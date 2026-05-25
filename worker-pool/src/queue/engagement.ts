import os from "os";
import { prisma } from "../lib/prisma.js";
import redis from "../lib/redis.js";
import { NotificationService } from "../services/NotificationService.js";
import {
    RedisStreamConsumer,
    type StreamMessage,
} from "../lib/StreamingConsumer.js";
import { STREAMS, JOBS, newVideoFanoutQueue } from "./definitions.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const GROUP = "engagement_workers";
const CONSUMER_BASE = `worker:${os.hostname()}:${process.pid}`;

const VIEW_LOCK = "lock:view-flush";
const VIEW_BUFFER = "video:v:buf";
const VIEW_DIRTY = "video:v:dirty";

// ─── View Flush ───────────────────────────────────────────────────────────────

/**
 * Atomically pops view counts from the Redis buffer.
 * Using Lua ensures we don't lose counts if the process crashes mid-flush.
 */
const VIEW_FLUSH_SCRIPT = `
local counts = {}
for i = 1, #KEYS do
  local val = redis.call('HGET', ARGV[1], KEYS[i])
  if val then
    table.insert(counts, KEYS[i])
    table.insert(counts, val)
    redis.call('HDEL', ARGV[1], KEYS[i])
    redis.call('SREM', ARGV[2], KEYS[i])
  else
    redis.call('SREM', ARGV[2], KEYS[i])
  end
end
return counts
`;

export async function flushViews(): Promise<void> {
    // Distributed lock: only one instance flushes at a time (15s matches legacy)
    const locked = await redis.set(VIEW_LOCK, "1", "EX", 15, "NX");
    if (!locked) return;

    try {
        const dirtyIds = await redis.smembers(VIEW_DIRTY);
        if (dirtyIds.length === 0) return;

        const CHUNK = 1_000;
        for (let i = 0; i < dirtyIds.length; i += CHUNK) {
            const chunk = dirtyIds.slice(i, i + CHUNK);
            const raw = (await redis.eval(
                VIEW_FLUSH_SCRIPT,
                chunk.length,
                ...chunk,
                VIEW_BUFFER,
                VIEW_DIRTY,
            )) as string[];
            if (!raw?.length) continue;

            const updates: { id: string; count: number }[] = [];
            for (let j = 0; j < raw.length; j += 2) {
                const id = raw[j];
                const count = parseInt(raw[j + 1], 10);
                if (/^[a-zA-Z0-9_-]+$/.test(id) && count > 0)
                    updates.push({ id, count });
            }
            if (!updates.length) continue;

            // Sort to prevent Postgres deadlocks during concurrent flush calls
            updates.sort((a, b) => a.id.localeCompare(b.id));
            const ids = updates.map((u) => u.id);
            const counts = updates.map((u) => u.count);

            await prisma.$executeRaw`
                UPDATE videos
                SET "viewCount" = "viewCount" + u.delta
                FROM UNNEST(${ids}::text[], ${counts}::int[]) AS u(id, delta)
                WHERE videos.id = u.id
            `;
            console.log(`[ViewFlush] Flushed ${updates.length} videos`);
        }
    } catch (err) {
        console.error("[ViewFlush] Error:", err);
    } finally {
        await redis.del(VIEW_LOCK);
    }
}

// ─── History Worker ───────────────────────────────────────────────────────────

