import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../router.js";
import { FeedService, feedCursorSchema } from "../../services/FeedService";
import redis from "../../lib/redis.js";

export const feedRouter = router({
    getSubscriptionsFeed: protectedProcedure
        .input(
            z.object({
                cursor: feedCursorSchema.optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            return await FeedService.getSubscriptionsFeed(
                ctx.session.user.id,
                input.cursor,
            );
        }),

    getLikedVideos: protectedProcedure
        .input(
            z.object({
                cursor: feedCursorSchema.optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            return await FeedService.getLikedVideos(
                ctx.session.user.id,
                input.cursor,
            );
        }),

    getHomeFeed: protectedProcedure
        .input(
            z.object({
                cursor: feedCursorSchema.optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            return await FeedService.getHomeFeed(
                ctx.session.user.id,
                input.cursor,
            );
        }),

    getTrendingFeed: protectedProcedure
        .input(
            z.object({
                cursor: feedCursorSchema.optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            return await FeedService.getTrendingFeed(
                ctx.session.user.id,
                input.cursor,
            );
        }),

    getHomeShorts: protectedProcedure
        .input(
            z.object({
                cursor: feedCursorSchema.optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            return await FeedService.getHomeShorts(
                ctx.session.user.id,
                input.cursor,
            );
        }),

    getTrendingShorts: protectedProcedure
        .input(
            z.object({
                cursor: feedCursorSchema.optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            return await FeedService.getTrendingShorts(
                ctx.session.user.id,
                input.cursor,
            );
        }),

    getRecommendations: publicProcedure
        .input(
            z.object({
                videoId: z.string(),
                cursor: feedCursorSchema.optional(),
                limit: z.number().optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            return await FeedService.getRecommendations(
                input.videoId,
                ctx.session?.user?.id,
                input.cursor,
                input.limit,
            );
        }),

    getChannelVideos: publicProcedure
        .input(
            z.object({
                channelId: z.string(),
                cursor: feedCursorSchema.optional(),
                limit: z.number().optional(),
            }),
        )
        .query(async ({ input }) => {
            return await FeedService.getChannelVideos(
                input.channelId,
                input.cursor,
                input.limit,
            );
        }),

    getChannelShorts: publicProcedure
        .input(
            z.object({
                channelId: z.string(),
                cursor: feedCursorSchema.optional(),
                limit: z.number().optional(),
            }),
        )
        .query(async ({ input }) => {
            return await FeedService.getChannelShorts(
                input.channelId,
                input.cursor,
                input.limit,
            );
        }),

    getCommunityPostsForFeed: protectedProcedure
        .input(
            z.object({
                limit: z.number().min(1).max(10).optional().default(4),
            }),
        )
        .query(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;
            const rawPosts = await FeedService.getRecentCommunityPosts(
                userId,
                input.limit,
            );

            // Enrich with isLiked, hasVoted, votedOptionIndex — same shape as getChannelPosts
            const enrichedPosts = await Promise.all(
                rawPosts.map(async (post) => {
                    const [isLikedResult, hasVotedResult] = await Promise.all([
                        redis.sismember(`community:likes:${post.id}`, userId),
                        post.type === "POLL"
                            ? redis.sismember(`community:poll_votes:${post.id}`, userId)
                            : Promise.resolve(0),
                    ]);

                    let votedOptionIndex: number | null = null;
                    if (post.type === "POLL" && hasVotedResult === 1) {
                        const storedIdx = await redis.get(`community:poll_voted_option:${post.id}:${userId}`);
                        votedOptionIndex = storedIdx !== null ? parseInt(storedIdx, 10) : null;
                    }

                    const { channels, ...rest } = post;

                    return {
                        ...rest,
                        author: channels ? {
                            id: channels.id,
                            name: channels.name || "Unknown Channel",
                            handle: channels.handle || "",
                            image: channels.image || null,
                        } : null,
                        isEdited: rest.updatedAt.getTime() - rest.createdAt.getTime() > 2000,
                        isLiked: isLikedResult === 1,
                        hasVoted: hasVotedResult === 1,
                        votedOptionIndex,
                    };
                })
            );

            return enrichedPosts;
        }),
});
