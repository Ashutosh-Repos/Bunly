import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../router.js";
import { CommentService, CommentSort, type CommentListResult } from "../../services/CommentService";
import { TRPCError } from "@trpc/server";
import { prisma } from "../../lib/prisma";

export const commentRouter = router({
    list: publicProcedure
        .input(
            z.object({
                videoId: z.string(),
                sortBy: z.enum(["TOP", "NEWEST"]).optional().default("NEWEST"),
                cursor: z.string().nullish(),
                limit: z.number().min(1).max(50).optional().default(20),
            }),
        )
        .query(async ({ input, ctx }) => {
            const { videoId, sortBy, cursor, limit } = input;
            const userId = ctx.session?.user?.id ?? "";

            return (await CommentService.getComments(
                videoId,
                sortBy as CommentSort,
                cursor,
                limit,
                userId,
            )) as CommentListResult;
        }),

    getById: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ input, ctx }) => {
            const comment = await CommentService.getById(
                input.id,
                ctx.session.user.id,
            );
            if (!comment) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Comment not found or deleted",
                });
            }
            return comment;
        }),

    replies: protectedProcedure
        .input(
            z.object({
                parentId: z.string(),
                cursor: z.string().nullish(),
                limit: z.number().min(1).max(50).optional().default(10),
            }),
        )
        .query(async ({ input, ctx }) => {
            const { parentId, cursor, limit } = input;
            const userId = ctx.session.user.id;
            return (await CommentService.getReplies(parentId, cursor, limit, userId)) as CommentListResult;
        }),

    create: protectedProcedure
        .input(
            z.object({
                videoId: z.string(),
                content: z.string().min(1).max(2000), // Reasonable limit
                parentId: z.string().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { videoId, content, parentId } = input;
            // CommentService.createComment handles:
            // - DB insert + cache invalidation + notifications
            // - Streaming commentCount/replyCount increments to CommentCountWorker
            return CommentService.createComment(
                ctx.session.user.id,
                videoId,
                content,
                parentId,
            );
        }),

    toggleLike: protectedProcedure
        .input(z.object({ commentId: z.string(), videoId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;
            const { commentId, videoId } = input;

            const comment = await prisma.comments.findUnique({
                where: { id: commentId },
                select: { videoId: true },
            });

            if (!comment || comment.videoId !== videoId) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message:
                        "Comment not found or does not belong to this video",
                });
            }

            // Check current state (Hybrid Read)
            const current = await CommentService.getUserReaction(
                userId,
                commentId,
            );

            let action: "LIKE" | "REMOVE" = "LIKE";
            if (current === "LIKE") {
                action = "REMOVE";
            } else {
                action = "LIKE"; // Overwrites DISLIKE if exists
            }

            await CommentService.addReaction(
                userId,
                commentId,
                action,
                videoId,
            );
            return { status: action };
        }),

    toggleDislike: protectedProcedure
        .input(z.object({ commentId: z.string(), videoId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;
            const { commentId, videoId } = input;

            const comment = await prisma.comments.findUnique({
                where: { id: commentId },
                select: { videoId: true },
            });

            if (!comment || comment.videoId !== videoId) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message:
                        "Comment not found or does not belong to this video",
                });
            }

            const current = await CommentService.getUserReaction(
                userId,
                commentId,
            );

            let action: "DISLIKE" | "REMOVE" = "DISLIKE";
            if (current === "DISLIKE") {
                action = "REMOVE";
            } else {
                action = "DISLIKE";
            }

            await CommentService.addReaction(
                userId,
                commentId,
                action,
                videoId,
            );
            return { status: action };
        }),

    edit: protectedProcedure
        .input(
            z.object({
                commentId: z.string(),
                content: z.string().min(1).max(2000),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            return CommentService.editComment(
                input.commentId,
                ctx.session.user.id,
                input.content,
            );
        }),

    pin: protectedProcedure
        .input(z.object({ commentId: z.string(), videoId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            return CommentService.pinComment(
                input.commentId,
                ctx.session.user.id,
                input.videoId,
            );
        }),

    heart: protectedProcedure
        .input(z.object({ commentId: z.string(), videoId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            return CommentService.heartComment(
                input.commentId,
                ctx.session.user.id,
                input.videoId,
            );
        }),

    delete: protectedProcedure
        .input(z.object({ commentId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            // CommentService.deleteComment handles:
            // - Soft delete + cache invalidation
            // - Streaming commentCount decrement to CommentCountWorker
            return CommentService.deleteComment(
                input.commentId,
                ctx.session.user.id,
            );
        }),

    getChannelComments: protectedProcedure
        .input(
            z.object({
                channelId: z.string(),
                cursor: z.string().nullish(),
                limit: z.number().min(1).max(50).optional().default(20),
            })
        )
        .query(async ({ ctx, input }) => {
            const { channelId, cursor, limit } = input;
            
            // First verify user owns the channel
            const channel = await prisma.channels.findUnique({
                where: { id: channelId },
                select: { userId: true }
            });

            if (!channel || channel.userId !== ctx.session.user.id) {
                throw new TRPCError({ code: "FORBIDDEN", message: "Not your channel" });
            }

            return await CommentService.getChannelComments(
                channelId,
                cursor ?? null,
                limit,
                ctx.session.user.id
            );
        }),
});
