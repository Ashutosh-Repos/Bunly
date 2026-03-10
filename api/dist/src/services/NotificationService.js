var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { prisma } from "../lib/prisma";
import redis from "../lib/redis";
export class NotificationService {
    static getChannel(userId) {
        return `${this.CHANNEL_PREFIX}:${userId}`;
    }
    /**
     * Create a notification and publish it via Redis Pub/Sub.
     * Respects user notification_settings — if the user has opted out
     * of this notification type, the notification is silently skipped.
     */
    static notify(data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!data.groupKey) {
                return this._notifyInternal(data);
            }
            // Distributed lock via Redis SET NX — safe across cluster workers
            const lockKey = `lock:notify:${data.userId}:${data.groupKey}`;
            const acquired = yield redis
                .set(lockKey, "1", "EX", 15, "NX")
                .catch(() => null);
            // If we couldn't acquire the lock another worker is handling it — skip
            if (!acquired)
                return;
            try {
                yield this._notifyInternal(data);
            }
            finally {
                yield redis.del(lockKey).catch(() => { });
            }
        });
    }
    static _notifyInternal(data) {
        return __awaiter(this, void 0, void 0, function* () {
            // Prevent self-notifications
            if (data.actorId && data.actorId === data.userId)
                return;
            // Check user notification settings (YouTube-style opt-out)
            const settingField = this.SETTING_MAP[data.type];
            if (settingField) {
                try {
                    const settings = yield prisma.notification_settings.findUnique({
                        where: { userId: data.userId },
                        select: { [settingField]: true },
                    });
                    // If settings exist and the user has explicitly disabled this type, skip
                    if (settings && settings[settingField] === false) {
                        return;
                    }
                }
                catch (err) {
                    // If settings lookup fails, send the notification anyway (fail-open)
                    console.warn("[Notification] Failed to check settings, sending anyway", err);
                }
            }
            // Aggregation: if groupKey provided, try to update an existing recent notification
            if (data.groupKey) {
                try {
                    const existing = yield prisma.notifications.findFirst({
                        where: {
                            userId: data.userId,
                            groupKey: data.groupKey,
                            createdAt: {
                                gt: new Date(Date.now() - 60 * 60 * 1000), // 1-hour window
                            },
                        },
                        select: { id: true, groupCount: true },
                    });
                    if (existing) {
                        // Update: increment count, update actor, resurface, and get full data in one trip
                        const updated = yield prisma.notifications.update({
                            where: { id: existing.id },
                            data: {
                                groupCount: existing.groupCount + 1,
                                actorId: data.actorId || undefined,
                                isRead: false,
                                readAt: null,
                                createdAt: new Date(), // float to top
                            },
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
                        // Publish real-time update so bell resurfaces the notification
                        try {
                            yield redis.publish(this.getChannel(data.userId), JSON.stringify(updated));
                        }
                        catch (_a) {
                            // Non-critical, swallow
                        }
                        return; // Don't create a new notification
                    }
                }
                catch (err) {
                    console.warn("[Notification] Aggregation check failed, creating new", err);
                }
            }
            // Publish to Stream for Background Worker (Batch Insert)
            try {
                yield redis.xadd("queue:notifications", "*", "data", JSON.stringify(data));
            }
            catch (err) {
                console.error("[Notification] Failed to queue notification", err);
            }
        });
    }
    static markAsRead(notificationId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield prisma.notifications.updateMany({
                where: { id: notificationId, userId },
                data: { isRead: true, readAt: new Date() },
            });
            return { success: result.count > 0 };
        });
    }
    static markAllAsRead(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma.notifications.updateMany({
                where: { userId, isRead: false, isHidden: false },
                data: { isRead: true, readAt: new Date() },
            });
        });
    }
    static getUnreadCount(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma.notifications.count({
                where: { userId, isRead: false, isHidden: false },
            });
        });
    }
    /**
     * TTL cleanup: delete old notifications to keep the table bounded.
     * - Read notifications older than 30 days
     * - Hidden (dismissed) notifications older than 7 days
     * Call from a daily cron or setInterval in the worker.
     */
    static cleanupOldNotifications() {
        return __awaiter(this, void 0, void 0, function* () {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            try {
                const [readResult, hiddenResult] = yield prisma.$transaction([
                    prisma.notifications.deleteMany({
                        where: {
                            isRead: true,
                            createdAt: { lt: thirtyDaysAgo },
                        },
                    }),
                    prisma.notifications.deleteMany({
                        where: {
                            isHidden: true,
                            createdAt: { lt: sevenDaysAgo },
                        },
                    }),
                ]);
                const total = readResult.count + hiddenResult.count;
                if (total > 0) {
                    console.log(`[NotificationCleanup] Deleted ${readResult.count} old read + ${hiddenResult.count} hidden notifications`);
                }
            }
            catch (err) {
                console.error("[NotificationCleanup] Failed:", err);
            }
        });
    }
}
NotificationService.CHANNEL_PREFIX = "user:notifications";
/**
 * Map notification type to the corresponding setting field.
 * YouTube-style: users can opt out of specific notification categories.
 */
NotificationService.SETTING_MAP = {
    NEW_VIDEO: "newVideos",
    COMMENT: "comments",
    COMMENT_REPLY: "replies",
    COMMENT_LIKE: "likes",
    VIDEO_LIKE: "likes",
    NEW_SUBSCRIBER: "subscribers",
    LIVE_STARTED: "liveStreams",
    LIVE_SCHEDULED: "liveStreams",
    SYSTEM: undefined, // System notifications cannot be opted out of
};
