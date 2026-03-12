import "./env.js"; // Validate env first — fails fast if vars missing

import { setupWorker } from "./queue/worker.js";
import { closeQueues } from "./queue/definitions.js";
import { killAllFfmpeg } from "./lib/ffmpeg.js";

console.log("[Transcoding Worker] 🚀 Starting...");

const worker = setupWorker();

console.log("[Transcoding Worker] ✅ Ready");

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
