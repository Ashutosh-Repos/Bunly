import * as fs from "fs";
import * as path from "path";
import { downloadFile, ensureDir } from "./storage.js";
import config from "../env.js";

// Use configurable temp dir for horizontal scaling
const getTempDir = () => config.tempDir;

interface DownloadLock {
    promise: Promise<void>;
    refCount: number;
}

// In-memory tracking of active downloads (process-local)
const activeDownloads = new Map<string, DownloadLock>();

/**
 * Ensure the original file is available locally.
 * If already downloaded, returns immediately.
 * If another worker is downloading, waits for completion.
 * Otherwise, downloads the file.
 */
export async function ensureOriginalFile(
    videoId: string,
    s3Key: string,
): Promise<string> {
    const localPath = path.join(getTempDir(), videoId, "source");
    const lockFile = path.join(getTempDir(), videoId, ".downloading");

    ensureDir(path.dirname(localPath));

    // Case 1: File already exists and is complete
    if (fs.existsSync(localPath) && !fs.existsSync(lockFile)) {
        console.log(`[InputCache] ✅ Using cached file: ${localPath}`);
        return localPath;
    }

    // Case 2: Another process on this node is downloading (lock file exists)
    if (fs.existsSync(lockFile)) {
        // --- STALE LOCK CHECK ---
        try {
            const timeString = fs.readFileSync(lockFile, "utf8");
            if (timeString) {
                const lockTime = parseInt(timeString, 10);
                // If it's a valid timestamp and it's older than 2 minutes (120000ms)
                if (!isNaN(lockTime) && Date.now() - lockTime > 90000) {
                    console.warn(
                        `[InputCache] ⚠️ Lock file ${lockFile} timestamp is stale (>90s old). Suspect dead pod, taking over...`,
                    );
                    try {
                        fs.unlinkSync(lockFile);
                    } catch {}
                    return ensureOriginalFile(videoId, s3Key);
                }

                console.log(
                    `[InputCache] ⏳ Waiting for active download (Lock active): ${videoId}`,
                );
                try {
                    await waitForDownload(lockFile, config.downloadTimeoutMs);
                } catch (e) {
                    console.warn(
                        `[InputCache] ⚠️ Download timeout reached. Taking over...`,
                    );
                    try {
                        fs.unlinkSync(lockFile);
                    } catch {}
                    return ensureOriginalFile(videoId, s3Key);
                }
            }
        } catch (e) {
            // Unreadable lock, wait normally as fallback
            await waitForDownload(lockFile, config.downloadTimeoutMs);
        }

        // Verify file exists after waiting
        if (!fs.existsSync(localPath)) {
            console.warn(
                `[InputCache] ⚠️ File not found after wait, retrying download`,
            );
            // Recurse to try again (another process may have failed)
            return ensureOriginalFile(videoId, s3Key);
        }
        return localPath;
    }

    // Case 3: Check in-memory for this process (concurrent calls within same process)
    const existingDownload = activeDownloads.get(videoId);
    if (existingDownload) {
        console.log(
            `[InputCache] ⏳ Waiting for in-process download: ${videoId}`,
        );
        existingDownload.refCount++;
        try {
            await existingDownload.promise;
        } finally {
            existingDownload.refCount--;
        }

        // Verify file exists
        if (!fs.existsSync(localPath)) {
            throw new Error(`Download failed, file not found: ${localPath}`);
        }
        return localPath;
    }

    // Case 4: Need to download
    console.log(`[InputCache] ⬇️ Starting download: ${s3Key}`);

    try {
        fs.writeFileSync(lockFile, String(Date.now()), { flag: "wx" });
    } catch (e: any) {
        if (e.code === "EEXIST") {
            // Another process just created the lock, wait for them
            console.log(`[InputCache] 🔄 Lock race detected, waiting...`);
            return ensureOriginalFile(videoId, s3Key);
        }
        throw e;
    }

    let heartbeatTimer: NodeJS.Timeout | null = null;
    const downloadPromise = (async () => {
        try {
            heartbeatTimer = setInterval(() => {
                try {
                    fs.writeFileSync(lockFile, String(Date.now()));
                } catch (e) {} // Ignores if lock unexpectedly deleted
            }, 30000); // 30 second heartbeat

            await downloadFile(s3Key, localPath);
            console.log(`[InputCache] ✅ Download complete: ${localPath}`);
        } catch (err) {
            // Remove partial file on failure
            try {
                if (fs.existsSync(localPath)) {
                    fs.unlinkSync(localPath);
                }
            } catch {}
            throw err;
        } finally {
            if (heartbeatTimer) clearInterval(heartbeatTimer);
            // Remove lock file
            try {
                fs.unlinkSync(lockFile);
            } catch {}
        }
    })();

    // Track in memory
    activeDownloads.set(videoId, { promise: downloadPromise, refCount: 1 });

    try {
        await downloadPromise;
    } finally {
        const download = activeDownloads.get(videoId);
        if (download && download.refCount <= 1) {
            activeDownloads.delete(videoId);
        }
    }

    return localPath;
}

/**
 * Wait for an external download to complete (file-based lock)
 * Timeout is configurable via DOWNLOAD_TIMEOUT_MS (default 30 mins)
 */
async function waitForDownload(
    lockFile: string,
    timeoutMs: number,
): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (!fs.existsSync(lockFile)) {
            return;
        }
        await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error(`Timeout waiting for download lock: ${lockFile}`);
}

/**
 * Check if the original file exists and is available
 */
export function isOriginalCached(videoId: string): boolean {
    const localPath = path.join(getTempDir(), videoId, "source");
    const lockFile = path.join(getTempDir(), videoId, ".downloading");
    return fs.existsSync(localPath) && !fs.existsSync(lockFile);
}
