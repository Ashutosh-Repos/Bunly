var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import redis from "../redis";
import { z } from "zod";
// Publisher client (existing redis connection)
export const redisPub = redis;
// --- Keys & Constants ---
export const REDIS_KEYS = {
    videoStatus: (videoId) => `video:${videoId}:status`,
    videoWsChannel: (videoId) => `video:${videoId}:ws`,
    videoMetadata: (videoId) => `video:${videoId}:meta`,
    videoProgressTracker: (videoId) => `video:${videoId}:progress:tracker`,
};
/**
 * Cache video status for fast API retrieval
 * TTL: 24 hours (sufficient for active uploads)
 */
export function cacheVideoStatus(videoId, status) {
    return __awaiter(this, void 0, void 0, function* () {
        const key = REDIS_KEYS.videoStatus(videoId);
        // Store as stringified JSON
        yield redis.setex(key, 86400, JSON.stringify(status));
    });
}
/**
 * Get cached status
 */
export function getCachedVideoStatus(videoId) {
    return __awaiter(this, void 0, void 0, function* () {
        const key = REDIS_KEYS.videoStatus(videoId);
        const data = yield redis.get(key);
        if (!data)
            return null;
        try {
            return JSON.parse(data);
        }
        catch (_a) {
            return null;
        }
    });
}
/**
 * Publish real-time update to WebSocket server via Redis Channel
 */
export const VideoStatusEventSchema = z.object({
    status: z.enum(["UPLOADING", "PROCESSING", "READY", "FAILED"]).optional(),
    progress: z.number().optional(),
    error: z.string().optional(),
    hlsUrl: z.string().optional(),
    thumbnails: z.array(z.string()).optional(),
    previewSprite: z.string().optional(),
    previewSpriteVtt: z.string().optional(),
    type: z.string().optional(), // "error", "completed", "update"
    visibility: z.string().optional(),
    publishedAt: z.date().optional(),
});
/**
 * Publish real-time update to WebSocket server via Redis Channel
 * Accepts strictly typed events.
 */
export function publishToVideoChannel(videoId, message) {
    return __awaiter(this, void 0, void 0, function* () {
        const channel = REDIS_KEYS.videoWsChannel(videoId);
        // Validate before publish (Double safety)
        const payload = JSON.stringify(message); // Already typed, but could use safeParse if we distrust caller
        yield redisPub.publish(channel, payload);
    });
}
/**
 * Cache video metadata (uploadId, ownerId) to skip DB on chunk uploads
 * TTL: 24 hours
 */
export function cacheVideoMetadata(videoId, metadata) {
    return __awaiter(this, void 0, void 0, function* () {
        const key = REDIS_KEYS.videoMetadata(videoId);
        yield redis.setex(key, 86400, JSON.stringify(metadata));
    });
}
/**
 * Get cached metadata
 */
export function getVideoMetadata(videoId) {
    return __awaiter(this, void 0, void 0, function* () {
        const key = REDIS_KEYS.videoMetadata(videoId);
        const data = yield redis.get(key);
        if (!data)
            return null;
        try {
            return JSON.parse(data);
        }
        catch (_a) {
            return null;
        }
    });
}
/**
 * Delete cached metadata
 */
export function deleteVideoMetadata(videoId) {
    return __awaiter(this, void 0, void 0, function* () {
        const key = REDIS_KEYS.videoMetadata(videoId);
        yield redis.del(key);
    });
}
/**
 * Delete aggregate progress tracker
 */
export function deleteAggregateTracker(videoId) {
    return __awaiter(this, void 0, void 0, function* () {
        const key = REDIS_KEYS.videoProgressTracker(videoId);
        yield redis.del(key);
    });
}
