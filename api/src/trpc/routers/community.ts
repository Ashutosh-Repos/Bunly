import { z } from "zod";
import { router, protectedProcedure, publicProcedure, channelProcedure } from "../router.js";
import { prisma } from "../../lib/prisma.js";
import { TRPCError } from "@trpc/server";
import redis from "../../lib/redis.js";

export const communityRouter = router({
    createPost: channelProcedure
        .input(
            z.object({
                channelId: z.string(),
                content: z.string().max(10000).optional(),
                type: z.enum(["TEXT", "IMAGE", "VIDEO_TEASER", "POLL"]),
                attachments: z.any().optional(), // Or more specific JSON array validation
                pollOptions: z.any().optional(),
                pollEndsAt: z.date().optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const { channelId, ...data } = input;
            
            // Denormalize the channel info into the post like the schema might expect? 
            // Wait, schema for community_posts:
            // "channelId", "type", "content", "attachments" (Json), "pollOptions" (Json), "pollResults" (Json), "pollEndsAt"

            return prisma.community_posts.create({
                data: {
                    channelId,
                    ...data,
                    content: data.content || "",
                },
            });
        }),

    editPost: channelProcedure
        .input(
            z.object({
                channelId: z.string(),
                postId: z.string(),
                content: z.string().max(10000).optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const { channelId, postId, content } = input;

            const post = await prisma.community_posts.findUnique({ where: { id: postId } });
            if (!post || post.channelId !== channelId) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Post not found on this channel" });
            }

            return prisma.community_posts.update({
                where: { id: postId },
                data: { content },
            });
        }),

    deletePost: channelProcedure
        .input(z.object({ channelId: z.string(), postId: z.string() }))
        .mutation(async ({ input }) => {
            const { channelId, postId } = input;
            
            const post = await prisma.community_posts.findUnique({ where: { id: postId } });
            if (!post || post.channelId !== channelId) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Post not found on this channel" });
            }

            // Soft delete
            await prisma.community_posts.update({
                where: { id: postId },
                data: { deletedAt: new Date() }
            });

            return { success: true };
        }),

    getChannelPosts: protectedProcedure
        .input(
            z.object({
                channelId: z.string(),
                cursor: z.string().nullish(),
                limit: z.number().min(1).max(100).optional().default(20),
            })
        )
        .query(async ({ input }) => {
            const { channelId, cursor, limit } = input;

            const items = await prisma.community_posts.findMany({
                where: { channelId, deletedAt: null },
                take: limit + 1,
                cursor: cursor ? { id: cursor } : undefined,
                skip: cursor ? 1 : 0,
                orderBy: { createdAt: "desc" },
            });

            let nextCursor: string | undefined = undefined;
            if (items.length > limit) {
                const nextItem = items.pop();
                nextCursor = nextItem?.id;
            }

            return { items, nextCursor };
        }),

    votePoll: protectedProcedure
        .input(
            z.object({
                postId: z.string(),
                optionIndex: z.number().int().min(0),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const { postId, optionIndex } = input;

            const post = await prisma.community_posts.findUnique({
                where: { id: postId },
                select: { type: true, pollEndsAt: true }
            });

            if (!post || post.type !== "POLL") {
                throw new TRPCError({ code: "BAD_REQUEST", message: "Not a poll" });
            }

            if (post.pollEndsAt && new Date() > post.pollEndsAt) {
                throw new TRPCError({ code: "BAD_REQUEST", message: "Poll has ended" });
            }

            // Atomic jsonb update to avoid race conditions.
            // OptionIndex needs to be cast to string for jsonb_set's path array.
            const idxStr = optionIndex.toString();
            
            await prisma.$executeRaw`
                UPDATE community_posts
                SET "pollResults" = jsonb_set(
                    COALESCE("pollResults", '{}'),
                    ARRAY[${idxStr}],
                    (COALESCE(("pollResults"->>${idxStr})::int, 0) + 1)::text::jsonb
                )
                WHERE id = ${postId} AND type = 'POLL' AND ("pollEndsAt" IS NULL OR "pollEndsAt" > NOW())
            `;

            return { success: true };
        }),

    togglePostLike: protectedProcedure
        .input(z.object({ postId: z.string() }))
        .mutation(async ({ input, ctx }) => {
            const { postId } = input;
            const userId = ctx.session.user.id;
            
            // Optional: check if post exists and is not deleted
            const post = await prisma.community_posts.findUnique({
                where: { id: postId },
                select: { id: true, deletedAt: true }
            });

            if (!post || post.deletedAt) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });
            }

            // To track individual user likes without a relational table, we use a Redis Set
            const redisStrKey = `community:likes:${postId}`;
            
            // Try to add the user to the Set
            // SADD returns 1 if added, 0 if already existed
            const added = await redis.sadd(redisStrKey, userId);

            if (added === 1) {
                // Was added successfully -> Increment count
                await prisma.community_posts.update({
                    where: { id: postId },
                    data: { likeCount: { increment: 1 } }
                });
                return { status: "LIKED" };
            } else {
                // Was already there -> Toggle off -> Remove from set and decrement
                await redis.srem(redisStrKey, userId);
                await prisma.community_posts.update({
                    where: { id: postId },
                    data: { likeCount: { decrement: 1 } }
                });
                return { status: "UNLIKED" };
            }
        }),
});
