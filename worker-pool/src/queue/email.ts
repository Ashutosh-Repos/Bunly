import { Worker, type Job } from "bullmq";
import { getRedisConnection } from "../lib/redis.js";
import { QUEUES } from "./definitions.js";
import config from "../env.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmailJobData {
    to: string;
    subject: string;
    html: string;
}

// ─── Brevo Transport ──────────────────────────────────────────────────────────

async function sendViaBrevo(data: EmailJobData): Promise<void> {
    const { apiKey, appName, from } = config.email;

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
            "api-key": apiKey,
            "content-type": "application/json",
            accept: "application/json",
        },
        body: JSON.stringify({
            sender: { name: appName, email: from },
            to: [{ email: data.to }],
            subject: data.subject,
            htmlContent: data.html,
        }),
        signal: AbortSignal.timeout(10_000), // Prevent TCP stall from exhausting concurrency
    });

    const result = (await res.json()) as { code?: string; message?: string };
    if (!res.ok) {
        throw new Error(result.code ? `Brevo ${result.code}: ${result.message}` : `Brevo HTTP ${res.status}`);
    }
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export function startEmailWorker(): Worker<EmailJobData> {
    const worker = new Worker<EmailJobData>(
        QUEUES.EMAIL,
        async (job: Job<EmailJobData>) => {
            const { to, subject } = job.data;
            try {
                await sendViaBrevo(job.data);
                console.log(`[EmailWorker] ✅ "${subject}" → ${to} (attempt ${job.attemptsMade + 1})`);
            } catch (err) {
                console.error(`[EmailWorker] ❌ "${subject}" → ${to}:`, (err as Error).message);
                throw err; // Re-throw for BullMQ retry
            }
        },
        {
            connection: getRedisConnection(),
            concurrency: 5,
            limiter: { max: 10, duration: 1_000 }, // 10 emails/sec max (Brevo free tier)
        },
    );

    worker.on("failed", (job, err) =>
        console.error(`[EmailWorker] ❌ Job ${job?.id} failed after ${job?.attemptsMade} attempts: ${err.message}`),
    );
    worker.on("error", (err) => console.error("[EmailWorker] Worker error:", err));

    console.log("[EmailWorker] Started — queue:", QUEUES.EMAIL);
    return worker;
}
