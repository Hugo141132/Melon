'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2, Globe, ChevronRight } from 'lucide-react';
import { LOCALE_COOKIE_NAME } from '@/lib/i18n/config';

export function LanguageGate() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSelect = (locale: string) => {
    setLoading(locale);
    document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/`;
    router.refresh();
  };

  return (
    <div className="bg-surface text-on-surface min-h-dvh flex flex-col justify-center items-center p-[24px]">
      <main className="w-full max-w-md bg-surface-container-lowest bento-shape p-[32px] shadow-sm border border-outline-variant/60 rounded-3xl">
        {/* Neutral Visual Anchor */}
        <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-6">
          <Globe size={24} className="text-primary" />
        </div>

        {/* Language Selection Cards */}
        <div className="space-y-3.5">
          {/* Bahasa Indonesia */}
          <button
            type="button"
            onClick={() => handleSelect('id')}
            disabled={loading !== null}
            aria-label="Pilih Bahasa Indonesia"
            className="w-full min-h-[80px] p-4 bg-surface text-on-surface border border-outline-variant hover:border-primary hover:bg-primary/5 rounded-2xl transition-all duration-150 active:scale-[0.99] flex items-center justify-between gap-3.5 cursor-pointer disabled:opacity-60 text-left group focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-2xs"
          >
            <div className="flex items-center gap-3.5">
              {/* Indonesian Flag Indicator */}
              <div
                className="w-9 h-6 rounded-xs overflow-hidden flex flex-col border border-black/15 shadow-2xs shrink-0"
                style={{ width: '36px', height: '24px' }}
                aria-hidden="true"
              >
                <div className="w-full h-1/2 bg-[#E70011]" />
                <div className="w-full h-1/2 bg-white" />
              </div>
              <div>
                <span className="block text-[17px] font-bold text-on-surface group-hover:text-primary transition-colors">
                  Bahasa Indonesia
                </span>
                <span className="block text-[13px] text-on-surface-variant font-normal mt-0.5">
                  Indonesia
                </span>
              </div>
            </div>

            <div className="shrink-0 text-outline group-hover:text-primary transition-colors pr-1">
              {loading === 'id' ? (
                <Loader2 size={22} className="animate-spin text-primary" />
              ) : (
                <ChevronRight
                  size={22}
                  className="group-hover:translate-x-0.5 transition-transform"
                />
              )}
            </div>
          </button>

          {/* English */}
          <button
            type="button"
            onClick={() => handleSelect('en')}
            disabled={loading !== null}
            aria-label="Select English"
            className="w-full min-h-[80px] p-4 bg-surface text-on-surface border border-outline-variant hover:border-primary hover:bg-primary/5 rounded-2xl transition-all duration-150 active:scale-[0.99] flex items-center justify-between gap-3.5 cursor-pointer disabled:opacity-60 text-left group focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-2xs"
          >
            <div className="flex items-center gap-3.5">
              {/* UK Flag Indicator */}
              <div
                className="w-9 h-6 rounded-xs overflow-hidden flex items-center justify-center bg-[#012169] border border-black/15 shadow-2xs shrink-0 relative"
                style={{ width: '36px', height: '24px' }}
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 60 30"
                  width="36"
                  height="24"
                  className="w-full h-full block"
                  aria-hidden="true"
                >
                  <clipPath id="uk-clip-s">
                    <path d="M0,0 v30 h60 v-30 z" />
                  </clipPath>
                  <clipPath id="uk-clip-t">
                    <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
                  </clipPath>
                  <g clipPath="url(#uk-clip-s)">
                    <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
                    <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
                    <path
                      d="M0,0 L60,30 M60,0 L0,30"
                      clipPath="url(#uk-clip-t)"
                      stroke="#C8102E"
                      strokeWidth="4"
                    />
                    <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
                    <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
                  </g>
                </svg>
              </div>
              <div>
                <span className="block text-[17px] font-bold text-on-surface group-hover:text-primary transition-colors">
                  English
                </span>
                <span className="block text-[13px] text-on-surface-variant font-normal mt-0.5">
                  English
                </span>
              </div>
            </div>

            <div className="shrink-0 text-outline group-hover:text-primary transition-colors pr-1">
              {loading === 'en' ? (
                <Loader2 size={22} className="animate-spin text-primary" />
              ) : (
                <ChevronRight
                  size={22}
                  className="group-hover:translate-x-0.5 transition-transform"
                />
              )}
            </div>
          </button>
        </div>
      </main>
    </div>
  );
}
