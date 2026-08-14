import { cookies } from 'next/headers';
import { LOCALE_COOKIE_NAME, isSupportedLocale } from '@/lib/i18n/config';
import { LanguageGate } from '@/components/auth/language-gate';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const rawLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const hasValidLocale = isSupportedLocale(rawLocale);

  if (!hasValidLocale) {
    return <LanguageGate />;
  }

  return <div className="bg-surface text-on-surface min-h-dvh">{children}</div>;
}
