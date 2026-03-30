var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../router.js";
import { FeedService, feedCursorSchema } from "../../services/FeedService";
import redis from "../../lib/redis.js";
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
    getCommunityPostsForFeed: protectedProcedure
        .input(z.object({
        limit: z.number().min(1).max(10).optional().default(4),
    }))
        .query((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const userId = ctx.session.user.id;
        const rawPosts = yield FeedService.getRecentCommunityPosts(userId, input.limit);
        // Enrich with isLiked, hasVoted, votedOptionIndex — same shape as getChannelPosts
        const enrichedPosts = yield Promise.all(rawPosts.map((post) => __awaiter(void 0, void 0, void 0, function* () {
            const [isLikedResult, hasVotedResult] = yield Promise.all([
                redis.sismember(`community:likes:${post.id}`, userId),
                post.type === "POLL"
                    ? redis.sismember(`community:poll_votes:${post.id}`, userId)
                    : Promise.resolve(0),
            ]);
            let votedOptionIndex = null;
            if (post.type === "POLL" && hasVotedResult === 1) {
                const storedIdx = yield redis.get(`community:poll_voted_option:${post.id}:${userId}`);
                votedOptionIndex = storedIdx !== null ? parseInt(storedIdx, 10) : null;
            }
            const { channels } = post, rest = __rest(post, ["channels"]);
            return Object.assign(Object.assign({}, rest), { author: channels ? {
                    id: channels.id,
                    name: channels.name || "Unknown Channel",
                    handle: channels.handle || "",
                    image: channels.image || null,
                } : null, isEdited: rest.updatedAt.getTime() - rest.createdAt.getTime() > 2000, isLiked: isLikedResult === 1, hasVoted: hasVotedResult === 1, votedOptionIndex });
        })));
        return enrichedPosts;
    })),
});
