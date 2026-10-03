'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { Bell, ChevronRight, X, AlertTriangle, CheckCircle2 } from 'lucide-react';

export function SettingsNotificationPreferences() {
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');

  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch initial preference on mount
  useEffect(() => {
    let isMounted = true;
    async function loadPreferences() {
      try {
        setIsLoading(true);
        const res = await fetch('/api/v1/me/preferences');
        if (res.ok) {
          const json = await res.json();
          if (isMounted && json?.data?.emailAlertsEnabled !== undefined) {
            setEmailAlertsEnabled(json.data.emailAlertsEnabled);
          }
        }
      } catch (err) {
        // Fallback to default true
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadPreferences();
    return () => {
      isMounted = false;
    };
  }, []);

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

  const handleToggle = async () => {
    if (isUpdating) return;
    const targetState = !emailAlertsEnabled;

    try {
      setIsUpdating(true);
      setErrorMsg(null);

      const res = await fetch('/api/v1/me/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailAlertsEnabled: targetState }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message || tSettings('savePreferencesFailed'));
      }

      setEmailAlertsEnabled(targetState);
      setSuccessToast(true);
      setTimeout(() => setSuccessToast(false), 2500);
    } catch (err: any) {
      console.error('Failed to update email alert preference', err);
      setErrorMsg(err?.message || tSettings('savePreferencesFailed'));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <>
      {/* Settings Row Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={tSettings('notificationsTitle')}
        data-testid="settings-notifications-trigger"
        className="w-full text-left bg-app-surface-container-lowest p-5 rounded-xl soft-elevation border border-app-outline-variant/20 hover:bg-app-surface-container-low transition-colors flex items-center gap-4 group active:scale-[0.98] cursor-pointer"
      >
        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-amber-500/10 text-amber-600">
          <Bell size={22} />
        </div>
        <div className="flex-1">
          <h3 className="text-[16px] font-semibold text-app-on-surface">
            {tSettings('notificationsTitle')}
          </h3>
          <p className="text-[14px] text-app-on-surface-variant">
            {emailAlertsEnabled
              ? `${tSettings('emailAlertsLabel')}: ${tSettings('emailAlertsEnabled')}`
              : `${tSettings('emailAlertsLabel')}: ${tSettings('emailAlertsDisabled')}`}
          </p>
        </div>
        <ChevronRight
          size={20}
          className="text-app-outline group-hover:translate-x-1 transition-transform"
        />
      </button>

      {/* Modal Dialog */}
      {mounted && isOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="presentation"
              onClick={() => !isUpdating && setIsOpen(false)}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 animate-fade-in backdrop-blur-xs"
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="notification-modal-title"
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-app-surface-container-lowest rounded-2xl p-6 shadow-2xl border border-app-outline-variant/30 space-y-5 animate-scale-up"
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2
                      id="notification-modal-title"
                      className="text-xl font-bold text-app-on-surface"
                    >
                      {tSettings('notificationsTitle')}
                    </h2>
                    <p className="text-xs text-app-on-surface-variant mt-0.5">
                      {tSettings('notificationsSubtitle')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    disabled={isUpdating}
                    aria-label={tCommon('close')}
                    className="p-1 rounded-lg hover:bg-app-surface-container-low text-app-on-surface-variant hover:text-app-on-surface transition-colors disabled:opacity-50"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Error Message */}
                {errorMsg && (
                  <div
                    role="alert"
                    className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2 text-xs text-red-600 font-medium"
                  >
                    <AlertTriangle size={16} className="shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Success Feedback */}
                {successToast && (
                  <div
                    role="status"
                    className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-xs text-emerald-600 font-medium animate-fade-in"
                  >
                    <CheckCircle2 size={16} className="shrink-0" />
                    <span>{tSettings('preferencesSaved')}</span>
                  </div>
                )}

                {/* Notification Toggle Card */}
                <div className="p-4 bg-app-surface-container-low rounded-xl border border-app-outline-variant/20 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-sm font-semibold text-app-on-surface block">
                      {tSettings('emailAlertsLabel')}
                    </span>
                    <span className="text-xs text-app-on-surface-variant leading-relaxed block">
                      {tSettings('emailAlertsDesc')}
                    </span>
                  </div>

                  {/* Accessible Switch */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={emailAlertsEnabled}
                    disabled={isUpdating || isLoading}
                    onClick={handleToggle}
                    data-testid="email-alerts-toggle"
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-app-primary ${
                      emailAlertsEnabled ? 'bg-app-primary' : 'bg-app-outline-variant/40'
                    } disabled:opacity-50`}
                  >
                    <span className="sr-only">{tSettings('emailAlertsLabel')}</span>
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        emailAlertsEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Modal Footer */}
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    disabled={isUpdating}
                    className="px-4 py-2 text-sm font-medium rounded-xl bg-app-surface-container hover:bg-app-surface-container-high text-app-on-surface transition-colors disabled:opacity-50"
                  >
                    {tCommon('close')}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
