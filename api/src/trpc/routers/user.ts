import { router, protectedProcedure } from "../router.js";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { auth } from "../../lib/auth.js";
import { TRPCError } from "@trpc/server";

const socialLinkSchema = z.object({
    platform: z.string(),
    url: z.string().url(),
    title: z.string().optional(),
});

const businessInfoSchema = z.object({
    inquiryEmail: z.string().email().optional().or(z.literal("")),
});

const contactInfoSchema = z.object({
    phone: z.string().optional(),
    address: z.string().optional(),
});

const updateUserSchema = z.object({
    name: z.string().min(2).optional(),
    bio: z.string().max(1000).optional(),
    websiteUrl: z.string().url().optional().or(z.literal("")),
    location: z.string().max(100).optional(),
    image: z.string().optional().or(z.literal("")),
    bannerUrl: z.string().optional().or(z.literal("")),
    socialLinks: z.array(socialLinkSchema).max(10).optional(),
    businessInfo: businessInfoSchema.optional(),
    contactInfo: contactInfoSchema.optional(),
});

export const userRouter = router({
    getProfile: protectedProcedure.query(async ({ ctx }) => {
        const user = await prisma.user.findUnique({
            where: { id: ctx.session.user.id },
            include: {
                channels: {
                    where: { deletedAt: null },
                    select: {
                        id: true,
                        handle: true,
                        name: true,
                        image: true,
                        isVerified: true,
                        status: true,
                        subscriberCount: true,
                        videoCount: true,
                        totalViews: true,
                    },
                },
            },
        });

        if (!user) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: "User not found",
            });
        }

        return user;
    }),

    updateProfile: protectedProcedure
        .input(updateUserSchema)
        .mutation(async ({ ctx, input }) => {
            try {
                const user = await prisma.user.update({
                    where: { id: ctx.session.user.id },
                    data: input,
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                        bio: true,
                        websiteUrl: true,
                        location: true,
                        bannerUrl: true,
                        socialLinks: true,
                        businessInfo: true,
                        contactInfo: true,
                        updatedAt: true,
                    },
                });
                return user;
            } catch (error) {
                console.error("Failed to update user profile:", error);
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to update profile",
                });
            }
        }),

    /**
     * Account Deletion Process:
     * 1. Trigger Better Auth's deleteUser, which sends a verification email.
     * 2. When the user clicks the email link, Better Auth hard-deletes the auth record.
     * 3. Prisma's `onDelete: Cascade` automatically deletes all associated channels, videos, comments, etc.
     */
    deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
        try {
            await auth.api.deleteUser({
                headers: ctx.headers,
                body: {},
            });

            return { success: true };
        } catch (error: any) {
            console.error("Failed to delete account:", error);
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: error?.message || "Failed to initiate account deletion",
            });
        }
    }),
});
