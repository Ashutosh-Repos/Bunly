import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../router.js";
import { FeedService, feedCursorSchema } from "../../services/FeedService";

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
});
