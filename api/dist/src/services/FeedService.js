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
import { z } from "zod";
import { TRPCError } from "@trpc/server";
export const feedCursorSchema = z.number().min(0).default(0);
export class FeedService {
    /**
     * Get Personalized Home Feed (SQL Computed Score) - Long Form Only
     */
    static getHomeFeed(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, cursor = 0) {
            return this.runFeed({
                userId,
                cursor,
                isShort: false,
                scoreColumn: "hotScore",
                label: "getHomeFeed",
            });
        });
    }
    /**
     * Get Trending Feed - Long Form Only
     */
    static getTrendingFeed(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, cursor = 0) {
            return this.runFeed({
                userId,
                cursor,
                isShort: false,
                scoreColumn: "trendingScore",
                onlyPositiveScore: true,
                label: "getTrendingFeed",
            });
        });
    }
    /**
     * Get Personalized Home Shorts Feed (SQL Computed Score) - Shorts Only
     */
    static getHomeShorts(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, cursor = 0) {
            return this.runFeed({
                userId,
                cursor,
                isShort: true,
                scoreColumn: "hotScore",
                limit: 15,
                label: "getHomeShorts",
            });
        });
    }
    /**
     * Get Trending Shorts Feed
     */
    static getTrendingShorts(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, cursor = 0) {
            return this.runFeed({
                userId,
                cursor,
                isShort: true,
                scoreColumn: "trendingScore",
                onlyPositiveScore: true,
                limit: 15,
                label: "getTrendingShorts",
            });
        });
    }
    /**
     * Core feed query builder.
     *
     * Deduplicates 8 nearly-identical SQL variants (4 feeds × 2 auth states)
     * into a single parameterized builder.
     */
    static runFeed(_a) {
        return __awaiter(this, arguments, void 0, function* ({ userId, cursor = 0, isShort, scoreColumn, onlyPositiveScore = false, limit = this.PAGE_SIZE, label, }) {
            try {
                let videos;
                if (userId) {
                    if (onlyPositiveScore) {
                        // Authenticated trending feed (trendingScore column)
                        videos = yield prisma.$queryRaw `
                        WITH user_cats AS (
                            SELECT "categoryId", MAX(score + (COALESCE("watchTime", 0) / 360.0)) as affinity
                            FROM user_interests
                            WHERE "userId" = ${userId} AND "categoryId" IS NOT NULL
                            GROUP BY "categoryId"
                        ),
                        user_chans AS (
                            SELECT "channelId", MAX(score + (COALESCE("watchTime", 0) / 360.0)) as affinity
                            FROM user_interests
                            WHERE "userId" = ${userId} AND "channelId" IS NOT NULL
                            GROUP BY "channelId"
                        ),
                        candidate_pool AS (
                            SELECT v.id FROM videos v
                            INNER JOIN channels c ON v."channelId" = c.id
                            WHERE v.visibility = 'PUBLIC' AND v."processingStatus" = 'READY' AND v."deletedAt" IS NULL
                              AND c.status = 'ACTIVE'
                              AND v."isShort" = ${isShort} AND v."trendingScore" > 0
                            ORDER BY v."trendingScore" DESC LIMIT 500
                        )
                        SELECT
                            v.id, v.title, v."thumbnailUrl", v."previewSprite", v."channelId",
                            c.name as "channelName", c.handle as "channelHandle", c.image as "channelImage",
                            c."subscriberCount" as "channelSubscriberCount",
                            v."viewCount", v."createdAt", v.duration, v."isShort",
                            (
                                v."trendingScore" +
                                GREATEST(0.0, 5.0 - (EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - COALESCE(v."publishedAt", v."createdAt")))/3600.0 / 24.0))
                            ) * (1.0 + LOG10(1.0 + COALESCE(uc.affinity, 0.0) + COALESCE(uch.affinity, 0.0))) as "personalizedScore"
                        FROM videos v
                        INNER JOIN candidate_pool cp ON v.id = cp.id
                        INNER JOIN channels c ON v."channelId" = c.id
                        LEFT JOIN user_cats uc ON v."categoryId" = uc."categoryId"
                        LEFT JOIN user_chans uch ON v."channelId" = uch."channelId"
                        ORDER BY "personalizedScore" DESC, v.id ASC
                        LIMIT ${limit} OFFSET ${cursor};
                    `;
                    }
                    else {
                        // Authenticated hot feed (hotScore column, two candidate pools)
                        videos = yield prisma.$queryRaw `
                        WITH user_cats AS (
                            SELECT "categoryId", MAX(score + (COALESCE("watchTime", 0) / 360.0)) as affinity
                            FROM user_interests
                            WHERE "userId" = ${userId} AND "categoryId" IS NOT NULL
                            GROUP BY "categoryId"
                        ),
                        user_chans AS (
                            SELECT "channelId", MAX(score + (COALESCE("watchTime", 0) / 360.0)) as affinity
                            FROM user_interests
                            WHERE "userId" = ${userId} AND "channelId" IS NOT NULL
                            GROUP BY "channelId"
                        ),
                        candidate_pool AS (
                            (SELECT v.id FROM videos v INNER JOIN channels c ON v."channelId" = c.id WHERE v.visibility = 'PUBLIC' AND v."processingStatus" = 'READY' AND v."deletedAt" IS NULL AND c.status = 'ACTIVE' AND v."isShort" = ${isShort} ORDER BY v."hotScore" DESC LIMIT 500)
                            UNION
                            (SELECT v.id FROM videos v INNER JOIN channels c ON v."channelId" = c.id WHERE v.visibility = 'PUBLIC' AND v."processingStatus" = 'READY' AND v."deletedAt" IS NULL AND c.status = 'ACTIVE' AND v."isShort" = ${isShort} ORDER BY v."publishedAt" DESC NULLS LAST LIMIT 200)
                            UNION
                            (
                                SELECT v.id FROM videos v
                                INNER JOIN channels c ON v."channelId" = c.id
                                INNER JOIN user_cats uc ON v."categoryId" = uc."categoryId"
                                WHERE v.visibility = 'PUBLIC' AND v."processingStatus" = 'READY' AND v."deletedAt" IS NULL AND c.status = 'ACTIVE' AND v."isShort" = ${isShort} AND uc.affinity > 1.0
                                ORDER BY v."hotScore" DESC LIMIT 500
                            )
                        )
                        SELECT
                            v.id, v.title, v."thumbnailUrl", v."previewSprite", v."channelId",
                            c.name as "channelName", c.handle as "channelHandle", c.image as "channelImage",
                            c."subscriberCount" as "channelSubscriberCount",
                            v."viewCount", v."createdAt", v.duration, v."isShort",
                            (
                                v."hotScore" +
                                GREATEST(0.0, 5.0 - (EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - COALESCE(v."publishedAt", v."createdAt")))/3600.0 / 24.0))
                            ) * (1.0 + LOG10(1.0 + COALESCE(uc.affinity, 0.0) + COALESCE(uch.affinity, 0.0))) as "personalizedScore"
                        FROM videos v
                        INNER JOIN candidate_pool cp ON v.id = cp.id
                        INNER JOIN channels c ON v."channelId" = c.id
                        LEFT JOIN user_cats uc ON v."categoryId" = uc."categoryId"
                        LEFT JOIN user_chans uch ON v."channelId" = uch."channelId"
                        ORDER BY "personalizedScore" DESC, v.id ASC
                        LIMIT ${limit} OFFSET ${cursor};
                    `;
                    }
                }
                else {
                    // Anonymous feed
                    if (onlyPositiveScore) {
                        videos = yield prisma.$queryRaw `
                        WITH candidate_pool AS (
                            SELECT v.id FROM videos v
                            INNER JOIN channels c ON v."channelId" = c.id
                            WHERE v.visibility = 'PUBLIC' AND v."processingStatus" = 'READY' AND v."deletedAt" IS NULL
                              AND c.status = 'ACTIVE'
                              AND v."isShort" = ${isShort} AND v."trendingScore" > 0
                            ORDER BY v."trendingScore" DESC LIMIT 500
                        )
                        SELECT
                            v.id, v.title, v."thumbnailUrl", v."previewSprite", v."channelId",
                            c.name as "channelName", c.handle as "channelHandle", c.image as "channelImage",
                            c."subscriberCount" as "channelSubscriberCount",
                            v."viewCount", v."createdAt", v.duration, v."isShort",
                            (
                                v."trendingScore" +
                                GREATEST(0.0, 5.0 - (EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - COALESCE(v."publishedAt", v."createdAt")))/3600.0 / 24.0))
                            ) as "personalizedScore"
                        FROM videos v
                        INNER JOIN candidate_pool cp ON v.id = cp.id
                        INNER JOIN channels c ON v."channelId" = c.id
                        ORDER BY "personalizedScore" DESC, v.id ASC
                        LIMIT ${limit} OFFSET ${cursor};
                    `;
                    }
                    else {
                        videos = yield prisma.$queryRaw `
                        WITH candidate_pool AS (
                            (SELECT v.id FROM videos v INNER JOIN channels c ON v."channelId" = c.id WHERE v.visibility = 'PUBLIC' AND v."processingStatus" = 'READY' AND v."deletedAt" IS NULL AND c.status = 'ACTIVE' AND v."isShort" = ${isShort} ORDER BY v."hotScore" DESC LIMIT 500)
                            UNION
                            (SELECT v.id FROM videos v INNER JOIN channels c ON v."channelId" = c.id WHERE v.visibility = 'PUBLIC' AND v."processingStatus" = 'READY' AND v."deletedAt" IS NULL AND c.status = 'ACTIVE' AND v."isShort" = ${isShort} ORDER BY v."publishedAt" DESC NULLS LAST LIMIT 200)
                        )
                        SELECT
                            v.id, v.title, v."thumbnailUrl", v."previewSprite", v."channelId",
                            c.name as "channelName", c.handle as "channelHandle", c.image as "channelImage",
                            c."subscriberCount" as "channelSubscriberCount",
                            v."viewCount", v."createdAt", v.duration, v."isShort",
                            (
                                v."hotScore" +
                                GREATEST(0.0, 5.0 - (EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - COALESCE(v."publishedAt", v."createdAt")))/3600.0 / 24.0))
                            ) as "personalizedScore"
                        FROM videos v
                        INNER JOIN candidate_pool cp ON v.id = cp.id
                        INNER JOIN channels c ON v."channelId" = c.id
                        ORDER BY "personalizedScore" DESC, v.id ASC
                        LIMIT ${limit} OFFSET ${cursor};
                    `;
                    }
                }
                return this.formatResponse(videos, cursor, limit);
            }
            catch (error) {
                console.error(`[FeedService] ${label} failed`, error);
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to fetch feed",
                });
            }
        });
    }
    /**
     * Get Public Videos for a Channel (paginated, newest first)
     */
    static getChannelVideos(channelId_1) {
        return __awaiter(this, arguments, void 0, function* (channelId, cursor = 0) {
            return this.runChannelFeed(channelId, cursor, false);
        });
    }
    /**
     * Get Public Shorts for a Channel (paginated, newest first)
     */
    static getChannelShorts(channelId_1) {
        return __awaiter(this, arguments, void 0, function* (channelId, cursor = 0) {
            return this.runChannelFeed(channelId, cursor, true);
        });
    }
    static runChannelFeed(channelId, cursor, isShort) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const limit = this.PAGE_SIZE;
                const videos = yield prisma.$queryRaw `
                SELECT
                    v.id, v.title, v."thumbnailUrl", v."previewSprite", v."channelId",
                    c.name as "channelName", c.handle as "channelHandle", c.image as "channelImage",
                    c."subscriberCount" as "channelSubscriberCount",
                    v."viewCount", v."createdAt", v.duration, v."isShort"
                FROM videos v
                INNER JOIN channels c ON v."channelId" = c.id
                WHERE v."channelId" = ${channelId}
                  AND v.visibility = 'PUBLIC'
                  AND v."processingStatus" = 'READY'
                  AND v."isShort" = ${isShort}
                  AND v."deletedAt" IS NULL
                  AND c.status = 'ACTIVE'
                ORDER BY COALESCE(v."publishedAt", v."createdAt") DESC, v.id ASC
                LIMIT ${limit} OFFSET ${cursor};
            `;
                return this.formatResponse(videos, cursor, limit);
            }
            catch (error) {
                console.error("[FeedService] runChannelFeed failed", error);
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to fetch channel videos",
                });
            }
        });
    }
    /**
     * Get Up Next Recommendations
     * Weighted heavily towards the same category and channel.
     */
    static getRecommendations(videoId_1, userId_1) {
        return __awaiter(this, arguments, void 0, function* (videoId, userId, cursor = 0) {
            try {
                const limit = this.PAGE_SIZE;
                // 1. Fetch source video contexts
                const sourceVideo = yield prisma.videos.findUnique({
                    where: { id: videoId },
                    select: { categoryId: true, channelId: true, isShort: true },
                });
                if (!sourceVideo) {
                    return { videos: [], nextCursor: undefined };
                }
                const isShort = sourceVideo.isShort || false;
                // 2. Fetch candidates via Native SQL
                let videos;
                if (userId) {
                    // Personalized related query
                    videos = yield prisma.$queryRaw `
                    WITH user_cats AS (
                        SELECT "categoryId", MAX(score + (COALESCE("watchTime", 0) / 360.0)) as affinity
                        FROM user_interests
                        WHERE "userId" = ${userId} AND "categoryId" IS NOT NULL
                        GROUP BY "categoryId"
                    ),
                    user_chans AS (
                        SELECT "channelId", MAX(score + (COALESCE("watchTime", 0) / 360.0)) as affinity
                        FROM user_interests
                        WHERE "userId" = ${userId} AND "channelId" IS NOT NULL
                        GROUP BY "channelId"
                    ),
                    source_tags AS (
                        SELECT "A" as tag_id FROM "_TagToVideo" WHERE "B" = ${videoId}
                    ),
                    candidate_pool AS (
                        SELECT v.id FROM videos v
                        INNER JOIN channels c ON v."channelId" = c.id
                        WHERE v.visibility = 'PUBLIC'
                          AND v."processingStatus" = 'READY'
                          AND v."deletedAt" IS NULL
                          AND c.status = 'ACTIVE'
                          AND v."isShort" = ${isShort}
                          AND v.id != ${videoId}
                        ORDER BY
                          CASE WHEN v."categoryId" = ${sourceVideo.categoryId} THEN 2 ELSE 0 END +
                          CASE WHEN v."channelId" = ${sourceVideo.channelId} THEN 1 ELSE 0 END DESC,
                          v."hotScore" DESC
                        LIMIT 500
                    ),
                    candidate_tags AS (
                        SELECT tv."B" as video_id, COUNT(tv."A") as tag_match_count
                        FROM "_TagToVideo" tv
                        JOIN source_tags st ON tv."A" = st.tag_id
                        JOIN candidate_pool cp ON tv."B" = cp.id
                        GROUP BY tv."B"
                    )
                    SELECT
                        v.id, v.title, v."thumbnailUrl", v."previewSprite", v."channelId",
                        c.name as "channelName", c.handle as "channelHandle", c.image as "channelImage",
                        c."subscriberCount" as "channelSubscriberCount",
                        v."viewCount", v."createdAt", v.duration, v."isShort",
                        (
                            v."hotScore" +
                            CASE WHEN v."categoryId" = ${sourceVideo.categoryId} THEN 20.0 ELSE 0.0 END +
                            CASE WHEN v."channelId" = ${sourceVideo.channelId} THEN 10.0 ELSE 0.0 END +
                            (COALESCE(ct.tag_match_count, 0) * 5.0) +
                            GREATEST(0.0, 5.0 - (EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - COALESCE(v."publishedAt", v."createdAt")))/3600.0 / 24.0))
                        ) * (1.0 + LOG10(1.0 + COALESCE(uc.affinity, 0.0) + COALESCE(uch.affinity, 0.0))) as "recommendationScore"
                    FROM videos v
                    INNER JOIN candidate_pool cp ON v.id = cp.id
                    INNER JOIN channels c ON v."channelId" = c.id
                    LEFT JOIN user_cats uc ON v."categoryId" = uc."categoryId"
                    LEFT JOIN user_chans uch ON v."channelId" = uch."channelId"
                    LEFT JOIN candidate_tags ct ON v.id = ct.video_id
                    ORDER BY "recommendationScore" DESC, v.id ASC
                    LIMIT ${limit} OFFSET ${cursor};
                `;
                }
                else {
                    // Anonymous related query
                    videos = yield prisma.$queryRaw `
                    WITH source_tags AS (
                        SELECT "A" as tag_id FROM "_TagToVideo" WHERE "B" = ${videoId}
                    ),
                    candidate_pool AS (
                        SELECT v.id FROM videos v
                        INNER JOIN channels c ON v."channelId" = c.id
                        WHERE v.visibility = 'PUBLIC'
                          AND v."processingStatus" = 'READY'
                          AND v."deletedAt" IS NULL
                          AND c.status = 'ACTIVE'
                          AND v."isShort" = ${isShort}
                          AND v.id != ${videoId}
                        ORDER BY
                          CASE WHEN v."categoryId" = ${sourceVideo.categoryId} THEN 2 ELSE 0 END +
                          CASE WHEN v."channelId" = ${sourceVideo.channelId} THEN 1 ELSE 0 END DESC,
                          v."hotScore" DESC
                        LIMIT 500
                    ),
                    candidate_tags AS (
                        SELECT tv."B" as video_id, COUNT(tv."A") as tag_match_count
                        FROM "_TagToVideo" tv
                        JOIN source_tags st ON tv."A" = st.tag_id
                        JOIN candidate_pool cp ON tv."B" = cp.id
                        GROUP BY tv."B"
                    )
                    SELECT
                        v.id, v.title, v."thumbnailUrl", v."previewSprite", v."channelId",
                        c.name as "channelName", c.handle as "channelHandle", c.image as "channelImage",
                        c."subscriberCount" as "channelSubscriberCount",
                        v."viewCount", v."createdAt", v.duration, v."isShort",
                        (
                            v."hotScore" +
                            CASE WHEN v."categoryId" = ${sourceVideo.categoryId} THEN 20.0 ELSE 0.0 END +
                            CASE WHEN v."channelId" = ${sourceVideo.channelId} THEN 10.0 ELSE 0.0 END +
                            (COALESCE(ct.tag_match_count, 0) * 5.0) +
                            GREATEST(0.0, 5.0 - (EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - COALESCE(v."publishedAt", v."createdAt")))/3600.0 / 24.0))
                        ) as "recommendationScore"
                    FROM videos v
                    INNER JOIN candidate_pool cp ON v.id = cp.id
                    INNER JOIN channels c ON v."channelId" = c.id
                    LEFT JOIN candidate_tags ct ON v.id = ct.video_id
                    ORDER BY "recommendationScore" DESC, v.id ASC
                    LIMIT ${limit} OFFSET ${cursor};
                `;
                }
                return this.formatResponse(videos, cursor, limit);
            }
            catch (error) {
                console.error("[FeedService] getRecommendations failed", error);
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to fetch recommendations",
                });
            }
        });
    }
    static formatResponse(videos, cursor, limit) {
        const formattedVideos = videos.map((v) => ({
            id: v.id,
            title: v.title,
            thumbnailUrl: v.thumbnailUrl,
            previewSprite: v.previewSprite || null,
            channelId: v.channelId,
            channels: {
                id: v.channelId,
                name: v.channelName || null,
                handle: v.channelHandle || null,
                image: v.channelImage || null,
                subscriberCount: v.channelSubscriberCount || 0,
            },
            viewCount: v.viewCount,
            createdAt: v.createdAt instanceof Date
                ? v.createdAt.toISOString()
                : v.createdAt,
            duration: v.duration,
            isShort: v.isShort || false,
        }));
        let nextCursor = cursor + videos.length;
        if (videos.length < limit) {
            nextCursor = undefined;
        }
        return { videos: formattedVideos, nextCursor };
    }
}
FeedService.PAGE_SIZE = 20;
