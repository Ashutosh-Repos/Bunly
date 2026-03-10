import { Queue, QueueEvents } from "bullmq";
import { getRedisConnection } from "./redis";
export const QUEUES = {
    TRANSCODE: "transcode-queue",
    ENGAGEMENT: "queue:engagement",
    NOTIFICATIONS: "queue:notifications",
    SCHEDULER: "scheduler-queue",
    HISTORY: "queue:history",
    COMMENT_ENGAGEMENT: "queue:comment-engagement",
    COMMENT_COUNT: "queue:comment-count",
};
export const FLOWS = {
    TRANSCODE_FLOW: "transcode-flow",
};
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
};
const REDIS_CONN = getRedisConnection();
export const transcodeQueue = new Queue(QUEUES.TRANSCODE, {
    connection: REDIS_CONN,
});
export const transcodeQueueEvents = new QueueEvents(QUEUES.TRANSCODE, {
    connection: REDIS_CONN,
});
export const schedulerQueue = new Queue(QUEUES.SCHEDULER, {
    connection: REDIS_CONN,
});
