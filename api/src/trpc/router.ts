import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { type Context } from "./context.js";
import { standardCursorPaginationSchema } from "./cursor.js";

const t = initTRPC.context<Context>().create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
        return {
            ...shape,
            data: {
                ...shape.data,
                // Include Zod error details if it's a validation error
                zodError:
                    error.code === "BAD_REQUEST" && error.cause instanceof Error
                        ? error.cause.message
                        : null,
            },
        };
    },
});

export const router = t.router;

/**
 * Public (unauthenticated) procedure
 */
export const publicProcedure = t.procedure;

export const paginateSchema = standardCursorPaginationSchema;

/**
 * Reusable middleware that enforces users are logged in before running the procedure
 */
const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
    if (!ctx.session || !ctx.session.user) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next({
        ctx: {
            ...ctx,
            // infers that `session` is non-nullable to downstream resolvers
            session: ctx.session,
        },
    });
});

/**
 * Reusable middleware that enforces users have the "admin" role from Better-Auth
 */
const enforceUserIsAdmin = t.middleware(({ ctx, next }) => {
    if (!ctx.session || !ctx.session.user) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    if (ctx.session.user.role !== "admin") {
        throw new TRPCError({
            code: "FORBIDDEN",
            message: "Elevated privileges required",
        });
    }

    return next({
        ctx: {
            ...ctx,
            session: ctx.session,
        },
    });
});

/**
 * Reusable middleware that enforces user is owner of the channel
 */
const enforceChannelOwnership = t.middleware(
    async ({ ctx, next, getRawInput }) => {
        if (!ctx.session || !ctx.session.user) {
            throw new TRPCError({ code: "UNAUTHORIZED" });
        }

        const rawInput = await getRawInput();
        const result = z.object({ channelId: z.string() }).safeParse(rawInput);

        if (!result.success) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message:
                    "channelId is required in input to use channelProcedure",
            });
        }

        const channel = await prisma.channels.findUnique({
            where: { id: result.data.channelId },
        });

        if (!channel) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: "Channel not found",
            });
        }

        if (channel.userId !== ctx.session.user.id) {
            throw new TRPCError({
                code: "FORBIDDEN",
                message: "You are not the owner of this channel",
            });
        }

        return next({
            ctx: {
                ...ctx,
                channel,
                session: ctx.session, // explicitly maintain non-nullable typing
            },
        });
    },
);

const enforceVideoOwnership = t.middleware(
    async ({ ctx, next, getRawInput }) => {
        if (!ctx.session || !ctx.session.user) {
            throw new TRPCError({ code: "UNAUTHORIZED" });
        }

        const rawInput = await getRawInput();
        const result = z.object({ videoId: z.string() }).safeParse(rawInput);

        if (!result.success) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message:
                    "videoId is required in input to use videoProcedure",
            });
        }

        const video = await prisma.videos.findUnique({
            where: { id: result.data.videoId },
            include: { channels: true }, // Needed to check channel ownership
        });

        if (!video || video.deletedAt !== null) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: "Video not found",
            });
        }

        if (video.channels.userId !== ctx.session.user.id) {
            throw new TRPCError({
                code: "FORBIDDEN",
                message: "You do not have permission to manage this video",
            });
        }

        return next({
            ctx: {
                ...ctx,
                video,
                session: ctx.session, // explicitly maintain non-nullable typing
            },
        });
    },
);
const enforcePlaylistOwnership = t.middleware(
    async ({ ctx, next, getRawInput }) => {
        if (!ctx.session || !ctx.session.user) {
            throw new TRPCError({ code: "UNAUTHORIZED" });
        }

        const rawInput = await getRawInput();
        const result = z.object({ playlistId: z.string() }).safeParse(rawInput);

        if (!result.success) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message:
                    "playlistId is required in input to use playlistProcedure",
            });
        }

        const playlist = await prisma.playlists.findUnique({
            where: { id: result.data.playlistId },
        });

        if (!playlist) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: "Playlist not found",
            });
        }

        if (playlist.userId !== ctx.session.user.id) {
            throw new TRPCError({
                code: "FORBIDDEN",
                message: "You do not have permission to manage this playlist",
            });
        }

        return next({
            ctx: {
                ...ctx,
                playlist,
                session: ctx.session, // explicitly maintain non-nullable typing
            },
        });
    },
);

import { AuditService } from "../services/AuditService.js";
import prisma from "../lib/prisma.js";
import { z } from "zod";

export const protectedProcedure = t.procedure.use(enforceUserIsAuthed);

export const adminProcedure = t.procedure.use(enforceUserIsAdmin);

/**
 * Admin procedure that injects an `audit` function into the context
 * for easy logging of administrative actions with IP/UserAgent.
 */
export const auditedAdminProcedure = adminProcedure.use(async ({ ctx, next }) => {
    const audit = (
        action: string,
        resource: string,
        resourceId: string,
        opts?: {
            reason?: string;
            metadata?: Record<string, unknown>;
            targetUserId?: string;
        },
    ) =>
        AuditService.log({
            actorId: ctx.session.user.id,
            action,
            resource,
            resourceId,
            ipAddress: ctx.req?.ip,
            userAgent: ctx.req?.headers ? ctx.req.headers["user-agent"] : undefined,
            ...opts,
        });

    return next({ ctx: { ...ctx, audit } });
});

export const channelProcedure = protectedProcedure
    .input(z.object({ channelId: z.string() }))
    .use(enforceChannelOwnership);

export const playlistProcedure = protectedProcedure
    .input(z.object({ playlistId: z.string() }))
    .use(enforcePlaylistOwnership);

export const videoProcedure = protectedProcedure
    .input(z.object({ videoId: z.string() }))
    .use(enforceVideoOwnership);
