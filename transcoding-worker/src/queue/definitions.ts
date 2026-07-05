import { Queue, QueueEvents } from "bullmq";
import { getRedisConnection } from "../lib/redis.js";

// ─── Queue Names ──────────────────────────────────────────────────────────────
export const QUEUES = {
    TRANSCODE: "transcode-queue",
} as const;

// ─── Job Names ────────────────────────────────────────────────────────────────
export const JOBS = {
    PROBE_AND_SPLIT: "probe-and-split",
    TRANSCODE_CHUNK: "transcode-chunk",
    MERGE_MANIFEST: "merge-manifest",
    GENERATE_THUMBNAILS: "generate-thumbnails",
    GENERATE_SPRITE: "generate-sprite",
    CONTENT_MODERATION: "content-moderation",
    SYNC_ENGAGEMENT: "sync-engagement",
    PUBLISH_SCHEDULED_VIDEO: "publish-scheduled-video",
    CLEANUP_VIDEO_ASSETS: "cleanup-video-assets",
} as const;

// ─── BullMQ Queue Instances ───────────────────────────────────────────────────
const REDIS_CONN = getRedisConnection();

export const transcodeQueue = new Queue(QUEUES.TRANSCODE, {
    connection: REDIS_CONN,
});

export const transcodeQueueEvents = new QueueEvents(QUEUES.TRANSCODE, {
    connection: { ...getRedisConnection() },
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
export async function closeQueues(): Promise<void> {
    await Promise.allSettled([
        transcodeQueue.close(),
        transcodeQueueEvents.close(),
    ]);
}
