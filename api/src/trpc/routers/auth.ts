import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../router.js";
import { auth } from "../../lib/auth.js";
import { TRPCError } from "@trpc/server";

// Derived from Legacy Client Schemas
export const registerSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Please enter a valid email address"),
    password: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .max(128, "Password is too long"),
});

export const loginSchema = z.object({
    email: z.email("Please enter a valid email address"),
    password: z.string().min(1, "Password is required"),
    rememberMe: z.boolean().optional().default(false),
});

export const forgotPasswordSchema = z.object({
    email: z.string().email("Please enter a valid email"),
});

export const resetPasswordSchema = z.object({
    password: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .max(128, "Password is too long"),
    token: z.string(),
});

export const completeProfileSchema = z.object({
    name: z.string().optional(),
    bio: z.string().max(500).optional(),
    dob: z.date().optional(),
    image: z.string().url().optional(),
});

export const revokeSessionSchema = z.object({
    token: z.string(),
});

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .max(128, "Password is too long"),
    revokeOtherSessions: z.boolean().optional().default(true),
});

export const linkSocialSchema = z.object({
    provider: z.enum(["google", "github"]),
});

export const unlinkSocialSchema = z.object({
    providerId: z.string(),
});

export const authRouter = router({
    /**
     * Get the active session safely via context
     */
    getSession: publicProcedure.query(async ({ ctx }) => {
        return ctx.session;
    }),

    /**
     * Updates an existing profile via protected context directly acting on the Auth database hooks
     */
    completeProfile: protectedProcedure
        .input(completeProfileSchema)
        .mutation(async ({ input, ctx }) => {
            try {
                const session = ctx.session;
                if (!session?.user) {
                    throw new TRPCError({ code: "UNAUTHORIZED" });
                }

                const result = await auth.api.updateUser({
                    headers: ctx.headers,
                    body: {
                        ...input,
                    },
                });
                return result;
            } catch (error: any) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: error?.message || "Failed to update profile",
                });
            }
        }),

    /**
     * Lists all active sessions for the current user
     */
    listSessions: protectedProcedure.query(async ({ ctx }) => {
        try {
            return await auth.api.listSessions({
                headers: ctx.headers,
            });
        } catch (error: any) {
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: error?.message || "Failed to list sessions",
            });
        }
    }),

    /**
     * Revokes a specific session by token
     */
    revokeSession: protectedProcedure
        .input(revokeSessionSchema)
        .mutation(async ({ input, ctx }) => {
            try {
                await auth.api.revokeSession({
                    headers: ctx.headers,
                    body: {
                        token: input.token,
                    },
                });
                return { success: true };
            } catch (error: any) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: error?.message || "Failed to revoke session",
                });
            }
        }),

    /**
     * Revokes all other sessions except the current one
     */
    revokeOtherSessions: protectedProcedure.mutation(async ({ ctx }) => {
        try {
            await auth.api.revokeOtherSessions({
                headers: ctx.headers,
            });
            return { success: true };
        } catch (error: any) {
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: error?.message || "Failed to revoke other sessions",
            });
        }
    }),

    /**
     * Signs out the current session
     */
    signOut: protectedProcedure.mutation(async ({ ctx }) => {
        try {
            await auth.api.signOut({
                headers: ctx.headers,
            });
            return { success: true };
        } catch (error: any) {
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: error?.message || "Failed to sign out",
            });
        }
    }),

    /**
     * Sends an account deletion verification email if configured, or deletes the account
     */
    deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
        try {
            await (auth.api as any).deleteUser({
                headers: ctx.headers,
                body: {}, // satisfy empty body requirements if they exist
            });
            return { success: true };
        } catch (error: any) {
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: error?.message || "Failed to delete account",
            });
        }
    }),

    /**
     * Returns an OAuth URL for linking a new social provider to the current account
     */
    linkSocial: protectedProcedure
        .input(linkSocialSchema)
        .mutation(async ({ input, ctx }) => {
            try {
                const result = await (auth.api as any).linkSocial({
                    headers: ctx.headers,
                    body: {
                        provider: input.provider,
                        callbackURL: "/me/settings",
                    },
                });
                return result;
            } catch (error: any) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: error?.message || "Failed to link social account",
                });
            }
        }),

    /**
     * Unlinks an OAuth provider from the current account securely
     */
    unlinkSocial: protectedProcedure
        .input(unlinkSocialSchema)
        .mutation(async ({ input, ctx }) => {
            try {
                await auth.api.unlinkAccount({
                    headers: ctx.headers,
                    body: {
                        providerId: input.providerId,
                    },
                });
                return { success: true };
            } catch (error: any) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: error?.message || "Failed to unlink account",
                });
            }
        }),
});
