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
import { prisma } from "../../lib/prisma";
export const searchRouter = router({
    globalSearch: protectedProcedure
        .input(z.object({
        query: z.string().min(1),
        cursor: z.string().nullish(), // Video ID for offset
        limit: z.number().min(1).max(50).default(20),
    }))
        .query((_a) => __awaiter(void 0, [_a], void 0, function* ({ input, ctx }) {
        var _b;
        const { query, cursor, limit } = input;
        const sanitizedQuery = query.replace(/[&|!():*<>\\]/g, "").trim();
        if (!sanitizedQuery) {
            return {
                channels: [],
                playlists: [],
                items: [],
                nextCursor: undefined,
            };
        }
        // Format for Postgres tsquery (Lexemes separated by AND operator with Prefix matching)
        const formattedQuery = sanitizedQuery
            .split(/\s+/)
            .map((word) => `${word}:*`)
            .join(" & ");
        let fetchedChannels = [];
        let fetchedPlaylists = [];
        if (!cursor) {
            const [channelsList, playlistsList] = yield Promise.all([
                prisma.channels.findMany({
                    where: {
                        status: "ACTIVE",
                        OR: [
                            {
                                name: {
                                    search: formattedQuery,
                                },
                            },
                            {
                                handle: {
                                    search: formattedQuery,
                                },
                            },
                        ],
                    },
                    take: 2,
                    orderBy: { subscriberCount: "desc" },
                    select: {
                        id: true,
                        name: true,
                        handle: true,
                        image: true,
                        subscriberCount: true,
                        videoCount: true,
                    },
                }),
                prisma.playlists.findMany({
                    where: {
                        visibility: "PUBLIC",
                        title: { search: formattedQuery },
                    },
                    take: 3,
                    orderBy: { videoCount: "desc" },
                    select: {
                        id: true,
                        title: true,
                        thumbnailUrl: true,
                        videoCount: true,
                        updatedAt: true,
                        channels: {
                            select: {
                                id: true,
                                name: true,
                                handle: true,
                                image: true,
                            },
                        },
                    },
                }),
            ]);
            if (((_b = ctx.session.user) === null || _b === void 0 ? void 0 : _b.id) && channelsList.length > 0) {
                const subscriptions = yield prisma.subscriptions.findMany({
                    where: {
                        subscriberId: ctx.session.user.id,
                        channelId: { in: channelsList.map((c) => c.id) },
                    },
                });
                const subSet = new Set(subscriptions.map((s) => s.channelId));
                fetchedChannels = channelsList.map((c) => (Object.assign(Object.assign({}, c), { isSubscribed: subSet.has(c.id) })));
            }
            else {
                fetchedChannels = channelsList.map((c) => (Object.assign(Object.assign({}, c), { isSubscribed: false })));
            }
            fetchedPlaylists = playlistsList.map((p) => (Object.assign(Object.assign({}, p), { updatedAt: p.updatedAt.toISOString() })));
        }
        // Prisma text search fallback (Can be upgraded to Raw SQL tsvector proxy)
        const videos = yield prisma.videos.findMany({
            where: {
                visibility: "PUBLIC",
                processingStatus: "READY",
                deletedAt: null,
                OR: [
                    { title: { search: formattedQuery } },
                    {
                        description: {
                            search: formattedQuery,
                        },
                    },
                ],
            },
            take: limit + 1,
            cursor: cursor ? { id: cursor } : undefined,
            orderBy: [
                { engagementScore: "desc" }, // Quality filter
                { viewCount: "desc" }, // Popularity fallback
                { id: "asc" }, // Deterministic order for cursor
            ],
            select: {
                id: true,
                title: true,
                thumbnailUrl: true,
                previewSprite: true,
                channelId: true,
                channels: {
                    select: {
                        name: true,
                        handle: true,
                        image: true,
                        subscriberCount: true,
                    },
                },
                viewCount: true,
                createdAt: true,
                duration: true,
                isShort: true,
            },
        });
        let nextCursor = undefined;
        if (videos.length > limit) {
            const nextItem = videos.pop();
            nextCursor = nextItem.id;
        }
        return {
            channels: fetchedChannels,
            playlists: fetchedPlaylists,
            items: videos.map((v) => {
                var _a, _b, _c, _d;
                return ({
                    id: v.id,
                    title: v.title,
                    thumbnailUrl: v.thumbnailUrl,
                    previewSprite: v.previewSprite || null,
                    channelId: v.channelId,
                    channels: {
                        id: v.channelId,
                        name: ((_a = v.channels) === null || _a === void 0 ? void 0 : _a.name) || null,
                        handle: ((_b = v.channels) === null || _b === void 0 ? void 0 : _b.handle) || null,
                        image: ((_c = v.channels) === null || _c === void 0 ? void 0 : _c.image) || null,
                        subscriberCount: ((_d = v.channels) === null || _d === void 0 ? void 0 : _d.subscriberCount) || 0,
                    },
                    viewCount: v.viewCount,
                    createdAt: v.createdAt.toISOString(),
                    duration: v.duration,
                    isShort: v.isShort,
                });
            }),
            nextCursor,
        };
    })),
});