async function handleHistoryBatch(
    messages: StreamMessage[],
    consumer: RedisStreamConsumer,
): Promise<void> {
    type Agg = {
        userId: string;
        videoId: string;
        watchedSeconds: number;
        lastWatchedAt: Date;
        heartbeatCount: number;
    };
    const aggMap = new Map<string, Agg>();
    const ids: string[] = [];

    for (const { id, fields } of messages) {
        ids.push(id);
        try {
            const data = JSON.parse(fields[1]);
            const key = `${data.userId}:${data.videoId}`;
            const ex = aggMap.get(key);
            if (!ex) {
                aggMap.set(key, {
                    userId: data.userId,
                    videoId: data.videoId,
                    watchedSeconds: data.seconds,
                    lastWatchedAt: new Date(data.timestamp),
                    heartbeatCount: 1,
                });
            } else {
                ex.heartbeatCount++;
                if (data.seconds > ex.watchedSeconds)
                    ex.watchedSeconds = data.seconds;
                const t = new Date(data.timestamp);
                if (t > ex.lastWatchedAt) ex.lastWatchedAt = t;
            }
        } catch {
            console.warn("[HistoryWorker] Bad message:", id);
        }
    }

    const batch = Array.from(aggMap.values());
    if (!batch.length) {
        await consumer.ack(...ids);
        return;
    }

    // Determine first-time views via batch fetch (not N+1)
    const existing = await prisma.watch_history.findMany({
        where: {
            OR: batch.map(({ userId, videoId }) => ({ userId, videoId })),
        },
        select: { userId: true, videoId: true },
    });
    const seenSet = new Set(
        existing.map((h: { userId: string; videoId: string }) => `${h.userId}:${h.videoId}`),
    );

    // FIX #3 & #4: Use raw SQL with GREATEST to never regress watchedSeconds,
    // and only increment watchCount for first-time views in this session.
    const CHUNK = 100;
    for (let i = 0; i < batch.length; i += CHUNK) {
        const s = batch.slice(i, i + CHUNK);

        // Separate new entries from updates
        const newEntries = s.filter(
            (v) => !seenSet.has(`${v.userId}:${v.videoId}`),
        );
        const existingEntries = s.filter((v) =>
            seenSet.has(`${v.userId}:${v.videoId}`),
        );

        const ops: any[] = [];

        // New entries: create with initial values
        for (const v of newEntries) {
            ops.push(
                prisma.watch_history.create({
                    data: {
                        userId: v.userId,
                        videoId: v.videoId,
                        watchedSeconds: v.watchedSeconds,
                        lastWatchedAt: v.lastWatchedAt,
                    },
                }),
            );
        }

        // Existing entries: use GREATEST for watchedSeconds, no watchCount bump for heartbeats
        if (existingEntries.length > 0) {
            const eUserIds = existingEntries.map((v) => v.userId);
            const eVideoIds = existingEntries.map((v) => v.videoId);
            const eSeconds = existingEntries.map((v) => v.watchedSeconds);
            const eTs = existingEntries.map(
                (v) => v.lastWatchedAt.toISOString(),
            );

            ops.push(
                prisma.$executeRaw`
                    UPDATE watch_history
                    SET
                        "watchedSeconds" = GREATEST("watchedSeconds", u.secs),
                        "lastWatchedAt"  = GREATEST("lastWatchedAt", u.ts::timestamptz),
                        "updatedAt"      = NOW()
                    FROM UNNEST(
                        ${eUserIds}::text[],
                        ${eVideoIds}::text[],
                        ${eSeconds}::int[],
                        ${eTs}::text[]
                    ) AS u(uid, vid, secs, ts)
                    WHERE watch_history."userId" = u.uid
                      AND watch_history."videoId" = u.vid
                `,
            );
        }

        if (ops.length > 0) {
            await prisma.$transaction(ops);
        }
    }

    // FIX #8: Invalidate history cache for all affected users
    const uniqueUserIds = [...new Set(batch.map((v) => v.userId))];
    const cachePipeline = redis.pipeline();
    for (const uid of uniqueUserIds) {
        cachePipeline.del(`user:${uid}:history`);
    }
    await cachePipeline.exec().catch((e) =>
        console.warn("[HistoryWorker] Cache invalidation warning:", e),
    );

    // ─── Interest scoring (tag, category, channel affinity) ───────────────

    type VidRow = { id: string; channelId: string; categoryId: string | null; tags: { id: string }[] };
    const vids: VidRow[] = await prisma.videos.findMany({
        where: { id: { in: [...new Set(batch.map((v) => v.videoId))] } },
        select: {
            id: true,
            channelId: true,
            categoryId: true,
            tags: { select: { id: true } },
        },
    }) as VidRow[];
    const vidMap = new Map(vids.map((v) => [v.id, v]));

    type IE = {
        type: "tag" | "category" | "channel";
        refId: string;
        userId: string;
        incScore: number;
        incWatchTime: number;
        incViewCount: number;
    };
    const iMap = new Map<string, IE>();

    for (const u of batch) {
        const vid = vidMap.get(u.videoId);
        if (!vid) continue;
        const isNew = !seenSet.has(`${u.userId}:${u.videoId}`);
        const addWT = u.heartbeatCount * 10;
        const addS = isNew ? 1.0 : 0.0;
        const addV = isNew ? 1 : 0;

        const acc = (type: IE["type"], refId: string) => {
            const k = `${u.userId}:${type}:${refId}`;
            const p = iMap.get(k);
            const w =
                type === "tag"
                    ? addS / Math.max(1, vid.tags.length)
                    : addS;
            iMap.set(k, {
                type,
                refId,
                userId: u.userId,
                incScore: (p?.incScore ?? 0) + w,
                incWatchTime: (p?.incWatchTime ?? 0) + addWT,
                incViewCount: (p?.incViewCount ?? 0) + addV,
            });
        };

        vid.tags.forEach((t) => acc("tag", t.id));
        if (vid.categoryId) acc("category", vid.categoryId);
        if (vid.channelId) acc("channel", vid.channelId);
    }

    // FIX #7 & #12: Use explicit switch for where clause, chunk upserts
    if (iMap.size > 0) {
        const interests = Array.from(iMap.values());
        const INTEREST_CHUNK = 50;
        for (let i = 0; i < interests.length; i += INTEREST_CHUNK) {
            const chunk = interests.slice(i, i + INTEREST_CHUNK);
            await prisma.$transaction(
                chunk.map((d) => {
                    const where = buildInterestWhere(d);
                    return prisma.user_interests.upsert({
                        where,
                        create: {
                            userId: d.userId,
                            ...(d.type === "tag" && { tagId: d.refId }),
                            ...(d.type === "category" && {
                                categoryId: d.refId,
                            }),
                            ...(d.type === "channel" && {
                                channelId: d.refId,
                            }),
                            score: Math.max(0.5, d.incScore),
                            watchTime: d.incWatchTime,
                            viewCount: Math.max(1, d.incViewCount),
                            lastSeenAt: new Date(),
                            firstSeenAt: new Date(),
                        },
                        update: {
                            score: { increment: d.incScore },
                            watchTime: { increment: d.incWatchTime },
                            viewCount: { increment: d.incViewCount },
                            lastSeenAt: new Date(),
                        },
                    });
                }),
            );
        }
    }

    await consumer.ack(...ids);
    console.log(`[HistoryWorker] Processed ${batch.length} entries`);
}

