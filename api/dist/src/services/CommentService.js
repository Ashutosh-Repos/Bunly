var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { prisma } from "../lib/prisma";
import redis from "../lib/redis";
import { NotificationService } from "./NotificationService";
import { TRPCError } from "@trpc/server";
export class CommentService {
    /**
     * Helper to verify if a user has read/write access to a video's comments.
     */
    static verifyVideoAccess(videoId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const video = yield prisma.videos.findUnique({
                where: { id: videoId },
                select: {
                    visibility: true,
                    processingStatus: true,
                    deletedAt: true,
                    channels: { select: { userId: true } },
                },
            });
            if (!video || video.deletedAt) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Video not found",
                });
            }
            const isOwner = ((_a = video.channels) === null || _a === void 0 ? void 0 : _a.userId) === userId;
            const isPubliclyAvailable = (video.visibility === "PUBLIC" || video.visibility === "UNLISTED") &&
                video.processingStatus === "READY";
            if (!isPubliclyAvailable && !isOwner) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Video not found or is unavailable",
                });
            }
            return true;
        });
    }
    /**
     * Get comments for a video with tiered caching.
     * - Page 1 is cached in Redis for 5 minutes.
     * - Subsequent pages hit the DB using cursor pagination.
     */
    static getComments(videoId_1) {
        return __awaiter(this, arguments, void 0, function* (videoId, sortBy = "NEWEST", cursor = null, limit = 20, userId) {
            // 0. Security Guard (Must run on every request regardless of cache)
            yield this.verifyVideoAccess(videoId, userId);
            // 1. Try Cache for First Page
            const isFirstPage = !cursor;
            const cacheKey = this.KEYS.list(videoId, sortBy);
            if (isFirstPage) {
                const cached = yield redis.get(cacheKey);
                if (cached) {
                    try {
                        const result = JSON.parse(cached);
                        // 6. Hydrate User Reactions (Always for Logged In User)
                        let reactions = {};
                        if (userId) {
                            const commentIds = result.items.map((c) => c.id);
                            reactions = yield this.fetchUserReactionsBatch(userId, commentIds);
                        }
                        // Attach reaction to each item
                        result.items = result.items.map((c) => (Object.assign(Object.assign({}, c), { userReaction: reactions[c.id] || null })));
                        return result;
                    }
                    catch (e) {
                        console.warn("Invalid comment cache", e);
                    }
                }
            }
            // 2. Build Query
            const orderBy = sortBy === "TOP"
                ? [
                    { isPinned: "desc" },
                    { likeCount: "desc" },
                    { createdAt: "desc" },
                ]
                : [
                    { isPinned: "desc" },
                    { createdAt: "desc" },
                ];
            const where = {
                videoId,
                parentId: null, // Top-level comments only
                status: "VISIBLE",
                deletedAt: null, // Filter out soft-deleted
            };
            // 3. Execute DB Query
            const comments = yield prisma.comments.findMany({
                take: limit + 1, // +1 to check for next page
                where,
                orderBy,
                cursor: cursor ? { id: cursor } : undefined,
                skip: cursor ? 1 : 0,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            image: true,
                            channels: {
                                select: {
                                    handle: true,
                                    name: true,
                                    image: true,
                                    isVerified: true,
                                },
                                take: 1,
                            },
                        },
                    },
                },
            });
            // 4. Transform & Pagination Logic
            let nextCursor = null;
            if (comments.length > limit) {
                const nextItem = comments.pop();
                nextCursor = (nextItem === null || nextItem === void 0 ? void 0 : nextItem.id) || null;
            }
            const result = {
                items: comments,
                nextCursor,
            };
            // 5. Cache First Page (Async) -> CACHE RAW ITEMS ONLY (Shared)
            if (isFirstPage) {
                yield redis.set(cacheKey, JSON.stringify(result), "EX", this.CACHE_TTL);
            }
            let reactions = {};
            if (userId) {
                const commentIds = result.items.map((c) => c.id);
                reactions = yield this.fetchUserReactionsBatch(userId, commentIds);
            }
            // Attach reaction to each item
            result.items = result.items.map((c) => (Object.assign(Object.assign({}, c), { userReaction: reactions[c.id] || null })));
            return result;
        });
    }
    /**
     * Get replies for a specific comment.
     * Replies are usually less hot, so we might skip caching for now or use shorter TTL.
     */
    static getReplies(parentId_1) {
        return __awaiter(this, arguments, void 0, function* (parentId, cursor = null, limit = 10, userId) {
            // 1. Try Cache for First Page
            const isFirstPage = !cursor;
            const cacheKey = `comment:${parentId}:replies:page1`;
            if (isFirstPage) {
                const cached = yield redis.get(cacheKey);
                if (cached) {
                    try {
                        const result = JSON.parse(cached);
                        // Hydrate Reactions
                        let reactions = {};
                        if (userId) {
                            const commentIds = result.items.map((c) => c.id);
                            reactions = yield this.fetchUserReactionsBatch(userId, commentIds);
                        }
                        result.items = result.items.map((c) => (Object.assign(Object.assign({}, c), { userReaction: reactions[c.id] || null })));
                        return result;
                    }
                    catch (e) {
                        console.warn("Invalid replies cache", e);
                    }
                }
            }
            const comments = yield prisma.comments.findMany({
                take: limit + 1,
                where: {
                    parentId,
                    status: "VISIBLE",
                    deletedAt: null,
                },
                orderBy: { createdAt: "asc" },
                cursor: cursor ? { id: cursor } : undefined,
                skip: cursor ? 1 : 0,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            image: true,
                            channels: {
                                select: {
                                    handle: true,
                                    name: true,
                                    image: true,
                                    isVerified: true,
                                },
                                take: 1,
                            },
                        },
                    },
                },
            });
            let nextCursor = null;
            if (comments.length > limit) {
                const nextItem = comments.pop();
                nextCursor = (nextItem === null || nextItem === void 0 ? void 0 : nextItem.id) || null;
            }
            const result = {
                items: comments,
                nextCursor,
            };
            // Cache First Page (Async) - Short TTL (e.g. 60s) as replies change fast in viral threads
            if (isFirstPage) {
                yield redis.set(cacheKey, JSON.stringify(result), "EX", 60);
            }
            // Hydrate Reactions
            let reactions = {};
            if (userId) {
                const commentIds = result.items.map((c) => c.id);
                reactions = yield this.fetchUserReactionsBatch(userId, commentIds);
            }
            result.items = result.items.map((c) => (Object.assign(Object.assign({}, c), { userReaction: reactions[c.id] || null })));
            return result;
        });
    }
    /**
     * Create a new comment.
     * - Writes to DB
     * - Updates Counts (Video & Parent)
     * - Triggers Notifications
     * - Invalidates List Cache
     */
    static createComment(userId, videoId, content, parentId) {
        return __awaiter(this, void 0, void 0, function* () {
            // 0. Security Guard
            yield this.verifyVideoAccess(videoId, userId);
            let effectiveParentId = parentId;
            if (parentId) {
                const parent = yield prisma.comments.findUnique({
                    where: { id: parentId },
                    select: { id: true, parentId: true, deletedAt: true },
                });
                if (!parent || parent.deletedAt) {
                    throw new Error("Cannot reply to a deleted comment");
                }
                // Flattening: If parent is already a reply, use ITS parent (the root)
                if (parent.parentId) {
                    effectiveParentId = parent.parentId;
                }
            }
            // 1. Create Comment
            const result = yield prisma.comments.create({
                data: {
                    userId,
                    videoId,
                    content,
                    parentId: effectiveParentId,
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            image: true,
                            channels: {
                                select: {
                                    handle: true,
                                    name: true,
                                    image: true,
                                    isVerified: true,
                                },
                                take: 1,
                            },
                        },
                    },
                    videos: {
                        select: {
                            channelId: true,
                            title: true,
                            thumbnailUrl: true,
                            channels: {
                                select: {
                                    userId: true,
                                },
                            },
                        },
                    },
                },
            });
            // 2. Invalidate Caches
            yield redis.del(this.KEYS.list(videoId, "TOP"), this.KEYS.list(videoId, "NEWEST"));
            if (effectiveParentId) {
                yield redis.del(`comment:${effectiveParentId}:replies:page1`);
            }
            // 3. Trigger Notifications (Async)
            this.handleNotifications(result, userId).catch((err) => {
                console.error("Failed to send comment notifications", err);
            });
            // 4. Queue Comment Count Update (Fire & Forget)
            const pipeline = redis.pipeline();
            // Video Count
            pipeline.xadd(this.KEYS.countStream, "*", "type", "video", "entityId", videoId, "delta", "1");
            // Reply Count (if reply)
            if (effectiveParentId) {
                pipeline.xadd(this.KEYS.countStream, "*", "type", "comment", "entityId", effectiveParentId, "delta", "1");
            }
            yield pipeline.exec().catch((err) => {
                console.error("Failed to queue comment count increments", err);
            });
            return result;
        });
    }
    static handleNotifications(comment, actorId) {
        return __awaiter(this, void 0, void 0, function* () {
            // A. Video Owner Notification
            const videoOwnerId = comment.videos.channels.userId;
            // Don't notify if commenting on own video
            if (videoOwnerId !== actorId) {
                const truncated = comment.content.length > 50
                    ? comment.content.substring(0, 50) + "..."
                    : comment.content;
                yield NotificationService.notify({
                    userId: videoOwnerId,
                    actorId: actorId,
                    type: "COMMENT",
                    title: "New Comment",
                    message: `commented: "${truncated}"`,
                    videoId: comment.videoId,
                    commentId: comment.id,
                    thumbnailUrl: comment.videos.thumbnailUrl || undefined,
                    actionUrl: `/watch/${comment.videoId}?lc=${comment.id}`,
                });
            }
            // B. Reply Notification
            if (comment.parentId) {
                const parent = yield prisma.comments.findUnique({
                    where: { id: comment.parentId },
                    select: { userId: true },
                });
                if (parent &&
                    parent.userId !== actorId &&
                    parent.userId !== videoOwnerId) {
                    const truncatedReply = comment.content.length > 50
                        ? comment.content.substring(0, 50) + "..."
                        : comment.content;
                    yield NotificationService.notify({
                        userId: parent.userId,
                        actorId: actorId,
                        type: "COMMENT_REPLY",
                        title: "New Reply",
                        message: `replied: "${truncatedReply}"`,
                        videoId: comment.videoId,
                        commentId: comment.id,
                        thumbnailUrl: comment.videos.thumbnailUrl || undefined,
                        actionUrl: `/watch/${comment.videoId}?lc=${comment.id}`,
                    });
                }
            }
        });
    }
    /**
     * Soft delete a comment.
     * - Sets deletedAt
     * - Decrements Counts
     * - Invalidates Cache
     */
    static deleteComment(commentId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const comment = yield prisma.comments.findUnique({
                where: { id: commentId },
                select: {
                    userId: true,
                    videoId: true,
                    parentId: true,
                    deletedAt: true,
                },
            });
            if (!comment)
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Comment not found",
                });
            if (comment.userId !== userId)
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "You do not own this comment",
                });
            if (comment.deletedAt)
                throw new TRPCError({
                    code: "CONFLICT",
                    message: "Comment already deleted",
                });
            // Soft Delete
            yield prisma.comments.update({
                where: { id: commentId },
                data: { deletedAt: new Date() },
            });
            // Invalidate Cache
            yield redis.del(this.KEYS.list(comment.videoId, "TOP"), this.KEYS.list(comment.videoId, "NEWEST"));
            if (comment.parentId) {
                yield redis.del(`comment:${comment.parentId}:replies:page1`);
            }
            // Queue Comment Count Decrement
            const pipeline = redis.pipeline();
            pipeline.xadd(this.KEYS.countStream, "*", "type", "video", "entityId", comment.videoId, "delta", "-1");
            if (comment.parentId) {
                pipeline.xadd(this.KEYS.countStream, "*", "type", "comment", "entityId", comment.parentId, "delta", "-1");
            }
            pipeline.exec().catch((err) => {
                console.error("Failed to queue comment count decrements", err);
            });
            return { success: true };
        });
    }
    /**
     * Add a reaction (Like/Dislike) to a comment.
     * High-scale implementation using Write-Behind pattern.
     */
    static addReaction(userId, commentId, type, videoId) {
        return __awaiter(this, void 0, void 0, function* () {
            const reactionKey = this.KEYS.reaction(userId, commentId);
            const timestamp = Date.now();
            const pipeline = redis.pipeline();
            // 1. Update User Cache (Read-Your-Own-Write)
            if (type === "REMOVE") {
                pipeline.set(reactionKey, "REMOVE", "EX", this.FAST_LANE_TTL);
            }
            else {
                pipeline.set(reactionKey, type, "EX", this.FAST_LANE_TTL);
            }
            // 2. Push to Stream for worker
            pipeline.xadd(this.KEYS.engagementStream, "MAXLEN", "~", 1000000, "*", "data", JSON.stringify({
                userId,
                commentId,
                videoId,
                type,
                timestamp,
            }));
            yield pipeline.exec();
        });
    }
    /**
     * Get user's current reaction for a comment.
     * Hybrid Read: Cache || DB
     */
    static getUserReaction(userId, commentId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const reactionKey = this.KEYS.reaction(userId, commentId);
                const cached = yield redis.get(reactionKey);
                if (cached)
                    return cached;
                // Fallback to DB
                const dbReaction = yield prisma.comment_reactions.findUnique({
                    where: { commentId_userId: { commentId, userId } },
                });
                return (dbReaction === null || dbReaction === void 0 ? void 0 : dbReaction.type) || null;
            }
            catch (e) {
                return null;
            }
        });
    }
    /**
     * Batch fetch user reactions for a list of comment IDs.
     * Uses Pipeline/MGET for cache and single DB query for misses.
     */
    static fetchUserReactionsBatch(userId, commentIds) {
        return __awaiter(this, void 0, void 0, function* () {
            if (commentIds.length === 0)
                return {};
            const keys = commentIds.map((id) => this.KEYS.reaction(userId, id));
            const reactionMap = {};
            const missingIds = [];
            try {
                // 1. Try Cache (MGET)
                const cachedValues = yield redis.mget(keys);
                cachedValues.forEach((val, idx) => {
                    if (val) {
                        if (val !== "REMOVE") {
                            reactionMap[commentIds[idx]] = val;
                        }
                    }
                    else {
                        missingIds.push(commentIds[idx]);
                    }
                });
                // 2. Fetch Missing from DB
                if (missingIds.length > 0) {
                    const dbReactions = yield prisma.comment_reactions.findMany({
                        where: {
                            userId,
                            commentId: { in: missingIds },
                        },
                        select: { commentId: true, type: true },
                    });
                    dbReactions.forEach((r) => {
                        reactionMap[r.commentId] = r.type;
                    });
                }
            }
            catch (e) {
                console.error("Failed to batch fetch reactions", e);
            }
            return reactionMap;
        });
    }
    /**
     * Edit a comment's content.
     */
    static editComment(commentId, userId, content) {
        return __awaiter(this, void 0, void 0, function* () {
            const comment = yield prisma.comments.findUnique({
                where: { id: commentId },
                select: { userId: true, videoId: true },
            });
            if (!comment || comment.userId !== userId) {
                throw new Error("Unauthorized to edit this comment");
            }
            const updated = yield prisma.comments.update({
                where: { id: commentId },
                data: { content, isEdited: true },
            });
            // Invalidate caches
            yield redis.del(this.KEYS.list(comment.videoId, "TOP"), this.KEYS.list(comment.videoId, "NEWEST"));
            return updated;
        });
    }
    /**
     * Pin or unpin a comment. Only the video owner can do this.
     */
    static pinComment(commentId, callerUserId, videoId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Verify caller owns the video
            const video = yield prisma.videos.findUnique({
                where: { id: videoId },
                select: { channels: { select: { userId: true } } },
            });
            if (!video || video.channels.userId !== callerUserId) {
                throw new Error("Unauthorized to pin comments on this video");
            }
            const comment = yield prisma.comments.findUnique({
                where: { id: commentId },
                select: { isPinned: true, videoId: true },
            });
            if (!comment || comment.videoId !== videoId) {
                throw new Error("Comment does not belong to this video");
            }
            const newPinnedState = !comment.isPinned;
            yield prisma.$transaction([
                // Unpin all other comments for this video
                prisma.comments.updateMany({
                    where: { videoId, isPinned: true },
                    data: { isPinned: false },
                }),
                // Set new pinned state
                prisma.comments.update({
                    where: { id: commentId },
                    data: { isPinned: newPinnedState },
                }),
            ]);
            // Invalidate caches
            yield redis.del(this.KEYS.list(videoId, "TOP"), this.KEYS.list(videoId, "NEWEST"));
            return { isPinned: newPinnedState };
        });
    }
    /**
     * Heart or unheart a comment. Only the video owner can do this.
     */
    static heartComment(commentId, callerUserId, videoId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Verify caller owns the video
            const video = yield prisma.videos.findUnique({
                where: { id: videoId },
                select: { title: true, thumbnailUrl: true, channels: { select: { userId: true } } },
            });
            if (!video || video.channels.userId !== callerUserId) {
                throw new Error("Unauthorized to heart comments on this video");
            }
            const comment = yield prisma.comments.findUnique({
                where: { id: commentId },
                select: { isHearted: true, videoId: true, userId: true },
            });
            if (!comment || comment.videoId !== videoId) {
                throw new Error("Comment does not belong to this video");
            }
            const newHeartedState = !comment.isHearted;
            const updated = yield prisma.comments.update({
                where: { id: commentId },
                data: { isHearted: newHeartedState },
            });
            // Notify if hearting
            if (newHeartedState && comment.userId !== callerUserId) {
                yield NotificationService.notify({
                    userId: comment.userId,
                    actorId: callerUserId,
                    type: "COMMENT_LIKE", // Reusing COMMENT_LIKE type for owner heart
                    title: "Creator Loved Your Comment!",
                    message: `The creator loved your comment on "${video.title}"`,
                    videoId: videoId,
                    commentId: commentId,
                    thumbnailUrl: video.thumbnailUrl || undefined,
                    actionUrl: `/watch/${videoId}?lc=${commentId}`,
                }).catch(e => console.error("Failed to send heart notification", e));
            }
            // Invalidate caches
            yield redis.del(this.KEYS.list(videoId, "TOP"), this.KEYS.list(videoId, "NEWEST"));
            return { isHearted: newHeartedState };
        });
    }
    /**
     * Get a single comment by ID, fully hydrated with user and reaction state.
     * Used for highlighting specific linked comments (e.g. from notifications).
     */
    static getById(commentId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const comment = yield prisma.comments.findUnique({
                where: { id: commentId, status: "VISIBLE", deletedAt: null },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            image: true,
                            channels: {
                                select: {
                                    handle: true,
                                    name: true,
                                    image: true,
                                    isVerified: true,
                                },
                                take: 1,
                            },
                        },
                    },
                },
            });
            if (!comment)
                return null;
            let userReaction = null;
            if (userId) {
                userReaction = yield this.getUserReaction(userId, commentId);
            }
            return Object.assign(Object.assign({}, comment), { userReaction });
        });
    }
}
CommentService.CACHE_TTL = 300; // 5 minutes for list cache
CommentService.FAST_LANE_TTL = 86400; // 24 hours for reaction cache
CommentService.KEYS = {
    list: (videoId, sort) => `video:${videoId}:comments:${sort.toLowerCase()}:page1`,
    reaction: (userId, commentId) => `user:comment_reaction:${userId}:${commentId}`,
    engagementStream: "queue:comment-engagement",
    countStream: "queue:comment-count",
};
