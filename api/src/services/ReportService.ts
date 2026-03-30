import { prisma } from "../lib/prisma";
import { TRPCError } from "@trpc/server";

export type ReportStatus = "PENDING" | "UNDER_REVIEW" | "RESOLVED" | "DISMISSED";
export type ReportReason = "SPAM" | "HARASSMENT" | "HATE_SPEECH" | "VIOLENCE" | "SEXUAL_CONTENT" | "MISINFORMATION" | "COPYRIGHT" | "IMPERSONATION";

export interface SubmitReportInput {
    videoId?: string;
    commentId?: string;
    reportedUserId?: string;
    reason: ReportReason;
    description?: string;
}

export class ReportService {
    /**
     * Submit a new report. Enforces exactly one target via business logic
     * (and DB unique constraints if present).
     */
    static async submitReport(reporterId: string, input: SubmitReportInput) {
        const { videoId, commentId, reportedUserId, reason, description } = input;

        // 1. Verify exactly one target
        const targets = [videoId, commentId, reportedUserId].filter(Boolean);
        if (targets.length !== 1) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Exactly one report target (video, comment, or user) must be provided",
            });
        }

        // 2. Prevent self-reporting
        if (reportedUserId === reporterId) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: "You cannot report yourself",
            });
        }

        // 3. Verify target existence
        if (videoId) {
            const video = await prisma.videos.findUnique({ where: { id: videoId } });
            if (!video) throw new TRPCError({ code: "NOT_FOUND", message: "Video not found" });
        } else if (commentId) {
            const comment = await prisma.comments.findUnique({ where: { id: commentId } });
            if (!comment) throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found" });
        } else if (reportedUserId) {
            const user = await prisma.user.findUnique({ where: { id: reportedUserId } });
            if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }

        try {
            return await prisma.reports.create({
                data: {
                    reporterId,
                    videoId,
                    commentId,
                    reportedUserId,
                    reason,
                    description,
                    status: "PENDING",
                },
            });
        } catch (err: any) {
            // P2002 is Prisma's unique constraint violation - reporter can't report same thing twice
            if (err.code === "P2002") {
                throw new TRPCError({
                    code: "CONFLICT",
                    message: "You have already reported this item",
                });
            }
            throw err;
        }
    }

    /**
     * Get reports created by the current user.
     */
    static async getMyReports(userId: string, cursor?: string, limit: number = 20) {
        return prisma.reports.findMany({
            where: { reporterId: userId },
            take: limit + 1,
            cursor: cursor ? { id: cursor } : undefined,
            skip: cursor ? 1 : 0,
            orderBy: { createdAt: "desc" },
        });
    }

    /**
     * List all reports (Admin context).
     */
    static async listReports(filters: { status?: ReportStatus; reason?: ReportReason }, cursor?: string, limit: number = 50) {
        const items = await prisma.reports.findMany({
            where: {
                status: filters.status,
                reason: filters.reason,
            },
            take: limit + 1,
            cursor: cursor ? { id: cursor } : undefined,
            skip: cursor ? 1 : 0,
            orderBy: { createdAt: "desc" },
            include: {
                user_reports_reporterIdTouser: { select: { name: true, image: true, id: true } },
                user_reports_reportedUserIdTouser: { select: { name: true, id: true } },
            }
        });

        let nextCursor: string | undefined = undefined;
        if (items.length > limit) {
            const nextItem = items.pop();
            nextCursor = nextItem?.id;
        }

        return { items, nextCursor };
    }

    /**
     * Review a report (Admin context).
     */
    static async reviewReport(
        reportId: string,
        adminId: string,
        data: { status: ReportStatus; reviewNote?: string; strikeId?: string }
    ) {
        return prisma.reports.update({
            where: { id: reportId },
            data: {
                status: data.status,
                reviewNote: data.reviewNote,
                reviewedAt: new Date(),
                reviewedById: adminId,
                strikeId: data.strikeId,
            },
        });
    }
}
