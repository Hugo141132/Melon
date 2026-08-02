import { describe, it, expect } from 'vitest';
import {
  buildUserFactory,
  buildSessionFactory,
  buildDeviceFactory,
  buildSoilTelemetryPayloadFactory,
  buildAlertFactory,
  buildFaucetCommandFactory,
} from '../testing/factories';
import { UserRole, AccountStatus } from '../enums';
import { DeviceAccountStatus, DeviceConnectionStatus, DeviceType } from '../device';

describe('Testing Factories', () => {
  it('builds a default valid User DTO with customizable overrides', () => {
    const user = buildUserFactory({ fullName: 'Custom Name', activeRoles: [UserRole.OWNER] });
    expect(user.id).toMatch(/^[0-9a-f-]+$/);
    expect(user.fullName).toBe('Custom Name');
    expect(user.activeRoles).toEqual([UserRole.OWNER]);
    expect(user.accountStatus).toBe(AccountStatus.ACTIVE);
  });

  it('builds a default Session DTO with customizable overrides', () => {
    const session = buildSessionFactory({ role: UserRole.ADMIN });
    expect(session.userId).toMatch(/^user-/);
    expect(session.role).toBe(UserRole.ADMIN);
  });

  it('builds a default Device DTO', () => {
    const device = buildDeviceFactory({
      hardwareRevision: 'NodeMCU-ESP8266',
      deviceType: DeviceType.SOIL_NODE,
    });
    expect(device.deviceId).toMatch(/^device-/);
    expect(device.hardwareRevision).toBe('NodeMCU-ESP8266');
    expect(device.accountStatus).toBe(DeviceAccountStatus.ACTIVE);
    expect(device.connectionStatus).toBe(DeviceConnectionStatus.ONLINE);
  });

  it('builds valid Soil Telemetry Payload', () => {
    const soil = buildSoilTelemetryPayloadFactory();
    expect(soil.schemaVersion).toBe('1.0');
    expect(soil.data.moisture).toBe(42.0);
  });

  it('builds Alert and Faucet Command DTOs', () => {
    const alert = buildAlertFactory({ severity: 'CRITICAL' });
    expect(alert.severity).toBe('CRITICAL');

    const command = buildFaucetCommandFactory({ phase: 'PHASE_2', targetVolumeMl: 1000 });
    expect(command.phase).toBe('PHASE_2');
    expect(command.targetVolumeMl).toBe(1000);
  });
});
