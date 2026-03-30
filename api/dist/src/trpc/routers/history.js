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
import { router, protectedProcedure } from "../router.js";
import { prisma } from "../../lib/prisma.js";
import { StreamService } from "../../services/StreamService.js";
import { HistoryService } from "../../services/HistoryService.js";
export const historyRouter = router({
    /**
     * Get watch history with infinite scrolling.
     * Filters out private, deleted, or unprocessed videos.
     */
    getHistory: protectedProcedure
        .input(z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(), // ID of the last item
    }))
        .query((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const { limit, cursor } = input;
        const userId = ctx.session.user.id;
        return yield HistoryService.getHistory(userId, limit, cursor);
    })),
    /**
     * Remove a single video from watch history.
     */
    removeFromHistory: protectedProcedure
        .input(z.object({ videoId: z.string() }))
        .mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx, input }) {
        const { videoId } = input;
        const userId = ctx.session.user.id;
        // Delete from DB
        yield prisma.watch_history.deleteMany({
            where: {
                userId,
                videoId,
            },
        });
        // Invalidate Cache
        yield StreamService.clearSession(userId, videoId);
        yield HistoryService.invalidateUserCache(userId);
        return { success: true };
    })),
    /**
     * Clear all watch history for the user.
     */
    clearHistory: protectedProcedure.mutation((_a) => __awaiter(void 0, [_a], void 0, function* ({ ctx }) {
        const userId = ctx.session.user.id;
        // Delete all from DB
        yield prisma.watch_history.deleteMany({
            where: { userId },
        });
        // Invalidate All Cache
        yield StreamService.clearAllSessions(userId);
        yield HistoryService.invalidateUserCache(userId);
        return { success: true };
    })),
});
