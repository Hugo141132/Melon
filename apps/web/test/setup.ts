import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import idMessages from '../messages/id.json';

vi.mock('next-intl', () => {
  return {
    useTranslations: (namespace?: string) => {
      return (key: string, values?: Record<string, any>) => {
        const nsObj = namespace ? (idMessages as any)[namespace] : idMessages;
        let template = nsObj?.[key] ?? key;
        if (typeof template === 'string' && values) {
          Object.entries(values).forEach(([k, v]) => {
            template = template.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
          });
        }
        return template;
      };
    },
    useLocale: () => 'id',
    useMessages: () => idMessages,
    NextIntlClientProvider: ({ children }: { children: any }) => children,
  };
});

afterEach(() => {
  cleanup();
});
