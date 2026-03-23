import { z } from "zod";
import { protectedProcedure, router } from "../router.js";
import { StreamService } from "../../services/StreamService";
import { TRPCError } from "@trpc/server";
import { prisma } from "../../lib/prisma";

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
     * Toggle Like on a video.
     * If already liked, removes like.
     * If disliked, changes to like.
     */
    toggleLike: protectedProcedure
        .input(z.object({ videoId: z.string().min(1) }))
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;
            const { videoId } = input;

            await verifyEngagementAccess(videoId, userId);

            const currentReaction = await getReaction(userId, videoId);

            let action: "LIKE" | "REMOVE" | "DISLIKE" = "LIKE";

            if (currentReaction === "LIKE") {
                action = "REMOVE";
            } else {
                action = "LIKE";
            }

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

            await verifyEngagementAccess(videoId, userId);

            const currentReaction = await getReaction(userId, videoId);

            let action: "DISLIKE" | "REMOVE" | "LIKE" = "DISLIKE";

            if (currentReaction === "DISLIKE") {
                action = "REMOVE";
            } else {
                action = "DISLIKE";
            }

            await StreamService.addReaction(userId, videoId, action);

            return { status: action };
        }),
});
