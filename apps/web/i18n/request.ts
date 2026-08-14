import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import {
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  LOCALE_COOKIE_NAME,
  isSupportedLocale,
} from '../lib/i18n/config';

import idMessages from '../messages/id.json';
import enMessages from '../messages/en.json';

const MESSAGES = {
  id: idMessages,
  en: enMessages,
};

export default getRequestConfig(async () => {
  let rawCookie: string | undefined;
  try {
    const store = await cookies();
    rawCookie = store.get(LOCALE_COOKIE_NAME)?.value;
  } catch {
    // Fallback to default locale during static page prerendering at build time
  }
  const locale = isSupportedLocale(rawCookie) ? rawCookie : DEFAULT_LOCALE;
  const messages = MESSAGES[locale] || MESSAGES[FALLBACK_LOCALE];

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
