import { z } from "zod";
import { router, auditedAdminProcedure } from "../router.js";
import { prisma } from "../../lib/prisma.js";
import { TRPCError } from "@trpc/server";
import { AdminContentStatus, ChannelStatus } from "@prisma/client";

export const adminRouter = router({
    getStats: auditedAdminProcedure.query(async () => {
        // Run a single raw SQL query for performance, instead of multiple COUNT(*)
        // This is safe because it takes no parameterized input.
        const result = await prisma.$queryRaw`
            SELECT
                (SELECT COUNT(*) FROM "user" WHERE "deletedAt" IS NULL) as users,
                (SELECT COUNT(*) FROM videos WHERE "deletedAt" IS NULL) as videos,
                (SELECT COUNT(*) FROM channels WHERE "deletedAt" IS NULL) as channels,
                (SELECT COUNT(*) FROM reports WHERE status = 'PENDING') as pending_reports,
                (SELECT COUNT(*) FROM strikes WHERE "revokedAt" IS NULL AND ("expiresAt" IS NULL OR "expiresAt" > NOW())) as active_strikes
        `;

        // The result is an array with one record
        const stats =
            Array.isArray(result) && result.length > 0 ? result[0] : {};

        return {
            users: Number(stats.users || 0),
            videos: Number(stats.videos || 0),
            channels: Number(stats.channels || 0),
            pendingReports: Number(stats.pending_reports || 0),
            activeStrikes: Number(stats.active_strikes || 0),
        };
    }),

    listUsers: auditedAdminProcedure
        .input(
            z.object({
                search: z.string().optional(),
                cursor: z.string().nullish(),
                limit: z.number().min(1).max(100).optional().default(50),
            }),
        )
        .query(async ({ input }) => {
            const { search, cursor, limit } = input;

            const whereClause = search
                ? {
                      OR: [
                          {
                              name: {
                                  contains: search,
                                  mode: "insensitive" as const,
                              },
                          },
                          {
                              email: {
                                  contains: search,
                                  mode: "insensitive" as const,
                              },
                          },
                      ],
                      deletedAt: null,
                  }
                : { deletedAt: null };

            const items = await prisma.user.findMany({
                where: whereClause,
                take: limit + 1,
                cursor: cursor ? { id: cursor } : undefined,
                skip: cursor ? 1 : 0,
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                    createdAt: true,
                    banned: true,
                    role: true,
                },
            });

            let nextCursor: string | undefined = undefined;
            if (items.length > limit) {
                const nextItem = items.pop();
                nextCursor = nextItem?.id;
            }

            return { items, nextCursor };
        }),

    banUser: auditedAdminProcedure
        .input(z.object({ userId: z.string(), reason: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const updated = await prisma.user.update({
                where: { id: input.userId },
                data: { banned: true, banReason: input.reason },
            });

            await ctx.audit("BAN_USER", "user", input.userId, {
                reason: input.reason,
            });

            return { success: true, banned: updated.banned };
        }),

    unbanUser: auditedAdminProcedure
        .input(z.object({ userId: z.string(), reason: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const updated = await prisma.user.update({
                where: { id: input.userId },
                data: { banned: false, banReason: null, banExpires: null },
            });

            await ctx.audit("UNBAN_USER", "user", input.userId, {
                reason: input.reason,
            });

            return { success: true, banned: updated.banned };
        }),

    setVideoAdminStatus: auditedAdminProcedure
        .input(
            z.object({
                videoId: z.string(),
                status: z.nativeEnum(AdminContentStatus),
                reason: z.string().optional(),
                adminNote: z.string().max(2000).optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const updated = await prisma.videos.update({
                where: { id: input.videoId },
                data: {
                    adminStatus: input.status,
                    adminNote: input.adminNote ?? input.reason ?? null,
                },
                select: {
                    id: true,
                    adminStatus: true,
                    adminNote: true,
                    title: true,
                },
            });

            await ctx.audit("VIDEO_ADMIN_STATUS", "video", input.videoId, {
                reason: input.reason,
                metadata: { newStatus: input.status },
            });

            return updated;
        }),

    setChannelStatus: auditedAdminProcedure
        .input(
            z.object({
                channelId: z.string(),
                status: z.enum(["ACTIVE", "SUSPENDED"]),
                reason: z.string().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const updated = await prisma.channels.update({
                where: { id: input.channelId },
                data: { status: input.status as ChannelStatus },
            });

            // If suspending
            if (input.status === "SUSPENDED") {
                await ctx.audit("CHANNEL_SUSPEND", "channel", input.channelId, {
                    reason: input.reason,
                });
            } else {
                await ctx.audit(
                    "CHANNEL_UNSUSPEND",
                    "channel",
                    input.channelId,
                    { reason: input.reason },
                );
            }

            return updated;
        }),

    listAuditLogs: auditedAdminProcedure
        .input(
            z.object({
                actionType: z.string().optional(),
                targetType: z.string().optional(),
                cursor: z.string().nullish(),
                limit: z.number().min(1).max(100).optional().default(50),
            }),
        )
        .query(async ({ input }) => {
            const { actionType, targetType, cursor, limit } = input;

            const items = await prisma.audit_logs.findMany({
                where: {
                    ...(actionType ? { action: actionType } : {}),
                    ...(targetType ? { targetType } : {}),
                },
                take: limit + 1,
                cursor: cursor ? { id: cursor } : undefined,
                skip: cursor ? 1 : 0,
                orderBy: { createdAt: "desc" },
                include: {
                    user_audit_logs_actorIdTouser: {
                        select: { name: true, email: true },
                    },
                },
            });

            let nextCursor: string | undefined = undefined;
            if (items.length > limit) {
                const nextItem = items.pop();
                nextCursor = nextItem?.id;
            }

            return { items, nextCursor };
        }),

    listChannels: auditedAdminProcedure
        .input(
            z.object({
                search: z.string().optional(),
                cursor: z.string().nullish(),
                limit: z.number().min(1).max(100).optional().default(50),
            }),
        )
        .query(async ({ input }) => {
            const { search, cursor, limit } = input;

            const whereClause = search
                ? {
                      OR: [
                          {
                              name: {
                                  contains: search,
                                  mode: "insensitive" as const,
                              },
                          },
                          {
                              handle: {
                                  contains: search,
                                  mode: "insensitive" as const,
                              },
                          },
                      ],
                      deletedAt: null,
                  }
                : { deletedAt: null };

            const items = await prisma.channels.findMany({
                where: whereClause,
                take: limit + 1,
                cursor: cursor ? { id: cursor } : undefined,
                skip: cursor ? 1 : 0,
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    handle: true,
                    name: true,
                    status: true,
                    createdAt: true,
                    user: { select: { id: true, name: true, email: true } },
                    videoCount: true,
                    subscriberCount: true,
                },
            });

            let nextCursor: string | undefined = undefined;
            if (items.length > limit) {
                const nextItem = items.pop();
                nextCursor = nextItem?.id;
            }

            return { items, nextCursor };
        }),

    getVideoDetail: auditedAdminProcedure
        .input(z.object({ videoId: z.string() }))
        .query(async ({ input }) => {
            const video = await prisma.videos.findUnique({
                where: { id: input.videoId },
                include: {
                    channels: {
                        select: {
                            id: true,
                            name: true,
                            handle: true,
                            user: { select: { email: true } },
                        },
                    },
                },
            });

            if (!video) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Video not found",
                });
            }

            return video;
        }),

    getReportDetail: auditedAdminProcedure
        .input(z.object({ reportId: z.string() }))
        .query(async ({ input }) => {
            const report = await prisma.reports.findUnique({
                where: { id: input.reportId },
                include: {
                    user_reports_reporterIdTouser: {
                        select: { id: true, name: true, email: true },
                    },
                    videos: {
                        select: {
                            id: true,
                            title: true,
                            adminStatus: true,
                            visibility: true,
                        },
                    },
                    comments: { select: { id: true, content: true } },
                },
            });

            if (!report) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Report not found",
                });
            }

            return report;
        }),
});
