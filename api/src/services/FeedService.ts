import { prisma } from "../lib/prisma";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const feedCursorSchema = z.number().min(0).default(0);
export type FeedCursor = z.infer<typeof feedCursorSchema>;

export interface HydratedVideo {
    id: string;
    title: string;
    thumbnailUrl: string | null;
    previewSprite: string | null;
    channelId: string;
    channels: {
        id: string;
        name: string | null;
        handle: string | null;
        image: string | null;
        subscriberCount?: number;
    };
    viewCount: number;
    createdAt: Date | string;
    duration: number | null;
    isPremiere?: boolean;
    isAgeRestricted?: boolean;
    isShort: boolean;
}

/** Shape of a row returned by the raw SQL feed queries. */
interface RawFeedRow {
    id: string;
    title: string;
    thumbnailUrl: string | null;
    previewSprite: string | null;
    channelId: string;
    channelName: string | null;
    channelHandle: string | null;
    channelImage: string | null;
    channelSubscriberCount: number | null;
    viewCount: number;
    createdAt: Date | string;
    duration: number | null;
    isShort: boolean;
}

export class FeedService {
    private static PAGE_SIZE = 20;

    /**
     * Get Personalized Home Feed (SQL Computed Score) - Long Form Only
     */
    public static async getHomeFeed(
        userId: string | undefined,
        cursor: FeedCursor = 0,
    ): Promise<{
        videos: HydratedVideo[];
        nextCursor: FeedCursor | undefined;
    }> {
        return this.runFeed({
            userId,
            cursor,
            isShort: false,
            scoreColumn: "hotScore",
            label: "getHomeFeed",
        });
    }

    /**
     * Get Trending Feed - Long Form Only
     */
    public static async getTrendingFeed(
        userId: string | undefined,
        cursor: FeedCursor = 0,
    ): Promise<{
        videos: HydratedVideo[];
        nextCursor: FeedCursor | undefined;
    }> {
        return this.runFeed({
            userId,
            cursor,
            isShort: false,
            scoreColumn: "trendingScore",
            onlyPositiveScore: true,
            label: "getTrendingFeed",
        });
    }

    /**
     * Get Personalized Home Shorts Feed (SQL Computed Score) - Shorts Only
     */
    public static async getHomeShorts(
        userId: string | undefined,
        cursor: FeedCursor = 0,
    ): Promise<{
        videos: HydratedVideo[];
        nextCursor: FeedCursor | undefined;
    }> {
        return this.runFeed({
            userId,
            cursor,
            isShort: true,
            scoreColumn: "hotScore",
            limit: 15,
            label: "getHomeShorts",
        });
    }

    /**
     * Get Trending Shorts Feed
     */
    public static async getTrendingShorts(
        userId: string | undefined,
        cursor: FeedCursor = 0,
    ): Promise<{
        videos: HydratedVideo[];
        nextCursor: FeedCursor | undefined;
    }> {
        return this.runFeed({
            userId,
            cursor,
            isShort: true,
            scoreColumn: "trendingScore",
            onlyPositiveScore: true,
            limit: 15,
            label: "getTrendingShorts",
        });
    }