/** Build the correct compound unique `where` for user_interests upsert */
function buildInterestWhere(d: {
    type: string;
    userId: string;
    refId: string;
}) {
    switch (d.type) {
        case "tag":
            return {
                userId_tagId: { userId: d.userId, tagId: d.refId },
            };
        case "category":
            return {
                userId_categoryId: {
                    userId: d.userId,
                    categoryId: d.refId,
                },
            };
        case "channel":
            return {
                userId_channelId: {
                    userId: d.userId,
                    channelId: d.refId,
                },
            };
        default:
            throw new Error(`Unknown interest type: ${d.type}`);
    }
}

// ─── Video Engagement Worker ──────────────────────────────────────────────────

async function handleEngagementBatch(
    messages: StreamMessage[],
    consumer: RedisStreamConsumer,
): Promise<void> {
    type R = {
        userId: string;
        videoId: string;
        type: "LIKE" | "DISLIKE" | "REMOVE";
    };
    const ids: string[] = [];
    const raw: R[] = [];
    for (const { id, fields } of messages) {
        ids.push(id);
        try {
            raw.push(JSON.parse(fields[1]));
        } catch {
            console.warn("[EngagementWorker] Bad message:", id);
        }
    }
    if (!raw.length) {
        await consumer.ack(...ids);
        return;
    }

    const deduped = new Map<string, R>();
    for (const r of raw) deduped.set(`${r.userId}:${r.videoId}`, r);
    const pairs = Array.from(deduped.values());

    const existing = await prisma.video_reactions.findMany({
        where: {
            OR: pairs.map((p) => ({ userId: p.userId, videoId: p.videoId })),
        },
        select: { userId: true, videoId: true, type: true },
    });
    const exMap = new Map(
        existing.map((r: { userId: string; videoId: string; type: string }) => [`${r.userId}:${r.videoId}`, r.type]),
    );

    const deltas = new Map<string, { ld: number; dd: number }>();
    for (const r of pairs) {
        const prev = exMap.get(`${r.userId}:${r.videoId}`);
        const d = deltas.get(r.videoId) ?? { ld: 0, dd: 0 };
        if (r.type === "REMOVE") {
            if (prev === "LIKE") d.ld--;
            if (prev === "DISLIKE") d.dd--;
        } else if (r.type === "LIKE") {
            if (prev !== "LIKE") d.ld++;
            if (prev === "DISLIKE") d.dd--;
        } else {
            if (prev !== "DISLIKE") d.dd++;
            if (prev === "LIKE") d.ld--;
        }
        deltas.set(r.videoId, d);
    }

    const upserts = pairs
        .filter((r) => r.type !== "REMOVE")
        .map((r) =>
            prisma.video_reactions.upsert({
                where: {
                    videoId_userId: {
                        videoId: r.videoId,
                        userId: r.userId,
                    },
                },
                create: {
                    videoId: r.videoId,
                    userId: r.userId,
                    type: r.type as "LIKE" | "DISLIKE",
                },
                update: { type: r.type as "LIKE" | "DISLIKE" },
            }),
        );
    const removes = pairs
        .filter((r) => r.type === "REMOVE")
        .map((r) =>
            prisma.video_reactions.deleteMany({
                where: { videoId: r.videoId, userId: r.userId },
            }),
        );
    const da = Array.from(deltas.entries())
        .filter(([, d]) => d.ld !== 0 || d.dd !== 0)
        .map(([id, d]) => ({ id, ...d }));
    const countOps = da.length
        ? [
              prisma.$executeRaw`
                UPDATE videos SET
                    "likeCount"    = GREATEST(0, "likeCount"    + u.ld),
                    "dislikeCount" = GREATEST(0, "dislikeCount" + u.dd)
                FROM UNNEST(${da.map((u) => u.id)}::text[], ${da.map((u) => u.ld)}::int[], ${da.map((u) => u.dd)}::int[]) AS u(id, ld, dd)
                WHERE videos.id = u.id
            `,
          ]
        : [];

    await prisma.$transaction([...upserts, ...removes, ...countOps]);

    // FIX #9: Send LIKE notifications to video owners (best-effort)
    const newLikes = pairs.filter(
        (r) => r.type === "LIKE" && exMap.get(`${r.userId}:${r.videoId}`) !== "LIKE",
    );
    if (newLikes.length > 0) {
        const videoIds = [...new Set(newLikes.map((l) => l.videoId))];
        type VideoNotifRow = { id: string; title: string; thumbnailUrl: string | null; channels: { userId: string } };
        const videos: VideoNotifRow[] = await prisma.videos.findMany({
            where: { id: { in: videoIds } },
            select: {
                id: true,
                title: true,
                thumbnailUrl: true,
                channels: { select: { userId: true } },
            },
        }) as VideoNotifRow[];
        const videoMap = new Map(videos.map((v) => [v.id, v]));

        const notifOps: Promise<unknown>[] = [];
        for (const like of newLikes) {
            const video = videoMap.get(like.videoId);
            if (!video || video.channels.userId === like.userId) continue;

            notifOps.push(
                NotificationService.notify({
                    userId: video.channels.userId,
                    actorId: like.userId,
                    type: "VIDEO_LIKE",
                    title: "New Like",
                    message: `liked your video`,
                    videoId: like.videoId,
                    thumbnailUrl: video.thumbnailUrl || undefined,
                    actionUrl: `/watch/${like.videoId}`,
                    groupKey: `VIDEO_LIKE:${like.videoId}:${new Date().toISOString().slice(0, 10)}`,
                }).catch((e: unknown) =>
                    console.warn("[EngagementWorker] Notification error:", e),
                ),
            );
        }
        await Promise.allSettled(notifOps);
    }

    await consumer.ack(...ids);
    console.log(`[EngagementWorker] Processed ${ids.length} reactions`);
}

