import { prisma } from "../lib/prisma.js";
import { TRPCError } from "@trpc/server";

export type StrikeType = "WARNING" | "COMMUNITY_GUIDELINE" | "COPYRIGHT";

export interface IssueStrikeInput {
    channelId?: string;
    userId?: string;
    type: StrikeType;
    severity: number;
    reason: string;
    internalNote?: string;
    videoId?: string;
    commentId?: string;
    postId?: string;
}

export class StrikeService {
    /**
     * Issue a new strike to a channel or user.
     * Automatically suspends the channel if they reach 3 active strikes.
     */
    static async issueStrike(adminId: string, data: IssueStrikeInput) {
        if (!data.channelId && !data.userId) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Must provide either channelId or userId for the strike",
            });
        }

        // Calculate expiration if severity > 0 (warnings don't expire, they just stay as warnings)
        let expiresAt: Date | null = null;
        if (data.severity > 0) {
            // Standard strike expires in 90 days
            expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 90);
        }

        const strike = await prisma.strikes.create({
            data: {
                ...data,
                adminId,
                expiresAt,
            },
        });

        // ─── Auto-Suspension Logic ───
        if (data.channelId) {
            await this.evaluateChannelSuspension(data.channelId);
        }

        return strike;
    }

    /**
     * Revoke an existing strike (e.g. after a successful appeal).
     * Automatically lifting suspension if strike count drops below 3.
     */
    static async revokeStrike(strikeId: string) {
        const strike = await prisma.strikes.update({
            where: { id: strikeId },
            data: { revokedAt: new Date() },
            select: { channelId: true },
        });

        if (strike.channelId) {
            await this.evaluateChannelSuspension(strike.channelId);
        }

        return { success: true };
    }

    /**
     * Get active strikes for a user.
     */
    static async getStrikesForUser(userId: string) {
        return prisma.strikes.findMany({
            where: {
                userId,
                revokedAt: null,
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: new Date() } }
                ]
            },
            orderBy: { issuedAt: "desc" },
        });
    }

    /**
     * Get active strikes for a channel.
     */
    static async getStrikesForChannel(channelId: string) {
        return prisma.strikes.findMany({
            where: {
                channelId,
                revokedAt: null,
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: new Date() } }
                ]
            },
            orderBy: { issuedAt: "desc" },
        });
    }

    /**
     * Evaluate if a channel should be suspended or unsuspended based on active strike count.
     * Rule: 3 or more active strikes (severity > 0) = SUSPENDED.
     */
    private static async evaluateChannelSuspension(channelId: string) {
        const activeStrikesCount = await prisma.strikes.count({
            where: {
                channelId,
                severity: { gt: 0 }, // Ignore WARNINGs for suspension count
                revokedAt: null,
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: new Date() } }
                ]
            },
        });

        const currentChannel = await prisma.channels.findUnique({
            where: { id: channelId },
            select: { status: true }
        });

        if (!currentChannel) return;

        if (activeStrikesCount >= 3 && currentChannel.status !== "SUSPENDED") {
            await prisma.channels.update({
                where: { id: channelId },
                data: { status: "SUSPENDED" },
            });
            console.log(`[StrikeSystem] Auto-suspended channel ${channelId} due to ${activeStrikesCount} strikes`);
        } else if (activeStrikesCount < 3 && currentChannel.status === "SUSPENDED") {
            await prisma.channels.update({
                where: { id: channelId },
                data: { status: "ACTIVE" },
            });
            console.log(`[StrikeSystem] Lifted suspension for channel ${channelId}. Active strikes: ${activeStrikesCount}`);
        }
    }
}
