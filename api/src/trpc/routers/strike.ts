import { z } from "zod";
import { router, protectedProcedure, adminProcedure, auditedAdminProcedure } from "../router.js";
import { StrikeService, StrikeType } from "../../services/StrikeService.js";
import { prisma } from "../../lib/prisma.js";
import { TRPCError } from "@trpc/server";

export const strikeRouter = router({
    issue: auditedAdminProcedure
        .input(
            z.object({
                channelId: z.string().optional(),
                userId: z.string().optional(),
                type: z.enum(["WARNING", "COMMUNITY_GUIDELINE", "COPYRIGHT"]) as z.ZodType<StrikeType>,
                severity: z.number().int().min(0).max(3),
                reason: z.string().min(1).max(500),
                internalNote: z.string().optional(),
                videoId: z.string().optional(),
                commentId: z.string().optional(),
                postId: z.string().optional(),
            }).refine((data) => data.channelId || data.userId, {
                message: "Must provide either channelId or userId for the strike",
            })
        )
        .mutation(async ({ ctx, input }) => {
            const strike = await StrikeService.issueStrike(ctx.session.user.id, input);
            
            await ctx.audit(
                "STRIKE_ISSUED",
                input.channelId ? "channel" : "user",
                input.channelId || input.userId!,
                {
                    reason: input.reason,
                    metadata: { strikeId: strike.id, type: input.type, severity: input.severity }
                }
            );

            return strike;
        }),

    revoke: auditedAdminProcedure
        .input(z.object({ strikeId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const result = await StrikeService.revokeStrike(input.strikeId);

            await ctx.audit(
                "STRIKE_REVOKED",
                "strike",
                input.strikeId
            );

            return result;
        }),

    getMyStrikes: protectedProcedure
        .query(async ({ ctx }) => {
            return StrikeService.getStrikesForUser(ctx.session.user.id);
        }),

    getChannelStrikes: auditedAdminProcedure
        .input(z.object({ channelId: z.string() }))
        .query(async ({ input }) => {
            return StrikeService.getStrikesForChannel(input.channelId);
        }),

    appealStrike: protectedProcedure
        .input(z.object({ strikeId: z.string(), appealMessage: z.string().min(10).max(2000) }))
        .mutation(async ({ input, ctx }) => {
            const { strikeId, appealMessage } = input;
            const userId = ctx.session.user.id;

            const strike = await prisma.strikes.findUnique({
                where: { id: strikeId },
                include: { channels: { select: { userId: true } } }
            });

            if (!strike) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Strike not found" });
            }

            // Verify ownership: strike must belong to the user directly, or to a channel owned by the user
            const isOwner = strike.userId === userId || strike.channels?.userId === userId;
            if (!isOwner) {
                throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized to appeal this strike" });
            }

            if (strike.appealed) {
                throw new TRPCError({ code: "CONFLICT", message: "You have already appealed this strike" });
            }

            const updated = await prisma.strikes.update({
                where: { id: strikeId },
                data: {
                    appealed: true,
                    appealedAt: new Date(),
                    appealNote: appealMessage,
                }
            });

            return updated;
        }),
});
