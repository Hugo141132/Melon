-- DEC-MON-086 / TASK-0412: Drop unused coordinate columns from water_readings
ALTER TABLE "water_readings" DROP COLUMN IF EXISTS "latitude";
ALTER TABLE "water_readings" DROP COLUMN IF EXISTS "longitude";
