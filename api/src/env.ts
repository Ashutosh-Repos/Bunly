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
    BETTER_AUTH_URL: z
        .preprocess((val) => (val === "" ? undefined : val), z.string().url().optional())
        .default("http://localhost:4000"),
    CORS_ORIGIN: z
        .preprocess((val) => (val === "" ? undefined : val), z.string().optional())
        .default("http://localhost:3000")
        .transform((val) => {
            return val.split(",").map((o) => o.trim()).filter(Boolean);
        }),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
    
    // Core App settings
    APP_NAME: z.string().default("Bunly"),
    NEXT_PUBLIC_APP_URL: z
        .preprocess((val) => (val === "" ? undefined : val), z.string().url().optional()),
    APP_URL: z
        .preprocess((val) => (val === "" ? undefined : val), z.string().url().optional())
        .default("http://localhost:3000"),
    PUBLIC_WS_URL: z
        .preprocess((val) => (val === "" ? undefined : val), z.string().url().optional()),
    EMAIL_FROM: z.string().email().default("onlinecodelab@gmail.com"),
    BREVO_API_KEY: z.string().optional(),
    
    // S3-compatible Storage (Local: MinIO, Production: Railway Bucket)
    AWS_S3_ENDPOINT: z.string().url().default("http://localhost:9000"),
    AWS_ACCESS_KEY_ID: z.string().default("minioadmin"),
    AWS_SECRET_ACCESS_KEY: z.string().default("minioadmin"),
    AWS_S3_BUCKET_NAME: z.string().default("youtube-videos"),
    AWS_REGION: z.string().default("auto"),
    
    // Upload tuning
    PRESIGNED_URL_EXPIRY: z.string().default("3600").transform((val) => parseInt(val, 10)),
    UPLOAD_DB_EXPIRY: z.string().default("86400").transform((val) => parseInt(val, 10)),
    
    // Build detection
    NEXT_PHASE: z.string().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
    console.error(
        "❌ Invalid API environment variables:",
        JSON.stringify(parsedEnv.error.format(), null, 2)
    );
    process.exit(1);
}

export const env = parsedEnv.data;

