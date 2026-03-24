var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
import { z } from "zod";
import { router, protectedProcedure } from "../router.js";
import { NotificationService } from "../../services/NotificationService";
import { redisSubscriptionManager } from "../../lib/ws/redisSubscription";
import { on } from "events";
import { prisma } from "../../lib/prisma";
import { NotificationType } from "../../../generated/prisma/client";
// Filter tab → NotificationType mapping (YouTube-style)
const TYPE_FILTER_MAP = {
    uploads: [NotificationType.NEW_VIDEO],
    comments: [NotificationType.COMMENT, NotificationType.COMMENT_REPLY],
    activity: [
        NotificationType.NEW_SUBSCRIBER,
        NotificationType.VIDEO_LIKE,
        NotificationType.COMMENT_LIKE,
        NotificationType.LIVE_STARTED,
        NotificationType.LIVE_SCHEDULED,
        NotificationType.SYSTEM,
    ],
};
export const notificationRouter = router({
    list: protectedProcedure
        .input(z.object({
        limit: z.number().min(1).max(50).default(20),
        cursor: z.string().nullish(),
        typeFilter: z
            .enum(["all", "uploads", "comments", "activity"])
            .default("all"),
    }))
        .query((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const { limit, cursor, typeFilter } = input;
        const userId = ctx.session.user.id;
        // Build type filter
        const typeCondition = typeFilter !== "all" && TYPE_FILTER_MAP[typeFilter]
            ? { type: { in: TYPE_FILTER_MAP[typeFilter] } }
            : {};
        const notifications = yield prisma.notifications.findMany({
            where: Object.assign({ userId, isHidden: false }, typeCondition),
            take: limit + 1,
            cursor: cursor ? { id: cursor } : undefined,
            skip: cursor ? 1 : 0,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            include: {
                user_notifications_actorIdTouser: {
                    select: {
                        id: true,
                        name: true,
                        image: true,
                    },
                },
            },
        });
        let nextCursor = null;
        if (notifications.length > limit) {
            const nextItem = notifications.pop();
            nextCursor = (nextItem === null || nextItem === void 0 ? void 0 : nextItem.id) || null;
        }
        return {
            items: notifications,
            nextCursor,
        };
    })),
    getUnreadCount: protectedProcedure.query((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx }) {
        return prisma.notifications.count({
            where: {
                userId: ctx.session.user.id,
                isRead: false,
                isHidden: false,
            },
        });
    })),
    markRead: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        return NotificationService.markAsRead(input.id, ctx.session.user.id);
    })),
    markAllRead: protectedProcedure.mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx }) {
        return NotificationService.markAllAsRead(ctx.session.user.id);
    })),
    // Soft-delete (dismiss): hides from list but keeps in DB for analytics
    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const result = yield prisma.notifications.updateMany({
            where: { id: input.id, userId: ctx.session.user.id },
            data: { isHidden: true },
        });
        return { success: result.count > 0 };
    })),
    onNotification: protectedProcedure.subscription(function (_a) {
        return __asyncGenerator(this, arguments, function* ({ ctx, signal }) {
            var _b, e_1, _c, _d;
            const userId = ctx.session.user.id;
            const channel = NotificationService.getChannel(userId);
            console.log(`[TRPC] 🎧 Client subscribing to ${channel}`);
            const ac = new AbortController();
            // Wire TRPC's cancellation signal to our AbortController
            signal === null || signal === void 0 ? void 0 : signal.addEventListener("abort", () => ac.abort());
            try {
                try {
                    for (var _e = true, _f = __asyncValues(on(redisSubscriptionManager, channel, { signal: ac.signal })), _g; _g = yield __await(_f.next()), _b = _g.done, !_b; _e = true) {
                        _d = _g.value;
                        _e = false;
                        const [message] = _d;
                        yield yield __await(message);
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (!_e && !_b && (_c = _f.return)) yield __await(_c.call(_f));
                    }
                    finally { if (e_1) throw e_1.error; }
                }
            }
            catch (err) {
                // AbortError is expected on disconnect, don't log it
                if (err instanceof Error && err.name === "AbortError")
                    return yield __await(void 0);
                console.error(`[TRPC] Subscription error on ${channel}`, err);
            }
        });
    }),
    getSettings: protectedProcedure.query((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx }) {
        const settings = yield prisma.notification_settings.findUnique({
            where: { userId: ctx.session.user.id },
        });
        // Return defaults if row doesn't exist yet
        return (settings !== null && settings !== void 0 ? settings : {
            newVideos: true,
            liveStreams: true,
            comments: true,
            replies: true,
            likes: false,
            subscribers: true,
        });
    })),
    updateSettings: protectedProcedure
        .input(z.object({
        newVideos: z.boolean().optional(),
        liveStreams: z.boolean().optional(),
        comments: z.boolean().optional(),
        replies: z.boolean().optional(),
        likes: z.boolean().optional(),
        subscribers: z.boolean().optional(),
    }))
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const userId = ctx.session.user.id;
        return prisma.notification_settings.upsert({
            where: { userId },
            create: Object.assign({ userId }, input),
            update: Object.assign({}, input),
        });
    })),
});
