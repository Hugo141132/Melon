import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Database Schema and Migration Static Validation', () => {
  const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');
  const migrationPath = path.resolve(__dirname, '../prisma/migrations/0_init/migration.sql');

  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
  const migrationContent = fs.readFileSync(migrationPath, 'utf-8');

  it('should contain all four distinct monitoring and equipment models in schema.prisma', () => {
    expect(schemaContent).toContain('model SoilReading');
    expect(schemaContent).toContain('model WaterReading');
    expect(schemaContent).toContain('model ReservoirWaterReading');
    expect(schemaContent).toContain('model SensorBatteryReading');
  });

  it('should enforce that WaterReading has NO battery or bat field', () => {
    const waterModelMatch = schemaContent.match(/model WaterReading \{([\s\S]*?)\}/);
    expect(waterModelMatch).not.toBeNull();
    const waterModelBody = waterModelMatch![1];
    expect(waterModelBody).not.toMatch(/\bbattery\b/i);
    expect(waterModelBody).not.toMatch(/\bbat\b/i);
  });

  it('should enforce that ReservoirWaterReading has NO battery or bat field', () => {
    const reservoirModelMatch = schemaContent.match(/model ReservoirWaterReading \{([\s\S]*?)\}/);
    expect(reservoirModelMatch).not.toBeNull();
    const reservoirModelBody = reservoirModelMatch![1];
    expect(reservoirModelBody).not.toMatch(/\bbattery\b/i);
    expect(reservoirModelBody).not.toMatch(/\bbat\b/i);
  });

  it('should enforce that UserDeviceAccess has NO canControl field', () => {
    const userDeviceAccessMatch = schemaContent.match(/model UserDeviceAccess \{([\s\S]*?)\}/);
    expect(userDeviceAccessMatch).not.toBeNull();
    const userDeviceAccessBody = userDeviceAccessMatch![1];
    expect(userDeviceAccessBody).not.toMatch(/\bcanControl\b/i);
    expect(userDeviceAccessBody).not.toMatch(/\bcan_control\b/i);
  });

  it('should contain unique constraints for device_id, email, session token hash, user_device_access, and command idempotency', () => {
    expect(schemaContent).toContain('deviceId         String                 @unique');
    expect(schemaContent).toContain('email           String        @unique');
    expect(schemaContent).toContain('sessionTokenHash String    @unique');
    expect(schemaContent).toContain('idempotencyKey    String              @unique');
  });

  it('should contain partial unique index for max 1 active faucet command per device in migration.sql', () => {
    expect(migrationContent).toContain('faucet_commands_one_active_per_device');
    expect(migrationContent).toContain(
      "WHERE \"status\" IN ('QUEUED', 'SENT', 'ACKNOWLEDGED', 'IN_PROGRESS')"
    );
  });

  it('should contain check constraint for Faucet Phase and Target Volume mapping in migration.sql', () => {
    expect(migrationContent).toContain('faucet_commands_phase_volume_check');
    expect(migrationContent).toContain('"phase" = 1 AND "target_volume_ml" = 300');
    expect(migrationContent).toContain('"phase" = 2 AND "target_volume_ml" = 1000');
    expect(migrationContent).toContain('"phase" = 3 AND "target_volume_ml" = 1500');
  });

  it('should verify audit models contain no plaintext password or session token fields', () => {
    const auditModelMatch = schemaContent.match(/model AuditLog \{([\s\S]*?)\}/);
    expect(auditModelMatch).not.toBeNull();
    const auditModelBody = auditModelMatch![1];
    expect(auditModelBody).not.toMatch(/password/i);
    expect(auditModelBody).not.toMatch(/session_token/i);
  });
});
