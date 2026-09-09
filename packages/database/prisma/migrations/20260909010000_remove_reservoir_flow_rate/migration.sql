-- DEC-MON-089: Scoped capability deletion to intended WATER_TANK_NODE devices
DELETE FROM "device_capabilities"
WHERE "capability" = 'WATER_FLOW_RATE'
  AND "device_id" IN (SELECT "id" FROM "devices" WHERE "device_type" = 'WATER_TANK_NODE');

-- Remove obsolete flow_rate column from reservoir_water_readings
ALTER TABLE "reservoir_water_readings" DROP COLUMN IF EXISTS "flow_rate";
