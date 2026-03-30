import "./env.js"; // Validate env first — fails fast if vars missing
import http from "node:http";

import { startEngagementWorkers } from "./queue/engagement.js";
import { startEmailWorker } from "./queue/email.js";
import { startSchedulerWorker, startFanoutWorker, registerRepeatableJobs } from "./queue/scheduler.js";
import { startNotificationWorker } from "./queue/notification.js";
import { closeQueues } from "./queue/definitions.js";
import redis from "./lib/redis.js";
import { prisma } from "./lib/prisma.js";

// ─── Boot ─────────────────────────────────────────────────────────────────────

console.log("[Worker Pool] 🚀 Starting...");

const stopEngagement = startEngagementWorkers();
const stopNotifications = startNotificationWorker();
const emailWorker = startEmailWorker();
const schedulerWorker = startSchedulerWorker();
const fanoutWorker = startFanoutWorker();

registerRepeatableJobs().catch((err) => {
    console.error("[Worker Pool] ⚠️ Failed to register repeatable jobs:", err);
});

console.log("[Worker Pool] ✅ All workers running");

// ─── Health Check Server (Port 4001) ──────────────────────────────────────────

const healthServer = http.createServer((req, res) => {
    if (req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }));
    } else {
        res.writeHead(404);
        res.end();
    }
});

healthServer.listen(4001, () => {
    console.log("[Worker Pool] 💓 Health check server listening on port 4001");
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

let isShuttingDown = false;

const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`\n[Worker Pool] 🛑 ${signal} received — shutting down...`);

    // 1. Stop Redis stream consumers (stops blocking, exits loops)
    stopEngagement();
    stopNotifications();

    // 2. Stop BullMQ workers (finish current job, then close)
    await Promise.allSettled([emailWorker.close(), schedulerWorker.close(), fanoutWorker.close()]);

    // 3. Close BullMQ queue connections
    await closeQueues().catch((e) => console.warn("[Worker Pool] Queue close warning:", e));

    // 4. Close shared Redis + Prisma
    await redis.quit().catch(() => {});
    await prisma.$disconnect().catch(() => {});

    // 5. Close Health Check Server
    healthServer.close();

    console.log("[Worker Pool] ✅ Shutdown complete. Goodbye!");
    process.exit(0);
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
    console.error("[Worker Pool] ⚠️ Unhandled rejection:", reason);
});

