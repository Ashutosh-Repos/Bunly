import { Job } from "bullmq";
import * as path from "path";
import * as fs from "fs";
import config from "../../env.js";
import { ensureDir, uploadFile, withRetry } from "../../lib/storage.js";
import redis from "../../lib/redis.js";
import { ensureOriginalFile } from "../../lib/inputCache.js";
import { transcodeResolution } from "../../lib/ffmpeg.js";

const getTempDir = () => config.tempDir;

async function waitForLockRelease(
    redisKey: string,
    timeout = config.fileWaitTimeoutMs,
) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const exists = await redis.exists(redisKey);
        if (!exists) return; // Lock is gone, other worker finished or crashed
        await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error(`Timeout waiting for lock release: ${redisKey}`);
}

export async function handleTranscodeChunk(job: Job) {
    const { videoId, inputPath: s3Key, resolution, audioCodec } = job.data;
    const localDir = path.join(getTempDir(), videoId, resolution.name);

    ensureDir(localDir);

    const lockKey = `lock:transcode:${videoId}:${resolution.name}`;
    const lockTTL = config.lock.ttlSeconds;
    const heartbeatInterval = config.lock.heartbeatIntervalMs;

    const acquired = await redis.set(
        lockKey,
        String(process.pid),
        "EX",
        lockTTL,
        "NX",
    );

    if (!acquired) {
        console.log(
            `🔒 Lock held for ${s3Key} (${resolution.name}), skipping duplicate...`,
        );
        try {
            await waitForLockRelease(lockKey, config.fileWaitTimeoutMs);
            return { resolution: resolution.name };
        } catch (e) {
            throw new Error(
                "Timeout waiting for other worker to finish transcoding",
            );
        }
    }

    let heartbeatTimer: NodeJS.Timeout | null = null;
    const startHeartbeat = () => {
        heartbeatTimer = setInterval(async () => {
            try {
                await redis.expire(lockKey, lockTTL);
            } catch (e) {
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

        console.log(`⚙️ Transcoding & Pipelining ${resolution.name}...`);
        
        let isTranscodingComplete = false;
        let transcodeError: any = null;

        const abortController = new AbortController();

        const transcodePromise = transcodeResolution(
            localInput,
            localDir,
            resolution,
            async (percent) => {
                await job.updateProgress({ progress: percent, videoId });
            },
            { sourceAudioCodec: audioCodec, signal: abortController.signal },
        ).then(() => {
            isTranscodingComplete = true;
        }).catch((err) => {
            isTranscodingComplete = true;
            transcodeError = err;
        });

        // Background poller to upload segments as they definitively complete
        const getUnuploadedTsFiles = () => fs.readdirSync(localDir).filter(f => f.endsWith('.ts'));
        
        const uploadQueuePromise = (async () => {
            try {
                // Loop until FFmpeg finishes AND all .ts files are successfully pushed & deleted
                while (!isTranscodingComplete || getUnuploadedTsFiles().length > 0) {
                    const tsFiles = getUnuploadedTsFiles();
                    tsFiles.sort(); // Lexicographical sort (seg_..._001.ts, seg_..._002.ts)
                    
                    // Safety Guard: Do not upload the highest-indexed chunk if FFmpeg is still running, 
                    // because FFmpeg is likely aggressively pushing byte streams to it.
                    let filesToUpload = tsFiles;
                    if (!isTranscodingComplete && filesToUpload.length > 0) {
                        filesToUpload = filesToUpload.slice(0, -1);
                    }

                    if (filesToUpload.length === 0) {
                        // Polling sleep timer to prevent aggressive CPU spinning when NO safe files exist
                        await new Promise(r => setTimeout(r, 2000));
                        continue;
                    }

                    // Batch upload
                    const CONCURRENT_UPLOADS = 10;
                    for (let i = 0; i < filesToUpload.length; i += CONCURRENT_UPLOADS) {
                        const batch = filesToUpload.slice(i, i + CONCURRENT_UPLOADS);
                        await Promise.all(
                            batch.map(async (file) => {
                                const key = `processed/${videoId}/${resolution.name}/${file}`;
                                
                                // Wrapped in exponential backoff retry to prevent 1 chunk drop destroying a 2 hour job
                                await withRetry(() => uploadFile(key, path.join(localDir, file), "video/MP2T"));
                                
                                // Memory/Disk optimization: immediately purge successful chunks early to avoid SSD ballooning
                                try { fs.unlinkSync(path.join(localDir, file)); } catch (e) {}
                            })
                        );
                    }
                }
                
                // Grand Finale: Upload the VOD tracking master playlist after all segments are finished
                if (!transcodeError && fs.existsSync(path.join(localDir, "playlist.m3u8"))) {
                    const key = `processed/${videoId}/${resolution.name}/playlist.m3u8`;
                    await withRetry(() => uploadFile(key, path.join(localDir, "playlist.m3u8"), "application/vnd.apple.mpegurl"));
                    try { fs.unlinkSync(path.join(localDir, "playlist.m3u8")); } catch (e) {}
                }
            } catch (err) {
                // If the robust upload sequence fatally crashes over 5 retries, we MUST abort the background FFmpeg process
                // or else it becomes an immortal Zombie taking up a permanently pinned 100% CPU thread internally.
                abortController.abort();
                throw err;
            }
        })();

        // Synchronize Transcoder and the Poller Queue
        await Promise.all([transcodePromise, uploadQueuePromise]);

        if (transcodeError) throw transcodeError;
        
        console.log(`✅ Upload pipelining completed for ${resolution.name}.`);
    } finally {
        stopHeartbeat();
        await redis.del(lockKey);
        try {
            fs.rmSync(localDir, { recursive: true, force: true });
        } catch (e) {
            console.warn(`⚠️ Cleanup failed: ${e}`);
        }
    }

    return { resolution: resolution.name };
}
