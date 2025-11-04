-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "checkedOutAt" TIMESTAMP(3),
ADD COLUMN     "checkedOutBy" TEXT;

-- CreateTable
CREATE TABLE "Station" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Station_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "qrToken" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "stationLabel" TEXT,
    "scannedByUser" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Station_eventId_idx" ON "Station"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Station_eventId_code_key" ON "Station"("eventId", "code");

-- CreateIndex
CREATE INDEX "AttendanceEvent_eventId_at_idx" ON "AttendanceEvent"("eventId", "at");

-- CreateIndex
CREATE INDEX "AttendanceEvent_qrToken_at_idx" ON "AttendanceEvent"("qrToken", "at");

-- CreateIndex
CREATE INDEX "AttendanceEvent_registrationId_at_idx" ON "AttendanceEvent"("registrationId", "at");

-- CreateIndex
CREATE INDEX "Registration_eventId_checkedOutBy_idx" ON "Registration"("eventId", "checkedOutBy");

-- AddForeignKey
ALTER TABLE "Station" ADD CONSTRAINT "Station_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
