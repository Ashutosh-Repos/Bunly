import { env } from "../env.js";

export const config = {
    appName: env.APP_NAME,
    appUrl: env.NEXT_PUBLIC_APP_URL || env.APP_URL,
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    corsOrigin: env.CORS_ORIGIN,
    publicWsUrl: env.PUBLIC_WS_URL || null,
    email: {
        from: env.EMAIL_FROM,
        brevoApiKey: env.BREVO_API_KEY,
    },
    upload: {
        presignedUrlExpiry: env.PRESIGNED_URL_EXPIRY,
        dbRecordExpiry: env.UPLOAD_DB_EXPIRY,
    },
    s3: {
        endpoint: env.AWS_S3_ENDPOINT,
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        bucket: env.AWS_S3_BUCKET_NAME,
        region: env.AWS_REGION,
        publicUrl: env.PUBLIC_S3_URL || null,
    },
    db: {
        url: env.DATABASE_URL,
    },
    redis: {
        url: env.REDIS_URL,
    },
    queue: {
        concurrency: env.TRANSCODER_CONCURRENCY,
        attempts: env.TRANSCODER_RETRIES,
    },
    // Node-specific settings for horizontal scaling
    nodeId: env.NODE_ID || env.HOSTNAME || `node-${process.pid}`,
};

export default config;

