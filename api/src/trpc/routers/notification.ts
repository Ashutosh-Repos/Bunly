import { z } from "zod";
import { router, protectedProcedure } from "../router.js";
import { NotificationService } from "../../services/NotificationService";
import { redisSubscriptionManager } from "../../lib/ws/redisSubscription";
import { on } from "events";
import { prisma } from "../../lib/prisma";
import { NotificationType } from "../../../generated/prisma/client";

// Filter tab → NotificationType mapping (YouTube-style)
const TYPE_FILTER_MAP: Record<string, NotificationType[]> = {
    uploads: [NotificationType.NEW_VIDEO],
    comments: [NotificationType.COMMENT, NotificationType.COMMENT_REPLY],
    activity: [
        NotificationType.NEW_SUBSCRIBER,
        NotificationType.VIDEO_LIKE,
        NotificationType.COMMENT_LIKE,
        NotificationType.LIVE_STARTED,
        NotificationType.LIVE_SCHEDULED,
        NotificationType.SYSTEM,
    ],
};

export const notificationRouter = router({
    list: protectedProcedure
        .input(
            z.object({
                limit: z.number().min(1).max(50).default(20),
                cursor: z.string().nullish(),
                typeFilter: z
                    .enum(["all", "uploads", "comments", "activity"])
                    .default("all"),
            }),
        )
        .query(async ({ ctx, input }) => {
            const { limit, cursor, typeFilter } = input;
            const userId = ctx.session.user.id;

            // Build type filter
            const typeCondition =
                typeFilter !== "all" && TYPE_FILTER_MAP[typeFilter]
                    ? { type: { in: TYPE_FILTER_MAP[typeFilter] } }
                    : {};

            const notifications = await prisma.notifications.findMany({
                where: { userId, isHidden: false, ...typeCondition },
                take: limit + 1,
                cursor: cursor ? { id: cursor } : undefined,
                skip: cursor ? 1 : 0,
                orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                include: {
                    user_notifications_actorIdTouser: {
                        select: {
                            id: true,
                            name: true,
                            image: true,
                        },
                    },
                },
            });

            let nextCursor: string | null = null;
            if (notifications.length > limit) {
                const nextItem = notifications.pop();
                nextCursor = nextItem?.id || null;
            }

            return {
                items: notifications,
                nextCursor,
            };
        }),

    getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
        return prisma.notifications.count({
            where: {
                userId: ctx.session.user.id,
                isRead: false,
                isHidden: false,
            },
        });
    }),

    markRead: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            return NotificationService.markAsRead(
                input.id,
                ctx.session.user.id,
            );
        }),

    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
        return NotificationService.markAllAsRead(ctx.session.user.id);
    }),

    // Soft-delete (dismiss): hides from list but keeps in DB for analytics
    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const result = await prisma.notifications.updateMany({
                where: { id: input.id, userId: ctx.session.user.id },
                data: { isHidden: true },
            });
            return { success: result.count > 0 };
        }),

    onNotification: protectedProcedure.subscription(async function* ({ ctx }) {
        const userId = ctx.session.user.id;
        const channel = NotificationService.getChannel(userId);

        console.log(`[TRPC] 🎧 Client subscribing to ${channel}`);

        try {
            for await (const [message] of on(
                redisSubscriptionManager,
                channel,
            )) {
                yield message;
            }
        } catch (err) {
            console.error(`[TRPC] Subscription error on ${channel}`, err);
        }
    }),

    getSettings: protectedProcedure.query(async ({ ctx }) => {
        const settings = await prisma.notification_settings.findUnique({
            where: { userId: ctx.session.user.id },
        });

        // Return defaults if row doesn't exist yet
        return (
            settings ?? {
                newVideos: true,
                liveStreams: true,
                comments: true,
                replies: true,
                likes: false,
                subscribers: true,
            }
        );
    }),

    updateSettings: protectedProcedure
        .input(
            z.object({
                newVideos: z.boolean().optional(),
                liveStreams: z.boolean().optional(),
                comments: z.boolean().optional(),
                replies: z.boolean().optional(),
                likes: z.boolean().optional(),
                subscribers: z.boolean().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;

            return prisma.notification_settings.upsert({
                where: { userId },
                create: {
                    userId,
                    ...input,
                },
                update: {
                    ...input,
                },
            });
        }),
});
