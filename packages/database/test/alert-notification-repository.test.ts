import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AlertNotificationRepository } from '../src/alert-notification-repository';
import { AccountStatus, UserRole, AlertSeverity } from '@kebun-melon/contracts';

describe('AlertNotificationRepository', () => {
  let mockPrisma: any;
  let repo: AlertNotificationRepository;

  beforeEach(() => {
    mockPrisma = {
      alert: {
        findUnique: vi.fn(),
      },
      user: {
        findMany: vi.fn(),
      },
      alertEmailDispatch: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
      $queryRaw: vi.fn(),
      $executeRaw: vi.fn(),
    };
    repo = new AlertNotificationRepository(mockPrisma);
  });

  describe('resolveAlertRecipients', () => {
    it('returns empty list if alert is not found', async () => {
      mockPrisma.alert.findUnique.mockResolvedValue(null);

      const result = await repo.resolveAlertRecipients('alert-not-found');

      expect(result.alert).toBeNull();
      expect(result.recipients).toEqual([]);
    });

    it('resolves active owners and device-assigned active admins with verified emails', async () => {
      mockPrisma.alert.findUnique.mockResolvedValue({
        id: 'alert-001',
        deviceId: 'device-001',
        alertType: 'COMMAND_TIMEOUT',
        severity: AlertSeverity.WARNING,
        titleKey: 'alerts.commandTimeoutTitle',
        messageKey: 'alerts.commandTimeoutMessage',
        messageParams: { deviceName: 'Water Tank Node 1' },
        openedAt: new Date('2026-10-03T10:00:00Z'),
        device: {
          id: 'device-001',
          deviceId: 'water-node-01',
          name: 'Water Tank Node 1',
        },
      });

      // Mock owners
      mockPrisma.user.findMany.mockImplementation(({ where }: any) => {
        if (where.userRoles?.some?.role?.code === UserRole.OWNER) {
          return Promise.resolve([
            {
              id: 'owner-001',
              fullName: 'Farm Owner',
              email: 'owner@example.com',
              accountStatus: AccountStatus.ACTIVE,
              emailVerifiedAt: new Date(),
              userPreference: {
                preferredLocale: 'en',
                timezone: 'America/New_York',
                emailAlertsEnabled: true,
              },
            },
          ]);
        }
        if (where.userRoles?.some?.role?.code === UserRole.ADMIN) {
          return Promise.resolve([
            {
              id: 'admin-001',
              fullName: 'Assigned Admin',
              email: 'admin@example.com',
              accountStatus: AccountStatus.ACTIVE,
              emailVerifiedAt: new Date(),
              userPreference: {
                preferredLocale: 'id',
                emailAlertsEnabled: false,
              },
            },
          ]);
        }
        return Promise.resolve([]);
      });

      const result = await repo.resolveAlertRecipients('alert-001');

      expect(result.alert).not.toBeNull();
      expect(result.alert?.deviceName).toBe('Water Tank Node 1');
      expect(result.recipients).toHaveLength(2);

      const owner = result.recipients.find((r) => r.userId === 'owner-001');
      expect(owner).toBeDefined();
      expect(owner?.email).toBe('owner@example.com');
      expect(owner?.preferredLocale).toBe('en');
      expect(owner?.timezone).toBe('America/New_York');
      expect(owner?.emailAlertsEnabled).toBe(true);

      const admin = result.recipients.find((r) => r.userId === 'admin-001');
      expect(admin).toBeDefined();
      expect(admin?.email).toBe('admin@example.com');
      expect(admin?.preferredLocale).toBe('id');
      expect(admin?.timezone).toBe('Asia/Jakarta');
      expect(admin?.emailAlertsEnabled).toBe(false);
    });

    it('resolves only owners for system-wide alerts without deviceId', async () => {
      mockPrisma.alert.findUnique.mockResolvedValue({
        id: 'alert-system',
        deviceId: null,
        alertType: 'SYSTEM_ERROR',
        severity: AlertSeverity.CRITICAL,
        titleKey: null,
        messageKey: null,
        messageParams: null,
        openedAt: new Date('2026-10-03T10:00:00Z'),
        device: null,
      });

      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 'owner-001',
          fullName: 'Farm Owner',
          email: 'owner@example.com',
          userPreference: null,
        },
      ]);

      const result = await repo.resolveAlertRecipients('alert-system');

      expect(result.recipients).toHaveLength(1);
      expect(result.recipients[0].userId).toBe('owner-001');
      expect(result.recipients[0].emailAlertsEnabled).toBe(true); // default true
      expect(mockPrisma.user.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('isAlertAlreadyDispatched', () => {
    it('returns true when a SENT dispatch record exists', async () => {
      mockPrisma.alertEmailDispatch.findUnique.mockResolvedValue({
        id: 'dispatch-001',
        status: 'SENT',
      });

      const dispatched = await repo.isAlertAlreadyDispatched('alert-001', 'user-001');

      expect(dispatched).toBe(true);
      expect(mockPrisma.alertEmailDispatch.findUnique).toHaveBeenCalledWith({
        where: {
          alertId_userId: {
            alertId: 'alert-001',
            userId: 'user-001',
          },
        },
      });
    });

    it('returns false when no dispatch record exists', async () => {
      mockPrisma.alertEmailDispatch.findUnique.mockResolvedValue(null);
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const dispatched = await repo.isAlertAlreadyDispatched('alert-001', 'user-002');

      expect(dispatched).toBe(false);
    });
  });

  describe('recordDispatch', () => {
    it('upserts dispatch record via Prisma model', async () => {
      mockPrisma.alertEmailDispatch.upsert.mockResolvedValue({});

      await repo.recordDispatch({
        alertId: 'alert-001',
        userId: 'user-001',
        deviceId: 'device-001',
        recipientEmail: 'user@example.com',
        status: 'SENT',
        resendId: 'msg-resend-123',
      });

      expect(mockPrisma.alertEmailDispatch.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            alertId_userId: {
              alertId: 'alert-001',
              userId: 'user-001',
            },
          },
          update: expect.objectContaining({
            status: 'SENT',
            resendId: 'msg-resend-123',
          }),
        })
      );
    });
  });
});
