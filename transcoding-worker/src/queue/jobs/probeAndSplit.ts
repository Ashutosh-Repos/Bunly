import { Job } from "bullmq";
import * as path from "path";
import config from "../../env.js";
import { ensureDir } from "../../lib/storage.js";
import { ensureOriginalFile } from "../../lib/inputCache.js";
import { probeVideo } from "../../lib/ffmpeg.js";
import { prisma } from "../../lib/prisma.js";
import { transcodeQueue, JOBS } from "../definitions.js";

const getTempDir = () => config.tempDir;

export async function handleProbeAndSplit(job: Job) {
    const { videoId, fileName } = job.data;
    const s3Key = fileName;

    console.log(`[Pipeline] ⬇️ Ensuring input exists: ${s3Key}...`);
    await job.updateProgress({ percent: 5, videoId });
    const localInput = await ensureOriginalFile(videoId, s3Key);

    await job.updateProgress({ percent: 15, videoId });
    const metadata = await probeVideo(localInput);
    console.log(
        `🔎 Probed ${videoId}: ${metadata.width}x${metadata.height}, ${metadata.duration}s`,
    );

    const width = metadata.width;
    const height = metadata.height;

    const isPortrait = height > width;
    const majorDimension = Math.max(width, height);

    const resolutions = [];

    // Helper to generate a resolution string prioritizing the major axis based on orientation
    const makeRes = (
        major: number,
        minor: number,
        name: string,
        bandwidth: number,
    ) => {
        return {
            width: isPortrait ? minor : major,
            height: isPortrait ? major : minor,
            bandwidth,
            name,
        };
    };

    if (majorDimension >= 2160)
        resolutions.push(makeRes(3840, 2160, "4k", 14000000));
    if (majorDimension >= 1440)
        resolutions.push(makeRes(2560, 1440, "2k", 10000000));
    if (majorDimension >= 1080)
        resolutions.push(makeRes(1920, 1080, "1080p", 6000000));
    if (majorDimension >= 720)
        resolutions.push(makeRes(1280, 720, "720p", 3000000));
    if (majorDimension >= 480)
        resolutions.push(makeRes(854, 480, "480p", 1500000));
    resolutions.push(makeRes(640, 360, "360p", 800000));

    await job.updateProgress({
        percent: 20,
        videoId,
        resCount: resolutions.length,
    });

    const isShort = isPortrait && metadata.duration <= 60;

    console.log(
        `[Pipeline] 💾 Updating DB for ${videoId} (Status: PROCESSING, isShort: ${isShort})`,
    );
    await prisma.videos.update({
        where: { id: videoId },
        data: {
            processingStatus: "PROCESSING",
            duration: Math.round(metadata.duration),
            width: metadata.width,
            height: metadata.height,
            fps: metadata.fps,
            isShort: isShort,
            resolutions: resolutions.map((r) => r.name),
        },
    });

    await transcodeQueue.add(
        JOBS.CONTENT_MODERATION,
        {
            videoId,
            inputPath: s3Key,
            resolutions,
            metadata: {
                duration: metadata.duration,
                fps: metadata.fps,
                audioCodec: metadata.audioCodec,
            },
        },
        {
            removeOnComplete: { count: 100, age: 24 * 3600 },
            removeOnFail: { age: 24 * 3600 },
        },
    );

    console.log(`🛡️ Sent ${videoId} to Content Moderation`);

    return { resolutions };
}
