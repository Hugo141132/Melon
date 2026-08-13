import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import {
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  LOCALE_COOKIE_NAME,
  isSupportedLocale,
} from '../lib/i18n/config';

export default getRequestConfig(async () => {
  const store = await cookies();
  const rawCookie = store.get(LOCALE_COOKIE_NAME)?.value;
  const locale = isSupportedLocale(rawCookie) ? rawCookie : DEFAULT_LOCALE;

  let messages;
  try {
    messages = (await import(`../messages/${locale}.json`)).default;
  } catch {
    messages = (await import(`../messages/${FALLBACK_LOCALE}.json`)).default;
  }

  return {
    locale,
    messages,
    onError(error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[i18n] Translation missing or error: ${error.code}`);
      }
    },
    getMessageFallback({ key, namespace }) {
      const fullKey = namespace ? `${namespace}.${key}` : key;
      return fullKey;
    },
  };
});
