import { z } from "zod";
import { router, protectedProcedure } from "../router.js";
import { prisma } from "../../lib/prisma";

export const searchRouter = router({
    globalSearch: protectedProcedure
        .input(
            z.object({
                query: z.string().min(1),
                cursor: z.string().nullish(), // ID for offset (video, channel, or playlist)
                limit: z.number().min(1).max(50).default(20),
                filter: z
                    .enum(["ALL", "VIDEOS", "CHANNELS", "PLAYLISTS"])
                    .default("ALL"),
                sortBy: z.enum(["relevance", "newest", "viewCount"]).default("relevance"),
                uploadDate: z.enum(["today", "thisWeek", "thisMonth", "thisYear"]).optional(),
                duration: z.enum(["short", "medium", "long"]).optional(),
            }),
        )
        .query(async ({ input, ctx }) => {
            const { query, cursor, limit, filter, sortBy, uploadDate, duration } = input;

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

            type SearchChannel = {
                id: string;
                name: string;
                handle: string;
                image: string | null;
                subscriberCount: number;
                videoCount: number;
                isSubscribed: boolean;
            };

            type SearchPlaylist = {
                id: string;
                title: string;
                firstVideoThumbnail: string | null;
                videoCount: number;
                updatedAt: string;
                author: {
                    id: string;
                    name: string | null;
                    handle: string | null;
                    image: string | null;
                } | null;
            };

            let fetchedChannels: SearchChannel[] = [];
            let fetchedPlaylists: SearchPlaylist[] = [];
            let nextCursor: string | undefined = undefined;

            // --- CHANNELS PAGINATION ---
            if (filter === "CHANNELS") {
                const channelsList = await prisma.channels.findMany({
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
                    nextCursor = nextItem!.id;
                }

                if (ctx.session.user?.id && channelsList.length > 0) {
                    const subscriptions = await prisma.subscriptions.findMany({
                        where: {
                            subscriberId: ctx.session.user.id,
                            channelId: { in: channelsList.map((c) => c.id) },
                        },
                    });
                    const subSet = new Set(
                        subscriptions.map((s) => s.channelId),
                    );
                    fetchedChannels = channelsList.map((c) => ({
                        ...c,
                        isSubscribed: subSet.has(c.id),
                    }));
                } else {
                    fetchedChannels = channelsList.map((c) => ({
                        ...c,
                        isSubscribed: false,
                    }));
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
                const playlistsList = await prisma.playlists.findMany({
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
                    nextCursor = nextItem!.id;
                }

                fetchedPlaylists = playlistsList.map((p) => {
                    const { playlist_videos, channels, ...rest } = p;
                    return {
                        ...rest,
                        updatedAt: rest.updatedAt.toISOString(),
                        firstVideoThumbnail: playlist_videos[0]?.videos?.thumbnailUrl ?? null,
                        author: channels ? {
                            id: channels.id,
                            name: channels.name,
                            handle: channels.handle,
                            image: channels.image,
                        } : null,
                    };
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
                const [channelsList, playlistsList] = await Promise.all([
                    prisma.channels.findMany({
                        where: {
                            status: "ACTIVE",
                            OR: [
                                { name: { search: formattedQuery } },
                                { handle: { search: formattedQuery } },
                            ],
                        },
                        take: 2,
                        orderBy: [{ subscriberCount: "desc" }, { id: "asc" }],
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
                    }),
                ]);

                if (ctx.session.user?.id && channelsList.length > 0) {
                    const subscriptions = await prisma.subscriptions.findMany({
                        where: {
                            subscriberId: ctx.session.user.id,
                            channelId: { in: channelsList.map((c) => c.id) },
                        },
                    });
                    const subSet = new Set(
                        subscriptions.map((s) => s.channelId),
                    );
                    fetchedChannels = channelsList.map((c) => ({
                        ...c,
                        isSubscribed: subSet.has(c.id),
                    }));
                } else {
                    fetchedChannels = channelsList.map((c) => ({
                        ...c,
                        isSubscribed: false,
                    }));
                }
                fetchedPlaylists = playlistsList.map((p) => {
                    const { playlist_videos, channels, ...rest } = p;
                    return {
                        ...rest,
                        updatedAt: rest.updatedAt.toISOString(),
                        firstVideoThumbnail: playlist_videos[0]?.videos?.thumbnailUrl ?? null,
                        author: channels ? {
                            id: channels.id,
                            name: channels.name,
                            handle: channels.handle,
                            image: channels.image,
                        } : null,
                    };
                });
            }

            // Build dynamic where clause for video filters
            const videoDateFilter: Record<string, Date> = {};
            if (uploadDate) {
                const now = new Date();
                if (uploadDate === "today") {
                    videoDateFilter.gte = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                } else if (uploadDate === "thisWeek") {
                    const weekAgo = new Date(now);
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    videoDateFilter.gte = weekAgo;
                } else if (uploadDate === "thisMonth") {
                    const monthAgo = new Date(now);
                    monthAgo.setMonth(monthAgo.getMonth() - 1);
                    videoDateFilter.gte = monthAgo;
                } else if (uploadDate === "thisYear") {
                    const yearAgo = new Date(now);
                    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
                    videoDateFilter.gte = yearAgo;
                }
            }

            const videoDurationFilter: Record<string, number> = {};
            if (duration === "short") {
                videoDurationFilter.lt = 240; // < 4 min
            } else if (duration === "medium") {
                videoDurationFilter.gte = 240;
                videoDurationFilter.lte = 1200; // 4-20 min
            } else if (duration === "long") {
                videoDurationFilter.gt = 1200; // > 20 min
            }

            const videoOrderBy = sortBy === "newest"
                ? [{ createdAt: "desc" as const }, { id: "asc" as const }]
                : sortBy === "viewCount"
                    ? [{ viewCount: "desc" as const }, { id: "asc" as const }]
                    : [{ engagementScore: "desc" as const }, { viewCount: "desc" as const }, { id: "asc" as const }];

            // Prisma text search fallback (Can be upgraded to Raw SQL tsvector proxy)
            const videos = await prisma.videos.findMany({
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
                    ...(Object.keys(videoDateFilter).length > 0 ? { createdAt: videoDateFilter } : {}),
                    ...(Object.keys(videoDurationFilter).length > 0 ? { duration: videoDurationFilter } : {}),
                },
                take: limit + 1,
                cursor: cursor ? { id: cursor } : undefined,
                skip: cursor ? 1 : 0,
                orderBy: videoOrderBy,
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
                nextCursor = nextItem!.id;
            }

            return {
                channels: fetchedChannels,
                playlists: fetchedPlaylists,
                items: videos.map((v) => ({
                    id: v.id,
                    title: v.title,
                    thumbnailUrl: v.thumbnailUrl,
                    previewSprite: v.previewSprite || null,
                    channelId: v.channelId,
                    author: {
                        id: v.channels?.id || v.channelId,
                        name: v.channels?.name || "Unknown User",
                        handle: v.channels?.handle || "",
                        image: v.channels?.image || null,
                        isVerified: v.channels?.isVerified || false,
                    },
                    viewCount: v.viewCount,
                    createdAt: v.createdAt.toISOString(),
                    duration: v.duration,
                    isShort: v.isShort,
                    hlsPlaylistUrl: v.hlsPlaylistUrl,
                })),
                nextCursor,
            };
        }),
});
