/*
  Warnings:

  - You are about to alter the column `name` on the `categories` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `description` on the `categories` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(1000)`.
  - You are about to alter the column `description` on the `channels` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(5000)`.
  - You are about to alter the column `description` on the `videos` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(5000)`.

*/
-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_actorId_fkey";

-- AlterTable
ALTER TABLE "categories" ALTER COLUMN "name" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "description" SET DATA TYPE VARCHAR(1000);

-- AlterTable
ALTER TABLE "channels" ALTER COLUMN "handle" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "name" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "description" SET DATA TYPE VARCHAR(5000);

-- AlterTable
ALTER TABLE "strikes" ADD COLUMN     "appealNote" TEXT,
ADD COLUMN     "appealedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "videos" ALTER COLUMN "title" SET DATA TYPE VARCHAR(200),
ALTER COLUMN "description" SET DATA TYPE VARCHAR(5000);

-- CreateIndex
CREATE INDEX "session_expiresAt_idx" ON "session"("expiresAt");

-- CreateIndex
CREATE INDEX "videos_channelId_deletedAt_publishedAt_idx" ON "videos"("channelId", "deletedAt", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "videos_channelId_visibility_deletedAt_publishedAt_idx" ON "videos"("channelId", "visibility", "deletedAt", "publishedAt" DESC);

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
