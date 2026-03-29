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
import { router, protectedProcedure, playlistProcedure, channelProcedure, publicProcedure, } from "../router.js";
import { prisma } from "../../lib/prisma";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
const videoVisibilitySchema = z.enum([
    "PUBLIC",
    "PRIVATE",
    "UNLISTED",
    "SCHEDULED",
]);
const playlistSchema = z.object({
    title: z.string().trim().min(1, "Title is required").max(150),
    description: z.string().trim().max(5000).optional(),
    channelId: z.string({ message: "Channel ID is required" }).optional(),
    visibility: videoVisibilitySchema.default("UNLISTED"),
});
export const playlistRouter = router({
    createPlaylist: protectedProcedure
        .input(playlistSchema)
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const { title, description, channelId, visibility } = input;
        const userId = ctx.session.user.id;
        let finalVisibility = visibility;
        // If channelId is provided, verify ownership
        if (channelId) {
            const channel = yield prisma.channels.findUnique({
                where: { id: channelId },
            });
            if (!channel) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Channel not found",
                });
            }
            if (channel.userId !== userId) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "You do not own this channel",
                });
            }
        }
        else {
            // User-managed playlist (no channel) -> Always PRIVATE
            finalVisibility = "PRIVATE";
        }
        const playlist = yield prisma.playlists.create({
            data: {
                title,
                description,
                channelId: channelId || null,
                userId,
                visibility: finalVisibility,
            },
        });
        return { success: true, playlist };
    })),
    updatePlaylist: playlistProcedure
        .input(playlistSchema
        .omit({ visibility: true })
        .extend({
        playlistId: z.string({
            message: "Playlist ID is required",
        }),
        visibility: z.enum(["PUBLIC", "PRIVATE", "UNLISTED"]).optional(),
    })
        .partial()
        .required({ playlistId: true }))
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const { playlistId, channelId } = input, data = __rest(input, ["playlistId", "channelId"]);
        const { playlist } = ctx;
        // Ensure playlist belongs to the specified channel (if valid channelId provided)
        if (channelId &&
            playlist.channelId &&
            playlist.channelId !== channelId) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Playlist does not belong to the specified channel",
            });
        }
        // User-managed playlists (no channel) must remain PRIVATE
        if (!playlist.channelId &&
            data.visibility &&
            data.visibility !== "PRIVATE") {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: "User-managed playlists must be private",
            });
        }
        const updatedPlaylist = yield prisma.playlists.update({
            where: { id: playlist.id },
            data: {
                title: data.title,
                description: data.description,
                visibility: data.visibility
            },
        });
        return { success: true, playlist: updatedPlaylist };
    })),
    deletePlaylist: playlistProcedure
        .input(z.object({
        playlistId: z.string({ message: "Playlist ID is required" }),
        channelId: z.string().optional(),
    }))
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx }) {
        const { playlist } = ctx;
        // implicitly checked by middleware
        yield prisma.playlists.delete({
            where: { id: playlist.id },
        });
        return { success: true };
    })),
    getPlaylistById: playlistProcedure
        .input(z.object({
        playlistId: z.string({ message: "Playlist ID is required" }),
        channelId: z.string().optional(),
    }))
        .query((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx }) {
        return { success: true, playlist: ctx.playlist };
    })),
    getPublicPlaylist: publicProcedure
        .input(z.object({
        playlistId: z.string({ message: "Playlist ID is required" }),
    }))
        .query((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        var _b, _c, _d;
        const { playlistId } = input;
        const userId = (_d = (_c = (_b = ctx.session) === null || _b === void 0 ? void 0 : _b.user) === null || _c === void 0 ? void 0 : _c.id) !== null && _d !== void 0 ? _d : null;
        const playlist = yield prisma.playlists.findUnique({
            where: { id: playlistId, deletedAt: null },
            include: {
                user: {
                    select: {
                        name: true,
                        image: true,
                    },
                },
                channels: {
                    select: {
                        name: true,
                        image: true,
                        handle: true,
                    },
                },
                _count: {
                    select: {
                        playlist_videos: true,
                    },
                },
            },
        });
        if (!playlist) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: "Playlist not found",
            });
        }
        // Access Rules:
        // 1. Owner can always view
        // 2. Public/Unlisted can be viewed by anyone
        const isOwner = userId ? playlist.userId === userId : false;
        const isPublicOrUnlisted = playlist.visibility === "PUBLIC" ||
            playlist.visibility === "UNLISTED";
        if (!isOwner && !isPublicOrUnlisted) {
            throw new TRPCError({
                code: "FORBIDDEN",
                message: "This playlist is private",
            });
        }
        return { success: true, playlist };
    })),
    addVideoToPlaylist: playlistProcedure
        .input(z.object({
        playlistId: z.string({ message: "Playlist ID is required" }),
        channelId: z.string().optional(),
        videoId: z.string({ message: "Video ID is required" }),
    }))
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const { playlistId, videoId } = input;
        // Use transaction to ensure safe position calculation
        yield prisma.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            // Check if video is already in playlist
            const existingItem = yield tx.playlist_videos.findUnique({
                where: { playlistId_videoId: { playlistId, videoId } },
            });
            if (existingItem) {
                throw new TRPCError({
                    code: "CONFLICT",
                    message: "Video already in playlist",
                });
            }
            // Get current max position
            const lastItem = yield tx.playlist_videos.findFirst({
                where: { playlistId },
                orderBy: { position: "desc" },
                select: { position: true },
            });
            const newPosition = ((_a = lastItem === null || lastItem === void 0 ? void 0 : lastItem.position) !== null && _a !== void 0 ? _a : -1) + 1;
            yield tx.playlist_videos.create({
                data: {
                    playlistId,
                    videoId,
                    position: newPosition,
                },
            });
            // Update count
            yield tx.playlists.update({
                where: { id: playlistId },
                data: { videoCount: { increment: 1 } },
            });
        }));
        return { success: true };
    })),
    removeVideoFromPlaylist: playlistProcedure
        .input(z.object({
        playlistId: z.string({ message: "Playlist ID is required" }),
        channelId: z.string().optional(),
        videoId: z.string({ message: "Video ID is required" }),
    }))
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const { playlistId, videoId } = input;
        yield prisma.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const item = yield tx.playlist_videos.findUnique({
                where: { playlistId_videoId: { playlistId, videoId } },
                select: { position: true },
            });
            if (!item) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Video not in playlist",
                });
            }
            yield tx.playlist_videos.delete({
                where: { playlistId_videoId: { playlistId, videoId } },
            });
            // Shift subsequent items up
            yield tx.playlist_videos.updateMany({
                where: {
                    playlistId,
                    position: { gt: item.position },
                },
                data: { position: { decrement: 1 } },
            });
            yield tx.playlists.update({
                where: { id: playlistId },
                data: { videoCount: { decrement: 1 } },
            });
        }));
        return { success: true };
    })),
    getPlaylistVideos: protectedProcedure
        .input(z.object({
        playlistId: z.string({ message: "Playlist ID is required" }),
        channelId: z
            .string({ message: "Channel ID is required" })
            .optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.number().nullish(), // Cursor is the 'position' of the last item
    }))
        .query((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const { playlistId, limit, cursor } = input;
        const playlist = yield prisma.playlists.findUnique({
            where: { id: playlistId, deletedAt: null },
            select: { id: true, visibility: true, userId: true },
        });
        if (!playlist) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: "Playlist not found",
            });
        }
        // Public/visibility check (if not owner)
        if (playlist.userId !== ctx.session.user.id &&
            playlist.visibility === "PRIVATE") {
            throw new TRPCError({
                code: "FORBIDDEN",
                message: "Private playlist",
            });
        }
        const items = yield prisma.playlist_videos.findMany({
            where: Object.assign({ playlistId }, (cursor !== null && cursor !== undefined
                ? { position: { gt: cursor } }
                : {})),
            take: limit + 1, // Get 1 extra to know if there's a next page
            include: {
                videos: {
                    select: {
                        id: true,
                        title: true,
                        thumbnailUrl: true,
                        visibility: true,
                        viewCount: true,
                        likeCount: true,
                        dislikeCount: true,
                        duration: true,
                        isShort: true,
                        channels: {
                            select: {
                                id: true,
                                name: true,
                                handle: true,
                                image: true,
                                userId: true,
                                isVerified: true,
                            },
                        },
                    },
                },
            },
            orderBy: { position: "asc" },
        });
        let nextCursor = undefined;
        if (items.length > limit) {
            const nextItem = items.pop();
            nextCursor = nextItem === null || nextItem === void 0 ? void 0 : nextItem.position;
        }
        const videos = items.map((item) => {
            const _a = item.videos, { channels } = _a, restVideo = __rest(_a, ["channels"]);
            // Security: Mask PRIVATE video details if requester is not the video's owner
            const isVideoOwner = (channels === null || channels === void 0 ? void 0 : channels.userId) === ctx.session.user.id;
            const isPrivate = restVideo.visibility === "PRIVATE";
            if (isPrivate && !isVideoOwner) {
                restVideo.title = "[Private Video]";
                restVideo.thumbnailUrl = null;
                restVideo.duration = 0;
                restVideo.viewCount = 0;
                restVideo.likeCount = 0;
                restVideo.dislikeCount = 0;
                if (channels) {
                    channels.name = "";
                    channels.handle = "";
                    channels.image = null;
                }
            }
            return Object.assign(Object.assign({}, restVideo), { channelId: (channels === null || channels === void 0 ? void 0 : channels.id) || "", author: {
                    id: (channels === null || channels === void 0 ? void 0 : channels.id) || "",
                    name: (channels === null || channels === void 0 ? void 0 : channels.name) || "",
                    handle: (channels === null || channels === void 0 ? void 0 : channels.handle) || "",
                    image: (channels === null || channels === void 0 ? void 0 : channels.image) || null,
                    isVerified: (channels === null || channels === void 0 ? void 0 : channels.isVerified) || false,
                }, position: item.position, addedAt: item.addedAt });
        });
        return { success: true, videos, nextCursor };
    })),
    reorderPlaylistVideos: playlistProcedure
        .input(z.object({
        playlistId: z.string(),
        channelId: z.string().optional(),
        videoId: z.string(),
        newPosition: z.number().min(0),
    }))
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const { playlistId, videoId, newPosition } = input;
        yield prisma.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const currentItem = yield tx.playlist_videos.findUnique({
                where: { playlistId_videoId: { playlistId, videoId } },
                select: { position: true },
            });
            if (!currentItem) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Video not in playlist",
                });
            }
            const oldPosition = currentItem.position;
            if (oldPosition === newPosition)
                return;
            if (newPosition > oldPosition) {
                // Moving Down: Shift items in (old, new] DOWN by 1
                // e.g. 1->5. Items 2,3,4,5 become 1,2,3,4.
                yield tx.playlist_videos.updateMany({
                    where: {
                        playlistId,
                        position: { gt: oldPosition, lte: newPosition },
                    },
                    data: { position: { decrement: 1 } },
                });
            }
            else {
                // Moving Up: Shift items in [new, old) UP by 1
                // e.g. 5->1. Items 1,2,3,4 become 2,3,4,5.
                yield tx.playlist_videos.updateMany({
                    where: {
                        playlistId,
                        position: { gte: newPosition, lt: oldPosition },
                    },
                    data: { position: { increment: 1 } },
                });
            }
            // Move target
            yield tx.playlist_videos.update({
                where: { playlistId_videoId: { playlistId, videoId } },
                data: { position: newPosition },
            });
        }));
        return { success: true };
    })),
    /**
     * List all playlists for a channel (Studio Content page).
     */
    getChannelPlaylists: channelProcedure
        .input(z.object({
        channelId: z.string(),
        videoId: z.string().optional(),
    }))
        .query((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const { channelId, videoId } = input;
        if (videoId) {
            // Fetch two pieces of data per playlist:
            //   1. Does it contain the given videoId? (containsVideo)
            //   2. What is its cover thumbnail? (first video by position)
            // Prisma doesn't support two filtered includes on the same relation,
            // so we fetch position-ordered items and derive containment in JS.
            const playlists = yield prisma.playlists.findMany({
                where: {
                    channelId,
                    deletedAt: null,
                },
                orderBy: { updatedAt: "desc" },
                include: {
                    _count: {
                        select: { playlist_videos: true },
                    },
                    playlist_videos: {
                        orderBy: { position: "asc" },
                        select: {
                            videoId: true,
                            position: true,
                            videos: { select: { thumbnailUrl: true } },
                        },
                        take: 100, // Fetch top 100 items to derive containment + cover thumbnail accurately
                    },
                },
            });
            return {
                success: true,
                playlists: playlists.map((p) => {
                    var _a, _b, _c;
                    const { playlist_videos } = p, rest = __rest(p, ["playlist_videos"]);
                    return Object.assign(Object.assign({}, rest), { containsVideo: playlist_videos.some((pv) => pv.videoId === videoId), firstVideoThumbnail: (_c = (_b = (_a = playlist_videos[0]) === null || _a === void 0 ? void 0 : _a.videos) === null || _b === void 0 ? void 0 : _b.thumbnailUrl) !== null && _c !== void 0 ? _c : null });
                }),
            };
        }
        const playlists = yield prisma.playlists.findMany({
            where: {
                channelId,
                deletedAt: null,
            },
            orderBy: { updatedAt: "desc" },
            include: {
                _count: {
                    select: { playlist_videos: true },
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
        return {
            success: true,
            playlists: playlists.map((p) => {
                var _a, _b;
                const { playlist_videos } = p, rest = __rest(p, ["playlist_videos"]);
                return Object.assign(Object.assign({}, rest), { containsVideo: false, firstVideoThumbnail: (_b = (_a = playlist_videos[0]) === null || _a === void 0 ? void 0 : _a.videos.thumbnailUrl) !== null && _b !== void 0 ? _b : null });
            }),
        };
    })),
    /**
     * List all public playlists for a channel (Public Profile Playlists tab).
     */
    getPublicChannelPlaylists: publicProcedure
        .input(z.object({
        channelId: z.string(),
    }))
        .query((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const { channelId } = input;
        const playlists = yield prisma.playlists.findMany({
            where: {
                channelId,
                deletedAt: null,
                visibility: "PUBLIC",
            },
            orderBy: { updatedAt: "desc" },
            include: {
                _count: {
                    select: { playlist_videos: true },
                },
                channels: {
                    select: { name: true }
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
        return {
            success: true,
            playlists: playlists.map((p) => {
                var _a, _b;
                const { playlist_videos } = p, rest = __rest(p, ["playlist_videos"]);
                return Object.assign(Object.assign({}, rest), { firstVideoThumbnail: (_b = (_a = playlist_videos[0]) === null || _a === void 0 ? void 0 : _a.videos.thumbnailUrl) !== null && _b !== void 0 ? _b : null });
            }),
        };
    })),
    /**
     * List all playlists across all channels for the current user (Save to Playlist dialog).
     */
    getUserPlaylists: protectedProcedure
        .input(z.object({
        videoId: z.string().optional(),
    }))
        .query((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const { videoId } = input;
        const userId = ctx.session.user.id;
        if (videoId) {
            const playlists = yield prisma.playlists.findMany({
                where: { userId, deletedAt: null },
                orderBy: { updatedAt: "desc" },
                include: {
                    playlist_videos: {
                        orderBy: { position: "asc" },
                        select: {
                            videoId: true,
                            videos: { select: { thumbnailUrl: true } },
                        },
                        take: 100, // Reasonable cap for looking up containment + cover
                    },
                },
            });
            return {
                success: true,
                playlists: playlists.map((p) => {
                    var _a, _b, _c;
                    const { playlist_videos } = p, rest = __rest(p, ["playlist_videos"]);
                    return Object.assign(Object.assign({}, rest), { containsVideo: playlist_videos.length > 0, firstVideoThumbnail: (_c = (_b = (_a = playlist_videos[0]) === null || _a === void 0 ? void 0 : _a.videos) === null || _b === void 0 ? void 0 : _b.thumbnailUrl) !== null && _c !== void 0 ? _c : null });
                }),
            };
        }
        const playlists = yield prisma.playlists.findMany({
            where: { userId, deletedAt: null },
            orderBy: { updatedAt: "desc" },
            include: {
                playlist_videos: {
                    take: 1,
                    orderBy: { position: "asc" },
                    select: { videos: { select: { thumbnailUrl: true } } },
                },
            },
        });
        return {
            success: true,
            playlists: playlists.map((p) => {
                var _a, _b, _c;
                const { playlist_videos } = p, rest = __rest(p, ["playlist_videos"]);
                return Object.assign(Object.assign({}, rest), { containsVideo: false, firstVideoThumbnail: (_c = (_b = (_a = playlist_videos[0]) === null || _a === void 0 ? void 0 : _a.videos) === null || _b === void 0 ? void 0 : _b.thumbnailUrl) !== null && _c !== void 0 ? _c : null });
            }),
        };
    })),
    getPlaylistFlow: protectedProcedure
        .input(z.object({ playlistId: z.string() }))
        .query((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        var _b, _c;
        const playlist = yield prisma.playlists.findUnique({
            where: { id: input.playlistId },
            include: {
                user: { select: { name: true, image: true } },
                channels: { select: { name: true, handle: true } },
                playlist_videos: {
                    orderBy: { position: "asc" },
                    where: { videos: { deletedAt: null } },
                    include: {
                        videos: {
                            select: {
                                id: true,
                                title: true,
                                duration: true,
                                thumbnailUrl: true,
                                channels: {
                                    select: { name: true, handle: true },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!playlist || playlist.deletedAt) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: "Playlist not found",
            });
        }
        // Privacy enforcement
        if (playlist.visibility === "PRIVATE" &&
            playlist.userId !== ctx.session.user.id) {
            throw new TRPCError({
                code: "FORBIDDEN",
                message: "You do not have access to this playlist",
            });
        }
        return {
            id: playlist.id,
            title: playlist.title,
            description: playlist.description,
            visibility: playlist.visibility,
            authorName: ((_b = playlist.channels) === null || _b === void 0 ? void 0 : _b.name) || playlist.user.name,
            authorHandle: ((_c = playlist.channels) === null || _c === void 0 ? void 0 : _c.handle) || null,
            videos: playlist.playlist_videos
                .filter((pv) => pv.videos && pv.videos.id)
                .map((pv) => {
                var _a, _b;
                return ({
                    id: pv.videos.id,
                    title: pv.videos.title,
                    duration: pv.videos.duration,
                    thumbnailUrl: pv.videos.thumbnailUrl,
                    channelName: ((_a = pv.videos.channels) === null || _a === void 0 ? void 0 : _a.name) || null,
                    channelHandle: ((_b = pv.videos.channels) === null || _b === void 0 ? void 0 : _b.handle) || null,
                    position: pv.position,
                });
            }),
        };
    })),
    updatePlaylistDetails: protectedProcedure
        .input(z.object({
        playlistId: z.string(),
        title: z.string().min(1).max(150),
        visibility: z.enum(["PUBLIC", "PRIVATE", "UNLISTED"])
    }))
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const playlist = yield prisma.playlists.findUnique({
            where: { id: input.playlistId }
        });
        if (!playlist || playlist.userId !== ctx.session.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Unauthorized" });
        }
        return prisma.playlists.update({
            where: { id: input.playlistId },
            data: {
                title: input.title,
                visibility: input.visibility
            }
        });
    })),
});
