import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AlertRepository } from '../alert-repository';
import { AlertSeverity, AlertStatus } from '@kebun-melon/contracts';

describe('AlertRepository Unit Tests', () => {
  let mockPrisma: any;
  let alertRepo: AlertRepository;

  beforeEach(() => {
    mockPrisma = {
      alert: {
        count: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      alertAcknowledgement: {
        create: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn(async (callback) => {
        return await callback(mockPrisma);
      }),
    };
    alertRepo = new AlertRepository(mockPrisma as any);
  });

  const mockAlertRecord = {
    id: '11111111-1111-1111-1111-111111111111',
    deviceId: '22222222-2222-2222-2222-222222222222',
    userId: null,
    alertType: 'DEVICE_OFFLINE',
    severity: 'CRITICAL',
    status: 'OPEN',
    sourceType: 'device',
    sourceId: null,
    titleKey: 'alerts.deviceOffline.title',
    messageKey: 'alerts.deviceOffline.message',
    messageParams: { deviceName: 'Water Node 1' },
    openedAt: new Date('2026-07-27T14:00:00Z'),
    resolvedAt: null,
    createdAt: new Date('2026-07-27T14:00:00Z'),
    updatedAt: new Date('2026-07-27T14:00:00Z'),
  };

  it('getAlerts fetches global alerts for OWNER (authorizedDeviceIds undefined)', async () => {
    mockPrisma.alert.count.mockResolvedValue(1);
    mockPrisma.alert.findMany.mockResolvedValue([mockAlertRecord]);

    const result = await alertRepo.getAlerts({ page: 1, pageSize: 20 }, undefined);

    expect(mockPrisma.alert.count).toHaveBeenCalledWith({ where: {} });
    expect(result.items.length).toBe(1);
    expect(result.items[0].id).toBe(mockAlertRecord.id);
    expect(result.items[0].severity).toBe(AlertSeverity.CRITICAL);
    expect(result.items[0].status).toBe(AlertStatus.OPEN);
  });

  it('getAlerts scopes query for ADMIN role (authorizedDeviceIds provided)', async () => {
    mockPrisma.alert.count.mockResolvedValue(1);
    mockPrisma.alert.findMany.mockResolvedValue([mockAlertRecord]);

    const assignedDevices = ['22222222-2222-2222-2222-222222222222'];
    const userId = 'user-admin-uuid';

    const result = await alertRepo.getAlerts({ page: 1, pageSize: 20 }, assignedDevices, userId);

    expect(mockPrisma.alert.count).toHaveBeenCalledWith({
      where: {
        OR: [{ deviceId: { in: assignedDevices } }, { userId }],
      },
    });
    expect(result.items.length).toBe(1);
  });

  it('getAlerts returns empty items when ADMIN queries unassigned deviceId', async () => {
    const assignedDevices = ['22222222-2222-2222-2222-222222222222'];
    const unassignedDeviceId = '99999999-9999-9999-9999-999999999999';

    const result = await alertRepo.getAlerts(
      { page: 1, pageSize: 20, deviceId: unassignedDeviceId },
      assignedDevices
    );

    expect(mockPrisma.alert.count).not.toHaveBeenCalled();
    expect(result.items).toEqual([]);
    expect(result.pagination.totalItems).toBe(0);
  });

  it('getAlertById returns formatted AlertDto when in scope', async () => {
    mockPrisma.alert.findUnique.mockResolvedValue(mockAlertRecord);

    const result = await alertRepo.getAlertById(mockAlertRecord.id, undefined);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(mockAlertRecord.id);
    expect(result?.alertType).toBe('DEVICE_OFFLINE');
  });

  it('getAlertById returns null when ADMIN tries to access alert of unassigned device', async () => {
    mockPrisma.alert.findUnique.mockResolvedValue(mockAlertRecord);

    const assignedDevices = ['33333333-3333-3333-3333-333333333333']; // different device
    const result = await alertRepo.getAlertById(mockAlertRecord.id, assignedDevices, 'admin-id');

    expect(result).toBeNull();
  });

  it('createAlert inserts alert and returns formatted DTO', async () => {
    mockPrisma.alert.create.mockResolvedValue(mockAlertRecord);

    const result = await alertRepo.createAlert({
      deviceId: mockAlertRecord.deviceId,
      alertType: 'DEVICE_OFFLINE',
      severity: AlertSeverity.CRITICAL,
    });

    expect(mockPrisma.alert.create).toHaveBeenCalled();
    expect(result.id).toBe(mockAlertRecord.id);
  });

  describe('acknowledgeAlert', () => {
    it('acknowledges an alert successfully and records audit log', async () => {
      mockPrisma.alert.findUnique.mockResolvedValue(mockAlertRecord);
      mockPrisma.alert.update.mockResolvedValue({
        ...mockAlertRecord,
        status: AlertStatus.ACKNOWLEDGED,
      });

      const userId = 'user-owner-uuid';
      const result = await alertRepo.acknowledgeAlert(mockAlertRecord.id, userId, 'Test note');

      expect(mockPrisma.alert.update).toHaveBeenCalledWith({
        where: { id: mockAlertRecord.id },
        data: { status: AlertStatus.ACKNOWLEDGED },
      });
      expect(mockPrisma.alertAcknowledgement.create).toHaveBeenCalledWith({
        data: {
          alertId: mockAlertRecord.id,
          acknowledgedByUserId: userId,
          note: 'Test note',
          acknowledgedAt: expect.any(Date),
        },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          eventKey: 'alert.acknowledged',
          actorUserId: userId,
          targetType: 'Alert',
          targetId: mockAlertRecord.id,
          result: 'SUCCESS',
          previousValues: { status: mockAlertRecord.status },
          newValues: { status: AlertStatus.ACKNOWLEDGED },
          metadata: { note: 'Test note' },
        },
      });
      expect(result.status).toBe(AlertStatus.ACKNOWLEDGED);
      expect(result.alertId).toBe(mockAlertRecord.id);
    });

    it('throws AlertNotFoundError if alert does not exist', async () => {
      mockPrisma.alert.findUnique.mockResolvedValue(null);

      await expect(alertRepo.acknowledgeAlert('non-existent', 'user-id')).rejects.toThrow(
        'not found'
      );
    });

    it('throws AlertNotFoundError if ADMIN is not authorized for the device', async () => {
      mockPrisma.alert.findUnique.mockResolvedValue(mockAlertRecord);
      const assignedDevices = ['33333333-3333-3333-3333-333333333333']; // different device

      await expect(
        alertRepo.acknowledgeAlert(mockAlertRecord.id, 'admin-id', 'note', assignedDevices)
      ).rejects.toThrow('not found or device access revoked');
    });

    it('allows ADMIN to acknowledge alert for assigned device', async () => {
      mockPrisma.alert.findUnique.mockResolvedValue(mockAlertRecord);
      const assignedDevices = [mockAlertRecord.deviceId];

      const result = await alertRepo.acknowledgeAlert(
        mockAlertRecord.id,
        'admin-id',
        undefined,
        assignedDevices
      );
      expect(result.status).toBe(AlertStatus.ACKNOWLEDGED);
      expect(mockPrisma.alert.update).toHaveBeenCalled();
    });

    it('handles duplicate acknowledgement idempotently without throwing', async () => {
      const alreadyAcknowledgedRecord = {
        ...mockAlertRecord,
        status: AlertStatus.ACKNOWLEDGED,
      };
      mockPrisma.alert.findUnique.mockResolvedValue(alreadyAcknowledgedRecord);
      mockPrisma.alert.update.mockResolvedValue(alreadyAcknowledgedRecord);

      const result = await alertRepo.acknowledgeAlert(
        alreadyAcknowledgedRecord.id,
        'owner-user-id',
        'Second acknowledgment note'
      );

      expect(result.status).toBe(AlertStatus.ACKNOWLEDGED);
      expect(mockPrisma.alertAcknowledgement.create).toHaveBeenCalledWith({
        data: {
          alertId: alreadyAcknowledgedRecord.id,
          acknowledgedByUserId: 'owner-user-id',
          note: 'Second acknowledgment note',
          acknowledgedAt: expect.any(Date),
        },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventKey: 'alert.acknowledged',
          previousValues: { status: AlertStatus.ACKNOWLEDGED },
          newValues: { status: AlertStatus.ACKNOWLEDGED },
        }),
      });
    });
  });

  describe('createCommandFailureAlert & createCommandTimeoutAlert', () => {
    beforeEach(() => {
      mockPrisma.device = {
        findFirst: vi.fn(),
      };
      mockPrisma.faucetCommand = {
        findFirst: vi.fn(),
      };
      mockPrisma.alert.findFirst = vi.fn();
    });

    it('creates COMMAND_FAILED alert linked to device and faucet command', async () => {
      mockPrisma.device.findFirst.mockResolvedValue({
        id: '22222222-2222-2222-2222-222222222222',
        deviceId: 'water-tank-001',
        name: 'Main Reservoir Tank',
      });
      mockPrisma.faucetCommand.findFirst.mockResolvedValue({
        id: '33333333-3333-3333-3333-333333333333',
        commandId: 'cmd-01JXYZ123',
        deviceId: '22222222-2222-2222-2222-222222222222',
      });
      mockPrisma.alert.findFirst.mockResolvedValue(null); // No existing alert

      const createdRecord = {
        id: 'alert-fail-001',
        deviceId: '22222222-2222-2222-2222-222222222222',
        userId: null,
        alertType: 'COMMAND_FAILED',
        severity: 'CRITICAL',
        status: 'OPEN',
        sourceType: 'faucet_command',
        sourceId: '33333333-3333-3333-3333-333333333333',
        titleKey: 'alerts.commandFailedTitle',
        messageKey: 'alerts.commandFailedMessage',
        messageParams: {
          commandId: 'cmd-01JXYZ123',
          deviceName: 'Main Reservoir Tank',
          reason: 'VALVE_MALFUNCTION',
        },
        openedAt: new Date('2026-08-14T10:00:00Z'),
        resolvedAt: null,
        createdAt: new Date('2026-08-14T10:00:00Z'),
        updatedAt: new Date('2026-08-14T10:00:00Z'),
      };
      mockPrisma.alert.create.mockResolvedValue(createdRecord);

      const result = await alertRepo.createCommandFailureAlert({
        deviceId: 'water-tank-001',
        commandId: 'cmd-01JXYZ123',
        reasonCode: 'VALVE_MALFUNCTION',
      });

      expect(mockPrisma.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          deviceId: '22222222-2222-2222-2222-222222222222',
          sourceId: '33333333-3333-3333-3333-333333333333',
          sourceType: 'faucet_command',
          alertType: 'COMMAND_FAILED',
          severity: AlertSeverity.CRITICAL,
          titleKey: 'alerts.commandFailedTitle',
          messageKey: 'alerts.commandFailedMessage',
          messageParams: expect.objectContaining({
            commandId: 'cmd-01JXYZ123',
            deviceName: 'Main Reservoir Tank',
            reason: 'VALVE_MALFUNCTION',
          }),
        }),
      });
      expect(result.alertType).toBe('COMMAND_FAILED');
      expect(result.sourceType).toBe('faucet_command');
    });

    it('returns existing COMMAND_FAILED alert idempotently without creating duplicates', async () => {
      mockPrisma.device.findFirst.mockResolvedValue({
        id: '22222222-2222-2222-2222-222222222222',
        deviceId: 'water-tank-001',
        name: 'Main Reservoir Tank',
      });
      mockPrisma.faucetCommand.findFirst.mockResolvedValue({
        id: '33333333-3333-3333-3333-333333333333',
        commandId: 'cmd-01JXYZ123',
        deviceId: '22222222-2222-2222-2222-222222222222',
      });

      const existingRecord = {
        id: 'alert-fail-001',
        deviceId: '22222222-2222-2222-2222-222222222222',
        userId: null,
        alertType: 'COMMAND_FAILED',
        severity: 'CRITICAL',
        status: 'OPEN',
        sourceType: 'faucet_command',
        sourceId: '33333333-3333-3333-3333-333333333333',
        titleKey: 'alerts.commandFailedTitle',
        messageKey: 'alerts.commandFailedMessage',
        messageParams: {
          commandId: 'cmd-01JXYZ123',
          deviceName: 'Main Reservoir Tank',
          reason: 'VALVE_MALFUNCTION',
        },
        openedAt: new Date('2026-08-14T10:00:00Z'),
        resolvedAt: null,
        createdAt: new Date('2026-08-14T10:00:00Z'),
        updatedAt: new Date('2026-08-14T10:00:00Z'),
      };
      mockPrisma.alert.findFirst.mockResolvedValue(existingRecord);

      const result = await alertRepo.createCommandFailureAlert({
        deviceId: 'water-tank-001',
        commandId: 'cmd-01JXYZ123',
        reasonCode: 'VALVE_MALFUNCTION',
      });

      expect(mockPrisma.alert.create).not.toHaveBeenCalled();
      expect(result.id).toBe('alert-fail-001');
    });

    it('creates distinct COMMAND_TIMEOUT alert and emphasizes physicalOutcome: UNKNOWN', async () => {
      mockPrisma.device.findFirst.mockResolvedValue({
        id: '22222222-2222-2222-2222-222222222222',
        deviceId: 'water-tank-001',
        name: 'Main Reservoir Tank',
      });
      mockPrisma.faucetCommand.findFirst.mockResolvedValue({
        id: '33333333-3333-3333-3333-333333333333',
        commandId: 'cmd-01JXYZ123',
        deviceId: '22222222-2222-2222-2222-222222222222',
      });
      mockPrisma.alert.findFirst.mockResolvedValue(null);

      const timeoutRecord = {
        id: 'alert-timeout-001',
        deviceId: '22222222-2222-2222-2222-222222222222',
        userId: null,
        alertType: 'COMMAND_TIMEOUT',
        severity: 'CRITICAL',
        status: 'OPEN',
        sourceType: 'faucet_command',
        sourceId: '33333333-3333-3333-3333-333333333333',
        titleKey: 'alerts.commandTimeoutTitle',
        messageKey: 'alerts.commandTimeoutMessage',
        messageParams: {
          commandId: 'cmd-01JXYZ123',
          deviceName: 'Main Reservoir Tank',
          physicalOutcome: 'UNKNOWN',
        },
        openedAt: new Date('2026-08-14T10:05:00Z'),
        resolvedAt: null,
        createdAt: new Date('2026-08-14T10:05:00Z'),
        updatedAt: new Date('2026-08-14T10:05:00Z'),
      };
      mockPrisma.alert.create.mockResolvedValue(timeoutRecord);

      const result = await alertRepo.createCommandTimeoutAlert({
        deviceId: 'water-tank-001',
        commandId: 'cmd-01JXYZ123',
      });

      expect(mockPrisma.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          deviceId: '22222222-2222-2222-2222-222222222222',
          sourceId: '33333333-3333-3333-3333-333333333333',
          sourceType: 'faucet_command',
          alertType: 'COMMAND_TIMEOUT',
          titleKey: 'alerts.commandTimeoutTitle',
          messageKey: 'alerts.commandTimeoutMessage',
          messageParams: expect.objectContaining({
            commandId: 'cmd-01JXYZ123',
            physicalOutcome: 'UNKNOWN',
          }),
        }),
      });
      expect(result.alertType).toBe('COMMAND_TIMEOUT');
      expect(result.alertType).not.toBe('COMMAND_FAILED');
    });
  });
});
