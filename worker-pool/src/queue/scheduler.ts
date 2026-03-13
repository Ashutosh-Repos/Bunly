import { Worker, type Job } from "bullmq";
import { prisma } from "../lib/prisma.js";
import redis, { getRedisConnection } from "../lib/redis.js";
import { QUEUES, JOBS, STREAMS, schedulerQueue } from "./definitions.js";

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * SQL-based engagement scoring.
 * Targets only PUBLIC/READY videos from the last 30 days (or with views)
 * to avoid a full-table scan every 5 minutes.
 */
async function runScoring(): Promise<void> {
    const start = Date.now();
    console.log("[ScoringWorker] ⚙️  Running scoring pass...");
    try {
        await prisma.$executeRaw`
            UPDATE videos
            SET
                "engagementScore" = ((CAST("likeCount" AS float8) * 2.0) + (CAST("commentCount" AS float8) * 3.0))
                                    / GREATEST(CAST("viewCount" AS float8), 1.0),

                "trendingScore"   = CAST("viewCount" AS float8) / POWER(
                                        GREATEST(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - COALESCE("publishedAt", "createdAt"))) / 3600.0, 0.0) + 2.0,
                                        1.5),

                "hotScore"        = (
                                        ((CAST("likeCount" AS float8) * 2.0) + (CAST("commentCount" AS float8) * 3.0))
                                        / GREATEST(CAST("viewCount" AS float8), 1.0)
                                    ) * (
                                        CAST("viewCount" AS float8) / POWER(
                                            GREATEST(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - COALESCE("publishedAt", "createdAt"))) / 3600.0, 0.0) + 2.0,
                                            1.5)
                                    ),

                "lastScoredAt"    = CURRENT_TIMESTAMP
            WHERE
                visibility = 'PUBLIC'
                AND "processingStatus" = 'READY'
                AND "deletedAt" IS NULL
                AND (
                    "publishedAt" >= CURRENT_TIMESTAMP - INTERVAL '30 days'
                    OR ("viewCount" > 0 AND "publishedAt" >= CURRENT_TIMESTAMP - INTERVAL '90 days')
                )
        `;
        console.log(`[ScoringWorker] ✅ Done in ${Date.now() - start}ms`);
    } catch (err) {
        console.error("[ScoringWorker] ❌ Error:", err);
        throw err;
    }
}

// ─── Notification Cleanup ─────────────────────────────────────────────────────

async function runNotificationCleanup(): Promise<void> {
    console.log("[NotificationCleanup] 🧹 Running...");
    try {
        const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const result = await prisma.notifications.deleteMany({
            where: {
                createdAt: { lt: cutoff },
                OR: [{ isHidden: true }, { isRead: true }],
            },
        });
        console.log(
            `[NotificationCleanup] ✅ Deleted ${result.count} old hidden/read notifications`,
        );
    } catch (err) {
        console.error("[NotificationCleanup] ❌ Error:", err);
        throw err;
    }
}

// ─── Scheduled Publishing ─────────────────────────────────────────────────────

async function handlePublishScheduledVideo(job: Job): Promise<void> {
    const { videoId } = job.data as { videoId: string };
    console.log(`[Scheduler] 🚀 Publishing video: ${videoId}`);

    const video = await prisma.videos.findUnique({
        where: { id: videoId },
        select: {
            id: true,
            channelId: true,
            visibility: true,
            scheduledAt: true,
            processingStatus: true,
            title: true,
            thumbnailUrl: true,
            channels: { select: { name: true, handle: true } },
        },
    });

    if (!video) {
        console.warn(`[Scheduler] ⚠️ Video ${videoId} not found`);
        return;
    }
    if (video.processingStatus === "FAILED") {
        console.warn(`[Scheduler] ⚠️ Video ${videoId} is FAILED`);
        return;
    }
    if (video.visibility !== "SCHEDULED") {
        console.warn(
            `[Scheduler] ⚠️ Video ${videoId} not SCHEDULED (${video.visibility})`,
        );
        return;
    }
    if (!video.scheduledAt) {
        console.warn(`[Scheduler] ⚠️ Video ${videoId} has no scheduledAt`);
        return;
    }

    // Optimistic concurrency: only update if STILL scheduled and time is reached
    const result = await prisma.videos.updateMany({
        where: {
            id: videoId,
            visibility: "SCHEDULED",
            scheduledAt: { lte: new Date() },
        },
        data: {
            visibility: "PUBLIC",
            publishedAt: new Date(),
            scheduledAt: null,
        },
    });

    if (result.count === 0) {
        console.warn(
            `[Scheduler] ⚠️ Concurrent state change for ${videoId} — skipped`,
        );
        return;
    }

    console.log(`[Scheduler] ✅ Video ${videoId} is now PUBLIC`);

    // Update channel video count (best-effort)
    if (video.channelId) {
        await prisma.channels
            .update({
                where: { id: video.channelId },
                data: { videoCount: { increment: 1 } },
            })
            .catch((e: any) =>
                console.error(`[Scheduler] ⚠️ Channel stats update failed:`, e),
            );
    }

    // Fan-out new-video notification to subscriber stream (best-effort)
    if (video.channelId) {
        await redis
            .xadd(
                STREAMS.NEW_VIDEO_NOTIFICATIONS,
                "MAXLEN",
                "~",
                1_000_000,
                "*",
                "data",
                JSON.stringify({
                    channelId: video.channelId,
                    videoId,
                    title: video.title,
                    thumbnailUrl: video.thumbnailUrl,
                    channelName: video.channels.name,
                    channelHandle: video.channels.handle,
                }),
            )
            .catch((e) =>
                console.error(
                    `[Scheduler] ⚠️ NEW_VIDEO stream push failed:`,
                    e,
                ),
            );
    }

    console.log(`[Scheduler] 🎉 Done for ${videoId}`);
}

