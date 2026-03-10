import * as path from "path";
import * as fs from "fs";
import config from "../../env.js";
import { ensureDir, uploadFile } from "../../lib/storage.js";
import redis from "../../lib/redis.js";
import { ensureOriginalFile } from "../../lib/inputCache.js";
import { transcodeResolution } from "../../lib/ffmpeg.js";
const getTempDir = () => config.tempDir;
async function waitForFile(filePath, timeout = config.fileWaitTimeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (fs.existsSync(filePath))
            return;
        await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error(`Timeout waiting for file: ${filePath}`);
}
export async function handleTranscodeChunk(job) {
    const { videoId, inputPath: s3Key, resolution, audioCodec } = job.data;
    const localDir = path.join(getTempDir(), videoId, resolution.name);
    ensureDir(localDir);
    const lockKey = `lock:transcode:${videoId}:${resolution.name}`;
    const lockTTL = config.lock.ttlSeconds;
    const heartbeatInterval = config.lock.heartbeatIntervalMs;
    const acquired = await redis.set(lockKey, String(process.pid), "EX", lockTTL, "NX");
    if (!acquired) {
        console.log(`🔒 Lock held for ${s3Key} (${resolution.name}), skipping duplicate...`);
        const resultPath = path.join(localDir, "playlist.m3u8");
        try {
            await waitForFile(resultPath, config.fileWaitTimeoutMs);
            return { resolution: resolution.name };
        }
        catch (e) {
            throw new Error("Timeout waiting for other worker to finish transcoding");
        }
    }
    let heartbeatTimer = null;
    const startHeartbeat = () => {
        heartbeatTimer = setInterval(async () => {
            try {
                await redis.expire(lockKey, lockTTL);
            }
            catch (e) {
                console.warn(`⚠️ Heartbeat failed for ${lockKey}:`, e);
            }
        }, heartbeatInterval);
    };
    const stopHeartbeat = () => {
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
        }
    };
    try {
        startHeartbeat();
        console.log(`[Pipeline] 📂 Ensuring input file available: ${s3Key}`);
        const localInput = await ensureOriginalFile(videoId, s3Key);
        console.log(`⚙️ Transcoding ${resolution.name}...`);
        await transcodeResolution(localInput, localDir, resolution, async (percent) => {
            await job.updateProgress({ progress: percent, videoId });
        }, { sourceAudioCodec: audioCodec });
        console.log(`⬆️ Uploading ${resolution.name} artifacts...`);
        const files = fs.readdirSync(localDir);
        // Process uploads in batches of 10 to limit concurrent connections but still be fast
        const CONCURRENT_UPLOADS = 10;
        for (let i = 0; i < files.length; i += CONCURRENT_UPLOADS) {
            const batch = files.slice(i, i + CONCURRENT_UPLOADS);
            await Promise.all(batch.map((file) => {
                const key = `processed/${videoId}/${resolution.name}/${file}`;
                const contentType = file.endsWith(".m3u8")
                    ? "application/vnd.apple.mpegurl"
                    : "video/MP2T";
                return uploadFile(key, path.join(localDir, file), contentType);
            }));
        }
    }
    finally {
        stopHeartbeat();
        await redis.del(lockKey);
        try {
            fs.rmSync(localDir, { recursive: true, force: true });
        }
        catch (e) {
            console.warn(`⚠️ Cleanup failed: ${e}`);
        }
    }
    return { resolution: resolution.name };
}
