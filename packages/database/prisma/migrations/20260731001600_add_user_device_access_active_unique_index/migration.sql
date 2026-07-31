-- Versioned migration: Add active unique constraint index on user_device_access
-- TASK-0304: Enforce that a user can only have ONE ACTIVE assignment (revoked_at IS NULL) per device.

CREATE UNIQUE INDEX IF NOT EXISTS "user_device_access_active_user_device_unique"
ON "user_device_access" ("user_id", "device_id")
WHERE "revoked_at" IS NULL;
