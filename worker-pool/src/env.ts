import { z } from "zod";
import * as dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    // Core infrastructure
    REDIS_URL: z.string().url().default("redis://localhost:6379"),
    DATABASE_URL: z.string().url(),
    // Email (Brevo)
    BREVO_API_KEY: z.string(),
    APP_NAME: z.string().default("Bunly"),
    EMAIL_FROM: z.string().default("no-reply@bunly.app"),
    // Worker identity
    NODE_ID: z.string().optional(),
    HOSTNAME: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error("❌ Invalid environment variables:", parsed.error.format());
    process.exit(1);
}

export const config = {
    nodeEnv: parsed.data.NODE_ENV,
    redis: { url: parsed.data.REDIS_URL },
    db: { url: parsed.data.DATABASE_URL },
    email: {
        apiKey: parsed.data.BREVO_API_KEY,
        appName: parsed.data.APP_NAME,
        from: parsed.data.EMAIL_FROM,
    },
    nodeId: parsed.data.NODE_ID || parsed.data.HOSTNAME || `node-${process.pid}`,
};

export default config;
