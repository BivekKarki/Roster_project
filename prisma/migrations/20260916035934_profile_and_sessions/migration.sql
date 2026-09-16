-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "idleTimeoutMinutes" INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatar" BYTEA,
ADD COLUMN     "avatarType" TEXT,
ADD COLUMN     "avatarUpdatedAt" TIMESTAMP(3);
