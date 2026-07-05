import { Redis } from "ioredis";
import config from "../env.js";

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates a fresh, dedicated Redis client.
 * Use this for blocking operations (XREADGROUP) or BullMQ connections
 * that need their own socket and won't disturb the shared client.
 *
 * NOTE: lazyConnect is OFF — every client connects eagerly on creation.
 * This avoids the ioredis race condition where the first command triggers
 * an implicit connect that can fail silently inside Lua/pipeline calls.
 */
export const createRedisClient = (isBullMQ = false): Redis => {
    const url = config.redis.url;
    const logUrl = url.replace(/\/\/.*@/, "//***:***@");
    console.log(
        `[Redis] Initializing ${isBullMQ ? "BullMQ" : "Stream"} client: ${logUrl}`,
    );

    return new Redis(url, {
        maxRetriesPerRequest: isBullMQ ? null : 3,
        retryStrategy(times) {
            if (times > 3) {
                console.error(
                    `[Redis] Connection failed after ${times} retries`,
                );
                return null;
            }
            return Math.min(times * 50, 2000);
        },
        connectTimeout: 5000,
        tls: url.startsWith("rediss")
            ? { rejectUnauthorized: false }
            : undefined,
    });
};

// ─── Shared singleton (for simple GET/SET/PIPELINE operations) ────────────────
const redis = createRedisClient(false);
export default redis;

// ─── BullMQ connection config (returns plain object, not a Redis instance) ────
export function getRedisConnection() {
    const url = config.redis.url;
    const base = { maxRetriesPerRequest: null as null }; // BullMQ requires null

    if (!url.startsWith("redis://") && !url.startsWith("rediss://")) {
        const [host, port] = url.split(":");
        return {
            ...base,
            host: host || "localhost",
            port: parseInt(port || "6379"),
        };
    }

    try {
        const u = new URL(url);
        return {
            ...base,
            host: u.hostname,
            port: parseInt(u.port || "6379"),
            username: u.username || undefined,
            password: u.password || undefined,
            tls: url.startsWith("rediss://")
                ? { rejectUnauthorized: false }
                : undefined,
        };
    } catch {
        console.warn("[Redis] Invalid URL, falling back to localhost");
        return { ...base, host: "localhost", port: 6379 };
    }
}