// ─── Comment Count Worker ─────────────────────────────────────────────────────

async function handleCommentCountBatch(
    messages: StreamMessage[],
    consumer: RedisStreamConsumer,
): Promise<void> {
    const ids: string[] = [];
    const vidDeltas = new Map<string, number>();
    const cmtDeltas = new Map<string, number>();

    for (const { id, fields } of messages) {
        ids.push(id);
        const data: Record<string, string> = {};
        for (let i = 0; i < fields.length; i += 2)
            data[fields[i]] = fields[i + 1];
        const entityId = data.entityId;
        const type = data.type ?? "video";
        const delta = parseInt(data.delta, 10);
        if (
            !entityId ||
            isNaN(delta) ||
            !/^[a-zA-Z0-9_-]+$/.test(entityId)
        )
            continue;
        if (type === "comment")
            cmtDeltas.set(
                entityId,
                (cmtDeltas.get(entityId) ?? 0) + delta,
            );
        else
            vidDeltas.set(
                entityId,
                (vidDeltas.get(entityId) ?? 0) + delta,
            );
    }

    // FIX #5: Wrap both updates in a single $transaction to prevent partial ACK
    const txOps: any[] = [];

    if (vidDeltas.size) {
        const vIds = [...vidDeltas.keys()];
        const vD = vIds.map((id) => vidDeltas.get(id)!);
        txOps.push(
            prisma.$executeRaw`
                UPDATE videos
                SET "commentCount" = GREATEST(0, "commentCount" + u.delta)
                FROM UNNEST(${vIds}::text[], ${vD}::int[]) AS u(id, delta)
                WHERE videos.id = u.id
            `,
        );
    }
    if (cmtDeltas.size) {
        const cIds = [...cmtDeltas.keys()];
        const cD = cIds.map((id) => cmtDeltas.get(id)!);
        txOps.push(
            prisma.$executeRaw`
                UPDATE comments
                SET "replyCount" = GREATEST(0, "replyCount" + u.delta)
                FROM UNNEST(${cIds}::text[], ${cD}::int[]) AS u(id, delta)
                WHERE comments.id = u.id
            `,
        );
    }

    if (txOps.length > 0) {
        await prisma.$transaction(txOps);
    }

    await consumer.ack(...ids);
    console.log(`[CommentCountWorker] ${ids.length} events`);
}

