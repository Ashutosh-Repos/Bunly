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
import { router, protectedProcedure, channelProcedure } from "../router.js";
import { prisma } from "../../lib/prisma.js";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "../../../generated/prisma/client";
import { NotificationService } from "../../services/NotificationService.js";
const channelHandleRegex = /^[a-zA-Z0-9_.]+$/;
const linkSchema = z.object({
    title: z.string().trim().min(1).max(100),
    url: z.url(),
});
export const createChannelSchema = z.object({
    name: z.string().trim().min(1).max(50),
    handle: z
        .string()
        .trim()
        .min(3)
        .max(30)
        .regex(channelHandleRegex, "Handle can only contain letters, numbers, underscores, and periods."),
    description: z.string().trim().max(5000).optional(),
    image: z.string().optional().or(z.literal("")),
    bannerUrl: z.string().optional().or(z.literal("")),
    contactEmail: z.email().optional(),
    location: z.string().trim().max(100).optional(),
    links: z.array(linkSchema).max(20).optional(),
    tags: z.array(z.string().trim()).max(50).optional(),
});
const CHANNEL_PUBLIC_SELECT = {
    id: true,
    userId: true,
    handle: true,
    name: true,
    description: true,
    image: true,
    bannerUrl: true,
    isVerified: true,
    subscriberCount: true,
    videoCount: true,
    totalViews: true,
    createdAt: true,
    links: true,
    location: true,
    contactEmail: true,
    featureFlags: true,
};
export const channelRouter = router({
    createChannel: protectedProcedure
        .input(createChannelSchema)
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const userId = ctx.session.user.id;
        const { tags } = input, scalarInput = __rest(input, ["tags"]);
        try {
            const channel = yield prisma.channels.create({
                data: Object.assign(Object.assign({}, scalarInput), { userId, status: "ACTIVE", tags: tags
                        ? {
                            connectOrCreate: tags.map((tag) => ({
                                where: { name: tag },
                                create: { name: tag },
                            })),
                        }
                        : undefined }),
            });
            return { success: true, channel };
        }
        catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === "P2002") {
                throw new TRPCError({
                    code: "CONFLICT",
                    message: "This handle is already taken.",
                });
            }
            throw error;
        }
    })),
    updateChannel: channelProcedure
        .input(createChannelSchema
        .extend({
        featureFlags: z
            .object({
            canLiveStream: z.boolean().optional(),
            canUpload: z.boolean().optional(),
        })
            .optional(),
    })
        .partial())
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const { tags, channelId: _channelId } = input, data = __rest(input, ["tags", "channelId"]);
        const channelId = ctx.channel.id;
        // Calculate Tag Deltas
        let tagsUpdateOp = undefined;
        if (tags) {
            // If tags are being updated, we need to fetch existing tags
            // channelOwnerProcedure does NOT include tags by default
            const existingWithTags = yield prisma.channels.findUnique({
                where: { id: channelId },
                select: { tags: true },
            });
            // Should exist because we just checked ownership
            if (existingWithTags) {
                const currentTagNames = existingWithTags.tags.map((t) => t.name);
                const newTagNames = tags;
                const tagsToConnect = newTagNames.filter((t) => !currentTagNames.includes(t));
                const tagsToDisconnect = currentTagNames.filter((t) => !newTagNames.includes(t));
                if (tagsToConnect.length > 0 ||
                    tagsToDisconnect.length > 0) {
                    tagsUpdateOp = {
                        disconnect: tagsToDisconnect.map((tag) => ({
                            name: tag,
                        })),
                        connectOrCreate: tagsToConnect.map((tag) => ({
                            where: { name: tag },
                            create: { name: tag },
                        })),
                    };
                }
            }
        }
        try {
            const channel = yield prisma.channels.update({
                where: { id: channelId },
                data: Object.assign(Object.assign({}, data), { tags: tagsUpdateOp }),
            });
            return { success: true, channel };
        }
        catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === "P2002") {
                throw new TRPCError({
                    code: "CONFLICT",
                    message: "This handle is already taken.",
                });
            }
            throw error;
        }
    })),
    deleteChannel: channelProcedure.mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx }) {
        // Soft-delete: preserves all video records and analytics.
        // A background job should later clean up associated S3 objects.
        yield prisma.channels.update({
            where: { id: ctx.channel.id },
            data: {
                deletedAt: new Date(),
                status: "SUSPENDED",
            },
        });
        return { success: true };
    })),
    toggleSubscription: protectedProcedure
        .input(z.object({
        channelId: z.string({ message: "Channel ID is required" }),
    }))
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const { channelId } = input;
        const userId = ctx.session.user.id;
        // TODO: For high scale (>1M users), refrain from writing to DB directly.
        // Instead, push to a Redis queue and process in background (Write-Behind).
        return yield prisma.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const channelInfo = yield tx.channels.findUnique({
                where: { id: channelId },
                select: { userId: true, handle: true, name: true },
            });
            if (!channelInfo) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Channel not found",
                });
            }
            if (channelInfo.userId === userId) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "You cannot subscribe to your own channel",
                });
            }
            const existing = yield tx.subscriptions.findUnique({
                where: {
                    subscriberId_channelId: {
                        subscriberId: userId,
                        channelId,
                    },
                },
            });
            if (existing) {
                yield tx.subscriptions.delete({
                    where: { id: existing.id },
                });
                yield tx.channels.update({
                    where: { id: channelId },
                    data: { subscriberCount: { decrement: 1 } },
                });
                // Floor at 0 to prevent data inconsistency
                yield tx.$executeRaw `UPDATE channels SET "subscriberCount" = GREATEST(0, "subscriberCount") WHERE id = ${channelId}`;
                return { success: true, action: "UNSUBSCRIBED" };
            }
            else {
                yield tx.subscriptions.create({
                    data: { subscriberId: userId, channelId },
                });
                const channel = yield tx.channels.update({
                    where: { id: channelId },
                    data: { subscriberCount: { increment: 1 } },
                    select: { userId: true, handle: true, name: true },
                });
                //Fire NEW_SUBSCRIBER notification to channel owner (async, non-blocking)
                NotificationService.notify({
                    userId: channel.userId,
                    actorId: userId,
                    type: "NEW_SUBSCRIBER",
                    title: "New Subscriber",
                    message: "subscribed to your channel",
                    channelId,
                    actionUrl: `/@${channel.handle}`,
                    groupKey: `NEW_SUBSCRIBER:${channelId}:${new Date().toISOString().slice(0, 10)}`,
                }).catch(console.error);
                return { success: true, action: "SUBSCRIBED" };
            }
        }));
    })),
    checkHandleAvailability: protectedProcedure
        .input(z.object({
        handle: z.string().min(3).max(30).regex(channelHandleRegex),
    }))
        .query((_a) => __awaiter(void 0, [_a], void 0, function* ({ input }) {
        const { handle } = input;
        const existing = yield prisma.channels.findFirst({
            where: { handle, deletedAt: null },
            select: { id: true },
        });
        return { success: !existing };
    })),
    getChannelByHandle: protectedProcedure
        .input(z.object({
        handle: z.string().min(3).max(30).regex(channelHandleRegex),
    }))
        .query((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const { handle } = input;
        const channel = yield prisma.channels.findUnique({
            where: { handle, deletedAt: null },
            select: CHANNEL_PUBLIC_SELECT,
        });
        if (!channel) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: "Channel not found",
            });
        }
        let isSubscribed = false;
        let notificationLevel = "PERSONALIZED";
        if (ctx.session.user.id) {
            const sub = yield prisma.subscriptions.findUnique({
                where: {
                    subscriberId_channelId: {
                        subscriberId: ctx.session.user.id,
                        channelId: channel.id,
                    },
                },
                select: { notificationLevel: true },
            });
            if (sub) {
                isSubscribed = true;
                notificationLevel = sub.notificationLevel;
            }
        }
        return {
            success: true,
            channel,
            isSubscribed,
            notificationLevel,
        };
    })),
    getChannelById: channelProcedure.query((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx }) {
        const channel = yield prisma.channels.findUnique({
            where: { id: ctx.channel.id },
            include: { tags: true },
        });
        if (!channel) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: "Channel not found",
            });
        }
        return { success: true, channel };
    })),
    getUserChannels: protectedProcedure.query((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx }) {
        const userId = ctx.session.user.id;
        const channelsData = yield prisma.channels.findMany({
            where: {
                userId,
                deletedAt: null,
            },
            orderBy: {
                createdAt: "desc",
            },
        });
        // Map to public shape but use dynamic video count
        const channels = channelsData.map((channel) => ({
            id: channel.id,
            userId: channel.userId,
            handle: channel.handle,
            name: channel.name,
            description: channel.description,
            image: channel.image,
            bannerUrl: channel.bannerUrl,
            isVerified: channel.isVerified,
            subscriberCount: channel.subscriberCount,
            videoCount: channel.videoCount, // Use denormalized fast count
            totalViews: channel.totalViews,
            createdAt: channel.createdAt,
            links: channel.links,
            location: channel.location,
            contactEmail: channel.contactEmail,
            featureFlags: channel.featureFlags,
        }));
        return { success: true, channels };
    })),
    // Per-channel notification bell: get current level
    getNotificationLevel: protectedProcedure
        .input(z.object({ channelId: z.string() }))
        .query((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        var _b;
        const sub = yield prisma.subscriptions.findUnique({
            where: {
                subscriberId_channelId: {
                    subscriberId: ctx.session.user.id,
                    channelId: input.channelId,
                },
            },
            select: { notificationLevel: true },
        });
        return (_b = sub === null || sub === void 0 ? void 0 : sub.notificationLevel) !== null && _b !== void 0 ? _b : null;
    })),
    // Per-channel notification bell: update level
    updateNotificationLevel: protectedProcedure
        .input(z.object({
        channelId: z.string(),
        level: z.enum(["ALL", "PERSONALIZED", "NONE"]),
    }))
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const result = yield prisma.subscriptions.updateMany({
            where: {
                subscriberId: ctx.session.user.id,
                channelId: input.channelId,
            },
            data: { notificationLevel: input.level },
        });
        return { success: result.count > 0 };
    })),
});
