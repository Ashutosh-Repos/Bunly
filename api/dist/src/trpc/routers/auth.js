var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
    getSession: publicProcedure.query((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx }) {
        return ctx.session;
    })),
    /**
     * Updates an existing profile via protected context directly acting on the Auth database hooks
     */
    completeProfile: protectedProcedure
        .input(completeProfileSchema)
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ input, ctx }) {
        try {
            const session = ctx.session;
            if (!(session === null || session === void 0 ? void 0 : session.user)) {
                throw new TRPCError({ code: "UNAUTHORIZED" });
            }
            const result = yield auth.api.updateUser({
                headers: ctx.headers,
                body: Object.assign({}, input),
            });
            return result;
        }
        catch (error) {
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: (error === null || error === void 0 ? void 0 : error.message) || "Failed to update profile",
            });
        }
    })),
    /**
     * Lists all active sessions for the current user
     */
    listSessions: protectedProcedure.query((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx }) {
        try {
            return yield auth.api.listSessions({
                headers: ctx.headers,
            });
        }
        catch (error) {
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: (error === null || error === void 0 ? void 0 : error.message) || "Failed to list sessions",
            });
        }
    })),
    /**
     * Revokes a specific session by token
     */
    revokeSession: protectedProcedure
        .input(revokeSessionSchema)
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ input, ctx }) {
        try {
            yield auth.api.revokeSession({
                headers: ctx.headers,
                body: {
                    token: input.token,
                },
            });
            return { success: true };
        }
        catch (error) {
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: (error === null || error === void 0 ? void 0 : error.message) || "Failed to revoke session",
            });
        }
    })),
    /**
     * Revokes all other sessions except the current one
     */
    revokeOtherSessions: protectedProcedure.mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx }) {
        try {
            yield auth.api.revokeOtherSessions({
                headers: ctx.headers,
            });
            return { success: true };
        }
        catch (error) {
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: (error === null || error === void 0 ? void 0 : error.message) || "Failed to revoke other sessions",
            });
        }
    })),
    /**
     * Signs out the current session
     */
    signOut: protectedProcedure.mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx }) {
        try {
            yield auth.api.signOut({
                headers: ctx.headers,
            });
            return { success: true };
        }
        catch (error) {
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: (error === null || error === void 0 ? void 0 : error.message) || "Failed to sign out",
            });
        }
    })),
    /**
     * Sends an account deletion verification email if configured, or deletes the account
     */
    deleteAccount: protectedProcedure.mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx }) {
        try {
            yield auth.api.deleteUser({
                headers: ctx.headers,
                body: {}, // satisfy empty body requirements if they exist
            });
            return { success: true };
        }
        catch (error) {
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: (error === null || error === void 0 ? void 0 : error.message) || "Failed to delete account",
            });
        }
    })),
    /**
     * Returns an OAuth URL for linking a new social provider to the current account
     */
    linkSocial: protectedProcedure
        .input(linkSocialSchema)
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ input, ctx }) {
        try {
            const result = yield auth.api.linkSocial({
                headers: ctx.headers,
                body: {
                    provider: input.provider,
                    callbackURL: "/me/settings",
                },
            });
            return result;
        }
        catch (error) {
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: (error === null || error === void 0 ? void 0 : error.message) || "Failed to link social account",
            });
        }
    })),
    /**
     * Unlinks an OAuth provider from the current account securely
     */
    unlinkSocial: protectedProcedure
        .input(unlinkSocialSchema)
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ input, ctx }) {
        try {
            yield auth.api.unlinkAccount({
                headers: ctx.headers,
                body: {
                    providerId: input.providerId,
                },
            });
            return { success: true };
        }
        catch (error) {
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: (error === null || error === void 0 ? void 0 : error.message) || "Failed to unlink account",
            });
        }
    })),
});
