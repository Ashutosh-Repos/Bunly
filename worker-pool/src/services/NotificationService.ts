import { prisma } from "../lib/prisma.js";
import redis from "../lib/redis.js";
import { NotificationType } from "@prisma/client";

export class NotificationService {
    private static CHANNEL_PREFIX = "user:notifications";

    static getChannel(userId: string) {
        return `${this.CHANNEL_PREFIX}:${userId}`;
    }

    /**
     * Map notification type to the corresponding setting field.
     * YouTube-style: users can opt out of specific notification categories.
     */
    private static SETTING_MAP: Partial<
        Record<
            NotificationType,
            "newVideos" | "liveStreams" | "comments" | "replies" | "likes" | "subscribers"
        >
    > = {
        NEW_VIDEO: "newVideos",
        COMMENT: "comments",
        COMMENT_REPLY: "replies",
        COMMENT_LIKE: "likes",
        VIDEO_LIKE: "likes",
        NEW_SUBSCRIBER: "subscribers",
        LIVE_STARTED: "liveStreams",
        LIVE_SCHEDULED: "liveStreams",
        SYSTEM: undefined, // System notifications cannot be opted out of
    };

    /**
     * Process a notification.
     * In the worker-pool, this handles the terminal state:
     * 1. Aggregates if possible.
     * 2. Creates if not.
     * 3. Publishes to Redis for real-time delivery.
     */
    static async notify(data: {
        userId: string;
        actorId?: string;
        type: NotificationType;
        title: string;
        message: string;
        videoId?: string;
        commentId?: string;
        channelId?: string;
        thumbnailUrl?: string;
        actionUrl?: string;
        metadata?: any;
        groupKey?: string;
    }) {
        // [REAL-TIME & AGGREGATION HARDENING]
        // If the worker is processing, we try to aggregate FIRST.
        
        if (!data.groupKey) {
            return this._processTerminal(data);
        }

        // Distributed lock for safe aggregation in concurrent workers
        const lockKey = `lock:notify:${data.userId}:${data.groupKey}`;
        const acquired = await redis.set(lockKey, "1", "EX", 15, "NX").catch(() => null);

        if (!acquired) {
            // Another worker is likely aggregating this — since we are in the worker stream,
            // we could either wait or just let the current record be created separately.
            // For hardening, we'll wait briefly.
            return this._processTerminal(data);
        }

        try {
            return await this._processTerminal(data);
        } finally {
            await redis.del(lockKey).catch(() => {});
        }
    }

    private static async _processTerminal(data: {
        userId: string;
        actorId?: string;
        type: NotificationType;
        title: string;
        message: string;
        videoId?: string;
        commentId?: string;
        channelId?: string;
        thumbnailUrl?: string;
        actionUrl?: string;
        metadata?: any;
        groupKey?: string;
    }) {
        // Prevent self-notifications
        if (data.actorId && data.actorId === data.userId) return;

        // Check user notification settings
        const settingField = this.SETTING_MAP[data.type];
        if (settingField) {
            try {
                const settings = await prisma.notification_settings.findUnique({
                    where: { userId: data.userId },
                    select: { [settingField]: true },
                });
                if (settings && settings[settingField] === false) {
                    return;
                }
            } catch (err) {
                console.warn("[Notification] Failed to check settings", err);
            }
        }

        // Aggregation logic
        if (data.groupKey) {
            try {
                const existing = await prisma.notifications.findFirst({
                    where: {
                        userId: data.userId,
                        groupKey: data.groupKey,
                        createdAt: {
                            gt: new Date(Date.now() - 60 * 60 * 1000), // 1-hour window
                        },
                    },
                    select: { id: true, groupCount: true },
                });

                if (existing) {
                    const updated = await prisma.notifications.update({
                        where: { id: existing.id },
                        data: {
                            groupCount: existing.groupCount + 1,
                            actorId: data.actorId || undefined,
                            isRead: false,
                            readAt: null,
                            createdAt: new Date(),
                        },
                        include: {
                            user_notifications_actorIdTouser: {
                                select: { id: true, name: true, image: true },
                            },
                        },
                    });

                    await redis.publish(this.getChannel(data.userId), JSON.stringify(updated)).catch(() => {});
                    return updated;
                }
            } catch (err) {
                console.warn("[Notification] Aggregation failed", err);
            }
        }

        // Direct Creation (Terminal State)
        try {
            const record = await prisma.notifications.create({
                data: {
                    userId: data.userId,
                    actorId: data.actorId,
                    type: data.type,
                    title: data.title,
                    message: data.message,
                    videoId: data.videoId,
                    commentId: data.commentId,
                    channelId: data.channelId,
                    thumbnailUrl: data.thumbnailUrl,
                    actionUrl: data.actionUrl,
                    metadata: data.metadata || undefined,
                    groupKey: data.groupKey || undefined,
                },
                include: {
                    user_notifications_actorIdTouser: {
                        select: { id: true, name: true, image: true },
                    },
                },
            });

            await redis.publish(this.getChannel(data.userId), JSON.stringify(record)).catch(() => {});
            return record;
        } catch (err) {
            console.error("[Notification] Final insert failed", err);
        }
    }
}
