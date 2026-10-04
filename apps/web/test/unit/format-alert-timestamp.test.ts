import { describe, it, expect } from 'vitest';
import { formatAlertTimestamp } from '@/lib/notifications/format-alert-timestamp';
import { getAlertNotificationEmailHtml } from '@/lib/email/resend';

describe('formatAlertTimestamp & Timezone Policy Parity Tests', () => {
  it('defaults to Asia/Jakarta (WIB, UTC+7) when timezone is omitted or null', () => {
    // 2026-10-03 at 10:00:00 UTC = 17:00:00 WIB
    const openedAt = new Date('2026-10-03T10:00:00Z');

    const resultId = formatAlertTimestamp(openedAt, 'id');
    const resultEn = formatAlertTimestamp(openedAt, 'en');

    // Hour 17 in Asia/Jakarta
    expect(resultId).toMatch(/17[:.]00/);
    expect(resultEn).toMatch(/5:00/); // 5:00 PM in en-US
    expect(resultEn).toContain('PM');
  });

  it('respects non-default user preference timezone', () => {
    const openedAt = new Date('2026-10-03T10:00:00Z');

    // UTC
    const resultUtc = formatAlertTimestamp(openedAt, 'en', 'UTC');
    expect(resultUtc).toMatch(/10:00/);
    expect(resultUtc).toContain('AM');

    // America/New_York (EDT, UTC-4 in October) -> 10:00 UTC = 06:00 EDT
    const resultNy = formatAlertTimestamp(openedAt, 'en', 'America/New_York');
    expect(resultNy).toMatch(/6:00/);
    expect(resultNy).toContain('AM');

    // Asia/Tokyo (JST, UTC+9) -> 10:00 UTC = 19:00 JST
    const resultTokyo = formatAlertTimestamp(openedAt, 'id', 'Asia/Tokyo');
    expect(resultTokyo).toMatch(/19[:.]00/);
  });

  it('gracefully falls back to Asia/Jakarta on invalid or corrupt timezone strings', () => {
    const openedAt = new Date('2026-10-03T10:00:00Z');

    const resultFallback = formatAlertTimestamp(
      openedAt,
      'id',
      'Invalid/Non_Existent_Timezone_123'
    );
    const resultDefault = formatAlertTimestamp(openedAt, 'id', 'Asia/Jakarta');

    expect(resultFallback).toBe(resultDefault);
    expect(resultFallback).toMatch(/17[:.]00/);
  });

  it('handles UTC midnight date rollover into next day without manual arithmetic', () => {
    // 2026-10-03 at 20:30:00 UTC -> 2026-10-04 at 03:30:00 WIB
    const openedAt = new Date('2026-10-03T20:30:00Z');

    const resultWib = formatAlertTimestamp(openedAt, 'en', 'Asia/Jakarta');
    expect(resultWib).toContain('Oct 4, 2026');
    expect(resultWib).toMatch(/3:30/);
    expect(resultWib).toContain('AM');

    const resultId = formatAlertTimestamp(openedAt, 'id', 'Asia/Jakarta');
    expect(resultId).toContain('4');
    expect(resultId).toMatch(/03[:.]30/);
  });

  it('guarantees 100% parity between email notification timestamp and UI timestamp', () => {
    const openedAt = new Date('2026-10-03T21:45:00Z');
    const timezone = 'Asia/Jakarta';
    const locale = 'id';

    // 1. Value produced by formatAlertTimestamp (used by /notifications UI)
    const uiFormattedTime = formatAlertTimestamp(openedAt, locale, timezone);

    // 2. Value produced in email HTML and text
    const { html, text } = getAlertNotificationEmailHtml(
      'Operator',
      {
        alertType: 'CRITICAL_WATER_LEVEL',
        severity: 'CRITICAL',
        title: 'Tinggi Air Kritis',
        message: 'Level air tangki di bawah ambang batas.',
        openedAt,
        timezone,
      },
      locale
    );

    expect(html).toContain(uiFormattedTime);
    expect(text).toContain(uiFormattedTime);
  });

  it('returns empty string on null, undefined, or invalid date inputs', () => {
    expect(formatAlertTimestamp(null)).toBe('');
    expect(formatAlertTimestamp(undefined)).toBe('');
    expect(formatAlertTimestamp('invalid-date')).toBe('');
  });
});
