export const SUPPORTED_LOCALES = ['id', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'id';
export const FALLBACK_LOCALE: SupportedLocale = 'en';

/**
 * Canonical cookie name for non-prefixed locale preference storage.
 * Centralized implementation detail as required by specification.
 */
export const LOCALE_COOKIE_NAME = 'locale';

/**
 * Validates whether a given value is a supported locale.
 */
export function isSupportedLocale(locale: unknown): locale is SupportedLocale {
  return typeof locale === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(locale);
}

/**
 * Resolves a valid locale from an input string or cookie, defaulting to DEFAULT_LOCALE ('id').
 */
export function resolveLocale(rawLocale?: string | null): SupportedLocale {
  if (rawLocale && isSupportedLocale(rawLocale)) {
    return rawLocale;
  }
  return DEFAULT_LOCALE;
}
