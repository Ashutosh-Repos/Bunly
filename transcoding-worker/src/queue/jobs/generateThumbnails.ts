import { Job } from "bullmq";
import * as path from "path";
import config from "../../env.js";
import { ensureDir, uploadFile } from "../../lib/storage.js";
import { ensureOriginalFile } from "../../lib/inputCache.js";
import { generateThumbnails } from "../../lib/ffmpeg.js";

const getTempDir = () => config.tempDir;

export async function handleThumbnails(job: Job) {
    const { videoId, inputPath: s3Key, duration } = job.data;
    const localDir = path.join(getTempDir(), videoId, "thumbnails");

    ensureDir(localDir);

    const localInput = await ensureOriginalFile(videoId, s3Key);

    console.log(`[Pipeline] 📷 Generating thumbnails...`);
    await job.updateProgress({ percent: 10, videoId });
    const filenames = await generateThumbnails(localInput, localDir, duration);

    await job.updateProgress({ percent: 50, videoId });
    const thumbnailKeys = await Promise.all(
        filenames.map(async (file) => {
            const key = `processed/${videoId}/thumbnails/${file}`;
            await uploadFile(key, path.join(localDir, file), "image/jpeg");
            return key;
        }),
    );

    await job.updateProgress({ percent: 100, videoId });
    console.log(`[Pipeline] 📷 Generated thumbnails for ${videoId}`);

    return { thumbnailKeys };
}
