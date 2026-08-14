'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { LOCALE_COOKIE_NAME } from '@/lib/i18n/config';

export function LanguageGate() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSelect = (locale: string) => {
    setLoading(locale);
    // 365 days max-age to match general Next.js practices if no specifics are set, but we keep it simple
    // The prompt says "do not invent Max-Age, SameSite, or other cookie policy not already established by approved code/docs".
    // I will just set path=/
    document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/`;
    router.refresh();
  };

  return (
    <div className="bg-surface text-on-surface min-h-dvh flex flex-col justify-center items-center p-[24px]">
      <main className="w-full max-w-md bg-surface-container-lowest bento-shape p-[32px] shadow-sm border border-outline-variant">
        <header className="mb-[32px] text-center">
          <h1 className="text-[24px] leading-[32px] font-bold tracking-[-0.01em] text-primary mb-2 md:text-[32px] md:leading-[40px]">
            Select Language / Pilih Bahasa
          </h1>
        </header>

        <div className="space-y-4">
          <button
            type="button"
            onClick={() => handleSelect('en')}
            disabled={loading !== null}
            aria-label="Select English"
            className="w-full h-[64px] bg-surface text-on-surface border border-outline rounded-xl text-[18px] font-semibold hover:bg-surface-variant transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {loading === 'en' ? <Loader2 size={24} className="animate-spin" /> : 'English'}
          </button>

          <button
            type="button"
            onClick={() => handleSelect('id')}
            disabled={loading !== null}
            aria-label="Pilih Bahasa Indonesia"
            className="w-full h-[64px] bg-surface text-on-surface border border-outline rounded-xl text-[18px] font-semibold hover:bg-surface-variant transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {loading === 'id' ? <Loader2 size={24} className="animate-spin" /> : 'Bahasa Indonesia'}
          </button>
        </div>
      </main>
    </div>
  );
}
