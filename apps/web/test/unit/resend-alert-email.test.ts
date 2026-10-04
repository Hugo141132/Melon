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

  it('formats openedAt timestamp using Asia/Jakarta (WIB) by default and maintains HTML/text parity', () => {
    const openedAt = new Date('2026-10-03T10:00:00Z'); // 10:00 UTC = 17:00 WIB
    const expectedTimeId = openedAt.toLocaleString('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'medium',
      timeZone: 'Asia/Jakarta',
    });

    const { html, text } = getAlertNotificationEmailHtml(
      'Budi',
      {
        alertType: 'DEVICE_OFFLINE',
        severity: 'CRITICAL',
        title: 'Node Offline',
        message: 'ESP32 device stopped responding.',
        openedAt,
      },
      'id'
    );

    // Verify both HTML and plain-text contain the identical Asia/Jakarta formatted timestamp
    expect(html).toContain(expectedTimeId);
    expect(text).toContain(expectedTimeId);
    // Confirm 17:00 (WIB) appears, not 10:00 (UTC)
    expect(expectedTimeId).toMatch(/17[:.]00/);
  });

  it('handles UTC date rollover correctly into Asia/Jakarta (WIB) next day without manual arithmetic', () => {
    // 2026-10-03 at 20:30:00 UTC corresponds to 2026-10-04 at 03:30:00 WIB (+7 hours)
    const openedAt = new Date('2026-10-03T20:30:00Z');
    const expectedRolloverTime = openedAt.toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'medium',
      timeZone: 'Asia/Jakarta',
    });

    const { html, text } = getAlertNotificationEmailHtml(
      'Operator',
      {
        alertType: 'LOW_RESERVOIR_LEVEL',
        severity: 'WARNING',
        title: 'Reservoir Level Low',
        message: 'Water level below safety threshold.',
        openedAt,
      },
      'en'
    );

    expect(html).toContain(expectedRolloverTime);
    expect(text).toContain(expectedRolloverTime);
    // Confirm date rolled over to Oct 4 and time is 3:30 AM
    expect(expectedRolloverTime).toContain('Oct 4, 2026');
    expect(expectedRolloverTime).toMatch(/3:30/);
  });

  it('respects recipient custom timezone when specified in preferences', () => {
    const openedAt = new Date('2026-10-03T10:00:00Z');
    const expectedUtcTime = openedAt.toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'medium',
      timeZone: 'UTC',
    });

    const { html, text } = getAlertNotificationEmailHtml(
      'Remote Admin',
      {
        alertType: 'DEVICE_OFFLINE',
        severity: 'INFO',
        title: 'Device Reconnected',
        message: 'Node reconnected.',
        openedAt,
        timezone: 'UTC',
      },
      'en'
    );

    expect(html).toContain(expectedUtcTime);
    expect(text).toContain(expectedUtcTime);
    expect(expectedUtcTime).toMatch(/10:00/);
  });

  it('safely falls back to Asia/Jakarta if an invalid timezone string is provided', () => {
    const openedAt = new Date('2026-10-03T10:00:00Z');
    const expectedFallbackTime = openedAt.toLocaleString('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'medium',
      timeZone: 'Asia/Jakarta',
    });

    const { html, text } = getAlertNotificationEmailHtml(
      'Operator',
      {
        alertType: 'COMMAND_TIMEOUT',
        severity: 'WARNING',
        title: 'Timeout',
        message: 'Timeout occured',
        openedAt,
        timezone: 'Invalid/Non_Existent_Timezone',
      },
      'id'
    );

    expect(html).toContain(expectedFallbackTime);
    expect(text).toContain(expectedFallbackTime);
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
