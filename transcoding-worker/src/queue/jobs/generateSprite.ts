import { Job } from "bullmq";
import * as path from "path";
import * as fs from "fs";
import config from "../../env.js";
import { ensureDir, uploadFile } from "../../lib/storage.js";
import { ensureOriginalFile } from "../../lib/inputCache.js";
import { generatePreviewSprite } from "../../lib/ffmpeg.js";

const getTempDir = () => config.tempDir;

export async function handleGenerateSprite(job: Job) {
    const { videoId, inputPath: s3Key, duration } = job.data;
    const localDir = path.join(getTempDir(), videoId, "sprite");

    ensureDir(localDir);

    const localInput = await ensureOriginalFile(videoId, s3Key);

    console.log(
        `[Pipeline] 🎞️ Generating preview sprite (duration: ${duration}s)...`,
    );
    await job.updateProgress({ percent: 10, videoId });
    const { spriteFile, vttFile } = await generatePreviewSprite(
        localInput,
        localDir,
        duration,
    );

    await job.updateProgress({ percent: 80, videoId });
    const spriteKey = `processed/${videoId}/sprite/${spriteFile}`;
    const vttKey = `processed/${videoId}/sprite/${vttFile}`;

    await Promise.all([
        uploadFile(spriteKey, path.join(localDir, spriteFile), "image/jpeg"),
        uploadFile(vttKey, path.join(localDir, vttFile), "text/vtt"),
    ]);

    await job.updateProgress({ percent: 100, videoId });

    try {
        fs.rmSync(localDir, { recursive: true, force: true });
    } catch (e) {}

    return { spriteKey, spriteVttKey: vttKey };
}
