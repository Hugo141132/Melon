-- Add new supported device types to DeviceType enum safely
ALTER TYPE "DeviceType" ADD VALUE IF NOT EXISTS 'WATER_QUALITY_NODE';
ALTER TYPE "DeviceType" ADD VALUE IF NOT EXISTS 'WATER_TANK_NODE';
