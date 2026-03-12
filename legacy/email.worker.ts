import { Worker, type Job } from "bullmq";
import { bullMQRedis } from "./redis";
import { env } from "./env";

// ─── Brevo Helper ────────────────────────────────────────────────────────────
async function sendViaBrevo(job: EmailJob) {
    const apiKey = env.BREVO_API_KEY;
    const appName = env.APP_NAME;
    const fromEmail = env.EMAIL_FROM || "clashutosh04@gmail.com";

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
            "api-key": apiKey,
            "content-type": "application/json",
            accept: "application/json",
        },
        body: JSON.stringify({
            sender: { name: appName, email: fromEmail },
            to: [{ email: job.to }],
            subject: job.subject,
            htmlContent: job.html,
        }),
        signal: AbortSignal.timeout(10000), // Prevent TCP stall from exhausting worker concurrency
    });

    const result = await response.json();
    if (!response.ok) {
        throw new Error(
            result.code
                ? `${result.code}: ${result.message}`
                : `Brevo error: ${response.statusText}`,
        );
    }
    return result;
}

// ─── Email Job Types ─────────────────────────────────────────────────────────
interface EmailJob {
    to: string;
    subject: string;
    html: string;
    from: string;
}

const QUEUE_NAME = "email-queue";

export function startEmailWorker() {
    try {
        const worker = new Worker(
            QUEUE_NAME,
            async (job: Job<EmailJob>) => {
                const { to, subject } = job.data;
                try {
                    await sendViaBrevo(job.data);
                    console.log(
                        `[Email Worker] Sent "${subject}" to ${to} (attempt ${job.attemptsMade + 1})`,
                    );
                } catch (error) {
                    const err = error as Error;
                    console.error(
                        `[Email Worker] Failed to send "${subject}" to ${to}:`,
                        err.message || error,
                    );
                    throw error;
                }
            },
            {
                connection: bullMQRedis as any,
                concurrency: 5,
                limiter: {
                    max: 10,
                    duration: 1000, // 10 emails/sec max
                },
            },
        );

        worker.on("failed", (job, err) => {
            console.error(
                `[Email Worker] Job ${job?.id} failed after ${job?.attemptsMade} attempts:`,
                err.message,
            );
        });

        worker.on("error", (err) => {
            console.error("[Email Worker] Worker error:", err);
        });

        console.log("[Email Worker] Started processing email queue");
        return worker;
    } catch (err) {
        console.warn("[Email Worker] Failed to start:", err);
    }
}
