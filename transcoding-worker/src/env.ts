import { z } from "zod";
import * as dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
    NODE_ENV: z
        .enum(["development", "production", "test"])
        .default("development"),
    DATABASE_URL: z.string().url(),
    // Redis infrastructure
    REDIS_URL: z.string().url().default("redis://localhost:6379"),
    // S3 Storage infrastructure
    AWS_S3_ENDPOINT: z.string().url().default("http://localhost:9000"),
    AWS_ACCESS_KEY_ID: z.string().default("minioadmin"),
    AWS_SECRET_ACCESS_KEY: z.string().default("minioadmin"),
    AWS_S3_BUCKET_NAME: z.string().default("youtube-videos"),
    AWS_REGION: z.string().default("us-east-1"),
    // Transcoder specific configs
    TRANSCODER_CONCURRENCY: z
        .string()
        .transform((val) => parseInt(val, 10))
        .default("2" as unknown as number),
    TRANSCODER_RETRIES: z
        .string()
        .transform((val) => parseInt(val, 10))
        .default(3),
    TEMP_DIR: z.string().default("/tmp/transcoder"),
    NODE_ID: z.string().optional(),
    HOSTNAME: z.string().optional(),
    HW_ACCEL: z
        .enum(["none", "nvenc", "videotoolbox", "vaapi"])
        .default("none"),
    // Tuning
    PROGRESS_THROTTLE_MS: z
        .string()
        .transform((val) => parseInt(val, 10))
        .default("5000" as unknown as number),
    CLEANUP_INTERVAL_MS: z
        .string()
        .transform((val) => parseInt(val, 10))
        .default("900000" as unknown as number),
    MAX_TEMP_AGE_MS: z
        .string()
        .transform((val) => parseInt(val, 10))
        .default("7200000" as unknown as number),
    DOWNLOAD_TIMEOUT_MS: z
        .string()
        .transform((val) => parseInt(val, 10))
        .default("1800000" as unknown as number),
    JOB_LOCK_DURATION_MS: z
        .string()
        .transform((val) => parseInt(val, 10))
        .default("1800000" as unknown as number),
    FILE_WAIT_TIMEOUT_MS: z
        .string()
        .transform((val) => parseInt(val, 10))
        .default("1800000" as unknown as number),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
    console.error(
        "❌ Invalid Transcoder environment variables:",
        parsedEnv.error.format(),
    );
    process.exit(1);
}

// Convert parsed schema to semantic object shape similar to old config
export const config = {
    nodeEnv: parsedEnv.data.NODE_ENV,
    db: {
        url: parsedEnv.data.DATABASE_URL,
    },
    redis: {
        url: parsedEnv.data.REDIS_URL,
    },
    s3: {
        endpoint: parsedEnv.data.AWS_S3_ENDPOINT,
        accessKeyId: parsedEnv.data.AWS_ACCESS_KEY_ID,
        secretAccessKey: parsedEnv.data.AWS_SECRET_ACCESS_KEY,
        bucket: parsedEnv.data.AWS_S3_BUCKET_NAME,
        region: parsedEnv.data.AWS_REGION,
    },
    queue: {
        concurrency: parsedEnv.data.TRANSCODER_CONCURRENCY,
        attempts: parsedEnv.data.TRANSCODER_RETRIES,
    },
    tempDir: parsedEnv.data.TEMP_DIR,
    nodeId:
        parsedEnv.data.NODE_ID ||
        parsedEnv.data.HOSTNAME ||
        `node-${process.pid}`,
    hwAccel: parsedEnv.data.HW_ACCEL,
    progressThrottleMs: parsedEnv.data.PROGRESS_THROTTLE_MS,
    cleanupIntervalMs: parsedEnv.data.CLEANUP_INTERVAL_MS,
    maxTempAgeMs: parsedEnv.data.MAX_TEMP_AGE_MS,
    lock: {
        ttlSeconds: 120, // 2 minutes (short TTL, refreshed via heartbeat)
        heartbeatIntervalMs: 30000, // Refresh every 30 seconds
    },
    downloadTimeoutMs: parsedEnv.data.DOWNLOAD_TIMEOUT_MS,
    jobLockDurationMs: parsedEnv.data.JOB_LOCK_DURATION_MS,
    fileWaitTimeoutMs: parsedEnv.data.FILE_WAIT_TIMEOUT_MS,
};

export default config;
