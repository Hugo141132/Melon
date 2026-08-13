import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  LOCALE_COOKIE_NAME,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  resolveLocale,
} from '../../lib/i18n/config';
import idMessages from '../../messages/id.json';
import enMessages from '../../messages/en.json';

describe('TASK-0601 — I18N Configuration & Infrastructure', () => {
  it('enforces approved locales (id and en) with id default and en fallback', () => {
    expect(SUPPORTED_LOCALES).toEqual(['id', 'en']);
    expect(DEFAULT_LOCALE).toBe('id');
    expect(FALLBACK_LOCALE).toBe('en');
    expect(LOCALE_COOKIE_NAME).toBe('locale');
  });

  it('validates supported locales correctly', () => {
    expect(isSupportedLocale('id')).toBe(true);
    expect(isSupportedLocale('en')).toBe(true);
    expect(isSupportedLocale('fr')).toBe(false);
    expect(isSupportedLocale('')).toBe(false);
    expect(isSupportedLocale(null)).toBe(false);
    expect(isSupportedLocale(undefined)).toBe(false);
    expect(isSupportedLocale(123)).toBe(false);
  });

  it('resolves valid locales or falls back safely to default locale (id)', () => {
    expect(resolveLocale('en')).toBe('en');
    expect(resolveLocale('id')).toBe('id');
    expect(resolveLocale('es')).toBe('id');
    expect(resolveLocale(null)).toBe('id');
    expect(resolveLocale(undefined)).toBe('id');
  });

  it('maintains structural key parity between Indonesian and English dictionaries', () => {
    const idKeys = Object.keys(idMessages).sort();
    const enKeys = Object.keys(enMessages).sort();

    expect(idKeys).toEqual(enKeys);
    expect(idMessages.system.status).toBe('Sistem Aktif');
    expect(enMessages.system.status).toBe('System Active');
  });
});
