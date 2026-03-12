import * as dotenv from "dotenv";
dotenv.config();

export const config = {
    appName: process.env.APP_NAME || "Bunly",
    appUrl: process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000",
    port: parseInt(process.env.PORT || "4000"),
    nodeEnv: process.env.NODE_ENV || "development",
    corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
    publicWsUrl: process.env.PUBLIC_WS_URL || null,
    upload: {
        presignedUrlExpiry: parseInt(
            process.env.PRESIGNED_URL_EXPIRY || "3600",
        ), // 1 hour for part URLs
        dbRecordExpiry: parseInt(process.env.UPLOAD_DB_EXPIRY || "86400"), // 24 hours for the video record
    },
    s3: {
        endpoint: process.env.AWS_S3_ENDPOINT || "http://localhost:9000",
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "minioadmin",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "minioadmin",
        bucket: process.env.AWS_S3_BUCKET_NAME || "youtube-videos",
        region: process.env.AWS_REGION || "us-east-1",
        // Public URL for browser-facing presigned URLs (Railway deployment)
        publicUrl: process.env.PUBLIC_S3_URL || null,
    },
    redis: {
        url: process.env.REDIS_URL || "redis://localhost:6379",
    },
    queue: {
        concurrency: parseInt(process.env.TRANSCODER_CONCURRENCY || "2"),
        attempts: parseInt(process.env.TRANSCODER_RETRIES || "3"),
    },
    // Node-specific settings for horizontal scaling
    nodeId:
        process.env.NODE_ID || process.env.HOSTNAME || `node-${process.pid}`,
};

export default config;