// ─── BullMQ Worker ────────────────────────────────────────────────────────────

export function startSchedulerWorker(): Worker {
    const worker = new Worker(
        QUEUES.SCHEDULER,
        async (job: Job) => {
            console.log(`[Scheduler] 🕰️ ${job.name} (id=${job.id})`);
            switch (job.name) {
                case JOBS.PUBLISH_SCHEDULED_VIDEO:
                    await handlePublishScheduledVideo(job);
                    break;
                case JOBS.SYNC_ENGAGEMENT:
                    await runScoring();
                    break;
                case JOBS.CLEANUP_NOTIFICATIONS:
                    await runNotificationCleanup();
                    break;
                default:
                    console.warn(`[Scheduler] Unknown job: ${job.name}`);
            }
        },
        {
            connection: getRedisConnection(),
            concurrency: 5,
            removeOnComplete: { count: 100, age: 3600 * 24 },
            removeOnFail: { count: 100, age: 3600 * 24 * 7 },
        },
    );

    worker.on("ready", () => console.log("[Scheduler] 🟢 Ready"));
    worker.on("error", (err) => console.error("[Scheduler] 🔴 Error:", err));
    worker.on("completed", (job) =>
        console.log(`[Scheduler] ✅ ${job.id} done`),
    );
    worker.on("failed", (job, err) =>
        console.error(`[Scheduler] ❌ Job ${job?.id} failed: ${err.message}`),
    );

    console.log("[Scheduler] Started — queue:", QUEUES.SCHEDULER);
    return worker;
}

// ─── Fan-out Worker ──────────────────────────────────────────────────────────

async function handleFanout(job: Job) {
    const { channelId, videoId, title, thumbnailUrl, channelName } = job.data;
    let cursor: string | undefined;
    const CHUNK = 1000;

    while (true) {
        const subs = await prisma.subscriptions.findMany({
            where: { channelId, notificationLevel: { not: "NONE" } },
            take: CHUNK,
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
            select: { id: true, subscriberId: true },
            orderBy: { id: "asc" },
        });
        
        if (!subs.length) break;
        cursor = subs[subs.length - 1].id;

        const subIds = subs.map((s: { subscriberId: string }) => s.subscriberId);

        // Check user-level notification_settings.newVideos opt-out
        const optedOut = await prisma.notification_settings.findMany({
            where: { userId: { in: subIds }, newVideos: false },
            select: { userId: true },
        });
        const optedOutSet = new Set(optedOut.map((o: { userId: string }) => o.userId));
        const eligible = subIds.filter((id: string) => !optedOutSet.has(id));

        if (eligible.length > 0) {
            await prisma.notifications.createMany({
                data: eligible.map((userId: string) => ({
                    userId,
                    type: "NEW_VIDEO",
                    title: `${channelName ?? "Someone"} uploaded a new video`,
                    message: title ?? "A channel you subscribed to uploaded a new video",
                    videoId,
                    channelId,
                    thumbnailUrl,
                    actionUrl: `/watch/${videoId}`,
                })),
                skipDuplicates: true, // Safety against retries
            });
        }

        if (subs.length < CHUNK) break; // Last page
    }
}

export function startFanoutWorker(): Worker {
    const worker = new Worker(
        QUEUES.NEW_VIDEO_FANOUT,
        async (job) => {
            if (job.name === JOBS.FANOUT_NEW_VIDEO) {
                await handleFanout(job);
            } else {
                console.warn(`[FanoutWorker] Unknown job: ${job.name}`);
            }
        },
        {
            connection: getRedisConnection(),
            concurrency: 5,
        },
    );

    worker.on("ready", () => console.log("[FanoutWorker] 🟢 Ready"));
    worker.on("error", (err) => console.error("[FanoutWorker] 🔴 Error:", err));
    worker.on("completed", (job) =>
        console.log(`[FanoutWorker] ✅ ${job.id} done`),
    );
    worker.on("failed", (job, err) =>
        console.error(`[FanoutWorker] ❌ Job ${job?.id} failed: ${err.message}`),
    );

    console.log("[FanoutWorker] Started — queue:", QUEUES.NEW_VIDEO_FANOUT);
    return worker;
}

// ─── Cron Job Registration ────────────────────────────────────────────────────

export async function registerRepeatableJobs(): Promise<void> {
    await schedulerQueue.add(
        JOBS.SYNC_ENGAGEMENT,
        {},
        {
            repeat: { pattern: "*/5 * * * *" },
            jobId: "cron:sync-engagement",
        },
    );

    await schedulerQueue.add(
        JOBS.CLEANUP_NOTIFICATIONS,
        {},
        {
            repeat: { pattern: "0 3 * * *" },
            jobId: "cron:cleanup-notifications",
        },
    );

    console.log("[Scheduler] 🗓️ Repeatable jobs registered");
}
