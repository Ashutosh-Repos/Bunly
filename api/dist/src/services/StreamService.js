var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import redis from "../lib/redis";
export class StreamService {
    /**
     * Add a view item to the "Fast Lane" buffer.
     * Uses HyperLogLog for unique counts and Atomic Counters for total views.
     */
    static addViewItem(videoId, ip, userAgent) {
        return __awaiter(this, void 0, void 0, function* () {
            // 1. Check uniqueness using standard Expiry Token
            // Key: view_lock:{videoId}:{ip}
            const lockKey = `view_lock:${videoId}:${ip}`;
            // Set the key only if it does not exist (NX), with a 12 hour expiry (EX 43200)
            const isNew = yield redis.set(lockKey, "1", "EX", 43200, "NX");
            if (isNew) {
                // 2. Increment buffer (Hash + Dirty Set)
                // Key: video:v:buf (Hash) -> Field: videoId
                // Key: video:v:dirty (Set) -> Member: videoId
                // Pipeline to ensure atomicity
                const pipeline = redis.pipeline();
                pipeline.hincrby("video:v:buf", videoId, 1);
                pipeline.sadd("video:v:dirty", videoId);
                yield pipeline.exec();
            }
        });
    }
    /**
     * Add a history item to the "Reliable Lane" stream.
     * Uses Redis Streams to queue updates for the background worker.
     * Also updates the "Session" cache for immediate read access (Hybrid Read).
     */
    static addHistoryItem(userId, videoId, seconds) {
        return __awaiter(this, void 0, void 0, function* () {
            const timestamp = Date.now();
            const pipeline = redis.pipeline();
            // 1. Update Session Cache (Hybrid Read)
            // Key: session:{userId}:{videoId}
            // Expires in 24 hours to keep Redis lean
            const sessionKey = `session:${userId}:${videoId}`;
            pipeline.set(sessionKey, JSON.stringify({
                watchedSeconds: seconds,
                lastWatchedAt: new Date(timestamp).toISOString(),
            }), "EX", 86400); // 1 day TTL
            // 2. Push to Stream (Write-Behind)
            // Key: queue:history
            // MaxLen approx 1000000 to prevent overflow if worker dies
            pipeline.xadd("queue:history", "MAXLEN", "~", 1000000, "*", "data", JSON.stringify({
                userId,
                videoId,
                seconds,
                timestamp,
            }));
            yield pipeline.exec();
        });
    }
    /**
     * Get merged history for Hybrid Read-Repair.
     * Combines DB history with active Redis session data.
     */
    static getMergedHistory(userId, videoId, dbHistory) {
        return __awaiter(this, void 0, void 0, function* () {
            const sessionKey = `session:${userId}:${videoId}`;
            const sessionData = yield redis.get(sessionKey);
            let merged = dbHistory ? Object.assign({}, dbHistory) : null;
            if (sessionData) {
                try {
                    const session = JSON.parse(sessionData);
                    const sessionSeconds = Number(session.watchedSeconds);
                    const sessionDate = new Date(session.lastWatchedAt);
                    if (!merged) {
                        merged = {
                            watchedSeconds: sessionSeconds,
                            lastWatchedAt: sessionDate,
                        };
                    }
                    else {
                        // Hybrid Merge: Take the one with later timestamp or higher seconds
                        if (sessionDate > merged.lastWatchedAt ||
                            sessionSeconds > merged.watchedSeconds) {
                            merged.watchedSeconds = Math.max(merged.watchedSeconds, sessionSeconds);
                            merged.lastWatchedAt =
                                sessionDate > merged.lastWatchedAt
                                    ? sessionDate
                                    : merged.lastWatchedAt;
                        }
                    }
                }
                catch (e) {
                    console.warn("Failed to parse session data", e);
                }
            }
            return merged;
        });
    }
    /**
     * Clear session cache for a specific video.
     * Called when removing a video from history.
     */
    static clearSession(userId, videoId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sessionKey = `session:${userId}:${videoId}`;
            yield redis.del(sessionKey);
        });
    }
    /**
     * Clear all session caches for a user.
     * Called when clearing all history.
     * Uses SCAN to find and delete keys iteratively to avoid blocking.
     */
    static clearAllSessions(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const match = `session:${userId}:*`;
            let cursor = "0";
            do {
                const [nextCursor, keys] = yield redis.scan(cursor, "MATCH", match, "COUNT", 100);
                cursor = nextCursor;
                if (keys.length > 0) {
                    yield redis.del(...keys);
                }
            } while (cursor !== "0");
        });
    }
    /**
     * Add a reaction (Like/Dislike) to the stream.
     * 1. Updates User Cache (Fast Lane Read) - TTL 24h
     * 2. Pushes to Redis Stream (Write Behind)
     */
    static addReaction(userId, videoId, type) {
        return __awaiter(this, void 0, void 0, function* () {
            const reactionKey = `user:reaction:${userId}:${videoId}`;
            const timestamp = Date.now();
            const pipeline = redis.pipeline();
            // 1. Update User Cache (Read-Your-Own-Write)
            // We set "REMOVE" explicitly so Hybrid Read knows the user intentionally removed it
            // even if DB still has the old record.
            if (type === "REMOVE") {
                pipeline.set(reactionKey, "REMOVE", "EX", 86400);
            }
            else {
                pipeline.set(reactionKey, type, "EX", 86400); // 24h TTL
            }
            // 2. Push to Stream
            pipeline.xadd("queue:engagement", "MAXLEN", "~", 1000000, "*", "data", JSON.stringify({
                userId,
                videoId,
                type,
                timestamp,
            }));
            yield pipeline.exec();
        });
    }
    /**
     * Get user's current reaction from Cache.
     * Used for Hybrid Read.
     */
    static getUserReaction(userId, videoId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const reactionKey = `user:reaction:${userId}:${videoId}`;
                const cached = yield redis.get(reactionKey);
                return cached;
            }
            catch (e) {
                console.warn("Failed to get user reaction from cache", e);
                return null; // Fallback to DB
            }
        });
    }
    /**
     * Add a subscription action to the stream.
     * 1. Updates Cache (Fast Lane Read) - TTL 30 days
     * 2. Pushes to Redis Stream (Write Behind)
     */
    static addSubscription(subscriberId, channelId, action) {
        return __awaiter(this, void 0, void 0, function* () {
            const subKey = `user:subscription:${subscriberId}:${channelId}`;
            const timestamp = Date.now();
            const pipeline = redis.pipeline();
            // 1. Update User Cache for immediate UI feedback. Long TTL because subscriptions are persistent.
            pipeline.set(subKey, action, "EX", 2592000); // 30 days
            // 2. Push to Stream for the worker
            pipeline.xadd("queue:subscriptions", "MAXLEN", "~", 1000000, "*", "data", JSON.stringify({
                subscriberId,
                channelId,
                action,
                timestamp,
            }));
            yield pipeline.exec();
        });
    }
    /**
     * Get user's current subscription status from Cache.
     * Returns "SUBSCRIBE" | "UNSUBSCRIBE" | null (if not in cache).
     */
    static getSubscriptionStatus(subscriberId, channelId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const subKey = `user:subscription:${subscriberId}:${channelId}`;
                const cached = yield redis.get(subKey);
                return cached;
            }
            catch (e) {
                console.warn("Failed to get subscription from cache", e);
                return null;
            }
        });
    }
}
