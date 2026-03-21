import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { type Context } from "./context.js";
import { standardCursorPaginationSchema } from "./cursor.js";
import redis from "../lib/redis.js";

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
    async ({ ctx, next, input }) => {
        if (!ctx.session || !ctx.session.user) {
            throw new TRPCError({ code: "UNAUTHORIZED" });
        }

        const { channelId } = input as { channelId: string };

        const channel = await prisma.channels.findUnique({
            where: { id: channelId },
        });

        if (!channel || channel.deletedAt !== null) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: "Channel not found or has been deleted",
            });
        }

        const isOwner = channel.userId === ctx.session.user.id;
        
        if (!isOwner) {
            throw new TRPCError({
                code: "FORBIDDEN",
                message: "You are not the owner of this channel",
            });
        }

        return next({
            ctx: {
                ...ctx,
                channel,
                session: ctx.session,
            },
        });
    },
);

const enforceVideoOwnership = t.middleware(
    async ({ ctx, next, input }) => {
        if (!ctx.session || !ctx.session.user) {
            throw new TRPCError({ code: "UNAUTHORIZED" });
        }

        const { videoId } = input as { videoId: string };

        const video = await prisma.videos.findUnique({
            where: { id: videoId },
            include: { channels: true },
        });

        if (!video || video.deletedAt !== null) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: "Video not found",
            });
        }

        const isOwner = video.channels.userId === ctx.session.user.id;

        if (!isOwner) {
            throw new TRPCError({
                code: "FORBIDDEN",
                message: "You do not have permission to manage this video",
            });
        }

        return next({
            ctx: {
                ...ctx,
                video,
                session: ctx.session,
            },
        });
    },
);

const enforcePlaylistOwnership = t.middleware(
    async ({ ctx, next, input }) => {
        if (!ctx.session || !ctx.session.user) {
            throw new TRPCError({ code: "UNAUTHORIZED" });
        }

        const { playlistId } = input as { playlistId: string };

        const playlist = await prisma.playlists.findUnique({
            where: { id: playlistId },
        });

        if (!playlist) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: "Playlist not found",
            });
        }

        const isOwner = playlist.userId === ctx.session.user.id;

        if (!isOwner) {
            throw new TRPCError({
                code: "FORBIDDEN",
                message: "You do not have permission to manage this playlist",
            });
        }

        return next({
            ctx: {
                ...ctx,
                playlist,
                session: ctx.session,
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
