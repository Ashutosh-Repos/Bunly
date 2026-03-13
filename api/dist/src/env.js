import { z } from "zod";
import * as dotenv from "dotenv";
dotenv.config();
const envSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.string().default("4000").transform((val) => parseInt(val, 10)),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url().default("redis://localhost:6379"),
    // Auth
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
    CORS_ORIGIN: z.string().url().default("http://localhost:3000"),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
    // Core App settings
    APP_NAME: z.string().default("Bunly"),
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
    APP_URL: z.string().url().default("http://localhost:3000"),
    PUBLIC_WS_URL: z.string().url().optional(),
    EMAIL_FROM: z.string().email().default("clashutosh04@gmail.com"),
    BREVO_API_KEY: z.string().optional(),
    // S3 Storage (MinIO)
    AWS_S3_ENDPOINT: z.string().url().default("http://localhost:9000"),
    AWS_ACCESS_KEY_ID: z.string().default("minioadmin"),
    AWS_SECRET_ACCESS_KEY: z.string().default("minioadmin"),
    AWS_S3_BUCKET_NAME: z.string().default("youtube-videos"),
    AWS_REGION: z.string().default("us-east-1"),
    PUBLIC_S3_URL: z.string().url().optional(),
    // Tuning and worker config
    PRESIGNED_URL_EXPIRY: z.string().default("3600").transform((val) => parseInt(val, 10)),
    UPLOAD_DB_EXPIRY: z.string().default("86400").transform((val) => parseInt(val, 10)),
    TRANSCODER_CONCURRENCY: z.string().default("2").transform((val) => parseInt(val, 10)),
    TRANSCODER_RETRIES: z.string().default("3").transform((val) => parseInt(val, 10)),
    // Worker identity (Horizontal scaling)
    NODE_ID: z.string().optional(),
    HOSTNAME: z.string().optional(),
    NEXT_PHASE: z.string().optional(), // Used to skip heavy init during Next.js build
});
const parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
    console.error("❌ Invalid API environment variables:", JSON.stringify(parsedEnv.error.format(), null, 2));
    process.exit(1);
}
export const env = parsedEnv.data;
