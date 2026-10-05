-- CreateTable
CREATE TABLE "faucet_command_idempotency_tombstones" (
    "id" UUID NOT NULL,
    "idempotency_key" VARCHAR(150) NOT NULL,
    "command_id" VARCHAR(150) NOT NULL,
    "device_id" UUID NOT NULL,
    "original_status" VARCHAR(40) NOT NULL,
    "requested_at" TIMESTAMPTZ NOT NULL,
    "purged_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faucet_command_idempotency_tombstones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "faucet_command_idempotency_tombstones_idempotency_key_key" ON "faucet_command_idempotency_tombstones"("idempotency_key");

-- CreateIndex
CREATE INDEX "faucet_command_tombstones_device_id_idx" ON "faucet_command_idempotency_tombstones"("device_id");
