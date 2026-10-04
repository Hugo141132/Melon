-- DEC-MON-092: Prune excess reservoir_water_readings to strictly latest 5 records per device
-- Atomic window-function cleanup preserving deterministic latest-5 records ordered by received_at DESC, id DESC

DELETE FROM "reservoir_water_readings"
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id",
           ROW_NUMBER() OVER (
             PARTITION BY "device_id"
             ORDER BY "received_at" DESC, "id" DESC
           ) as rn
    FROM "reservoir_water_readings"
  ) sub
  WHERE sub.rn > 5
);