// ─── Comment Engagement Worker ────────────────────────────────────────────────

async function handleCommentEngagementBatch(
    messages: StreamMessage[],
    consumer: RedisStreamConsumer,
): Promise<void> {
    type CR = {
        userId: string;
        commentId: string;
        videoId: string;
        type: "LIKE" | "DISLIKE" | "REMOVE";
    };
    const ids: string[] = [];
    const raw: CR[] = [];
    for (const { id, fields } of messages) {
        ids.push(id);
        try {
            raw.push(JSON.parse(fields[1]));
        } catch {
            console.warn("[CommentEngagementWorker] Bad message:", id);
        }
    }
    if (!raw.length) {
        await consumer.ack(...ids);
        return;
    }

    const ded = new Map<string, CR>();
    for (const r of raw) ded.set(`${r.userId}:${r.commentId}`, r);
    const pairs = Array.from(ded.values());

    const existing = await prisma.comment_reactions.findMany({
        where: {
            OR: pairs.map((p) => ({
                commentId: p.commentId,
                userId: p.userId,
            })),
        },
        select: { commentId: true, userId: true, type: true },
    });
    const exMap = new Map(
        existing.map((r: { userId: string; commentId: string; type: string }) => [`${r.userId}:${r.commentId}`, r.type]),
    );

    const deltas = new Map<string, { ld: number; dd: number }>();
    for (const r of pairs) {
        const prev = exMap.get(`${r.userId}:${r.commentId}`);
        const d = deltas.get(r.commentId) ?? { ld: 0, dd: 0 };
        if (r.type === "REMOVE") {
            if (prev === "LIKE") d.ld--;
            if (prev === "DISLIKE") d.dd--;
        } else if (r.type === "LIKE") {
            if (prev !== "LIKE") d.ld++;
            if (prev === "DISLIKE") d.dd--;
        } else {
            if (prev !== "DISLIKE") d.dd++;
            if (prev === "LIKE") d.ld--;
        }
        deltas.set(r.commentId, d);
    }

    const upserts = pairs
        .filter((r) => r.type !== "REMOVE")
        .map((r) =>
            prisma.comment_reactions.upsert({
                where: {
                    commentId_userId: {
                        commentId: r.commentId,
                        userId: r.userId,
                    },
                },
                create: {
                    commentId: r.commentId,
                    userId: r.userId,
                    type: r.type as "LIKE" | "DISLIKE",
                },
                update: { type: r.type as "LIKE" | "DISLIKE" },
            }),
        );
    const removes = pairs
        .filter((r) => r.type === "REMOVE")
        .map((r) =>
            prisma.comment_reactions.deleteMany({
                where: { commentId: r.commentId, userId: r.userId },
            }),
        );
    const da = Array.from(deltas.entries())
        .filter(([, d]) => d.ld !== 0 || d.dd !== 0)
        .map(([id, d]) => ({ id, ...d }));
    const countOps = da.length
        ? [
              prisma.$executeRaw`
                UPDATE comments SET
                    "likeCount"    = GREATEST(0, "likeCount"    + u.ld),
                    "dislikeCount" = GREATEST(0, "dislikeCount" + u.dd)
                FROM UNNEST(${da.map((u) => u.id)}::text[], ${da.map((u) => u.ld)}::int[], ${da.map((u) => u.dd)}::int[]) AS u(id, ld, dd)
                WHERE comments.id = u.id
            `,
          ]
        : [];

    await prisma.$transaction([...upserts, ...removes, ...countOps]);
    await consumer.ack(...ids);
    console.log(`[CommentEngagementWorker] Processed ${ids.length} events`);
}

