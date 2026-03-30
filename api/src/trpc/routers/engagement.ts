import { z } from "zod";
import { protectedProcedure, router } from "../router.js";
import { StreamService } from "../../services/StreamService.js";
import { TRPCError } from "@trpc/server";
import { prisma } from "../../lib/prisma.js";

/** Hybrid cache→DB read for a user's reaction on a video. */
async function getReaction(
    userId: string,
    videoId: string,
): Promise<string | null> {
    const cached = await StreamService.getUserReaction(userId, videoId);
    if (cached !== null) return cached;
    const db = await prisma.video_reactions.findUnique({
        where: { videoId_userId: { videoId, userId } },
    });
    return db?.type ?? null;
}

/**
 * Ensures the target video exists, is not soft-deleted, and is visible to the requesting user.
 */
async function verifyEngagementAccess(videoId: string, userId: string) {
    const video = await prisma.videos.findUnique({
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

    const isOwner = video.channels?.userId === userId;
    const isPubliclyAvailable =
        (video.visibility === "PUBLIC" || video.visibility === "UNLISTED") &&
        video.processingStatus === "READY";

    if (!isPubliclyAvailable && !isOwner) {
        throw new TRPCError({
            code: "NOT_FOUND",
            message: "Content not available for engagement",
        });
    }
}

export const engagementRouter = router({
    /**
     * Get the current user's reaction (LIKE/DISLIKE/null) for a video.
     * Used by ShortsClient to hydrate initial engagement state.
     */
    getReaction: protectedProcedure
        .input(z.object({ videoId: z.string().min(1) }))
        .query(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;
            const { videoId } = input;

            const reaction = await getReaction(userId, videoId);
            const type = reaction === "REMOVE" ? null : reaction;

            return { type };
        }),

    /**
     * Toggle Like on a video.
     * If already liked, removes like.
     * If disliked, changes to like.
     */
    toggleLike: protectedProcedure
        .input(z.object({ videoId: z.string().min(1) }))
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;
            const { videoId } = input;

            // Parallel: verify access + read current reaction (saves 1 DB round-trip)
            const [, currentReaction] = await Promise.all([
                verifyEngagementAccess(videoId, userId),
                getReaction(userId, videoId),
            ]);

            const action: "LIKE" | "REMOVE" = currentReaction === "LIKE" ? "REMOVE" : "LIKE";

            await StreamService.addReaction(userId, videoId, action);

            return { status: action };
        }),

    /**
     * Toggle Dislike on a video.
     */
    toggleDislike: protectedProcedure
        .input(z.object({ videoId: z.string().min(1) }))
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;
            const { videoId } = input;

            // Parallel: verify access + read current reaction
            const [, currentReaction] = await Promise.all([
                verifyEngagementAccess(videoId, userId),
                getReaction(userId, videoId),
            ]);

            const action: "DISLIKE" | "REMOVE" = currentReaction === "DISLIKE" ? "REMOVE" : "DISLIKE";

            await StreamService.addReaction(userId, videoId, action);

            return { status: action };
        }),
});
