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
import { router, protectedProcedure, publicProcedure } from "../router.js";
import { FeedService, feedCursorSchema } from "../../services/FeedService";
export const feedRouter = router({
    getSubscriptionsFeed: protectedProcedure
        .input(z.object({
        cursor: feedCursorSchema.optional(),
    }))
        .query((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        return yield FeedService.getSubscriptionsFeed(ctx.session.user.id, input.cursor);
    })),
    getLikedVideos: protectedProcedure
        .input(z.object({
        cursor: feedCursorSchema.optional(),
    }))
        .query((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        return yield FeedService.getLikedVideos(ctx.session.user.id, input.cursor);
    })),
    getHomeFeed: protectedProcedure
        .input(z.object({
        cursor: feedCursorSchema.optional(),
    }))
        .query((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        return yield FeedService.getHomeFeed(ctx.session.user.id, input.cursor);
    })),
    getTrendingFeed: protectedProcedure
        .input(z.object({
        cursor: feedCursorSchema.optional(),
    }))
        .query((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        return yield FeedService.getTrendingFeed(ctx.session.user.id, input.cursor);
    })),
    getHomeShorts: protectedProcedure
        .input(z.object({
        cursor: feedCursorSchema.optional(),
    }))
        .query((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        return yield FeedService.getHomeShorts(ctx.session.user.id, input.cursor);
    })),
    getTrendingShorts: protectedProcedure
        .input(z.object({
        cursor: feedCursorSchema.optional(),
    }))
        .query((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        return yield FeedService.getTrendingShorts(ctx.session.user.id, input.cursor);
    })),
    getRecommendations: publicProcedure
        .input(z.object({
        videoId: z.string(),
        cursor: feedCursorSchema.optional(),
        limit: z.number().optional(),
    }))
        .query((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        var _b, _c;
        return yield FeedService.getRecommendations(input.videoId, (_c = (_b = ctx.session) === null || _b === void 0 ? void 0 : _b.user) === null || _c === void 0 ? void 0 : _c.id, input.cursor, input.limit);
    })),
    getChannelVideos: publicProcedure
        .input(z.object({
        channelId: z.string(),
        cursor: feedCursorSchema.optional(),
        limit: z.number().optional(),
    }))
        .query((_a) => __awaiter(void 0, [_a], void 0, function* ({ input }) {
        return yield FeedService.getChannelVideos(input.channelId, input.cursor, input.limit);
    })),
    getChannelShorts: publicProcedure
        .input(z.object({
        channelId: z.string(),
        cursor: feedCursorSchema.optional(),
        limit: z.number().optional(),
    }))
        .query((_a) => __awaiter(void 0, [_a], void 0, function* ({ input }) {
        return yield FeedService.getChannelShorts(input.channelId, input.cursor, input.limit);
    })),
});