// ─── New Video Notification Fan-out ───────────────────────────────────────────

async function handleNewVideoStreamBatch(
    messages: StreamMessage[],
    consumer: RedisStreamConsumer,
): Promise<void> {
    const ids: string[] = [];
    for (const { id, fields } of messages) {
        ids.push(id);
        try {
            const raw = fields[1];
            const data = JSON.parse(raw);
            const { videoId } = data;

            if (!videoId) continue;

            // Dedup: We rely EXCLUSIVELY on BullMQ's native deduplication mechanism
            // via the `jobId` parameter. Doing a `redis.set NX` here would swallow
            // retries in the event of a worker crash between Redis success and BullMQ enqueue.
            await newVideoFanoutQueue.add(JOBS.FANOUT_NEW_VIDEO, data, {
                jobId: `fanout-${videoId}`, 
            });
        } catch (err) {
            console.warn("[NewVideoWorker] Bad message:", id, err);
        }
    }
    
    if (ids.length > 0) {
        await consumer.ack(...ids);
        console.log(`[NewVideoWorker] Dispatched ${ids.length} fanout jobs`);
    }
}

// ─── Subscription Write-Behind Worker ────────────────────────────────────────

/**
 * Processes subscription events from the "queue:subscriptions" stream.
 * Performs the actual DB writes (upsert subscription, update subscriberCount)
 * and fires the NEW_SUBSCRIBER notification. Handles both SUBSCRIBE and UNSUBSCRIBE.
 */