    /**
     * Core feed query builder.
     *
     * Deduplicates 8 nearly-identical SQL variants (4 feeds × 2 auth states)
     * into a single parameterized builder.
     */
    private static async runFeed({
        userId,
        cursor = 0,
        isShort,
        scoreColumn,
        onlyPositiveScore = false,
        limit = this.PAGE_SIZE,
        label,
    }: {
        userId: string | undefined;
        cursor?: number;
        isShort: boolean;
        /** Which video score column to use for ranking, e.g. "hotScore" | "trendingScore" */
        scoreColumn: "hotScore" | "trendingScore";
        onlyPositiveScore?: boolean;
        limit?: number;
        label: string;
    }): Promise<{
        videos: HydratedVideo[];
        nextCursor: FeedCursor | undefined;
    }> {
        try {
            let videos: RawFeedRow[];

            if (userId) {
                if (onlyPositiveScore) {
                    // Authenticated trending feed (trendingScore column)
                    videos = await prisma.$queryRaw<RawFeedRow[]>`
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
                            SELECT id FROM videos
                            WHERE visibility = 'PUBLIC' AND "processingStatus" = 'READY' AND "deletedAt" IS NULL
                              AND "isShort" = ${isShort} AND "trendingScore" > 0
                            ORDER BY "trendingScore" DESC LIMIT 500
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
                } else {
                    // Authenticated hot feed (hotScore column, two candidate pools)
                    videos = await prisma.$queryRaw<RawFeedRow[]>`
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
                            (SELECT id FROM videos WHERE visibility = 'PUBLIC' AND "processingStatus" = 'READY' AND "deletedAt" IS NULL AND "isShort" = ${isShort} ORDER BY "hotScore" DESC LIMIT 500)
                            UNION
                            (SELECT id FROM videos WHERE visibility = 'PUBLIC' AND "processingStatus" = 'READY' AND "deletedAt" IS NULL AND "isShort" = ${isShort} ORDER BY "publishedAt" DESC NULLS LAST LIMIT 200)
                            UNION
                            (
                                SELECT v.id FROM videos v
                                INNER JOIN user_cats uc ON v."categoryId" = uc."categoryId"
                                WHERE v.visibility = 'PUBLIC' AND v."processingStatus" = 'READY' AND v."deletedAt" IS NULL AND v."isShort" = ${isShort} AND uc.affinity > 1.0
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
            } else {
                // Anonymous feed
                if (onlyPositiveScore) {
                    videos = await prisma.$queryRaw<RawFeedRow[]>`
                        WITH candidate_pool AS (
                            SELECT id FROM videos
                            WHERE visibility = 'PUBLIC' AND "processingStatus" = 'READY' AND "deletedAt" IS NULL
                              AND "isShort" = ${isShort} AND "trendingScore" > 0
                            ORDER BY "trendingScore" DESC LIMIT 500
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
                } else {
                    videos = await prisma.$queryRaw<RawFeedRow[]>`
                        WITH candidate_pool AS (
                            (SELECT id FROM videos WHERE visibility = 'PUBLIC' AND "processingStatus" = 'READY' AND "deletedAt" IS NULL AND "isShort" = ${isShort} ORDER BY "hotScore" DESC LIMIT 500)
                            UNION
                            (SELECT id FROM videos WHERE visibility = 'PUBLIC' AND "processingStatus" = 'READY' AND "deletedAt" IS NULL AND "isShort" = ${isShort} ORDER BY "publishedAt" DESC NULLS LAST LIMIT 200)
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
        } catch (error) {
            console.error(`[FeedService] ${label} failed`, error);
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to fetch feed",
            });
        }
    }

    /**
     * Get Public Videos for a Channel (paginated, newest first)
     */
    public static async getChannelVideos(
        channelId: string,
        cursor: FeedCursor = 0,
    ): Promise<{
        videos: HydratedVideo[];
        nextCursor: FeedCursor | undefined;
    }> {
        return this.runChannelFeed(channelId, cursor, false);
    }

    /**
     * Get Public Shorts for a Channel (paginated, newest first)
     */
    public static async getChannelShorts(
        channelId: string,
        cursor: FeedCursor = 0,
    ): Promise<{
        videos: HydratedVideo[];
        nextCursor: FeedCursor | undefined;
    }> {
        return this.runChannelFeed(channelId, cursor, true);
    }

    private static async runChannelFeed(
        channelId: string,
        cursor: number,
        isShort: boolean,
    ) {
        try {
            const limit = this.PAGE_SIZE;
            const videos = await prisma.$queryRaw<RawFeedRow[]>`
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
                ORDER BY COALESCE(v."publishedAt", v."createdAt") DESC, v.id ASC
                LIMIT ${limit} OFFSET ${cursor};
            `;
            return this.formatResponse(videos, cursor, limit);
        } catch (error) {
            console.error("[FeedService] runChannelFeed failed", error);
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to fetch channel videos",
            });
        }
    }

    /**
     * Get Up Next Recommendations
     * Weighted heavily towards the same category and channel.
     */
    public static async getRecommendations(
        videoId: string,
        userId: string | undefined,
        cursor: FeedCursor = 0,
    ): Promise<{
        videos: HydratedVideo[];
        nextCursor: FeedCursor | undefined;
    }> {
        try {
            const limit = this.PAGE_SIZE;

            // 1. Fetch source video contexts
            const sourceVideo = await prisma.videos.findUnique({
                where: { id: videoId },
                select: { categoryId: true, channelId: true, isShort: true },
            });

            if (!sourceVideo) {
                return { videos: [], nextCursor: undefined };
            }

            const isShort = sourceVideo.isShort || false;

            // 2. Fetch candidates via Native SQL
            let videos: RawFeedRow[];

            if (userId) {
                // Personalized related query
                videos = await prisma.$queryRaw<RawFeedRow[]>`
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
                        SELECT id FROM videos
                        WHERE visibility = 'PUBLIC'
                          AND "processingStatus" = 'READY'
                          AND "deletedAt" IS NULL
                          AND "isShort" = ${isShort}
                          AND id != ${videoId}
                        ORDER BY
                          CASE WHEN "categoryId" = ${sourceVideo.categoryId} THEN 2 ELSE 0 END +
                          CASE WHEN "channelId" = ${sourceVideo.channelId} THEN 1 ELSE 0 END DESC,
                          "hotScore" DESC
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
            } else {
                // Anonymous related query
                videos = await prisma.$queryRaw<RawFeedRow[]>`
                    WITH source_tags AS (
                        SELECT "A" as tag_id FROM "_TagToVideo" WHERE "B" = ${videoId}
                    ),
                    candidate_pool AS (
                        SELECT id FROM videos
                        WHERE visibility = 'PUBLIC'
                          AND "processingStatus" = 'READY'
                          AND "deletedAt" IS NULL
                          AND "isShort" = ${isShort}
                          AND id != ${videoId}
                        ORDER BY
                          CASE WHEN "categoryId" = ${sourceVideo.categoryId} THEN 2 ELSE 0 END +
                          CASE WHEN "channelId" = ${sourceVideo.channelId} THEN 1 ELSE 0 END DESC,
                          "hotScore" DESC
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
        } catch (error) {
            console.error("[FeedService] getRecommendations failed", error);
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to fetch recommendations",
            });
        }
    }

    private static formatResponse(
        videos: RawFeedRow[],
        cursor: number,
        limit: number,
    ) {
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
            createdAt:
                v.createdAt instanceof Date
                    ? v.createdAt.toISOString()
                    : v.createdAt,
            duration: v.duration,
            isShort: v.isShort || false,
        }));

        let nextCursor: number | undefined = cursor + videos.length;
        if (videos.length < limit) {
            nextCursor = undefined;
        }

        return { videos: formattedVideos, nextCursor };
    }
}
