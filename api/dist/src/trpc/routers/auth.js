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
export const authRouter = router({
    /**
     * Get the active session safely via context
     */
    getSession: publicProcedure.query((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx }) {
        return ctx.session;
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
                message: error instanceof Error ? error.message : "Failed to list sessions",
            });
        }
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
     * Lists all linked accounts (credential, google, github) for the current user.
     * Used by the settings page to show connected providers.
     */
    listAccounts: protectedProcedure.query((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx }) {
        try {
            const accounts = yield auth.api.listUserAccounts({
                headers: ctx.headers,
            });
            return accounts;
        }
        catch (error) {
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: (error === null || error === void 0 ? void 0 : error.message) || "Failed to list accounts",
            });
        }
    })),
});
