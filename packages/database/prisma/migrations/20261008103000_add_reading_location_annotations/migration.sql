-- TASK-0503 / TASK-0504: Portable soil & water-quality reading location annotations.
--
-- Soil and water-quality devices are PORTABLE (one each) and carry no firmware
-- location identifiers. These columns let an operator annotate individual,
-- immutable readings with a human-readable measurement location.
--
-- Design invariants (per approved scope):
--   * Annotations bind to the reading row itself, never to the device's current
--     location. Renaming or clearing one reading never affects any other row.
--   * `location_key` is the normalized identity (trim + lowercase) used for
--     grouping and chart filtering so that "  Bed A  " and "bed a" resolve to the
--     same location instead of silently fragmenting into two series.
--   * `location_name` preserves the exact text the operator typed for display.
--   * `location_named_by_id` records the authenticated session user who made the
--     annotation; the prior value is retained in the audit log (AuditLog), not
--     here, so this table stays a single source of current truth.
--   * All columns are NULLABLE so every pre-existing reading stays unnamed and
--     charts continue to exclude them (named-only chart eligibility).
--
-- No backfill, no retention change, no firmware change, no ingestion change.

ALTER TABLE "soil_readings"
  ADD COLUMN "location_name" VARCHAR(120),
  ADD COLUMN "location_key" VARCHAR(120),
  ADD COLUMN "location_annotated_at" TIMESTAMPTZ,
  ADD COLUMN "location_named_by_id" UUID;

ALTER TABLE "water_readings"
  ADD COLUMN "location_name" VARCHAR(120),
  ADD COLUMN "location_key" VARCHAR(120),
  ADD COLUMN "location_annotated_at" TIMESTAMPTZ,
  ADD COLUMN "location_named_by_id" UUID;

-- Named-only chart queries always filter by device + location_key + recorded_at,
-- so this composite index serves both the location filter and the deterministic
-- ordering without a sort on the full retained history.
CREATE INDEX "soil_readings_device_location_idx"
  ON "soil_readings" ("device_id", "location_key", "recorded_at" DESC);

CREATE INDEX "water_readings_device_location_idx"
  ON "water_readings" ("device_id", "location_key", "recorded_at" DESC);

-- Annotator attribution resolves through the user relation; a partial index keeps
-- the lookup cheap without indexing rows that were never annotated.
CREATE INDEX "soil_readings_location_named_by_idx"
  ON "soil_readings" ("location_named_by_id")
  WHERE "location_named_by_id" IS NOT NULL;

CREATE INDEX "water_readings_location_named_by_idx"
  ON "water_readings" ("location_named_by_id")
  WHERE "location_named_by_id" IS NOT NULL;

ALTER TABLE "soil_readings"
  ADD CONSTRAINT "soil_readings_location_named_by_id_fkey"
  FOREIGN KEY ("location_named_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "water_readings"
  ADD CONSTRAINT "water_readings_location_named_by_id_fkey"
  FOREIGN KEY ("location_named_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
