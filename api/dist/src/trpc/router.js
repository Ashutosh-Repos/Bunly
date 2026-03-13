var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { standardCursorPaginationSchema } from "./cursor.js";
const t = initTRPC.context().create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
        return Object.assign(Object.assign({}, shape), { data: Object.assign(Object.assign({}, shape.data), { 
                // Include Zod error details if it's a validation error
                zodError: error.code === "BAD_REQUEST" && error.cause instanceof Error
                    ? error.cause.message
                    : null }) });
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
        ctx: Object.assign(Object.assign({}, ctx), { 
            // infers that `session` is non-nullable to downstream resolvers
            session: ctx.session }),
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
        ctx: Object.assign(Object.assign({}, ctx), { session: ctx.session }),
    });
});
/**
 * Reusable middleware that enforces user is owner of the channel
 */
const enforceChannelOwnership = t.middleware((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, next, getRawInput }) {
    if (!ctx.session || !ctx.session.user) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    const rawInput = yield getRawInput();
    const result = z.object({ channelId: z.string() }).safeParse(rawInput);
    if (!result.success) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: "channelId is required in input to use channelProcedure",
        });
    }
    const channel = yield prisma.channels.findUnique({
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
        ctx: Object.assign(Object.assign({}, ctx), { channel, session: ctx.session }),
    });
}));
const enforceVideoOwnership = t.middleware((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, next, getRawInput }) {
    if (!ctx.session || !ctx.session.user) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    const rawInput = yield getRawInput();
    const result = z.object({ videoId: z.string() }).safeParse(rawInput);
    if (!result.success) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: "videoId is required in input to use videoProcedure",
        });
    }
    const video = yield prisma.videos.findUnique({
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
        ctx: Object.assign(Object.assign({}, ctx), { video, session: ctx.session }),
    });
}));
const enforcePlaylistOwnership = t.middleware((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, next, getRawInput }) {
    if (!ctx.session || !ctx.session.user) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    const rawInput = yield getRawInput();
    const result = z.object({ playlistId: z.string() }).safeParse(rawInput);
    if (!result.success) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: "playlistId is required in input to use playlistProcedure",
        });
    }
    const playlist = yield prisma.playlists.findUnique({
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
        ctx: Object.assign(Object.assign({}, ctx), { playlist, session: ctx.session }),
    });
}));
import { AuditService } from "../services/AuditService.js";
export const protectedProcedure = t.procedure.use(enforceUserIsAuthed);
export const adminProcedure = t.procedure.use(enforceUserIsAdmin);
/**
 * Admin procedure that injects an `audit` function into the context
 * for easy logging of administrative actions with IP/UserAgent.
 */
export const auditedAdminProcedure = adminProcedure.use((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, next }) {
    const audit = (action, resource, resourceId, opts) => {
        var _a, _b;
        return AuditService.log(Object.assign({ actorId: ctx.session.user.id, action,
            resource,
            resourceId, ipAddress: (_a = ctx.req) === null || _a === void 0 ? void 0 : _a.ip, userAgent: ((_b = ctx.req) === null || _b === void 0 ? void 0 : _b.headers) ? ctx.req.headers["user-agent"] : undefined }, opts));
    };
    return next({ ctx: Object.assign(Object.assign({}, ctx), { audit }) });
}));
export const channelProcedure = protectedProcedure
    .input(z.object({ channelId: z.string() }))
    .use(enforceChannelOwnership);
export const playlistProcedure = protectedProcedure
    .input(z.object({ playlistId: z.string() }))
    .use(enforcePlaylistOwnership);
export const videoProcedure = protectedProcedure
    .input(z.object({ videoId: z.string() }))
    .use(enforceVideoOwnership);
import { authRouter } from "./routers/auth.js";
import { userRouter } from "./routers/user.js";
import { channelRouter } from "./routers/channel.js";
import { playlistRouter } from "./routers/playlist.js";
import { videoRouter } from "./routers/video.js";
import { commentRouter } from "./routers/comment.js";
import { feedRouter } from "./routers/feed.js";
import { historyRouter } from "./routers/history.js";
import { notificationRouter } from "./routers/notification.js";
import { searchRouter } from "./routers/search.js";
import { engagementRouter } from "./routers/engagement.js";
import { reportRouter } from "./routers/report.js";
import { strikeRouter } from "./routers/strike.js";
import { adminRouter } from "./routers/admin.js";
import { communityRouter } from "./routers/community.js";
import prisma from "../lib/prisma.js";
import { z } from "zod";
/**
 * App Router containing all sub-routers
 */
export const appRouter = router({
    auth: authRouter,
    user: userRouter,
    channel: channelRouter,
    playlist: playlistRouter,
    video: videoRouter,
    comment: commentRouter,
    feed: feedRouter,
    history: historyRouter,
    notification: notificationRouter,
    search: searchRouter,
    engagement: engagementRouter,
    report: reportRouter,
    strike: strikeRouter,
    admin: adminRouter,
    community: communityRouter,
    health: publicProcedure.query(() => {
        return { status: "ok", timestamp: new Date().toISOString() };
    }),
});
