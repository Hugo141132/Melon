import { describe, it, expect } from 'vitest';
import { getAlertNotificationEmailHtml, sendAlertNotificationEmail } from '@/lib/email/resend';

describe('Alert Notification Email Templates', () => {
  it('generates Indonesian HTML and text email for WARNING severity', () => {
    const { subject, html, text } = getAlertNotificationEmailHtml(
      'Budi Operator',
      {
        alertType: 'COMMAND_TIMEOUT',
        severity: 'WARNING',
        title: 'Perintah Valve Kehabisan Waktu',
        message: 'Perintah valve untuk Water Tank 1 kehabisan waktu tanpa konfirmasi.',
        deviceName: 'Water Tank 1',
        openedAt: new Date('2026-10-03T10:00:00Z'),
      },
      'id'
    );

    expect(subject).toContain('[PERINGATAN]');
    expect(subject).toContain('Perintah Valve Kehabisan Waktu');
    expect(html).toContain('Budi Operator');
    expect(html).toContain('Water Tank 1');
    expect(html).toContain('COMMAND_TIMEOUT');
    expect(html).toContain('Perintah valve untuk Water Tank 1 kehabisan waktu tanpa konfirmasi.');
    expect(html).toContain('Buka Daftar Notifikasi');
    expect(text).toContain('Melon Governance');
  });

  it('generates English HTML and text email for CRITICAL severity', () => {
    const { subject, html } = getAlertNotificationEmailHtml(
      'John Owner',
      {
        alertType: 'DEVICE_OFFLINE',
        severity: 'CRITICAL',
        title: 'Device Lost Connection',
        message: 'Reservoir monitoring node stopped responding.',
        deviceName: 'Reservoir Node 1',
      },
      'en'
    );

    expect(subject).toContain('[CRITICAL]');
    expect(subject).toContain('Device Lost Connection');
    expect(html).toContain('John Owner');
    expect(html).toContain('#dc2626'); // Red accent for critical
    expect(html).toContain('View in Notifications');
  });

  it('simulates delivery in test environment without throwing', async () => {
    const result = await sendAlertNotificationEmail({
      toEmail: 'test@example.com',
      recipientName: 'Test Recipient',
      alertType: 'COMMAND_TIMEOUT',
      severity: 'WARNING',
      title: 'Valve Command Timed Out',
      message: 'Command timed out.',
      deviceName: 'Water Tank',
      locale: 'en',
    });

    expect(result.success).toBe(true);
    expect(result.simulated).toBe(true);
    expect(result.emailSent).toBe(false);
  });
});
