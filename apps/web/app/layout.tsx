import type { Metadata, Viewport } from 'next';
import './globals.css';
import { DeviceProvider } from '@/context/DeviceContext';
import { AuthProvider } from '@/context/AuthContext';
import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import {
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  LOCALE_COOKIE_NAME,
  isSupportedLocale,
} from '@/lib/i18n/config';
import idMessages from '@/messages/id.json';
import enMessages from '@/messages/en.json';
import { getSessionOrNull } from '@/lib/auth/rbac';

const MESSAGES = {
  id: idMessages,
  en: enMessages,
};

async function getLayoutLocaleAndMessages() {
  let rawCookie: string | undefined;
  try {
    const store = await cookies();
    rawCookie = store.get(LOCALE_COOKIE_NAME)?.value;
  } catch {
    // Fallback to default locale during static page prerendering at build time
  }
  const locale = isSupportedLocale(rawCookie) ? rawCookie : DEFAULT_LOCALE;
  const messages = MESSAGES[locale] || MESSAGES[FALLBACK_LOCALE];
  return { locale, messages };
}

export const metadata: Metadata = {
  title: {
    default: 'Kebun Melon - Smart Farming',
    template: '%s | Kebun Melon',
  },
  description:
    'Kelola lahan melon Anda dengan lebih mudah. Monitor NPK, air, dan kesehatan tanaman secara real-time.',
  keywords: ['kebun melon', 'smart farming', 'pertanian pintar', 'NPK sensor'],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, messages } = await getLayoutLocaleAndMessages();
  const session = await getSessionOrNull();

  return (
    <html lang={locale}>
      <body className="min-h-dvh font-sans antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AuthProvider initialSession={session}>
            <DeviceProvider>{children}</DeviceProvider>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
