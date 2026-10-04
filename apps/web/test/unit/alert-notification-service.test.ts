import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatAlertContent,
  dispatchAlertEmails,
} from '@/lib/notifications/alert-notification-service';

vi.mock('@kebun-melon/database', () => {
  const mockResolveAlertRecipients = vi.fn();
  const mockIsAlertAlreadyDispatched = vi.fn();
  const mockRecordDispatch = vi.fn();

  class MockAlertNotificationRepository {
    resolveAlertRecipients = mockResolveAlertRecipients;
    isAlertAlreadyDispatched = mockIsAlertAlreadyDispatched;
    recordDispatch = mockRecordDispatch;
  }

  return {
    prisma: {},
    AlertNotificationRepository: MockAlertNotificationRepository,
    __mockResolveAlertRecipients: mockResolveAlertRecipients,
    __mockIsAlertAlreadyDispatched: mockIsAlertAlreadyDispatched,
    __mockRecordDispatch: mockRecordDispatch,
  };
});

vi.mock('@/lib/email/resend', () => ({
  sendAlertNotificationEmail: vi.fn().mockResolvedValue({
    success: true,
    emailSent: false,
    simulated: true,
    id: 'sim-alert-email-123',
  }),
}));

describe('Alert Notification Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('formatAlertContent', () => {
    it('formats localized timeout alert in Indonesian', () => {
      const { title, message } = formatAlertContent(
        'alerts.commandTimeoutTitle',
        'alerts.commandTimeoutMessage',
        { deviceName: 'Water Tank 1' },
        'id'
      );

      expect(title).toBe('Perintah Valve Kehabisan Waktu');
      expect(message).toBe('Perintah valve untuk Water Tank 1 kehabisan waktu tanpa konfirmasi.');
    });

    it('formats localized timeout alert in English', () => {
      const { title, message } = formatAlertContent(
        'alerts.commandTimeoutTitle',
        'alerts.commandTimeoutMessage',
        { deviceName: 'Water Tank 1' },
        'en'
      );

      expect(title).toBe('Valve Command Timed Out');
      expect(message).toBe('The valve command for Water Tank 1 timed out without confirmation.');
    });

    it('falls back to raw keys when keys are not in translation map', () => {
      const { title, message } = formatAlertContent(
        'custom.unknownTitle',
        'custom.unknownMessage {code}',
        { code: 'ERR_42' },
        'en'
      );

      expect(title).toBe('custom.unknownTitle');
      expect(message).toBe('custom.unknownMessage ERR_42');
    });
  });

  describe('dispatchAlertEmails', () => {
    it('dispatches emails to eligible users and tracks results', async () => {
      const dbModule = await import('@kebun-melon/database');
      const { __mockResolveAlertRecipients, __mockIsAlertAlreadyDispatched, __mockRecordDispatch } =
        dbModule as any;

      __mockResolveAlertRecipients.mockResolvedValue({
        alert: {
          id: 'alert-001',
          deviceId: 'dev-001',
          deviceName: 'Node 1',
          alertType: 'COMMAND_TIMEOUT',
          severity: 'WARNING',
          titleKey: 'alerts.commandTimeoutTitle',
          messageKey: 'alerts.commandTimeoutMessage',
          messageParams: { deviceName: 'Node 1' },
          openedAt: new Date(),
        },
        recipients: [
          {
            userId: 'user-001',
            email: 'active@example.com',
            fullName: 'Active User',
            preferredLocale: 'id',
            timezone: 'Asia/Jakarta',
            emailAlertsEnabled: true,
          },
          {
            userId: 'user-002',
            email: 'optout@example.com',
            fullName: 'Opt-out User',
            preferredLocale: 'en',
            timezone: 'UTC',
            emailAlertsEnabled: false,
          },
        ],
      });

      __mockIsAlertAlreadyDispatched.mockResolvedValue(false);

      const result = await dispatchAlertEmails('alert-001', { requestId: 'req-test' });

      expect(result.success).toBe(true);
      expect(result.totalEligible).toBe(2);
      expect(result.sent).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.failed).toBe(0);

      const emailModule = await import('@/lib/email/resend');
      expect((emailModule as any).sendAlertNotificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          toEmail: 'active@example.com',
          timezone: 'Asia/Jakarta',
        })
      );

      // Verify opt-out was recorded as DISABLED_BY_PREFERENCE
      expect(__mockRecordDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-002',
          status: 'DISABLED_BY_PREFERENCE',
        })
      );

      // Verify active user was recorded as SIMULATED or SENT
      expect(__mockRecordDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-001',
          status: 'SIMULATED',
        })
      );
    });

    it('skips already dispatched alerts (idempotency)', async () => {
      const dbModule = await import('@kebun-melon/database');
      const { __mockResolveAlertRecipients, __mockIsAlertAlreadyDispatched, __mockRecordDispatch } =
        dbModule as any;

      __mockResolveAlertRecipients.mockResolvedValue({
        alert: {
          id: 'alert-002',
          deviceId: 'dev-001',
          alertType: 'COMMAND_TIMEOUT',
          severity: 'WARNING',
          openedAt: new Date(),
        },
        recipients: [
          {
            userId: 'user-001',
            email: 'already@example.com',
            fullName: 'Already Dispatched',
            preferredLocale: 'en',
            emailAlertsEnabled: true,
          },
        ],
      });

      __mockIsAlertAlreadyDispatched.mockResolvedValue(true);

      const result = await dispatchAlertEmails('alert-002');

      expect(result.sent).toBe(0);
      expect(result.skipped).toBe(1);
      expect(__mockRecordDispatch).not.toHaveBeenCalled();
    });
  });
});
