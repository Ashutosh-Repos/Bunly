var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { router, protectedProcedure } from "../router.js";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
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
    image: z.string().url().optional().or(z.literal("")),
    bannerUrl: z.string().url().optional().or(z.literal("")),
    socialLinks: z.array(socialLinkSchema).max(10).optional(),
    businessInfo: businessInfoSchema.optional(),
    contactInfo: contactInfoSchema.optional(),
});
export const userRouter = router({
    getProfile: protectedProcedure.query((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx }) {
        const user = yield prisma.user.findUnique({
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
    })),
    updateProfile: protectedProcedure
        .input(updateUserSchema)
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        try {
            const user = yield prisma.user.update({
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
        }
        catch (error) {
            console.error("Failed to update user profile:", error);
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to update profile",
            });
        }
    })),
});
