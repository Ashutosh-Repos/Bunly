import { Job } from "bullmq";
import * as path from "path";
import * as fs from "fs";
import config from "../../env.js";
import { ensureDir, uploadFile, deleteS3Prefix } from "../../lib/storage.js";
import { createMasterPlaylist } from "../../lib/ffmpeg.js";
import { prisma } from "../../lib/prisma.js";
import { cacheVideoStatus, publishToVideoChannel } from "../../lib/pubsub.js";

const getTempDir = () => config.tempDir;

export async function handleMergeManifest(job: Job) {
    const { videoId, resolutions, metadata } = job.data;

    const childrenValues = await job.getChildrenValues();

    let thumbnailOptions: string[] = [];
    let previewSprite: string | undefined = undefined;
    let previewSpriteVtt: string | undefined = undefined;

    Object.values(childrenValues).forEach((val: any) => {
        if (val && val.thumbnailKeys) {
            thumbnailOptions = val.thumbnailKeys;
        }
        if (val && val.spriteKey) {
            previewSprite = val.spriteKey;
        }
        if (val && val.spriteVttKey) {
            previewSpriteVtt = val.spriteVttKey;
        }
    });

    const localDir = path.join(getTempDir(), videoId);
    ensureDir(localDir);
    console.log("📝 Creating Master Playlist...");
    await job.updateProgress({ percent: 90, videoId });
    await createMasterPlaylist(localDir, resolutions);

    const masterKey = `processed/${videoId}/master.m3u8`;
    await job.updateProgress({ percent: 95, videoId });
    await uploadFile(
        masterKey,
        path.join(localDir, "master.m3u8"),
        "application/vnd.apple.mpegurl",
    );

    console.log("✅ Transcoding Flow Complete!");
    console.log(`[Pipeline] 📤 Publishing TRANSCODER_COMPLETED for ${videoId}`);

    const finalStatus = {
        status: "READY" as const,
        progress: 100,
        hlsUrl: masterKey,
        thumbnails: thumbnailOptions,
        previewSprite,
        previewSpriteVtt,
    };

    const currentVideo = await prisma.videos.findUnique({
        where: { id: videoId },
        select: { processingStatus: true, thumbnailUrl: true },
    });

    if (currentVideo?.processingStatus === "READY") {
        console.warn(
            `⚠️ Video ${videoId} already READY, skipping duplicate update`,
        );
        fs.rmSync(path.join(getTempDir(), videoId), {
            recursive: true,
            force: true,
        });
        return { masterKey, thumbnailOptions, previewSprite, previewSpriteVtt };
    }

    // Protect against overwriting user-uploaded custom thumbnails
    const finalThumbnailUrl =
        currentVideo?.thumbnailUrl || thumbnailOptions[0] || null;

    console.log(
        `[Pipeline] 💾 Updating Database for ${videoId} (Status: READY)...`,
    );
    await prisma.videos.update({
        where: { id: videoId },
        data: {
            processingStatus: "READY",
            processingProgress: 100,
            hlsPlaylistUrl: masterKey,
            thumbnailUrl: finalThumbnailUrl,
            thumbnailOptions: thumbnailOptions,
            previewSprite: previewSprite || null,
            previewSpriteVtt: previewSpriteVtt || null,
            publishedAt: new Date(),
        },
    });

    const { cacheVideoStatus, publishToVideoChannel, deleteAggregateTracker } =
        await import("../../lib/pubsub.js");

    await cacheVideoStatus(videoId, {
        status: "READY",
        progress: 100,
        hlsUrl: masterKey,
        thumbnails: thumbnailOptions,
    });

    await deleteAggregateTracker(videoId);

    await publishToVideoChannel(videoId, {
        type: "completed",
        ...finalStatus,
    });

    fs.rmSync(path.join(getTempDir(), videoId), {
        recursive: true,
        force: true,
    });

    // To prevent race-condition data loss, DO NOT delete the raw source immediately.
    // Rely on an S3 Object Lifecycle policy (e.g. 7 days expiration for /raw-videos)
    // or a dedicated background garbage collection job later.
    /*
    try {
        await deleteS3Prefix(`raw-videos/${videoId}/`);
        console.log(`[Pipeline] 🗑️ Cleaned up raw source for ${videoId}`);
    } catch (e) {
        console.warn(
            `[Pipeline] ⚠️ Failed to cleanup raw source for ${videoId}`,
            e,
        );
    }
    */

    return { masterKey, thumbnailOptions, previewSprite, previewSpriteVtt };
}
