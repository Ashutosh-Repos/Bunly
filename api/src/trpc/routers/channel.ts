import { router, protectedProcedure, channelProcedure } from "../router.js";
import { prisma } from "../../lib/prisma.js";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "../../../generated/prisma/client";
import { NotificationService } from "../../services/NotificationService.js";
import { StreamService } from "../../services/StreamService.js";

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
        .regex(
            channelHandleRegex,
            "Handle can only contain letters, numbers, underscores, and periods.",
        ),
    description: z.string().trim().max(5000).optional(),
    image: z.string().optional().or(z.literal("")),
    bannerUrl: z.string().optional().or(z.literal("")),
    contactEmail: z
        .string()
        .email()
        .optional()
        .or(z.literal(""))
        .transform((val) => (val === "" ? null : val)),
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
} satisfies Prisma.channelsSelect;

export const channelRouter = router({
    createChannel: protectedProcedure
        .input(createChannelSchema)
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;
            const { tags, ...scalarInput } = input;

            try {
                const channel = await prisma.channels.create({
                    data: {
                        ...scalarInput,
                        userId,
                        status: "ACTIVE",
                        tags: tags
                            ? {
                                  connectOrCreate: tags.map((tag) => ({
                                      where: { name: tag },
                                      create: { name: tag },
                                  })),
                              }
                            : undefined,
                    },
                });
                return { success: true, channel };
            } catch (error) {
                if (error instanceof Prisma.PrismaClientKnownRequestError) {
                    if (error.code === "P2002") {
                        throw new TRPCError({
                            code: "CONFLICT",
                            message: "This handle is already taken.",
                        });
                    }
                    if (error.code === "P2003") {
                        throw new TRPCError({
                            code: "UNAUTHORIZED",
                            message:
                                "User account missing or session out of sync. Please log in again.",
                        });
                    }
                }
                throw error;
            }
        }),

    updateChannel: channelProcedure
        .input(createChannelSchema.partial())
        .mutation(async ({ ctx, input }) => {
            const { tags, channelId: _channelId, ...data } = input;
            const channelId = ctx.channel.id;

            // Calculate Tag Deltas
            let tagsUpdateOp = undefined;
            if (tags) {
                // If tags are being updated, we need to fetch existing tags
                // channelOwnerProcedure does NOT include tags by default
                const existingWithTags = await prisma.channels.findUnique({
                    where: { id: channelId },
                    select: { tags: true },
                });

                // Should exist because we just checked ownership
                if (existingWithTags) {
                    const currentTagNames = existingWithTags.tags.map(
                        (t) => t.name,
                    );
                    const newTagNames = tags;

                    const tagsToConnect = newTagNames.filter(
                        (t) => !currentTagNames.includes(t),
                    );
                    const tagsToDisconnect = currentTagNames.filter(
                        (t) => !newTagNames.includes(t),
                    );

                    if (
                        tagsToConnect.length > 0 ||
                        tagsToDisconnect.length > 0
                    ) {
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
                const channel = await prisma.channels.update({
                    where: { id: channelId },
                    data: {
                        ...data,
                        tags: tagsUpdateOp,
                    },
                });
                return { success: true, channel };
            } catch (error) {
                if (
                    error instanceof Prisma.PrismaClientKnownRequestError &&
                    error.code === "P2002"
                ) {
                    throw new TRPCError({
                        code: "CONFLICT",
                        message: "This handle is already taken.",
                    });
                }
                throw error;
            }
        }),

    deleteChannel: channelProcedure.mutation(async ({ ctx }) => {
        const userId = ctx.session.user.id;
        const channelId = ctx.channel.id;

        await prisma.$transaction(async (tx) => {
            // 1. Soft-delete the channel
            await tx.channels.update({
                where: { id: channelId },
                data: {
                    deletedAt: new Date(),
                    status: "SUSPENDED",
                },
            });

            // 2. Cascade delete User's subscriptions (Data Consistency)
            // The user deleting their channel profile effectively deletes their public presence.
            const userSubs = await tx.subscriptions.findMany({
                where: { subscriberId: userId },
                select: { channelId: true },
            });

            if (userSubs.length > 0) {
                const subbedChannelIds = userSubs.map((s) => s.channelId);

                // Decrement remote channels' subscriber counts
                await tx.channels.updateMany({
                    where: { id: { in: subbedChannelIds } },
                    data: { subscriberCount: { decrement: 1 } },
                });

                // Purge the subscription records
                await tx.subscriptions.deleteMany({
                    where: { subscriberId: userId },
                });
            }
        });

        // A background job should later clean up associated S3 objects.
        return { success: true };
    }),

    /**
     * Get the current user's subscription status for a channel.
     * Used by SubscribeButton to hydrate initial state.
     */
    getSubscriptionStatus: protectedProcedure
        .input(z.object({ channelId: z.string().min(1) }))
        .query(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;
            const { channelId } = input;

            // Hybrid Read: Cache → DB
            const cachedStatus = await StreamService.getSubscriptionStatus(userId, channelId);
            if (cachedStatus !== null) {
                return { subscribed: cachedStatus === "SUBSCRIBE" };
            }

            const existing = await prisma.subscriptions.findUnique({
                where: { subscriberId_channelId: { subscriberId: userId, channelId } },
                select: { id: true },
            });

            return { subscribed: !!existing };
        }),

    toggleSubscription: protectedProcedure
        .input(
            z.object({
                channelId: z.string({ message: "Channel ID is required" }),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { channelId } = input;
            const userId = ctx.session.user.id;

            // Write-Behind: High scale architecture via Redis Streams.
            // Gets initial state from hybrid cache/DB, computes toggle, and delegates write to worker.
            const channelInfo = await prisma.channels.findUnique({
                where: { id: channelId },
                select: { userId: true },
            });

            if (!channelInfo) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Channel not found" });
            }

            if (channelInfo.userId === userId) {
                throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot subscribe to your own channel" });
            }

            // Hybrid Read
            let isSubscribed = false;
            const cachedStatus = await StreamService.getSubscriptionStatus(userId, channelId);

            if (cachedStatus !== null) {
                isSubscribed = cachedStatus === "SUBSCRIBE";
            } else {
                const existing = await prisma.subscriptions.findUnique({
                    where: { subscriberId_channelId: { subscriberId: userId, channelId } },
                });
                isSubscribed = !!existing;
            }

            const action = isSubscribed ? "UNSUBSCRIBE" : "SUBSCRIBE";

            // Push to Stream and Cache (Fast Lane)
            await StreamService.addSubscription(userId, channelId, action);

            return { success: true, action: action === "SUBSCRIBE" ? "SUBSCRIBED" : "UNSUBSCRIBED" };
        }),

    checkHandleAvailability: protectedProcedure
        .input(
            z.object({
                handle: z.string().min(3).max(30).regex(channelHandleRegex),
            }),
        )
        .query(async ({ input }) => {
            const { handle } = input;
            const existing = await prisma.channels.findFirst({
                where: { handle, deletedAt: null },
                select: { id: true },
            });
            return { success: !existing };
        }),

    getChannelByHandle: protectedProcedure
        .input(
            z.object({
                handle: z.string().min(3).max(30).regex(channelHandleRegex),
            }),
        )
        .query(async ({ ctx, input }) => {
            const { handle } = input;
            const channel = await prisma.channels.findUnique({
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
            let notificationLevel: "ALL" | "PERSONALIZED" | "NONE" =
                "PERSONALIZED";

            if (ctx.session.user.id) {
                // Hybrid Read: Check Redis cache first (write-behind), then DB
                const [cachedSub, sub] = await Promise.all([
                    StreamService.getSubscriptionStatus(ctx.session.user.id, channel.id),
                    prisma.subscriptions.findUnique({
                        where: {
                            subscriberId_channelId: {
                                subscriberId: ctx.session.user.id,
                                channelId: channel.id,
                            },
                        },
                        select: { notificationLevel: true },
                    }),
                ]);

                isSubscribed = cachedSub !== null
                    ? cachedSub === "SUBSCRIBE"
                    : !!sub;

                if (sub) {
                    notificationLevel = sub.notificationLevel;
                }
            }

            return {
                success: true,
                channel,
                isSubscribed,
                notificationLevel,
            };
        }),

    getChannelById: channelProcedure.query(async ({ ctx }) => {
        const channel = await prisma.channels.findUnique({
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
    }),

    getUserChannels: protectedProcedure.query(async ({ ctx }) => {
        const userId = ctx.session.user.id;
        const channelsData = await prisma.channels.findMany({
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
    }),

    // Per-channel notification bell: get current level
    getNotificationLevel: protectedProcedure
        .input(z.object({ channelId: z.string() }))
        .query(async ({ ctx, input }) => {
            const sub = await prisma.subscriptions.findUnique({
                where: {
                    subscriberId_channelId: {
                        subscriberId: ctx.session.user.id,
                        channelId: input.channelId,
                    },
                },
                select: { notificationLevel: true },
            });
            return sub?.notificationLevel ?? null;
        }),

    // Per-channel notification bell: update level
    updateNotificationLevel: protectedProcedure
        .input(
            z.object({
                channelId: z.string(),
                level: z.enum(["ALL", "PERSONALIZED", "NONE"]),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const result = await prisma.subscriptions.updateMany({
                where: {
                    subscriberId: ctx.session.user.id,
                    channelId: input.channelId,
                },
                data: { notificationLevel: input.level },
            });
            return { success: result.count > 0 };
        }),

    // Paginated list of channels the calling user subscribes to
    getSubscribedChannels: protectedProcedure
        .input(
            z.object({
                limit: z.number().min(1).max(100).default(50),
                cursor: z.string().nullish(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const { limit, cursor } = input;
            const userId = ctx.session.user.id;

            const subs = await prisma.subscriptions.findMany({
                where: { subscriberId: userId },
                take: limit + 1,
                cursor: cursor ? { id: cursor } : undefined,
                skip: cursor ? 1 : 0,
                orderBy: { subscribedAt: "desc" },
                select: {
                    id: true,
                    notificationLevel: true,
                    subscribedAt: true,
                    channels: {
                        select: {
                            id: true,
                            handle: true,
                            name: true,
                            image: true,
                            isVerified: true,
                            subscriberCount: true,
                            status: true,
                        },
                    },
                },
            });

            let nextCursor: string | undefined;
            if (subs.length > limit) {
                const next = subs.pop()!;
                nextCursor = next.id;
            }

            return {
                items: subs.map((s) => ({
                    ...s.channels,
                    notificationLevel: s.notificationLevel,
                    subscribedAt: s.subscribedAt,
                })),
                nextCursor,
            };
        }),
});
