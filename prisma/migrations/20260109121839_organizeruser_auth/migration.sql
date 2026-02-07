-- AlterTable
ALTER TABLE "OrganizerUser" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "name" TEXT,
ADD COLUMN     "passwordHash" TEXT;

-- CreateIndex
CREATE INDEX "OrganizerUser_organizerId_idx" ON "OrganizerUser"("organizerId");

-- CreateIndex
CREATE INDEX "OrganizerUser_email_idx" ON "OrganizerUser"("email");
