import { Queue } from "bullmq";
import { getRedisConnection } from "../lib/redis.js";

// ─── BullMQ Queue Names ───────────────────────────────────────────────────────
export const QUEUES = {
    EMAIL: "email-queue",
    SCHEDULER: "scheduler-queue",
    NEW_VIDEO_FANOUT: "new-video-fanout-queue",
} as const;

// ─── Redis Stream Keys (Native Streams — not BullMQ) ─────────────────────────
export const STREAMS = {
    HISTORY: "queue:history",
    ENGAGEMENT: "queue:engagement",
    COMMENT_ENGAGEMENT: "queue:comment-engagement",
    COMMENT_COUNT: "queue:comment-count",
    NEW_VIDEO_NOTIFICATIONS: "queue:new-video-notifications",
    SUBSCRIPTIONS: "queue:subscriptions",
    NOTIFICATIONS: "queue:notifications",
} as const;

// ─── Job Names ────────────────────────────────────────────────────────────────
export const JOBS = {
    PUBLISH_SCHEDULED_VIDEO: "publish-scheduled-video",
    SYNC_ENGAGEMENT: "sync-engagement",
    CLEANUP_NOTIFICATIONS: "cleanup-notifications",
    FANOUT_NEW_VIDEO: "fanout-new-video",
} as const;

// ─── BullMQ Queue Instances ───────────────────────────────────────────────────
export const schedulerQueue = new Queue(QUEUES.SCHEDULER, {
    connection: getRedisConnection(),
    defaultJobOptions: {
        removeOnComplete: { count: 100, age: 3600 * 24 },
        removeOnFail: { count: 100, age: 3600 * 24 * 7 },
    },
});

export const emailQueue = new Queue(QUEUES.EMAIL, {
    connection: getRedisConnection(),
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
    },
});

export const newVideoFanoutQueue = new Queue(QUEUES.NEW_VIDEO_FANOUT, {
    connection: getRedisConnection(),
    defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 10000 },
        removeOnComplete: { count: 1000, age: 3600 * 24 * 7 }, // Keep longer for debugging fanouts
        removeOnFail: { count: 1000, age: 3600 * 24 * 14 },
    },
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
export async function closeQueues(): Promise<void> {
    await Promise.allSettled([
        schedulerQueue.close(),
        emailQueue.close(),
        newVideoFanoutQueue.close(),
    ]);
}
