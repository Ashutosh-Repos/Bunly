import { setupWorker } from "./queue/worker.js";
import { killAllFfmpeg } from "./lib/ffmpeg.js";

const worker = setupWorker();

const gracefulShutdown = async (signal: string) => {
    console.log(
        `\n[System] 🛑 Received ${signal}. Initiating graceful shutdown...`,
    );

    // Kill all detached immortal FFmpeg zombie processes violently FIRST
    // This causes running FFmpeg jobs inside worker to throw an Error and reject the BullMQ job immediately
    await killAllFfmpeg();

    // Now securely stop accepting new jobs and close redis connections
    await worker.close();

    console.log(`[System] ✅ Shutdown complete. Goodbye!`);
    process.exit(0);
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
