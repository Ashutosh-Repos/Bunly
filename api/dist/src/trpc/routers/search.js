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
import { router, protectedProcedure } from "../router.js";
import { prisma } from "../../lib/prisma";
export const searchRouter = router({
    globalSearch: protectedProcedure
        .input(z.object({
        query: z.string().min(1),
        cursor: z.string().nullish(), // ID for offset (video, channel, or playlist)
        limit: z.number().min(1).max(50).default(20),
        filter: z
            .enum(["ALL", "VIDEOS", "CHANNELS", "PLAYLISTS"])
            .default("ALL"),
    }))
        .query((_a) => __awaiter(void 0, [_a], void 0, function* ({ input, ctx }) {
        var _b, _c;
        const { query, cursor, limit, filter } = input;
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
        let nextCursor = undefined;
        // --- CHANNELS PAGINATION ---
        if (filter === "CHANNELS") {
            const channelsList = yield prisma.channels.findMany({
                where: {
                    status: "ACTIVE",
                    OR: [
                        { name: { search: formattedQuery } },
                        { handle: { search: formattedQuery } },
                    ],
                },
                take: limit + 1,
                cursor: cursor ? { id: cursor } : undefined,
                skip: cursor ? 1 : 0,
                orderBy: [{ subscriberCount: "desc" }, { id: "asc" }],
                select: {
                    id: true,
                    name: true,
                    handle: true,
                    image: true,
                    subscriberCount: true,
                    videoCount: true,
                },
            });
            if (channelsList.length > limit) {
                const nextItem = channelsList.pop();
                nextCursor = nextItem.id;
            }
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
            return {
                channels: fetchedChannels,
                playlists: [],
                items: [],
                nextCursor,
            };
        }
        // --- PLAYLISTS PAGINATION ---
        if (filter === "PLAYLISTS") {
            const playlistsList = yield prisma.playlists.findMany({
                where: {
                    visibility: "PUBLIC",
                    title: { search: formattedQuery },
                },
                take: limit + 1,
                cursor: cursor ? { id: cursor } : undefined,
                skip: cursor ? 1 : 0,
                orderBy: [{ videoCount: "desc" }, { id: "asc" }],
                select: {
                    id: true,
                    title: true,
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
                    playlist_videos: {
                        take: 1,
                        orderBy: { position: "asc" },
                        select: {
                            videos: {
                                select: { thumbnailUrl: true },
                            },
                        },
                    },
                },
            });
            if (playlistsList.length > limit) {
                const nextItem = playlistsList.pop();
                nextCursor = nextItem.id;
            }
            fetchedPlaylists = playlistsList.map((p) => {
                var _a, _b, _c;
                const { playlist_videos } = p, rest = __rest(p, ["playlist_videos"]);
                return Object.assign(Object.assign({}, rest), { updatedAt: rest.updatedAt.toISOString(), firstVideoThumbnail: (_c = (_b = (_a = playlist_videos[0]) === null || _a === void 0 ? void 0 : _a.videos) === null || _b === void 0 ? void 0 : _b.thumbnailUrl) !== null && _c !== void 0 ? _c : null });
            });
            return {
                channels: [],
                playlists: fetchedPlaylists,
                items: [],
                nextCursor,
            };
        }
        // --- MIXED "ALL" / "VIDEOS" SEARCH ---
        // Fetch top preview items ONLY if we are on the first page of "ALL" filter
        if (filter === "ALL" && !cursor) {
            const [channelsList, playlistsList] = yield Promise.all([
                prisma.channels.findMany({
                    where: {
                        status: "ACTIVE",
                        OR: [
                            { name: { search: formattedQuery } },
                            { handle: { search: formattedQuery } },
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
                        playlist_videos: {
                            take: 1,
                            orderBy: { position: "asc" },
                            select: {
                                videos: {
                                    select: { thumbnailUrl: true },
                                },
                            },
                        },
                    },
                }),
            ]);
            if (((_c = ctx.session.user) === null || _c === void 0 ? void 0 : _c.id) && channelsList.length > 0) {
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
            fetchedPlaylists = playlistsList.map((p) => {
                var _a, _b, _c;
                const { playlist_videos } = p, rest = __rest(p, ["playlist_videos"]);
                return Object.assign(Object.assign({}, rest), { updatedAt: rest.updatedAt.toISOString(), firstVideoThumbnail: (_c = (_b = (_a = playlist_videos[0]) === null || _a === void 0 ? void 0 : _a.videos) === null || _b === void 0 ? void 0 : _b.thumbnailUrl) !== null && _c !== void 0 ? _c : null });
            });
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
            skip: cursor ? 1 : 0,
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
                        id: true,
                        name: true,
                        handle: true,
                        image: true,
                        isVerified: true,
                    },
                },
                viewCount: true,
                createdAt: true,
                duration: true,
                isShort: true,
                hlsPlaylistUrl: true,
            },
        });
        if (videos.length > limit) {
            const nextItem = videos.pop();
            nextCursor = nextItem.id;
        }
        return {
            channels: fetchedChannels,
            playlists: fetchedPlaylists,
            items: videos.map((v) => {
                var _a, _b, _c, _d, _e;
                return ({
                    id: v.id,
                    title: v.title,
                    thumbnailUrl: v.thumbnailUrl,
                    previewSprite: v.previewSprite || null,
                    channelId: v.channelId,
                    author: {
                        id: ((_a = v.channels) === null || _a === void 0 ? void 0 : _a.id) || v.channelId,
                        name: ((_b = v.channels) === null || _b === void 0 ? void 0 : _b.name) || "Unknown User",
                        handle: ((_c = v.channels) === null || _c === void 0 ? void 0 : _c.handle) || "",
                        image: ((_d = v.channels) === null || _d === void 0 ? void 0 : _d.image) || null,
                        isVerified: ((_e = v.channels) === null || _e === void 0 ? void 0 : _e.isVerified) || false,
                    },
                    viewCount: v.viewCount,
                    createdAt: v.createdAt.toISOString(),
                    duration: v.duration,
                    isShort: v.isShort,
                    hlsPlaylistUrl: v.hlsPlaylistUrl,
                });
            }),
            nextCursor,
        };
    })),
});
