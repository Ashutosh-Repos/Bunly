var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { prisma } from "../lib/prisma.js";
import redis from "../lib/redis.js";
export class HistoryService {
    /**
     * Get watch history with infinite scrolling.
     * Uses DataCache to cache the first page per user for fast reads.
     */
    static getHistory(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, limit = this.PAGE_SIZE, cursor) {
            // Cache Key specifically for the first page
            const cacheKey = `history:${userId}:page:1:${limit}`;
            if (!cursor) {
                const cached = yield redis.get(cacheKey);
                if (cached) {
                    try {
                        return JSON.parse(cached);
                    }
                    catch (e) {
                        console.error("Failed to parse cached history:", e);
                    }
                }
                // Cache miss, fetch from DB
                const freshData = yield this.fetchHistoryFromDatabase(userId, limit, cursor);
                // Cache for 5 minutes (invalidated proactively by workers/mutations)
                yield redis.set(cacheKey, JSON.stringify(freshData), "EX", 60 * 5);
                return freshData;
            }
            // Subsequent pages always hit DB (no cache to avoid massive memory bloat)
            return yield this.fetchHistoryFromDatabase(userId, limit, cursor);
        });
    }
    static fetchHistoryFromDatabase(userId, limit, cursor) {
        return __awaiter(this, void 0, void 0, function* () {
            const items = yield prisma.watch_history.findMany({
                take: limit + 1,
                where: {
                    userId,
                    videos: {
                        visibility: { in: ["PUBLIC", "UNLISTED"] },
                        deletedAt: null,
                        processingStatus: "READY",
                    },
                },
                cursor: cursor ? { id: cursor } : undefined,
                orderBy: [
                    { lastWatchedAt: "desc" },
                    { id: "desc" }, // Stable tie-breaker
                ],
                include: {
                    videos: {
                        select: {
                            id: true,
                            title: true,
                            thumbnailUrl: true,
                            description: true,
                            viewCount: true,
                            createdAt: true,
                            duration: true,
                            isShort: true,
                            channels: {
                                select: {
                                    id: true,
                                    name: true,
                                    handle: true,
                                    image: true,
                                },
                            },
                        },
                    },
                },
            });
            let nextCursor = undefined;
            if (items.length > limit) {
                const nextItem = items.pop();
                nextCursor = nextItem.id;
            }
            return {
                items,
                nextCursor,
            };
        });
    }
    /**
     * Invalidate the history cache for a specific user.
     * Executed by background workers and history mutations.
     * If limit is provided, delete precisely. Otherwise, wildcard delete.
     */
    static invalidateUserCache(userId, limit) {
        return __awaiter(this, void 0, void 0, function* () {
            if (limit) {
                yield redis.del(`history:${userId}:page:1:${limit}`);
            }
            else {
                // Because history has dynamic limits, we must find all combinations
                const match = `history:${userId}:page:1:*`;
                let cursor = "0";
                do {
                    const [nextCursor, keys] = yield redis.scan(cursor, "MATCH", match, "COUNT", 100);
                    cursor = nextCursor;
                    if (keys.length > 0) {
                        yield redis.del(...keys);
                    }
                } while (cursor !== "0");
            }
        });
    }
}
HistoryService.PAGE_SIZE = 20;
