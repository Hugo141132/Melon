-- CreateEnum
CREATE TYPE "AlertEmailDispatchStatus" AS ENUM ('SENT', 'FAILED', 'DISABLED_BY_PREFERENCE', 'SIMULATED');

-- AlterTable
ALTER TABLE "user_preferences" ADD COLUMN "email_alerts_enabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "alert_email_dispatches" (
    "id" UUID NOT NULL,
    "alert_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" UUID,
    "recipient_email" VARCHAR(320) NOT NULL,
    "status" "AlertEmailDispatchStatus" NOT NULL,
    "resend_id" VARCHAR(100),
    "error_message" TEXT,
    "dispatched_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_email_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "alert_email_dispatches_alert_user_idx" ON "alert_email_dispatches"("alert_id", "user_id");

-- CreateIndex
CREATE INDEX "alert_email_dispatches_user_id_idx" ON "alert_email_dispatches"("user_id");

-- CreateIndex
CREATE INDEX "alert_email_dispatches_alert_id_idx" ON "alert_email_dispatches"("alert_id");

-- AddForeignKey
ALTER TABLE "alert_email_dispatches" ADD CONSTRAINT "alert_email_dispatches_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_email_dispatches" ADD CONSTRAINT "alert_email_dispatches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
