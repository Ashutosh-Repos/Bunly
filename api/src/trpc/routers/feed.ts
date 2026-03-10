import { z } from "zod";
import { router, protectedProcedure } from "../router.js";
import { FeedService, feedCursorSchema } from "../../services/FeedService";

export const feedRouter = router({
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

    getRecommendations: protectedProcedure
        .input(
            z.object({
                videoId: z.string(),
                cursor: feedCursorSchema.optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            return await FeedService.getRecommendations(
                input.videoId,
                ctx.session.user.id,
                input.cursor,
            );
        }),

    getChannelVideos: protectedProcedure
        .input(
            z.object({
                channelId: z.string(),
                cursor: feedCursorSchema.optional(),
            }),
        )
        .query(async ({ input }) => {
            return await FeedService.getChannelVideos(
                input.channelId,
                input.cursor,
            );
        }),

    getChannelShorts: protectedProcedure
        .input(
            z.object({
                channelId: z.string(),
                cursor: feedCursorSchema.optional(),
            }),
        )
        .query(async ({ input }) => {
            return await FeedService.getChannelShorts(
                input.channelId,
                input.cursor,
            );
        }),
});
