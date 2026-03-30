var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { on } from "events";
import { router, protectedProcedure, publicProcedure, videoProcedure, channelProcedure, } from "../router.js";
import { TRPCError } from "@trpc/server";
import { prisma } from "../../lib/prisma";
import config from "../../lib/config.js";
import { createMultipartUpload, getPresignedPartUrl, completeMultipartUpload, abortMultipartUpload, listUploadedParts, deleteS3Prefix, } from "../../lib/storage.js";
import { cacheVideoStatus, cacheVideoMetadata, deleteVideoMetadata, deleteAggregateTracker, getCachedVideoStatus, REDIS_KEYS, VideoStatusEventSchema, } from "../../lib/ws/definitions";
import { transcodeQueue, schedulerQueue, JOBS, } from "../../lib/queue-definitions.js";
import { redisSubscriptionManager } from "../../lib/ws/redisSubscription";
import { StreamService } from "../../services/StreamService";
import redis from "../../lib/redis";
// --- Helpers ---
/** Build the public WebSocket URL for a given video ID */
function buildWsUrl(videoId) {
    const wsProtocol = config.nodeEnv === "production" ? "wss" : "ws";
    const baseUrl = config.publicWsUrl || `${wsProtocol}://localhost:${config.port}`;
    return `${baseUrl}/ws/videos?id=${videoId}`;
}
export function updateChannelStats(channelId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        // 1. Count ONLY public videos
        const videoCount = yield prisma.videos.count({
            where: {
                channelId,
                deletedAt: null,
                visibility: "PUBLIC",
            },
        });
        // 2. Sum total views for ONLY public videos
        const aggregate = yield prisma.videos.aggregate({
            where: {
                channelId,
                deletedAt: null,
                visibility: "PUBLIC",
            },
            _sum: {
                viewCount: true,
            },
        });
        const totalViews = (_a = aggregate._sum.viewCount) !== null && _a !== void 0 ? _a : 0;
        // 3. Update Channel
        yield prisma.channels.update({
            where: { id: channelId },
            data: {
                videoCount,
                totalViews,
            },
        });
        return { videoCount, totalViews };
    });
}
// --- Input Schemas ---
const initUploadSchema = z.object({
    fileName: z
        .string()
        .min(1)
        .max(255)
        .regex(/^[a-zA-Z0-9._\-\s]+$/, "Filename can only contain alphanumeric characters, dots, underscores, dashes, and spaces"),
    channelId: z.string().min(1, { message: "Invalid Channel ID" }),
});
const getPartUrlSchema = z.object({
    videoId: z.string().min(1),
    uploadId: z.string().min(1),
    partNumber: z.number().int().min(1),
    md5: z.string().optional(),
});
const completeUploadSchema = z.object({
    videoId: z.string().min(1),
    uploadId: z.string().min(1),
    parts: z.array(z.object({
        ETag: z.string().min(1),
        PartNumber: z.number().int().min(1),
    })),
});
const videoIdSchema = z.object({
    videoId: z.string().min(1),
});
const abortUploadSchema = z.object({
    videoId: z.string().min(1),
    uploadId: z.string().min(1),
});
const reportFailureSchema = z.object({
    videoId: z.string().min(1),
    error: z.string().optional(),
});
/**
 * Updates the cached video count and total views for a channel.
 * Typically called after video publication, deletion, or visibility changes.
 */
