import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import idMessages from '../messages/id.json';
import enMessages from '../messages/en.json';

function getActiveTestLocale(): 'id' | 'en' {
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(/(?:^|;\s*)locale=([^;]+)/);
    if (match && (match[1] === 'en' || match[1] === 'id')) {
      return match[1] as 'id' | 'en';
    }
  }
  return 'id';
}

vi.mock('next-intl', () => {
  return {
    useTranslations: (namespace?: string) => {
      return (key: string, values?: Record<string, any>) => {
        const loc = getActiveTestLocale();
        const msgs = loc === 'en' ? enMessages : idMessages;
        const nsObj = namespace ? (msgs as any)[namespace] : msgs;
        let template = nsObj?.[key] ?? key;
        if (typeof template === 'string' && values) {
          Object.entries(values).forEach(([k, v]) => {
            template = template.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
          });
        }
        return template;
      };
    },
    useLocale: () => getActiveTestLocale(),
    useMessages: () => (getActiveTestLocale() === 'en' ? enMessages : idMessages),
    NextIntlClientProvider: ({
      children,
      locale,
    }: {
      children: any;
      locale?: string;
      messages?: any;
    }) => {
      if (locale && typeof document !== 'undefined') {
        document.cookie = `locale=${locale}; path=/`;
      }
      return children;
    },
  };
});

afterEach(() => {
  cleanup();
});
