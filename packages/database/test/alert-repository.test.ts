import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AlertRepository, AlertNotFoundError } from '../src/alert-repository';
import { AlertStatus, AlertSeverity } from '@kebun-melon/contracts';

describe('AlertRepository - User-Scoped Acknowledgement & Visibility', () => {
  let mockPrisma: any;
  let repo: AlertRepository;

  beforeEach(() => {
    mockPrisma = {
      alert: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      alertAcknowledgement: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
        return cb(mockPrisma);
      }),
    };

    repo = new AlertRepository(mockPrisma as any);
  });

  it('preserves global OPEN status on alert row when User A acknowledges', async () => {
    const alertId = 'alert-uuid-1';
    const userA = 'user-uuid-a';

    mockPrisma.alert.findUnique.mockResolvedValueOnce({
      id: alertId,
      status: AlertStatus.OPEN,
      deviceId: 'dev-1',
    });

    mockPrisma.alertAcknowledgement.findFirst.mockResolvedValueOnce(null);
    mockPrisma.alertAcknowledgement.create.mockResolvedValueOnce({
      id: 'ack-1',
      alertId,
      acknowledgedByUserId: userA,
      acknowledgedAt: new Date(),
    });

    const result = await repo.acknowledgeAlert(alertId, userA);

    expect(result.status).toBe(AlertStatus.ACKNOWLEDGED);
    // Crucial: tx.alert.update MUST NOT be called to mutate global alert.status to ACKNOWLEDGED
    expect(mockPrisma.alert.update).not.toHaveBeenCalled();
    // User acknowledgement record created
    expect(mockPrisma.alertAcknowledgement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        alertId,
        acknowledgedByUserId: userA,
      }),
    });
    // Audit log created with userScoped flag
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventKey: 'alert.acknowledged',
        actorUserId: userA,
        targetId: alertId,
        metadata: expect.objectContaining({ userScoped: true }),
      }),
    });
  });

  it('filters out acknowledged alerts for User A while retaining them as OPEN for User B', async () => {
    const userA = 'user-uuid-a';
    const userB = 'user-uuid-b';

    // Mock count & findMany for User A querying status=OPEN
    mockPrisma.alert.count.mockResolvedValueOnce(0);
    mockPrisma.alert.findMany.mockResolvedValueOnce([]);

    const resultUserA = await repo.getAlerts({ status: AlertStatus.OPEN }, undefined, userA);

    expect(mockPrisma.alert.count).toHaveBeenLastCalledWith({
      where: expect.objectContaining({
        status: { not: AlertStatus.RESOLVED },
        acknowledgements: {
          none: {
            acknowledgedByUserId: userA,
          },
        },
      }),
    });
    expect(resultUserA.items).toHaveLength(0);

    // Mock count & findMany for User B querying status=OPEN
    const rawAlertForUserB = {
      id: 'alert-uuid-1',
      deviceId: 'dev-1',
      userId: null,
      alertType: 'COMMAND_TIMEOUT',
      severity: AlertSeverity.WARNING,
      status: AlertStatus.OPEN,
      sourceType: 'faucet_command',
      sourceId: null,
      titleKey: 'alerts.commandTimeoutTitle',
      messageKey: 'alerts.commandTimeoutMessage',
      messageParams: null,
      openedAt: new Date(),
      resolvedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      acknowledgements: [], // User B has not acknowledged
    };

    mockPrisma.alert.count.mockResolvedValueOnce(1);
    mockPrisma.alert.findMany.mockResolvedValueOnce([rawAlertForUserB]);

    const resultUserB = await repo.getAlerts({ status: AlertStatus.OPEN }, undefined, userB);

    expect(mockPrisma.alert.count).toHaveBeenLastCalledWith({
      where: expect.objectContaining({
        status: { not: AlertStatus.RESOLVED },
        acknowledgements: {
          none: {
            acknowledgedByUserId: userB,
          },
        },
      }),
    });
    expect(resultUserB.items).toHaveLength(1);
    expect(resultUserB.items[0].status).toBe(AlertStatus.OPEN);
    expect(resultUserB.items[0].isAcknowledged).toBe(false);
  });

  it('renders status=ACKNOWLEDGED and isAcknowledged=true only for User A when listing all alerts', async () => {
    const userA = 'user-uuid-a';
    const userB = 'user-uuid-b';

    const rawAlert = {
      id: 'alert-uuid-1',
      deviceId: 'dev-1',
      userId: null,
      alertType: 'COMMAND_TIMEOUT',
      severity: AlertSeverity.WARNING,
      status: AlertStatus.OPEN, // Global DB status
      sourceType: 'faucet_command',
      sourceId: null,
      titleKey: 'alerts.commandTimeoutTitle',
      messageKey: 'alerts.commandTimeoutMessage',
      messageParams: null,
      openedAt: new Date(),
      resolvedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // User A includes userA acknowledgement
    mockPrisma.alert.count.mockResolvedValueOnce(1);
    mockPrisma.alert.findMany.mockResolvedValueOnce([
      {
        ...rawAlert,
        acknowledgements: [
          {
            id: 'ack-1',
            acknowledgedByUserId: userA,
            acknowledgedAt: new Date('2026-10-03T11:00:00Z'),
          },
        ],
      },
    ]);

    const resultUserA = await repo.getAlerts({}, undefined, userA);
    expect(resultUserA.items[0].status).toBe(AlertStatus.ACKNOWLEDGED);
    expect(resultUserA.items[0].isAcknowledged).toBe(true);

    // User B includes empty acknowledgements
    mockPrisma.alert.count.mockResolvedValueOnce(1);
    mockPrisma.alert.findMany.mockResolvedValueOnce([
      {
        ...rawAlert,
        acknowledgements: [],
      },
    ]);

    const resultUserB = await repo.getAlerts({}, undefined, userB);
    expect(resultUserB.items[0].status).toBe(AlertStatus.OPEN);
    expect(resultUserB.items[0].isAcknowledged).toBe(false);
  });

  it('getAlertById derives user-scoped acknowledgement status', async () => {
    const alertId = 'alert-uuid-1';
    const userA = 'user-uuid-a';
    const userB = 'user-uuid-b';

    const rawAlert = {
      id: alertId,
      deviceId: 'dev-1',
      userId: null,
      alertType: 'COMMAND_TIMEOUT',
      severity: AlertSeverity.WARNING,
      status: AlertStatus.OPEN,
      sourceType: 'faucet_command',
      sourceId: null,
      titleKey: null,
      messageKey: null,
      messageParams: null,
      openedAt: new Date(),
      resolvedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // For user A (acknowledged)
    mockPrisma.alert.findUnique.mockResolvedValueOnce({
      ...rawAlert,
      acknowledgements: [
        {
          id: 'ack-1',
          acknowledgedByUserId: userA,
          acknowledgedAt: new Date('2026-10-03T11:00:00Z'),
        },
      ],
    });

    const detailUserA = await repo.getAlertById(alertId, undefined, userA);
    expect(detailUserA).not.toBeNull();
    expect(detailUserA?.status).toBe(AlertStatus.ACKNOWLEDGED);
    expect(detailUserA?.isAcknowledged).toBe(true);

    // For user B (not acknowledged)
    mockPrisma.alert.findUnique.mockResolvedValueOnce({
      ...rawAlert,
      acknowledgements: [],
    });

    const detailUserB = await repo.getAlertById(alertId, undefined, userB);
    expect(detailUserB).not.toBeNull();
    expect(detailUserB?.status).toBe(AlertStatus.OPEN);
    expect(detailUserB?.isAcknowledged).toBe(false);
  });

  describe('acknowledgeAlertsBulk', () => {
    it('acknowledges specified alert IDs with user-scoped upserts and audit log', async () => {
      const userA = 'user-uuid-a';
      const targetIds = ['alert-1', 'alert-2'];

      mockPrisma.alertAcknowledgement.upsert = vi.fn().mockResolvedValue({});
      mockPrisma.alert.findMany.mockResolvedValueOnce([
        { id: 'alert-1', status: AlertStatus.OPEN },
        { id: 'alert-2', status: AlertStatus.OPEN },
      ]);

      const result = await repo.acknowledgeAlertsBulk(userA, {
        alertIds: targetIds,
        note: 'Bulk check',
      });

      expect(result.acknowledgedCount).toBe(2);
      expect(result.alertIds).toEqual(targetIds);

      expect(mockPrisma.alertAcknowledgement.upsert).toHaveBeenCalledTimes(2);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventKey: 'alert.acknowledged.bulk',
          actorUserId: userA,
          targetType: 'Alert',
          result: 'SUCCESS',
          metadata: expect.objectContaining({
            count: 2,
            alertIds: targetIds,
            userScoped: true,
            note: 'Bulk check',
          }),
        }),
      });
    });

    it('acknowledges all open alerts when all: true is passed', async () => {
      const userA = 'user-uuid-a';

      mockPrisma.alertAcknowledgement.upsert = vi.fn().mockResolvedValue({});
      mockPrisma.alert.findMany.mockResolvedValueOnce([
        { id: 'alert-1', status: AlertStatus.OPEN },
        { id: 'alert-2', status: AlertStatus.OPEN },
        { id: 'alert-3', status: AlertStatus.OPEN },
      ]);

      const result = await repo.acknowledgeAlertsBulk(userA, { all: true });

      expect(result.acknowledgedCount).toBe(3);
      expect(result.alertIds).toEqual(['alert-1', 'alert-2', 'alert-3']);
      expect(mockPrisma.alertAcknowledgement.upsert).toHaveBeenCalledTimes(3);
    });

    it('returns acknowledgedCount: 0 when no eligible alerts match', async () => {
      const userA = 'user-uuid-a';

      mockPrisma.alert.findMany.mockResolvedValueOnce([]);

      const result = await repo.acknowledgeAlertsBulk(userA, { alertIds: ['non-existent'] });

      expect(result.acknowledgedCount).toBe(0);
      expect(result.alertIds).toEqual([]);
      expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
    });
  });
});