// --- Router ---
export const videoRouter = router({
    /**
     * Initialize a multipart upload session and create video record
     */
    initUpload: protectedProcedure
        .input(initUploadSchema.extend({ idempotencyKey: z.string().optional() }))
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const userId = ctx.session.user.id;
        const { fileName, channelId, idempotencyKey } = input;
        // Verify channel exists and user owns it
        const channel = yield prisma.channels.findUnique({
            where: { id: channelId },
            select: {
                id: true,
                handle: true,
                name: true,
                image: true,
                status: true,
                userId: true,
            },
        });
        if (!channel) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: "Channel not found",
            });
        }
        if (channel.userId !== userId) {
            throw new TRPCError({
                code: "FORBIDDEN",
                message: "You do not have permission to upload to this channel",
            });
        }
        // IDEMPOTENCY CHECK
        if (idempotencyKey) {
            const existingVideo = yield prisma.videos.findFirst({
                where: { idempotencyKey },
                select: {
                    id: true,
                    uploadId: true,
                    processingStatus: true,
                    uploadExpiresAt: true,
                },
            });
            if (existingVideo) {
                // CASE 1: Valid Resumable Session
                if (existingVideo.processingStatus === "UPLOADING" &&
                    existingVideo.uploadId) {
                    // Check if not expired
                    if (existingVideo.uploadExpiresAt &&
                        existingVideo.uploadExpiresAt > new Date()) {
                        console.log(`[Pipeline] ♻️ Idempotency Hit: Returning existing session for ${fileName} (${existingVideo.id})`);
                        // Refresh cache just in case
                        yield cacheVideoMetadata(existingVideo.id, {
                            uploadId: existingVideo.uploadId,
                            ownerId: userId,
                        });
                        return {
                            videoId: existingVideo.id,
                            uploadId: existingVideo.uploadId,
                            wsUrl: buildWsUrl(existingVideo.id),
                            expiresAt: existingVideo.uploadExpiresAt.toISOString(),
                        };
                    }
                }
                // CASE 2: Completed/Processing Video (Conflict)
                if (existingVideo.processingStatus === "PROCESSING" ||
                    existingVideo.processingStatus === "READY") {
                    throw new TRPCError({
                        code: "CONFLICT",
                        message: "Duplicate Upload: The file you selected has already been uploaded to this channel. To upload it again, please delete the existing video from your content list.",
                    });
                }
                // CASE 3: Stale/Failed/Expired Session -> CLEANUP
                // We must delete the old record to avoid unique constraint violation on 'idempotencyKey'
                console.log(`[Pipeline] 🗑️ Idempotency: Cleaning up stale/failed session for ${fileName} (${existingVideo.id})`);
                if (existingVideo.uploadId) {
                    yield abortMultipartUpload(existingVideo.id, existingVideo.uploadId).catch((err) => {
                        console.warn(`[Pipeline] ⚠️ Failed to abort stale upload session:`, err);
                    });
                }
                yield prisma.videos.delete({
                    where: { id: existingVideo.id },
                });
            }
        }
        const uploadExpiresAt = new Date(Date.now() + config.upload.dbRecordExpiry * 1000);
        console.log(`[Pipeline] 🆕 Initializing Multipart Upload for ${fileName} (Channel: ${channel.handle})`);
        // 1. Start S3 session
        const videoId = uuidv4();
        const uploadId = yield createMultipartUpload(videoId);
        // 2. Create DB record
        let video;
        try {
            video = yield prisma.videos.create({
                data: {
                    id: videoId,
                    uploadId,
                    channelId: channel.id,
                    title: fileName
                        .replace(/\.[^/.]+$/, "")
                        .substring(0, 100),
                    processingStatus: "UPLOADING",
                    visibility: "PRIVATE",
                    channelHandle: channel.handle,
                    channelName: channel.name,
                    channelImage: channel.image,
                    originalFileName: fileName,
                    uploadExpiresAt: uploadExpiresAt,
                    uploadStartedAt: new Date(),
                    uploadAttempts: 0,
                    updatedAt: new Date(),
                    idempotencyKey, // Save key
                },
                select: {
                    id: true,
                    title: true,
                    processingStatus: true,
                    createdAt: true,
                },
            });
        }
        catch (error) {
            console.error(`[Pipeline] ❌ DB Creation Failed. Aborting S3 Upload ${uploadId}...`);
            yield abortMultipartUpload(videoId, uploadId).catch((err) => console.error(`[Pipeline] ⚠️ Failed to abort orphaned upload:`, err));
            throw error;
        }
        // Cache initial status
        yield cacheVideoStatus(video.id, {
            status: "UPLOADING",
            progress: 0,
        });
        // Cache metadata for subsequent calls
        yield cacheVideoMetadata(videoId, {
            uploadId,
            ownerId: userId,
        });
        return {
            videoId: video.id,
            uploadId,
            wsUrl: buildWsUrl(video.id),
            expiresAt: uploadExpiresAt.toISOString(),
        };
    })),
    /**
     * Get a presigned URL for a specific part
     */
    getPartUrl: videoProcedure
        .input(getPartUrlSchema.omit({
        videoId: true,
    }))
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const { video } = ctx;
        const { uploadId, partNumber, md5 } = input;
        if (video.uploadId !== uploadId) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Upload session mismatch",
            });
        }
        const url = yield getPresignedPartUrl(video.id, uploadId, partNumber, md5);
        return { url };
    })),
    /**
     * Get presigned URLs for multiple parts (Batch)
     */
    getPartUrls: videoProcedure
        .input(z.object({
        uploadId: z.string().min(1),
        parts: z
            .array(z.object({
            partNumber: z.number().int().min(1),
            md5: z.string().optional(),
        }))
            .min(1)
            .max(50), // Batch limit
    }))
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const { video } = ctx;
        const { uploadId, parts } = input;
        if (video.uploadId !== uploadId) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Upload session mismatch",
            });
        }
        const urls = yield Promise.all(parts.map((part) => __awaiter(void 0, void 0, void 0, function* () {
            const url = yield getPresignedPartUrl(video.id, uploadId, part.partNumber, part.md5);
            return { partNumber: part.partNumber, url };
        })));
        return { urls };
    })),
    /**
     * Resume an interrupted upload
     */
    resumeUpload: videoProcedure.query((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx }) {
        const { video } = ctx;
        if (!video.uploadId) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: "No active upload session",
            });
        }
        console.log(`[Pipeline] 🔄 Resuming Multipart Upload for ${video.id}...`);
        let parts;
        try {
            parts = yield listUploadedParts(video.id, video.uploadId);
        }
        catch (error) {
            if (error instanceof Error && error.name === "NoSuchUpload") {
                console.warn(`[Pipeline] ⚠️ NoSuchUpload during resume for ${video.id}. Deleting stale DB record.`);
                // Clean up the DB since S3 has discarded the upload session
                yield prisma.videos
                    .delete({ where: { id: video.id } })
                    .catch(() => { });
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Upload session expired or aborted by server. Please start a new upload.",
                });
            }
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to resume upload from storage provider.",
                cause: error,
            });
        }
        return {
            videoId: video.id,
            uploadId: video.uploadId,
            wsUrl: buildWsUrl(video.id),
            parts: parts.map((p) => ({
                PartNumber: p.PartNumber,
                ETag: p.ETag,
            })),
        };
    })),
    /**
     * Complete the multipart upload
     */
    completeUpload: videoProcedure
        .input(completeUploadSchema.omit({ videoId: true }))
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const { video } = ctx;
        const { uploadId, parts } = input;
        if (video.uploadId !== uploadId) {
            // If the video is already processing or ready, this might be a retry.
            // We should check if the uploadId mismatches because it was already cleared/completed.
            if (video.processingStatus === "PROCESSING" ||
                video.processingStatus === "READY") {
                console.log(`[Pipeline] ⚠️ completeUpload called for ${video.id} which is already ${video.processingStatus}. Treating as success.`);
                return {
                    success: true,
                    message: "Upload already completed",
                };
            }
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Upload session mismatch",
            });
        }
        console.log(`[Pipeline] 🏁 Completing Multipart Upload for ${video.id}...`);
        // Verify all parts have ETags
        const missingETags = parts.filter((p) => !p.ETag);
        if (missingETags.length > 0) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Some parts are missing ETags. Upload failed.",
            });
        }
        try {
            yield completeMultipartUpload(video.id, uploadId, parts);
        }
        catch (error) {
            // S3 Error Handling & Recovery
            if (error instanceof Error && error.name === "NoSuchUpload") {
                console.warn(`[Pipeline] ⚠️ NoSuchUpload for ${video.id}. Checking if duplicate or already completed...`);
                // 1. Check DB (Fastest) - Already handled above, but double check fresh state
                const freshVideo = yield prisma.videos.findUnique({
                    where: { id: video.id },
                    select: {
                        processingStatus: true,
                        uploadCompletedAt: true,
                    },
                });
                if ((freshVideo === null || freshVideo === void 0 ? void 0 : freshVideo.processingStatus) === "PROCESSING" ||
                    (freshVideo === null || freshVideo === void 0 ? void 0 : freshVideo.uploadCompletedAt)) {
                    console.log(`[Pipeline] ✅ DB says upload already completed. Returning success.`);
                    return {
                        success: true,
                        message: "Upload already completed",
                    };
                }
                // 2. Check S3 Object Existence (Source of Truth)
                // If S3 merge succeeded but DB update failed previously, the upload ID is gone, but the file exists.
                try {
                    const { headObject } = yield import("../../lib/storage.js");
                    const exists = yield headObject(`raw-videos/${video.id}/source`);
                    if (exists) {
                        console.log(`[Pipeline] ✅ Object exists in S3 despite NoSuchUpload error. Treating as success (Recovered).`);
                        // Fix DB State
                        yield prisma.videos.update({
                            where: { id: video.id },
                            data: {
                                uploadCompletedAt: new Date(),
                                processingStatus: "PROCESSING",
                            },
                        });
                        // Trigger Transcode (since we recovered, we must ensure downstream works)
                        try {
                            const { JOBS } = yield import("../../lib/queue-definitions.js");
                            yield transcodeQueue.add(JOBS.PROBE_AND_SPLIT, {
                                videoId: video.id,
                                fileName: `raw-videos/${video.id}/source`,
                            }, { jobId: video.id });
                        }
                        catch (_b) { }
                        return {
                            success: true,
                            message: "Upload recovered and completed",
                        };
                    }
                }
                catch (headErr) {
                    console.warn(`[Pipeline] ❌ Recovery failed: Object not found in S3.`, headErr);
                }
                // Cleanup DB record if S3 lost the file completely
                yield prisma.videos
                    .delete({ where: { id: video.id } })
                    .catch(() => { });
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "The upload session expired or was discarded by the storage provider. Please upload again.",
                });
            }
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to complete upload with storage provider.",
                cause: error,
            });
        }
        // Update DB
        yield prisma.videos.update({
            where: { id: video.id },
            data: {
                uploadCompletedAt: new Date(),
                processingStatus: "PROCESSING",
            },
        });
        try {
            const { JOBS } = yield import("../../lib/queue-definitions.js");
            const key = `raw-videos/${video.id}/source`;
            console.log(`[Pipeline] 🚀 Triggering Transcode Job for ${video.id} (Key: ${key})`);
            yield transcodeQueue.add(JOBS.PROBE_AND_SPLIT, {
                videoId: video.id,
                fileName: key,
            }, { jobId: video.id });
        }
        catch (error) {
            console.warn(`[Pipeline] ⚠️ Failed to trigger transcode job explicitly:`, error);
        }
        return { success: true, message: "Upload completion initiated" };
    })),
    /**
     * Abort a multipart upload
     */
    abortUpload: videoProcedure
        .input(abortUploadSchema.omit({ videoId: true }))
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const { video } = ctx;
        const { uploadId } = input;
        console.log(`[Pipeline] 🛑 Aborting Multipart Upload for ${video.id}...`);
        yield abortMultipartUpload(video.id, uploadId);
        // Clean up any potential orphaned S3 parts or source file that might have been pushed
        yield deleteS3Prefix(`raw-videos/${video.id}/`).catch((err) => {
            console.warn(`[Pipeline] ⚠️ Failed to delete S3 prefix during abort:`, err);
        });
        // Remove from queue if present
        try {
            const job = yield transcodeQueue.getJob(video.id);
            if (job) {
                yield job.remove();
                console.log(`[Pipeline] 🗑️ Removed pending job for ${video.id}`);
            }
        }
        catch (e) {
            console.warn(`[Pipeline] ⚠️ Failed to remove job or cache during abort:`, e);
        }
        // Delete record
        yield prisma.videos.delete({ where: { id: video.id } });
        // Ensure channel metrics update since the pending video was just destroyed
        updateChannelStats(video.channelId).catch((err) => console.error("[Video] Failed to update channel stats on abort", err));
        // Clear cache and tracking
        yield deleteVideoMetadata(video.id);
        yield deleteAggregateTracker(video.id);
        return {
            success: true,
            message: "Upload aborted and record removed",
        };
    })),
    /**
     * Report a client-side upload failure
     */
    reportFailure: videoProcedure
        .input(reportFailureSchema.omit({ videoId: true }))
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const { video } = ctx;
        const { error } = input;
        yield prisma.videos.update({
            where: { id: video.id },
            data: {
                processingStatus: "FAILED",
                processingError: error || "Client-side upload failed",
            },
        });
        console.log(`[Pipeline] ❌ Upload for ${video.id} reported as FAILED`);
        return { success: true, message: "Video status updated to FAILED" };
    })),
    /**
     * Get current processing status
     */
    getStatus: videoProcedure.query((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx }) {
        const { video } = ctx;
        // Return cached status
        const status = yield getCachedVideoStatus(video.id);
        if (status) {
            return status;
        }
        return {
            status: video.processingStatus,
            progress: video.processingProgress || 0,
            error: video.processingError || undefined,
            hlsUrl: video.hlsPlaylistUrl || undefined,
            thumbnails: video.thumbnailOptions || undefined,
        };
    })),
    /**
     * Subscribe to processing status updates
     */
    onProcessingStatus: videoProcedure.subscription(function (_a) {
        return __asyncGenerator(this, arguments, function* ({ ctx }) {
            var _b, e_1, _c, _d;
            const { video } = ctx;
            const channel = REDIS_KEYS.videoWsChannel(video.id);
            try {
                try {
                    for (var _e = true, _f = __asyncValues(on(redisSubscriptionManager, channel)), _g; _g = yield __await(_f.next()), _b = _g.done, !_b; _e = true) {
                        _d = _g.value;
                        _e = false;
                        const [rawMessage] = _d;
                        // Runtime Validation: Ensure message matches schema
                        const result = VideoStatusEventSchema.safeParse(rawMessage);
                        if (!result.success) {
                            console.warn(`[TRPC] ⚠️ Invalid Redis message on ${channel}:`, result.error);
                            continue;
                        }
                        const data = result.data;
                        yield yield __await(data);
                        if (data.status === "READY" || data.status === "FAILED") {
                            break; // Closes iterator, removing listener
                        }
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (!_e && !_b && (_c = _f.return)) yield __await(_c.call(_f));
                    }
                    finally { if (e_1) throw e_1.error; }
                }
            }
            catch (err) {
                // Handle aborts or errors
            }
        });
    }),
    // ─── Studio Content Management ───────────────────────────────────
    /**
     * Fetch channel content (videos/shorts) with cursor-based pagination and filters.
     * Used by Studio Content page.
     */
    getChannelContent: channelProcedure
        .input(z.object({
        channelId: z.string(),
        visibility: z
            .enum(["PUBLIC", "PRIVATE", "UNLISTED", "SCHEDULED"])
            .optional(),
        search: z.string().optional(),
        isShort: z.boolean().optional(),
        isAgeRestricted: z.boolean().optional(),
        limit: z.number().min(1).max(100).default(30),
        cursor: z.string().optional(),
        sortOrder: z
            .enum(["newest", "oldest", "views"])
            .default("newest"),
    }))
        .query((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const { visibility, search, isShort, isAgeRestricted, limit, cursor, sortOrder, } = input;
        const channelId = ctx.channel.id;
        const cleanedSearch = search === null || search === void 0 ? void 0 : search.replace(/[&|!():*<>\\]/g, "").trim();
        const formattedSearch = cleanedSearch
            ? cleanedSearch
                .split(/\s+/)
                .map((word) => `${word}:*`)
                .join(" & ")
            : undefined;
        const where = Object.assign(Object.assign(Object.assign(Object.assign({ channelId, deletedAt: null }, (visibility && { visibility })), (typeof isShort === "boolean" && { isShort })), (typeof isAgeRestricted === "boolean" && {
            isAgeRestricted,
        })), (formattedSearch && {
            OR: [
                { title: { search: formattedSearch } },
                {
                    description: {
                        search: formattedSearch,
                    },
                },
            ],
        }));
        const [items, totalCount] = yield Promise.all([
            prisma.videos.findMany({
                where,
                take: limit + 1,
                cursor: cursor ? { id: cursor } : undefined,
                skip: cursor ? 1 : 0,
                orderBy: [
                    sortOrder === "views"
                        ? { viewCount: "desc" }
                        : sortOrder === "oldest"
                            ? { createdAt: "asc" }
                            : { createdAt: "desc" },
                    { id: "desc" }, // Deterministic tie-breaker
                ],
                select: {
                    id: true,
                    title: true,
                    description: true,
                    thumbnailUrl: true,
                    duration: true,
                    visibility: true,
                    adminStatus: true,
                    adminNote: true,
                    processingStatus: true,
                    processingProgress: true,
                    resolutions: true,
                    viewCount: true,
                    likeCount: true,
                    commentCount: true,
                    createdAt: true,
                    publishedAt: true,
                    scheduledAt: true,
                    isShort: true,
                    channelId: true,
                    previewSprite: true,
                    previewSpriteVtt: true,
                },
            }),
            prisma.videos.count({ where }),
        ]);
        let nextCursor = null;
        if (items.length > limit) {
            const nextItem = items.pop();
            nextCursor = nextItem.id;
        }
        return { items, nextCursor, totalCount };
    })),
    /**
     * Bulk soft-delete videos.
     * Ownership enforced via channelOwnerProcedure — only deletes videos belonging to the channel.
     */
    deleteVideos: channelProcedure
        .input(z.object({
        channelId: z.string(),
        videoIds: z.array(z.string()).min(1).max(100),
    }))
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const channelId = ctx.channel.id;
        const { videoIds } = input;
        // Fetch video IDs that will actually be soft-deleted (belong to channel, not yet deleted)
        const videosToDelete = yield prisma.videos.findMany({
            where: { id: { in: videoIds }, channelId, deletedAt: null },
            select: { id: true },
        });
        // Only delete videos that belong to this channel
        const result = yield prisma.videos.updateMany({
            where: {
                id: { in: videoIds },
                channelId,
                deletedAt: null,
            },
            data: { deletedAt: new Date() },
        });
        // Update channel stats
        updateChannelStats(channelId).catch((err) => console.error("[Video] Failed to update channel stats on delete", err));
        // Clean up S3 assets non-blocking (raw-videos + processed prefixes)
        for (const v of videosToDelete) {
            deleteS3Prefix(`raw-videos/${v.id}/`).catch((err) => console.error(`[Video] Failed to delete raw S3 assets for ${v.id}`, err));
            deleteS3Prefix(`processed/${v.id}/`).catch((err) => console.error(`[Video] Failed to delete processed S3 assets for ${v.id}`, err));
            deleteAggregateTracker(v.id).catch(() => { });
        }
        // Remove any scheduled jobs
        try {
            yield Promise.all(videoIds.map((id) => schedulerQueue.remove(id)));
        }
        catch (err) {
            console.warn(`[Video] ⚠️ Failed to remove scheduled jobs for deleted videos:`, err);
        }
        return { success: true, count: result.count };
    })),
    /**
     * Bulk update video visibility.
     * Resets scheduledAt for non-SCHEDULED visibility values.
     */
    updateVideosVisibility: channelProcedure
        .input(z.object({
        channelId: z.string(),
        videoIds: z.array(z.string()).min(1).max(100),
        visibility: z.enum(["PUBLIC", "PRIVATE", "UNLISTED"]),
    }))
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const channelId = ctx.channel.id;
        const { videoIds, visibility } = input;
        // Atomically fetch the IDs that will transition to PUBLIC by checking
        // current state *within* the update query result ordering.
        // We do a pre-fetch immediately before the update to minimize the race window.
        let previouslyNonPublicIds = [];
        if (visibility === "PUBLIC") {
            const nonPublic = yield prisma.videos.findMany({
                where: {
                    id: { in: videoIds },
                    channelId,
                    visibility: { not: "PUBLIC" },
                    deletedAt: null,
                },
                select: { id: true },
            });
            previouslyNonPublicIds = nonPublic.map((v) => v.id);
        }
        const result = yield prisma.videos.updateMany({
            where: {
                id: { in: videoIds },
                channelId,
            },
            data: {
                visibility,
                scheduledAt: null,
            },
        });
        // If transitioning to PUBLIC, set publishedAt for videos that didn't have it
        if (visibility === "PUBLIC" && previouslyNonPublicIds.length > 0) {
            yield prisma.videos.updateMany({
                where: {
                    id: { in: previouslyNonPublicIds },
                    publishedAt: null, // Only set if not already set (safety)
                },
                data: {
                    publishedAt: new Date(),
                },
            });
        }
        // Update channel stats asynchronously to prevent blocking the UI
        updateChannelStats(channelId).catch((err) => console.error("[Video] Failed to update channel stats:", err));
        // NEW_VIDEO notification: only for videos that were previously non-public
        if (visibility === "PUBLIC" && previouslyNonPublicIds.length > 0) {
            const [channel, videos] = yield Promise.all([
                prisma.channels.findUnique({
                    where: { id: channelId },
                    select: { name: true, handle: true },
                }),
                prisma.videos.findMany({
                    where: { id: { in: previouslyNonPublicIds } },
                    select: { id: true, title: true, thumbnailUrl: true },
                }),
            ]);
            for (const vid of videos) {
                redis
                    .xadd("queue:new-video-notifications", "*", "data", JSON.stringify({
                    channelId,
                    videoId: vid.id,
                    title: vid.title,
                    thumbnailUrl: vid.thumbnailUrl,
                    channelName: channel === null || channel === void 0 ? void 0 : channel.name,
                    channelHandle: channel === null || channel === void 0 ? void 0 : channel.handle,
                }))
                    .catch((err) => console.error("[Video] Failed to queue NEW_VIDEO notification", err));
            }
        }
        return { success: true, count: result.count };
    })),
    /**
     * Get single video details for editing.
     * Includes tags, category, and chapters.
     */
    getVideo: videoProcedure.query((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx }) {
        const { video } = ctx;
        const videoDetails = yield prisma.videos.findUnique({
            where: { id: video.id },
            include: {
                tags: true,
                category: true,
                chapters: {
                    orderBy: { startTime: "asc" },
                },
            },
        });
        if (!videoDetails) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: "Video not found",
            });
        }
        return videoDetails;
    })),
    /**
     * Update video metadata.
     * Handles title, description, visibility, scheduling, tags, category, and chapters.
     */
    updateVideo: videoProcedure
        .input(z
        .object({
        title: z.string().min(1).max(100).optional(),
        description: z.string().max(5000).optional(),
        visibility: z
            .enum(["PUBLIC", "PRIVATE", "UNLISTED", "SCHEDULED"])
            .optional(),
        scheduledAt: z.date().nullable().optional(),
        categoryId: z.string().nullable().optional(),
        tags: z.array(z.string()).optional(),
        chapters: z
            .array(z.object({
            title: z.string().min(1).max(200),
            startTime: z.number().min(0),
        }))
            .optional(),
        thumbnailUrl: z.string().optional(),
        isAgeRestricted: z.boolean().optional(),
        allowComments: z.boolean().optional(),
        allowEmbedding: z.boolean().optional(),
    })
        .refine((data) => {
        if (data.visibility === "SCHEDULED") {
            return data.scheduledAt != null;
        }
        return true;
    }, {
        message: "Schedule date is required when visibility is scheduled",
        path: ["scheduledAt"],
    }))
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        var _b;
        const { video } = ctx;
        const { videoId, tags, chapters } = input, otherData = __rest(input, ["videoId", "tags", "chapters"]);
        // Sanitize scheduling: clear scheduledAt if not visibility SCHEDULED
        const finalVisibility = (_b = otherData.visibility) !== null && _b !== void 0 ? _b : video.visibility;
        if (finalVisibility !== "SCHEDULED") {
            otherData.scheduledAt = null;
        }
        // Calculate publishedAt: set if transitioning to PUBLIC and not already set
        const transitioningToPublic = otherData.visibility === "PUBLIC" &&
            ctx.video.visibility !== "PUBLIC";
        const publishedAt = transitioningToPublic && !ctx.video.publishedAt
            ? new Date()
            : undefined;
        const updatedVideo = yield prisma.videos.update({
            where: { id: video.id },
            data: Object.assign(Object.assign(Object.assign(Object.assign({}, otherData), { publishedAt }), (tags && {
                tags: {
                    set: [], // Disconnect all existing tags
                    connectOrCreate: tags.map((tag) => ({
                        where: { name: tag.trim() },
                        create: { name: tag.trim() },
                    })),
                },
            })), (chapters && {
                chapters: {
                    deleteMany: {}, // Delete all existing chapters
                    create: chapters.map((c) => ({
                        title: c.title,
                        startTime: c.startTime,
                    })),
                },
            })),
            include: {
                tags: true,
                category: true,
                chapters: {
                    orderBy: { startTime: "asc" },
                },
            },
        });
        // If visibility changed, update channel stats
        if (otherData.visibility &&
            otherData.visibility !== video.visibility) {
            updateChannelStats(video.channelId).catch((err) => console.error("[Video] Failed to update channel stats on update", err));
            // NEW_VIDEO notification: fan out to subscribers when video goes PUBLIC
            if (otherData.visibility === "PUBLIC" &&
                video.visibility !== "PUBLIC") {
                // Fetch channel info for notification message
                const channel = yield prisma.channels.findUnique({
                    where: { id: video.channelId },
                    select: { name: true, handle: true },
                });
                // Push lightweight event to Redis Stream (worker handles fan-out)
                redis
                    .xadd("queue:new-video-notifications", "*", "data", JSON.stringify({
                    channelId: video.channelId,
                    videoId: video.id,
                    title: updatedVideo.title,
                    thumbnailUrl: updatedVideo.thumbnailUrl,
                    channelName: channel === null || channel === void 0 ? void 0 : channel.name,
                    channelHandle: channel === null || channel === void 0 ? void 0 : channel.handle,
                }))
                    .catch((err) => console.error("[Video] Failed to queue NEW_VIDEO notification", err));
            }
        }
        // HANDLE SCHEDULING
        // Always try to remove existing job to handle rescheduling or cancellation
        if (otherData.visibility !== undefined ||
            otherData.scheduledAt !== undefined) {
            try {
                yield schedulerQueue.remove(video.id);
                if (updatedVideo.visibility === "SCHEDULED" &&
                    updatedVideo.scheduledAt) {
                    const delay = updatedVideo.scheduledAt.getTime() - Date.now();
                    if (delay > 0) {
                        console.log(`[Video] 🕰️ Scheduling video ${video.id} publish in ${Math.round(delay / 1000)}s`);
                        yield schedulerQueue.add(JOBS.PUBLISH_SCHEDULED_VIDEO, { videoId: video.id }, {
                            delay,
                            jobId: video.id, // Enforce unique job ID per video
                            removeOnComplete: true,
                            attempts: 5,
                            backoff: {
                                type: "exponential",
                                delay: 2000,
                            },
                        });
                    }
                    else {
                        console.warn(`[Video] ⚠️ Scheduled time is in the past. Video will remain SCHEDULED until worker picks it up or user updates.`);
                        // Optionally triggered immediately?
                        // The worker *should* handle past jobs if we add with 0 delay,
                        // but let's just add it with 0 delay to be safe.
                        yield schedulerQueue.add(JOBS.PUBLISH_SCHEDULED_VIDEO, { videoId: video.id }, {
                            jobId: video.id,
                            removeOnComplete: true,
                            attempts: 5,
                            backoff: {
                                type: "exponential",
                                delay: 2000,
                            },
                        });
                    }
                }
                else {
                    console.log(`[Video] 🗑️ Removed scheduled job for ${video.id} (Visibility: ${updatedVideo.visibility})`);
                }
            }
            catch (err) {
                console.error(`[Video] ❌ Failed to manage scheduler job for ${video.id}:`, err);
                // Non-critical: don't fail the request, but log loud
            }
        }
        return updatedVideo;
    })),
    // ─── Public Playback Endpoints ───────────────────────────────────
    /**
      * Get a video for public viewing (Watch Page).
      * Works for both authenticated and unauthenticated users.
      * Watch history and engagement are only available for authenticated users.
      */
    getPublicVideo: publicProcedure
        .input(z.object({ videoId: z.string().min(1) }))
        .query((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        var _b, _c, _d, _e;
        const { videoId } = input;
        const userId = (_d = (_c = (_b = ctx.session) === null || _b === void 0 ? void 0 : _b.user) === null || _c === void 0 ? void 0 : _c.id) !== null && _d !== void 0 ? _d : null;
        const video = yield prisma.videos.findUnique({
            where: { id: videoId, deletedAt: null },
            select: {
                id: true,
                title: true,
                description: true,
                thumbnailUrl: true,
                previewSpriteVtt: true,
                previewSprite: true,
                duration: true,
                visibility: true,
                hlsPlaylistUrl: true,
                processingStatus: true,
                viewCount: true,
                likeCount: true,
                dislikeCount: true,
                commentCount: true,
                createdAt: true,
                publishedAt: true,
                channelId: true,
                channels: {
                    select: {
                        id: true,
                        name: true,
                        handle: true,
                        image: true,
                        subscriberCount: true,
                        userId: true,
                    },
                },
                tags: true,
                category: true,
                chapters: { orderBy: { startTime: "asc" } },
            },
        });
        if (!video) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: "Video not found",
            });
        }
        const isOwner = userId ? ((_e = video.channels) === null || _e === void 0 ? void 0 : _e.userId) === userId : false;
        const isPubliclyAvailable = (video.visibility === "PUBLIC" || video.visibility === "UNLISTED") &&
            video.processingStatus === "READY";
        if (!isPubliclyAvailable && !isOwner) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: "Video not found or is unavailable",
            });
        }
        // User-specific data: only fetch when authenticated
        let history = null;
        let engagement = { liked: false, disliked: false, subscribed: false };
        if (userId) {
            // Hybrid Read for Watch History
            const dbHistory = yield prisma.watch_history.findUnique({
                where: {
                    userId_videoId: { userId, videoId },
                },
                select: {
                    watchedSeconds: true,
                    lastWatchedAt: true,
                },
            });
            history = yield StreamService.getMergedHistory(userId, videoId, dbHistory);
            // Check if user liked/disliked/subscribed (Hybrid Read for all)
            const [cachedReaction, dbReaction, dbSub, cachedSub] = yield Promise.all([
                StreamService.getUserReaction(userId, videoId),
                prisma.video_reactions.findUnique({
                    where: { videoId_userId: { userId, videoId } },
                }),
                prisma.subscriptions.findUnique({
                    where: {
                        subscriberId_channelId: {
                            subscriberId: userId,
                            channelId: video.channelId,
                        },
                    },
                }),
                StreamService.getSubscriptionStatus(userId, video.channelId),
            ]);
            const rawReaction = cachedReaction || (dbReaction === null || dbReaction === void 0 ? void 0 : dbReaction.type);
            const reactionType = rawReaction === "REMOVE" ? null : rawReaction;
            // Hybrid: prefer cache (write-behind), fall back to DB
            const isSubscribed = cachedSub !== null
                ? cachedSub === "SUBSCRIBE"
                : !!dbSub;
            engagement = {
                liked: reactionType === "LIKE",
                disliked: reactionType === "DISLIKE",
                subscribed: isSubscribed,
            };
        }
        const { channels } = video, restVideo = __rest(video, ["channels"]);
        const author = channels ? {
            id: channels.id,
            name: channels.name || "Unknown Channel",
            handle: channels.handle || "",
            image: channels.image || null,
            subscriberCount: channels.subscriberCount || 0,
            // Include userId only if needed by frontend (currently watch-client doesn't need it for author, but keep it if other logic depends?)
            // Actually watch-client checks video.channels?.userId to see if it's the owner? No, that's done server-side.
            // Wait, watch owner logic is server-side in `isOwner` check.
        } : null;
        return Object.assign(Object.assign({}, restVideo), { author,
            history,
            engagement });
    })),
    /**
     * Record a public view (Fast Lane).
     * Called once when video starts or reaches threshold.
     */
    registerView: protectedProcedure
        .input(z.object({ videoId: z.string().min(1) }))
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        var _b, _c;
        const { videoId } = input;
        // Get IP/UserAgent for deduplication
        // Express Adapter puts req/res in ctx
        // We need to type cast ctx to access req if not typed
        // Assuming ctx.req is available or we use a fallback
        // In tRPC express adapter, ctx usually has req/res if we put it there in createContext
        // NOTE: ctx.user is present. ctx.req might need check.
        // checking createContext... usually it has req.
        // If not available, we use random ID? No, IP is better.
        // Let's assume we can get it or fallback.
        const ip = ctx.req.ip || ctx.session.session.ipAddress || "unknown";
        const ua = ((_c = (_b = ctx.req) === null || _b === void 0 ? void 0 : _b.headers) === null || _c === void 0 ? void 0 : _c["user-agent"]) || "unknown";
        yield StreamService.addViewItem(videoId, ip, ua);
        return { success: true };
    })),
    /**
     * Heartbeat: Update Watch Progress (Reliable Lane).
     * Called every 10-30s by client.
     */
    updateWatchProgress: protectedProcedure
        .input(z.object({
        videoId: z.string().min(1),
        seconds: z.number().min(0),
    }))
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const userId = ctx.session.user.id;
        const { videoId, seconds } = input;
        yield StreamService.addHistoryItem(userId, videoId, seconds);
        return { success: true };
    })),
    setChapters: videoProcedure
        .input(z.object({
        videoId: z.string(),
        chapters: z.array(z.object({
            title: z.string().max(100),
            startTime: z.number().int().min(0),
        })),
    }))
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ input }) {
        const { videoId, chapters } = input;
        yield prisma.$transaction([
            prisma.video_chapters.deleteMany({ where: { videoId } }),
            prisma.video_chapters.createMany({
                data: chapters.map((c) => (Object.assign({ videoId }, c))),
            }),
        ]);
        return { success: true };
    })),
    getChapters: protectedProcedure
        .input(z.object({ videoId: z.string() }))
        .query((_a) => __awaiter(void 0, [_a], void 0, function* ({ input }) {
        return prisma.video_chapters.findMany({
            where: { videoId: input.videoId },
            orderBy: { startTime: "asc" },
        });
    })),
    addCard: videoProcedure
        .input(z.object({
        videoId: z.string(),
        type: z.enum(["VIDEO", "PLAYLIST", "CHANNEL", "LINK", "POLL"]),
        title: z.string().max(100).optional(),
        startTime: z.number().int().min(0),
        endTime: z.number().int().optional(),
        targetVideoId: z.string().optional(),
        targetPlaylistId: z.string().optional(),
        targetChannelId: z.string().optional(),
        targetUrl: z.string().url().max(500).optional(),
        pollOptions: z.array(z.string().min(1).max(200)).min(2).max(10).optional(),
    }))
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ input }) {
        const { videoId } = input, data = __rest(input, ["videoId"]);
        return prisma.video_cards.create({
            data: Object.assign({ videoId }, data),
        });
    })),
    updateCard: videoProcedure
        .input(z.object({
        videoId: z.string(),
        cardId: z.string(),
        title: z.string().max(100).optional(),
        startTime: z.number().int().min(0).optional(),
        endTime: z.number().int().optional(),
        targetVideoId: z.string().optional(),
        targetPlaylistId: z.string().optional(),
        targetChannelId: z.string().optional(),
        targetUrl: z.string().url().max(500).optional(),
        pollOptions: z.array(z.string().min(1).max(200)).min(2).max(10).optional(),
    }))
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ input }) {
        const { videoId, cardId } = input, data = __rest(input, ["videoId", "cardId"]);
        const existing = yield prisma.video_cards.findUnique({ where: { id: cardId } });
        if (!existing || existing.videoId !== videoId) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Card not found on this video" });
        }
        return prisma.video_cards.update({
            where: { id: cardId },
            data,
        });
    })),
    deleteCard: videoProcedure
        .input(z.object({ videoId: z.string(), cardId: z.string() }))
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ input }) {
        const { videoId, cardId } = input;
        const existing = yield prisma.video_cards.findUnique({ where: { id: cardId } });
        if (!existing || existing.videoId !== videoId) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Card not found on this video" });
        }
        yield prisma.video_cards.delete({ where: { id: cardId } });
        return { success: true };
    })),
    getCards: protectedProcedure
        .input(z.object({ videoId: z.string() }))
        .query((_a) => __awaiter(void 0, [_a], void 0, function* ({ input }) {
        return prisma.video_cards.findMany({
            where: { videoId: input.videoId },
            orderBy: { startTime: "asc" },
        });
    })),
});
