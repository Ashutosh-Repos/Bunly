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
import { router, protectedProcedure } from "../router.js";
import { CommentService } from "../../services/CommentService";
import { TRPCError } from "@trpc/server";
import { prisma } from "../../lib/prisma";
export const commentRouter = router({
    list: protectedProcedure
        .input(z.object({
        videoId: z.string(),
        sortBy: z.enum(["TOP", "NEWEST"]).optional().default("NEWEST"),
        cursor: z.string().nullish(),
        limit: z.number().min(1).max(50).optional().default(20),
    }))
        .query((_a) => __awaiter(void 0, [_a], void 0, function* ({ input, ctx }) {
        const { videoId, sortBy, cursor, limit } = input;
        const userId = ctx.session.user.id;
        return CommentService.getComments(videoId, sortBy, cursor, limit, userId);
    })),
    getById: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query((_a) => __awaiter(void 0, [_a], void 0, function* ({ input, ctx }) {
        const comment = yield CommentService.getById(input.id, ctx.session.user.id);
        if (!comment) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: "Comment not found or deleted",
            });
        }
        return comment;
    })),
    replies: protectedProcedure
        .input(z.object({
        parentId: z.string(),
        cursor: z.string().nullish(),
        limit: z.number().min(1).max(50).optional().default(10),
    }))
        .query((_a) => __awaiter(void 0, [_a], void 0, function* ({ input, ctx }) {
        var _b;
        const { parentId, cursor, limit } = input;
        const userId = (_b = ctx.session.user) === null || _b === void 0 ? void 0 : _b.id;
        return CommentService.getReplies(parentId, cursor, limit, userId);
    })),
    create: protectedProcedure
        .input(z.object({
        videoId: z.string(),
        content: z.string().min(1).max(2000), // Reasonable limit
        parentId: z.string().optional(),
    }))
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const { videoId, content, parentId } = input;
        const comment = yield CommentService.createComment(ctx.session.user.id, videoId, content, parentId);
        return comment;
    })),
    toggleLike: protectedProcedure
        .input(z.object({ commentId: z.string(), videoId: z.string() }))
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const userId = ctx.session.user.id;
        const { commentId, videoId } = input;
        const comment = yield prisma.comments.findUnique({
            where: { id: commentId },
            select: { videoId: true },
        });
        if (!comment || comment.videoId !== videoId) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: "Comment not found or does not belong to this video",
            });
        }
        // Check current state (Hybrid Read)
        let current = yield CommentService.getUserReaction(userId, commentId);
        let action = "LIKE";
        if (current === "LIKE") {
            action = "REMOVE";
        }
        else {
            action = "LIKE"; // Overwrites DISLIKE if exists
        }
        yield CommentService.addReaction(userId, commentId, action, videoId);
        return { status: action };
    })),
    toggleDislike: protectedProcedure
        .input(z.object({ commentId: z.string(), videoId: z.string() }))
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const userId = ctx.session.user.id;
        const { commentId, videoId } = input;
        const comment = yield prisma.comments.findUnique({
            where: { id: commentId },
            select: { videoId: true },
        });
        if (!comment || comment.videoId !== videoId) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: "Comment not found or does not belong to this video",
            });
        }
        let current = yield CommentService.getUserReaction(userId, commentId);
        let action = "DISLIKE";
        if (current === "DISLIKE") {
            action = "REMOVE";
        }
        else {
            action = "DISLIKE";
        }
        yield CommentService.addReaction(userId, commentId, action, videoId);
        return { status: action };
    })),
    edit: protectedProcedure
        .input(z.object({
        commentId: z.string(),
        content: z.string().min(1).max(2000),
    }))
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        return CommentService.editComment(input.commentId, ctx.session.user.id, input.content);
    })),
    pin: protectedProcedure
        .input(z.object({ commentId: z.string(), videoId: z.string() }))
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        return CommentService.pinComment(input.commentId, ctx.session.user.id, input.videoId);
    })),
    heart: protectedProcedure
        .input(z.object({ commentId: z.string(), videoId: z.string() }))
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        return CommentService.heartComment(input.commentId, ctx.session.user.id, input.videoId);
    })),
    delete: protectedProcedure
        .input(z.object({ commentId: z.string() }))
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        return CommentService.deleteComment(input.commentId, ctx.session.user.id);
    })),
    getChannelComments: protectedProcedure
        .input(z.object({
        channelId: z.string(),
        cursor: z.string().nullish(),
        limit: z.number().min(1).max(50).optional().default(20),
    }))
        .query((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const { channelId, cursor, limit } = input;
        // First verify user owns the channel
        const channel = yield prisma.channels.findUnique({
            where: { id: channelId },
            select: { userId: true }
        });
        if (!channel || channel.userId !== ctx.session.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Not your channel" });
        }
        const items = yield prisma.comments.findMany({
            where: {
                videos: { channelId },
                status: "VISIBLE",
                deletedAt: null
            },
            take: limit + 1,
            cursor: cursor ? { id: cursor } : undefined,
            skip: cursor ? 1 : 0,
            orderBy: { createdAt: "desc" },
            include: {
                user: {
                    select: {
                        name: true,
                        image: true,
                        channels: { select: { handle: true, name: true, image: true }, take: 1 }
                    }
                },
                videos: {
                    select: { id: true, title: true, thumbnailUrl: true }
                }
            }
        });
        let nextCursor = undefined;
        if (items.length > limit) {
            const nextItem = items.pop();
            nextCursor = nextItem === null || nextItem === void 0 ? void 0 : nextItem.id;
        }
        return { items, nextCursor };
    })),
});
