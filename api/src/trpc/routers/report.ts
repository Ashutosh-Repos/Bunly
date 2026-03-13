import { z } from "zod";
import { router, protectedProcedure, adminProcedure, auditedAdminProcedure } from "../router.js";
import { ReportService, ReportStatus, ReportReason } from "../../services/ReportService.js";

export const reportRouter = router({
    submit: protectedProcedure
        .input(
            z.object({
                videoId: z.string().optional(),
                commentId: z.string().optional(),
                reportedUserId: z.string().optional(),
                reason: z.enum([
                    "SPAM",
                    "HARASSMENT",
                    "HATE_SPEECH",
                    "VIOLENCE",
                    "SEXUAL_CONTENT",
                    "MISINFORMATION",
                    "COPYRIGHT",
                    "IMPERSONATION",
                ]) as z.ZodType<ReportReason>,
                description: z.string().optional(),
            }).refine(
                (data) => {
                    const targets = [data.videoId, data.commentId, data.reportedUserId].filter(Boolean);
                    return targets.length === 1;
                },
                {
                    message: "Exactly one report target (video, comment, or user) must be provided",
                }
            )
        )
        .mutation(async ({ ctx, input }) => {
            return ReportService.submitReport(ctx.session.user.id, input);
        }),

    getMyReports: protectedProcedure
        .input(
            z.object({
                cursor: z.string().nullish(),
                limit: z.number().min(1).max(100).optional().default(20),
            })
        )
        .query(async ({ ctx, input }) => {
            return ReportService.getMyReports(ctx.session.user.id, input.cursor ?? undefined, input.limit);
        }),

    list: adminProcedure
        .input(
            z.object({
                status: z.enum(["PENDING", "UNDER_REVIEW", "RESOLVED", "DISMISSED"]).optional(),
                reason: z.enum([
                    "SPAM",
                    "HARASSMENT",
                    "HATE_SPEECH",
                    "VIOLENCE",
                    "SEXUAL_CONTENT",
                    "MISINFORMATION",
                    "COPYRIGHT",
                    "IMPERSONATION",
                ]).optional(),
                cursor: z.string().nullish(),
                limit: z.number().min(1).max(100).optional().default(50),
            })
        )
        .query(async ({ input }) => {
            return ReportService.listReports(
                { status: input.status as ReportStatus, reason: input.reason as ReportReason },
                input.cursor ?? undefined,
                input.limit
            );
        }),

    review: auditedAdminProcedure
        .input(
            z.object({
                reportId: z.string(),
                status: z.enum(["UNDER_REVIEW", "RESOLVED", "DISMISSED"]),
                reviewNote: z.string().optional(),
                strikeId: z.string().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const result = await ReportService.reviewReport(input.reportId, ctx.session.user.id, {
                status: input.status as ReportStatus,
                reviewNote: input.reviewNote,
                strikeId: input.strikeId,
            });

            await ctx.audit(
                "REPORT_REVIEWED",
                "report",
                input.reportId,
                { metadata: { status: input.status, strikeId: input.strikeId } }
            );

            return result;
        }),
});
