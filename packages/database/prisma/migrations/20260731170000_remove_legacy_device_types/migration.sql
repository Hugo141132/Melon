-- Re-create DeviceType enum to safely remove legacy values 'WATER_NODE' and 'COMBINED_NODE'
ALTER TYPE "DeviceType" RENAME TO "DeviceType_old";

CREATE TYPE "DeviceType" AS ENUM ('SOIL_NODE', 'WATER_QUALITY_NODE', 'WATER_TANK_NODE');

ALTER TABLE "devices" ALTER COLUMN "device_type" TYPE "DeviceType" USING "device_type"::text::"DeviceType";

DROP TYPE "DeviceType_old";
