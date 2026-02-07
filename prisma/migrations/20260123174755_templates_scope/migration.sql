/*
  Warnings:

  - A unique constraint covering the columns `[organizerId,name]` on the table `EventTemplate` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "EventTemplate_name_key";

-- AlterTable
ALTER TABLE "EventTemplate" ADD COLUMN     "organizerId" TEXT;

-- CreateIndex
CREATE INDEX "EventTemplate_organizerId_createdAt_idx" ON "EventTemplate"("organizerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventTemplate_organizerId_name_key" ON "EventTemplate"("organizerId", "name");

-- AddForeignKey
ALTER TABLE "EventTemplate" ADD CONSTRAINT "EventTemplate_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "Organizer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
