-- Migration: Add partial unique index for faucet command event message_id
-- Requirement: DATABASE.md §9.2 - Duplicate device events shall be idempotent

CREATE UNIQUE INDEX "faucet_command_events_message_unique"
ON "faucet_command_events" ("message_id")
WHERE "message_id" IS NOT NULL;
