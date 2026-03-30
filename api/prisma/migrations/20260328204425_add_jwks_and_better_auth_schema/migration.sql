/*
  Warnings:

  - You are about to drop the column `thumbnailUrl` on the `playlists` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "playlists" DROP COLUMN "thumbnailUrl";

-- CreateTable
CREATE TABLE "jwks" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jwks_pkey" PRIMARY KEY ("id")
);
