'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Globe, ChevronRight, CheckCircle2, Circle, X, Loader2, AlertTriangle } from 'lucide-react';
import { LOCALE_COOKIE_NAME } from '@/lib/i18n/config';

export function SettingsLocaleSwitcher() {
  const router = useRouter();
  const currentLocale = useLocale();
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');

  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);

  // Clear error state when modal opens
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
    }
  }, [isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen && !isUpdating) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isUpdating]);

  const handleSelectLanguage = async (newLocale: string) => {
    if (newLocale === currentLocale) {
      setIsOpen(false);
      return;
    }

    if (isUpdating) return;

    try {
      setIsUpdating(true);
      setErrorMsg(null);

      // 1. Update backend preference
      const res = await fetch('/api/v1/me/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredLocale: newLocale }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message || tSettings('saveLanguageFailed'));
      }

      // 2. Update client cookie
      document.cookie = `${LOCALE_COOKIE_NAME}=${newLocale}; path=/`;

      // 3. Dynamically update HTML lang attribute
      if (typeof document !== 'undefined') {
        document.documentElement.lang = newLocale;
      }

      // 4. Close modal and refresh UI (preserves route & query params)
      setIsOpen(false);
      router.refresh();
    } catch (error: any) {
      console.error('Failed to update language', error);
      setErrorMsg(error?.message || tSettings('saveLanguageFailed'));
    } finally {
      setIsUpdating(false);
    }
  };

  const currentLanguageLabel =
    currentLocale === 'id' ? tSettings('indonesian') : tSettings('english');

  return (
    <>
      {/* Settings Row Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={tSettings('languagePreferences')}
        data-testid="settings-locale-trigger"
        className="w-full text-left bg-app-surface-container-lowest p-5 rounded-xl soft-elevation border border-app-outline-variant/20 hover:bg-app-surface-container-low transition-colors flex items-center gap-4 group active:scale-[0.98] cursor-pointer"
      >
        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-app-tertiary/10 text-app-tertiary">
          <Globe size={22} />
        </div>
        <div className="flex-1">
          <h3 className="text-[16px] font-semibold text-app-on-surface">
            {tSettings('languagePreferences')}
          </h3>
          <p className="text-[14px] text-app-on-surface-variant font-medium">
            {currentLanguageLabel}
          </p>
        </div>
        <ChevronRight
          size={20}
          className="text-app-outline group-hover:translate-x-1 transition-transform"
        />
      </button>

      {/* Accessible Language Selector Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          data-testid="settings-language-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="language-modal-title"
        >
          <div
            ref={modalRef}
            className="bg-app-surface-container-lowest rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-app-outline-variant/30 animate-scale-up"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-app-outline-variant/20 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-app-tertiary/10 flex items-center justify-center text-app-tertiary">
                  <Globe size={22} />
                </div>
                <div>
                  <h3
                    id="language-modal-title"
                    className="text-[17px] font-bold text-app-on-surface"
                  >
                    {tSettings('selectLanguage')}
                  </h3>
                  <p className="text-[12px] text-app-on-surface-variant">
                    {tSettings('languageModalDesc')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isUpdating && setIsOpen(false)}
                disabled={isUpdating}
                className="text-app-outline hover:text-app-on-surface p-1.5 rounded-xl hover:bg-app-surface-container transition-colors cursor-pointer disabled:opacity-40"
                aria-label={tCommon('close')}
                data-testid="btn-close-language-modal"
              >
                <X size={20} />
              </button>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div
                className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5 text-xs animate-fade-in"
                data-testid="language-modal-error"
              >
                <AlertTriangle size={16} className="text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{errorMsg}</div>
              </div>
            )}

            {/* Language Options List */}
            <div className="space-y-2.5" role="radiogroup" aria-label={tSettings('selectLanguage')}>
              {[
                { code: 'id', name: tSettings('indonesian'), native: 'Bahasa Indonesia' },
                { code: 'en', name: tSettings('english'), native: 'English' },
              ].map((lang) => {
                const isActive = currentLocale === lang.code;

                return (
                  <button
                    key={lang.code}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    disabled={isUpdating}
                    onClick={() => handleSelectLanguage(lang.code)}
                    data-testid={`language-option-${lang.code}`}
                    className={`w-full p-4 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      isActive
                        ? 'border-app-primary bg-app-primary/5 ring-1 ring-app-primary/20'
                        : 'border-app-outline-variant/30 hover:border-app-primary/40 hover:bg-app-surface-container-low/40'
                    } disabled:opacity-60`}
                  >
                    <div className="flex items-center gap-3">
                      {isActive ? (
                        <CheckCircle2 size={20} className="text-app-primary flex-shrink-0" />
                      ) : (
                        <Circle size={20} className="text-app-outline flex-shrink-0" />
                      )}
                      <div>
                        <p className="text-[15px] font-semibold text-app-on-surface">{lang.name}</p>
                        <p className="text-[12px] text-app-on-surface-variant font-mono uppercase">
                          {lang.code} · {lang.native}
                        </p>
                      </div>
                    </div>

                    {isActive && (
                      <span className="text-[11px] font-bold text-app-primary bg-app-primary/10 px-2.5 py-1 rounded-full">
                        {tSettings('activeLanguage')}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-app-outline-variant/20">
              {isUpdating ? (
                <div className="flex items-center gap-2 text-xs text-app-primary font-medium">
                  <Loader2 size={16} className="animate-spin" />
                  <span>{tSettings('savingLanguage')}</span>
                </div>
              ) : (
                <div />
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isUpdating}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-app-on-surface-variant hover:bg-app-surface-container transition-colors disabled:opacity-50 cursor-pointer"
              >
                {tCommon('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