async function handleSubscriptionBatch(
    messages: StreamMessage[],
    consumer: RedisStreamConsumer,
): Promise<void> {
    const ids: string[] = [];

    for (const { id, fields } of messages) {
        ids.push(id);
        try {
            const raw = fields[1];
            const data = JSON.parse(raw) as {
                subscriberId: string;
                channelId: string;
                action: "SUBSCRIBE" | "UNSUBSCRIBE";
            };

            const { subscriberId, channelId, action } = data;

            if (action === "SUBSCRIBE") {
                // Upsert: create if not exists (idempotent on duplicates via P2002 catch)
                try {
                    await prisma.subscriptions.create({ data: { subscriberId, channelId } });
                } catch (e: any) {
                    if (e.code !== "P2002") throw e; // ignore duplicate
                }

                // Recount atomically from source of truth
                await prisma.$executeRaw`
                    UPDATE channels
                    SET "subscriberCount" = (
                        SELECT COUNT(*) FROM subscriptions WHERE "channelId" = ${channelId}
                    )
                    WHERE id = ${channelId}
                `;

                // Fire notification (non-blocking, worker handles retries)
                const channel = await prisma.channels.findUnique({
                    where: { id: channelId },
                    select: { userId: true, handle: true, name: true },
                });

                // [SETTINGS FIX] Respect user's UI toggle preference preventing UI spam
                // Fire notification using consolidated NotificationService
                if (channel && channel.userId !== subscriberId) {
                    await NotificationService.notify({
                        userId: channel.userId,
                        actorId: subscriberId,
                        type: "NEW_SUBSCRIBER",
                        title: "New Subscriber",
                        message: "subscribed to your channel",
                        channelId,
                        actionUrl: `/@${channel.handle}`,
                        groupKey: `NEW_SUBSCRIBER:${channelId}:${new Date().toISOString().slice(0, 10)}`,
                    }).catch((e: unknown) =>
                        console.warn("[SubscriptionWorker] Notification error:", e),
                    );
                }
            } else {
                // UNSUBSCRIBE: delete + recount atomically
                await prisma.subscriptions.deleteMany({ where: { subscriberId, channelId } });
                await prisma.$executeRaw`
                    UPDATE channels
                    SET "subscriberCount" = GREATEST(0, (
                        SELECT COUNT(*) FROM subscriptions WHERE "channelId" = ${channelId}
                    ))
                    WHERE id = ${channelId}
                `;
            }
        } catch (err) {
            console.warn("[SubscriptionWorker] Failed to process message:", id, err);
        }
    }

    if (ids.length > 0) {
        await consumer.ack(...ids);
        console.log(`[SubscriptionWorker] Processed ${ids.length} subscription events`);
    }
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export function startEngagementWorkers(): () => void {
    const mk = (stream: string, suffix: string) =>
        new RedisStreamConsumer({
            streamKey: stream,
            groupName: GROUP,
            consumerName: `${CONSUMER_BASE}:${suffix}`,
            pendingMaxAgeMs: 60_000,
        });

    const history = mk(STREAMS.HISTORY, "history");
    const engagement = mk(STREAMS.ENGAGEMENT, "engagement");
    const commentCount = mk(STREAMS.COMMENT_COUNT, "comment-count");
    const commentEngagement = mk(
        STREAMS.COMMENT_ENGAGEMENT,
        "comment-engagement",
    );
    const newVideo = mk(STREAMS.NEW_VIDEO_NOTIFICATIONS, "new-video");
    const subscriptions = mk(STREAMS.SUBSCRIPTIONS, "subscriptions");

    // Consumers auto-restart on fatal errors (handled in StreamingConsumer)
    history
        .run((msgs) => handleHistoryBatch(msgs, history))
        .catch((e) => console.error("[HistoryWorker] Fatal:", e));
    engagement
        .run((msgs) => handleEngagementBatch(msgs, engagement))
        .catch((e) => console.error("[EngagementWorker] Fatal:", e));
    commentCount
        .run((msgs) => handleCommentCountBatch(msgs, commentCount))
        .catch((e) => console.error("[CommentCountWorker] Fatal:", e));
    commentEngagement
        .run((msgs) => handleCommentEngagementBatch(msgs, commentEngagement))
        .catch((e) =>
            console.error("[CommentEngagementWorker] Fatal:", e),
        );
    newVideo
        .run((msgs) => handleNewVideoStreamBatch(msgs, newVideo))
        .catch((e) => console.error("[NewVideoWorker] Fatal:", e));
    subscriptions
        .run((msgs) => handleSubscriptionBatch(msgs, subscriptions))
        .catch((e) => console.error("[SubscriptionWorker] Fatal:", e));

    const flushInterval = setInterval(flushViews, 10_000);
    flushViews().catch((e) =>
        console.error("[ViewFlush] Startup error:", e),
    );

    console.log("[EngagementWorkers] All 6 stream consumers started");

    return () => {
        clearInterval(flushInterval);
        history.stop();
        engagement.stop();
        commentCount.stop();
        commentEngagement.stop();
        newVideo.stop();
        subscriptions.stop();
        console.log("[EngagementWorkers] Stopped");
    };
}
