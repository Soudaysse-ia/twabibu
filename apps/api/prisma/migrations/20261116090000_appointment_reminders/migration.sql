-- AlterTable
ALTER TABLE "OrganizationNotificationSettings" ADD COLUMN     "reminderHour" INTEGER NOT NULL DEFAULT 17;

-- CreateTable
CREATE TABLE "AppointmentReminder" (
    "id" UUID NOT NULL,
    "appointmentId" UUID NOT NULL,
    "offsetHours" INTEGER NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "channel" "NotificationChannel",
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentReminder_appointmentId_offsetHours_startsAt_key" ON "AppointmentReminder"("appointmentId", "offsetHours", "startsAt");

-- AddForeignKey
ALTER TABLE "AppointmentReminder" ADD CONSTRAINT "AppointmentReminder_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

