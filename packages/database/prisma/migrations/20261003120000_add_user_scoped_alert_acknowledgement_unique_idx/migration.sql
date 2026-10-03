-- Deduplicate any existing duplicate acknowledgements before adding unique index
DELETE FROM "alert_acknowledgements" a
USING "alert_acknowledgements" b
WHERE a."id" < b."id"
  AND a."alert_id" = b."alert_id"
  AND a."acknowledged_by_user_id" = b."acknowledged_by_user_id";

-- Create unique index for user-scoped acknowledgement
CREATE UNIQUE INDEX IF NOT EXISTS "alert_acknowledgements_alert_user_idx"
  ON "alert_acknowledgements"("alert_id", "acknowledged_by_user_id");
