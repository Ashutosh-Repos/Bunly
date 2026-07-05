import "./env.js"; // Validate env first — fails fast if vars missing
import http from "node:http";

import { setupWorker } from "./queue/worker.js";
import { closeQueues } from "./queue/definitions.js";
import { killAllFfmpeg } from "./lib/ffmpeg.js";

console.log("[Transcoding Worker] 🚀 Starting...");

const worker = setupWorker();

console.log("[Transcoding Worker] ✅ Ready");

// ─── Health Check Server (Port 4002) ──────────────────────────────────────────

const healthServer = http.createServer((req, res) => {
    if (req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }));
    } else {
        res.writeHead(404);
        res.end();
    }
});

healthServer.listen(4002, () => {
    console.log("[Transcoding Worker] 💓 Health check server listening on port 4002");
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

let isShuttingDown = false;

const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`\n[Transcoding Worker] 🛑 ${signal} received — shutting down...`);

    // Kill zombie FFmpeg processes first so jobs fail immediately
    await killAllFfmpeg().catch((e) => console.warn("[Transcoding Worker] FFmpeg kill warning:", e));

    // Stop BullMQ worker gracefully (finishes current job)
    await worker.close();

    // Close queue/event connections
    await closeQueues().catch((e) => console.warn("[Transcoding Worker] Queue close warning:", e));

    console.log("[Transcoding Worker] ✅ Shutdown complete. Goodbye!");
    process.exit(0);
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
    console.error("[Transcoding Worker] ⚠️ Unhandled rejection:", reason);
});
