import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  UserRole,
  AccountStatus,
  MonitoringStatus,
  FaucetCommandStatus,
  AlertStatus,
  AlertSeverity,
} from '../index';

/**
 * Approved Supported Locales (DEC-I18N-068, docs/I18N.md)
 * en: English
 * id: Bahasa Indonesia (Default)
 */
const SupportedLocaleSchema = z.enum(['en', 'id']);
type SupportedLocale = z.infer<typeof SupportedLocaleSchema>;

const DEFAULT_LOCALE: SupportedLocale = 'id';
const FALLBACK_LOCALE: SupportedLocale = 'en';

function validateLocale(locale?: string | null): SupportedLocale {
  if (!locale || locale.trim() === '') {
    return DEFAULT_LOCALE;
  }
  const normalized = locale.trim().toLowerCase();
  const parsed = SupportedLocaleSchema.safeParse(normalized);
  return parsed.success ? parsed.data : FALLBACK_LOCALE;
}

describe('TASK-1001 — Locale Validation & Canonical Enum Preservation', () => {
  describe('SupportedLocaleSchema & validateLocale', () => {
    it('validates supported locales ("en" and "id")', () => {
      expect(SupportedLocaleSchema.parse('en')).toBe('en');
      expect(SupportedLocaleSchema.parse('id')).toBe('id');
    });

    it('rejects unsupported locales in schema parse', () => {
      expect(() => SupportedLocaleSchema.parse('fr')).toThrow();
      expect(() => SupportedLocaleSchema.parse('es')).toThrow();
      expect(() => SupportedLocaleSchema.parse('')).toThrow();
    });

    it('returns DEFAULT_LOCALE ("id") when locale is null, undefined, or empty string', () => {
      expect(validateLocale(null)).toBe(DEFAULT_LOCALE);
      expect(validateLocale(undefined)).toBe(DEFAULT_LOCALE);
      expect(validateLocale('')).toBe(DEFAULT_LOCALE);
      expect(validateLocale('   ')).toBe(DEFAULT_LOCALE);
    });

    it('returns requested locale when valid ("en" or "id")', () => {
      expect(validateLocale('en')).toBe('en');
      expect(validateLocale('id')).toBe('id');
    });

    it('normalises whitespace and case (" EN ", "ID")', () => {
      expect(validateLocale(' EN ')).toBe('en');
      expect(validateLocale('ID')).toBe('id');
    });

    it('returns FALLBACK_LOCALE ("en") when locale is invalid or unsupported string', () => {
      expect(validateLocale('fr')).toBe(FALLBACK_LOCALE);
      expect(validateLocale('de')).toBe(FALLBACK_LOCALE);
      expect(validateLocale('invalid_locale')).toBe(FALLBACK_LOCALE);
    });
  });

  describe('Canonical Internal Values Preservation', () => {
    it('preserves untranslated UserRole enum values', () => {
      expect(UserRole.OWNER).toBe('OWNER');
      expect(UserRole.ADMIN).toBe('ADMIN');
    });

    it('preserves untranslated AccountStatus enum values', () => {
      expect(AccountStatus.PENDING_APPROVAL).toBe('PENDING_APPROVAL');
      expect(AccountStatus.APPROVED).toBe('APPROVED');
      expect(AccountStatus.ACTIVE).toBe('ACTIVE');
      expect(AccountStatus.REJECTED).toBe('REJECTED');
      expect(AccountStatus.SUSPENDED).toBe('SUSPENDED');
      expect(AccountStatus.DEACTIVATED).toBe('DEACTIVATED');
    });

    it('preserves untranslated MonitoringStatus enum values', () => {
      expect(MonitoringStatus.NORMAL).toBe('NORMAL');
      expect(MonitoringStatus.WARNING).toBe('WARNING');
      expect(MonitoringStatus.CRITICAL).toBe('CRITICAL');
      expect(MonitoringStatus.UNKNOWN).toBe('UNKNOWN');
      expect(MonitoringStatus.UNAVAILABLE).toBe('UNAVAILABLE');
      expect(MonitoringStatus.INVALID).toBe('INVALID');
    });

    it('preserves untranslated FaucetCommandStatus enum values', () => {
      expect(FaucetCommandStatus.QUEUED).toBe('QUEUED');
      expect(FaucetCommandStatus.SENT).toBe('SENT');
      expect(FaucetCommandStatus.ACKNOWLEDGED).toBe('ACKNOWLEDGED');
      expect(FaucetCommandStatus.IN_PROGRESS).toBe('IN_PROGRESS');
      expect(FaucetCommandStatus.COMPLETED).toBe('COMPLETED');
      expect(FaucetCommandStatus.FAILED).toBe('FAILED');
      expect(FaucetCommandStatus.CANCELLED).toBe('CANCELLED');
      expect(FaucetCommandStatus.TIMEOUT).toBe('TIMEOUT');
      expect(FaucetCommandStatus.EXPIRED).toBe('EXPIRED');
    });

    it('preserves untranslated AlertStatus and AlertSeverity enum values', () => {
      expect(AlertStatus.OPEN).toBe('OPEN');
      expect(AlertStatus.ACKNOWLEDGED).toBe('ACKNOWLEDGED');
      expect(AlertStatus.RESOLVED).toBe('RESOLVED');
      expect(AlertSeverity.INFO).toBe('INFO');
      expect(AlertSeverity.WARNING).toBe('WARNING');
      expect(AlertSeverity.CRITICAL).toBe('CRITICAL');
    });
  });
});
