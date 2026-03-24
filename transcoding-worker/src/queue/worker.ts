import { execSync } from "child_process";
try {
    execSync("ffmpeg -version", { stdio: "ignore" });
    console.log("✅ FFmpeg binary found");
} catch (error) {
    console.error("❌ FFmpeg binary NOT found in PATH. Please install ffmpeg.");
    process.exit(1);
}
import { Worker, Job } from "bullmq";
import { QUEUES, JOBS } from "./definitions.js";
import { deleteS3Prefix } from "../lib/storage.js";

import config from "../env.js";
import * as path from "path";
import * as fs from "fs";

import { getRedisConnection } from "../lib/redis.js";
import { prisma } from "../lib/prisma.js";
import { cacheVideoStatus, publishToVideoChannel } from "../lib/pubsub.js";

import { handleProbeAndSplit } from "./jobs/probeAndSplit.js";
import { handleContentModeration } from "./jobs/contentModeration.js";
import { handleTranscodeChunk } from "./jobs/transcodeChunk.js";
import { handleThumbnails } from "./jobs/generateThumbnails.js";
import { handleGenerateSprite } from "./jobs/generateSprite.js";
import { handleMergeManifest } from "./jobs/mergeManifest.js";

const getTempDir = () => config.tempDir;
export let worker: Worker;

export const setupWorker = () => {
    worker = new Worker(
        QUEUES.TRANSCODE,
        async (job: Job) => {
            console.log(
                `[Pipeline] 👷 Job ${job.name} started (ID: ${job.id}) - Data: ${JSON.stringify(job.data)}`,
            );

            try {
                switch (job.name) {
                    case JOBS.PROBE_AND_SPLIT:
                        return await handleProbeAndSplit(job);
                    case JOBS.TRANSCODE_CHUNK:
                        return await handleTranscodeChunk(job);
                    case JOBS.GENERATE_THUMBNAILS:
                        return await handleThumbnails(job);
                    case JOBS.GENERATE_SPRITE:
                        return await handleGenerateSprite(job);
                    case JOBS.MERGE_MANIFEST:
                        return await handleMergeManifest(job);
                    case JOBS.CONTENT_MODERATION:
                        return await handleContentModeration(job);
                    default:
                        throw new Error(`Unknown job type: ${job.name}`);
                }
            } catch (error) {
                console.error(`❌ Job ${job.name} failed:`, error);
                throw error;
            }
        },
        {
            connection: getRedisConnection(),
            concurrency: config.queue.concurrency,
            lockDuration: config.jobLockDurationMs,
            maxStalledCount: 2,
        },
    );

    worker.on("failed", async (job, err) => {
        if (job && job.data && job.data.videoId) {
            const videoId = job.data.videoId;
            const maxAttempts = job.opts.attempts || 1;
            if (job.attemptsMade >= maxAttempts) {
                console.warn(
                    `💀 Job ${job.name} exhausted retries. Updating DB, cleaning S3 & temp dir for ${videoId}...`,
                );
                try {
                    await prisma.videos.update({
                        where: { id: videoId },
                        data: {
                            processingStatus: "FAILED",
                            processingError: err.message || "Unknown error",
                        },
                    });

                    await cacheVideoStatus(videoId, {
                        status: "FAILED",
                        error: err.message || "Processing failed",
                    });

                    await publishToVideoChannel(videoId, {
                        type: "error",
                        status: "FAILED",
                        error: err.message || "Processing failed",
                    });

                    // SAFETY: Only delete processed/ outputs on failure.
                    // DO NOT delete raw-videos/ here — the user may want to retry processing.
                    // Raw source cleanup is handled by S3 lifecycle policies.
                    await deleteS3Prefix(`processed/${videoId}/`).catch((e) =>
                        console.warn(
                            `⚠️ S3 cleanup failed for processed/${videoId}:`,
                            e,
                        ),
                    );

                    const vidDir = path.join(getTempDir(), videoId);
                    if (fs.existsSync(vidDir)) {
                        fs.rmSync(vidDir, { recursive: true, force: true });
                        console.log(`🧹 Cleaned up ${vidDir}`);
                    }
                } catch (e) {
                    console.error("Failed to handle job failure cleanup:", e);
                }
            }
        }
    });

    worker.on("ready", () => {
        console.log(`[Worker] 🟢 Worker is ready and connected to Redis`);
    });

    worker.on("error", (err) => {
        console.error(`[Worker] 🔴 Worker Error:`, err);
    });

    worker.on("stalled", (jobId) => {
        console.warn(`[Worker] ⚠️ Job ${jobId} stalled!`);
    });

    worker.on("completed", (job) => {
        console.log(`[Worker] ✅ Job ${job.id} completed!`);
    });

    // --- PROGRESS RELAY ---
    // --- AGGREGATE PROGRESS RELAY ---
    worker.on("progress", async (job, progress) => {
        if (job.data?.videoId) {
            const videoId = job.data.videoId;
            let rawPercent = 0;

            if (typeof progress === "number") {
                rawPercent = progress;
            } else if (typeof progress === "object" && progress !== null) {
                rawPercent =
                    (progress as any).percent ||
                    (progress as any).progress ||
                    0;
            }

            const { updateAggregateProgress } =
                await import("../lib/pubsub.js");

            // Extract context from either static job data or dynamic progress payload
            const resName =
                job.data.resolution?.name || (progress as any).resolution;
            const resCount = job.data.resCount || (progress as any).resCount;

            await updateAggregateProgress(videoId, job.name, rawPercent, {
                resolution: resName,
                resCount: resCount,
            });
        }
    });

    console.log(`👷 Transcoder Worker started on queue: ${QUEUES.TRANSCODE}`);
    return worker;
};
