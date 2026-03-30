/*
  Warnings:

  - A unique constraint covering the columns `[subscriberCount,id]` on the table `channels` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[likeCount,id]` on the table `comments` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[createdAt,id]` on the table `comments` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[videoCount,id]` on the table `playlists` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[viewCount,id]` on the table `videos` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[createdAt,id]` on the table `videos` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[engagementScore,viewCount,id]` on the table `videos` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "notifications_type_createdAt_idx";

-- DropIndex
DROP INDEX "notifications_userId_createdAt_idx";

-- DropIndex
DROP INDEX "notifications_userId_isHidden_createdAt_idx";

-- DropIndex
DROP INDEX "notifications_userId_isRead_createdAt_idx";

-- CreateIndex
CREATE UNIQUE INDEX "channels_subscriberCount_id_key" ON "channels"("subscriberCount" DESC, "id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "comments_likeCount_id_key" ON "comments"("likeCount" DESC, "id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "comments_createdAt_id_key" ON "comments"("createdAt" DESC, "id" ASC);

-- CreateIndex
CREATE INDEX "notifications_type_createdAt_id_idx" ON "notifications"("type", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_id_idx" ON "notifications"("userId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_createdAt_id_idx" ON "notifications"("userId", "isRead", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "notifications_userId_isHidden_createdAt_id_idx" ON "notifications"("userId", "isHidden", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "notifications_userId_isHidden_type_createdAt_id_idx" ON "notifications"("userId", "isHidden", "type", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "playlists_videoCount_id_key" ON "playlists"("videoCount" DESC, "id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "videos_viewCount_id_key" ON "videos"("viewCount" DESC, "id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "videos_createdAt_id_key" ON "videos"("createdAt" DESC, "id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "videos_engagementScore_viewCount_id_key" ON "videos"("engagementScore" DESC, "viewCount" DESC, "id" ASC);
