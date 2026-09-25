-- CreateTable
CREATE TABLE "session_recovery_challenges" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "otp_hash" VARCHAR(128) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "consumed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_recovery_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "session_recovery_challenges_user_id_idx" ON "session_recovery_challenges"("user_id");

-- CreateIndex
CREATE INDEX "session_recovery_challenges_expires_at_idx" ON "session_recovery_challenges"("expires_at");

-- AddForeignKey
ALTER TABLE "session_recovery_challenges" ADD CONSTRAINT "session_recovery_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
