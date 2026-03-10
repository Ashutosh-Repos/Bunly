import { Redis } from "ioredis";
import { env } from "../env.js";
const globalForRedis = global;
export const redisUrl = env.REDIS_URL;
const createRedisClient = (isBullMQ = false) => {
    // Obfuscate sensitive part for logging
    const logUrl = redisUrl.replace(/\/\/.*@/, "//***:***@");
    console.log(`[Redis] Initializing ${isBullMQ ? "BullMQ" : "Cache"} client with: ${logUrl}`);
    return new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: isBullMQ ? null : 3, // BullMQ strictly requires null
        retryStrategy(times) {
            if (times > 3) {
                console.error(`[Redis] ${isBullMQ ? "BullMQ" : "Cache"} connection failed after 3 retries`);
                return null;
            }
            return Math.min(times * 50, 2000);
        },
        connectTimeout: 5000,
        // Only use TLS if protocol is rediss://
        tls: redisUrl.startsWith("rediss")
            ? { rejectUnauthorized: false }
            : undefined,
    });
};
const redis = process.env.NODE_ENV === "production"
    ? createRedisClient(false)
    : (() => {
        if (!globalForRedis.redis ||
            globalForRedis.redisUrl !== redisUrl) {
            if (globalForRedis.redis) {
                console.log("[Redis] URL changed or HMR trigger, disconnecting old Cache client...");
                globalForRedis.redis.disconnect();
            }
            globalForRedis.redis = createRedisClient(false);
            globalForRedis.redisUrl = redisUrl;
        }
        return globalForRedis.redis;
    })();
// Separated Dedicated BullMQ Connection
export const bullMQRedis = createRedisClient(true);
export function getRedisConnection() {
    const urlStr = redisUrl || "redis://localhost:6379";
    // If it doesn't start with redis://, assume host:port or just host
    if (!urlStr.startsWith("redis://") && !urlStr.startsWith("rediss://")) {
        const [host, port] = urlStr.split(":");
        return {
            host: host || "localhost",
            port: parseInt(port || "6379"),
        };
    }
    try {
        const url = new URL(urlStr);
        return {
            host: url.hostname,
            port: parseInt(url.port || "6379"),
            username: url.username || undefined,
            password: url.password || undefined,
            // BullMQ needs TLS config if using rediss:// protocol
            tls: urlStr.startsWith("rediss://")
                ? { rejectUnauthorized: false }
                : undefined,
        };
    }
    catch (e) {
        console.warn("Invalid Redis URL, falling back to localhost", e);
        return { host: "localhost", port: 6379 };
    }
}
export default redis;
