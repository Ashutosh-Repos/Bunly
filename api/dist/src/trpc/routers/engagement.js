var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { z } from "zod";
import { protectedProcedure, router } from "../router.js";
import { StreamService } from "../../services/StreamService";
import { TRPCError } from "@trpc/server";
import { prisma } from "../../lib/prisma";
/** Hybrid cache→DB read for a user's reaction on a video. */
function getReaction(userId, videoId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const cached = yield StreamService.getUserReaction(userId, videoId);
        if (cached !== null)
            return cached;
        const db = yield prisma.video_reactions.findUnique({
            where: { videoId_userId: { videoId, userId } },
        });
        return (_a = db === null || db === void 0 ? void 0 : db.type) !== null && _a !== void 0 ? _a : null;
    });
}
/**
 * Ensures the target video exists, is not soft-deleted, and is visible to the requesting user.
 */
function verifyEngagementAccess(videoId, userId) {
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
                message: "Content not found",
            });
        }
        const isOwner = ((_a = video.channels) === null || _a === void 0 ? void 0 : _a.userId) === userId;
        const isPubliclyAvailable = (video.visibility === "PUBLIC" || video.visibility === "UNLISTED") &&
            video.processingStatus === "READY";
        if (!isPubliclyAvailable && !isOwner) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: "Content not available for engagement",
            });
        }
    });
}
export const engagementRouter = router({
    /**
     * Get the current user's reaction (LIKE/DISLIKE/null) for a video.
     * Used by ShortsClient to hydrate initial engagement state.
     */
    getReaction: protectedProcedure
        .input(z.object({ videoId: z.string().min(1) }))
        .query((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const userId = ctx.session.user.id;
        const { videoId } = input;
        const reaction = yield getReaction(userId, videoId);
        const type = reaction === "REMOVE" ? null : reaction;
        return { type };
    })),
    /**
     * Toggle Like on a video.
     * If already liked, removes like.
     * If disliked, changes to like.
     */
    toggleLike: protectedProcedure
        .input(z.object({ videoId: z.string().min(1) }))
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const userId = ctx.session.user.id;
        const { videoId } = input;
        yield verifyEngagementAccess(videoId, userId);
        const currentReaction = yield getReaction(userId, videoId);
        let action = "LIKE";
        if (currentReaction === "LIKE") {
            action = "REMOVE";
        }
        else {
            action = "LIKE";
        }
        yield StreamService.addReaction(userId, videoId, action);
        return { status: action };
    })),
    /**
     * Toggle Dislike on a video.
     */
    toggleDislike: protectedProcedure
        .input(z.object({ videoId: z.string().min(1) }))
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const userId = ctx.session.user.id;
        const { videoId } = input;
        yield verifyEngagementAccess(videoId, userId);
        const currentReaction = yield getReaction(userId, videoId);
        let action = "DISLIKE";
        if (currentReaction === "DISLIKE") {
            action = "REMOVE";
        }
        else {
            action = "DISLIKE";
        }
        yield StreamService.addReaction(userId, videoId, action);
        return { status: action };
    })),
});
