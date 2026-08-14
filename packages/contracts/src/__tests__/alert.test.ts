import { describe, it, expect } from 'vitest';
import {
  AlertSeverity,
  AlertStatus,
  AlertType,
  AlertDtoSchema,
  AlertQueryInputSchema,
  CreateAlertInputSchema,
} from '../alert';

describe('Alert Contracts & Zod Validation', () => {
  it('validates a correct AlertDto', () => {
    const validDto = {
      id: '11111111-1111-1111-1111-111111111111',
      deviceId: '22222222-2222-2222-2222-222222222222',
      userId: null,
      alertType: 'DEVICE_OFFLINE',
      severity: AlertSeverity.CRITICAL,
      status: AlertStatus.OPEN,
      sourceType: 'device',
      sourceId: null,
      titleKey: 'alerts.deviceOffline.title',
      messageKey: 'alerts.deviceOffline.message',
      messageParams: { deviceName: 'Water Node 1' },
      openedAt: new Date().toISOString(),
      resolvedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const parsed = AlertDtoSchema.safeParse(validDto);
    expect(parsed.success).toBe(true);
  });

  it('validates AlertQueryInput default values', () => {
    const parsed = AlertQueryInputSchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.page).toBe(1);
      expect(parsed.data.pageSize).toBe(20);
      expect(parsed.data.sort).toBe('openedAt:desc');
    }
  });

  it('validates AlertQueryInput custom query parameters', () => {
    const input = {
      page: 2,
      pageSize: 50,
      deviceId: '22222222-2222-2222-2222-222222222222',
      severity: 'WARNING',
      status: 'OPEN',
      alertType: 'SOIL_MOISTURE_CRITICAL',
    };

    const parsed = AlertQueryInputSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.severity).toBe(AlertSeverity.WARNING);
      expect(parsed.data.status).toBe(AlertStatus.OPEN);
    }
  });

  it('rejects invalid enum values in query parameters', () => {
    const input = {
      severity: 'SUPER_CRITICAL',
    };

    const parsed = AlertQueryInputSchema.safeParse(input);
    expect(parsed.success).toBe(false);
  });

  it('validates CreateAlertInput default values', () => {
    const input = {
      alertType: 'DEVICE_OFFLINE',
      severity: AlertSeverity.CRITICAL,
    };

    const parsed = CreateAlertInputSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.status).toBe(AlertStatus.OPEN);
      expect(parsed.data.sourceType).toBe('device');
    }
  });

  it('validates COMMAND_FAILED and COMMAND_TIMEOUT AlertDto schemas', () => {
    const failedAlert = {
      id: '11111111-1111-1111-1111-111111111111',
      deviceId: '22222222-2222-2222-2222-222222222222',
      userId: null,
      alertType: AlertType.COMMAND_FAILED,
      severity: AlertSeverity.CRITICAL,
      status: AlertStatus.OPEN,
      sourceType: 'faucet_command',
      sourceId: '33333333-3333-3333-3333-333333333333',
      titleKey: 'alerts.commandFailedTitle',
      messageKey: 'alerts.commandFailedMessage',
      messageParams: {
        commandId: 'cmd-01JXYZ123',
        deviceName: 'Water Tank Node 1',
        reason: 'VALVE_MALFUNCTION',
      },
      openedAt: new Date().toISOString(),
      resolvedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const timeoutAlert = {
      id: '44444444-4444-4444-4444-444444444444',
      deviceId: '22222222-2222-2222-2222-222222222222',
      userId: null,
      alertType: AlertType.COMMAND_TIMEOUT,
      severity: AlertSeverity.CRITICAL,
      status: AlertStatus.OPEN,
      sourceType: 'faucet_command',
      sourceId: '33333333-3333-3333-3333-333333333333',
      titleKey: 'alerts.commandTimeoutTitle',
      messageKey: 'alerts.commandTimeoutMessage',
      messageParams: {
        commandId: 'cmd-01JXYZ123',
        deviceName: 'Water Tank Node 1',
        physicalOutcome: 'UNKNOWN',
      },
      openedAt: new Date().toISOString(),
      resolvedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(AlertDtoSchema.safeParse(failedAlert).success).toBe(true);
    expect(AlertDtoSchema.safeParse(timeoutAlert).success).toBe(true);
    expect(failedAlert.alertType).not.toBe(timeoutAlert.alertType);
  });
});
