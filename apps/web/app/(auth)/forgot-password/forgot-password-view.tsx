'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Mail, Send, Loader2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

const STORAGE_KEY = 'kebun_melon_pw_reset_cooldown_until';
const STORAGE_KEY_EMAIL = 'kebun_melon_pw_reset_email';
const RESET_TOKEN_LIFETIME_SECONDS = 60; // 1:00 (60s) resend cooldown and reset window (TASK-0218)

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function ForgotPasswordView() {
  const tAuth = useTranslations('auth');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifyingStatus, setVerifyingStatus] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  // Initialize countdown and email from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY) : null;
      const storedEmail =
        typeof window !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY_EMAIL) : null;
      if (storedEmail && !email) {
        setEmail(storedEmail);
      }
      if (stored) {
        const until = parseInt(stored, 10);
        const diff = Math.max(0, Math.ceil((until - Date.now()) / 1000));
        if (diff > 0) {
          setRemainingSeconds(diff);
        } else {
          sessionStorage.removeItem(STORAGE_KEY);
          sessionStorage.removeItem(STORAGE_KEY_EMAIL);
        }
      }
    } catch {
      // Ignore sessionStorage access errors
    }
  }, []);

  // Interval timer for 15-minute countdown
  useEffect(() => {
    if (remainingSeconds <= 0) return;

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          try {
            sessionStorage.removeItem(STORAGE_KEY);
            sessionStorage.removeItem(STORAGE_KEY_EMAIL);
          } catch {}
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [remainingSeconds]);

  // Auto-dismiss success toast after 5 seconds
  useEffect(() => {
    if (!showNotification) return;

    const timer = setTimeout(() => {
      setShowNotification(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, [showNotification]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || loading || remainingSeconds > 0) return;
    setErrorMessage(null);
    setInfoMessage(null);
    setLoading(true);

    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim() }),
      });

      const json = await res.json().catch(() => ({}));

      if (res.ok) {
        const cooldownUntil = Date.now() + RESET_TOKEN_LIFETIME_SECONDS * 1000;
        try {
          sessionStorage.setItem(STORAGE_KEY, cooldownUntil.toString());
          sessionStorage.setItem(STORAGE_KEY_EMAIL, email.trim());
        } catch {}
        setRemainingSeconds(RESET_TOKEN_LIFETIME_SECONDS);
        setShowNotification(true);
      } else if (res.status === 404 || json?.error?.code === 'EMAIL_NOT_FOUND') {
        // DEC-AUTH-108: Clear user feedback for unregistered emails without triggering countdown
        setErrorMessage(tAuth('emailNotRegistered'));
      } else {
        setErrorMessage(json?.error?.message || tAuth('registerFailed'));
      }
    } catch {
      setErrorMessage(tAuth('registerFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyResetStatus = async () => {
    if (!email || verifyingStatus) return;
    setErrorMessage(null);
    setInfoMessage(null);
    setVerifyingStatus(true);

    try {
      const res = await fetch(
        `/api/v1/auth/forgot-password?email=${encodeURIComponent(email.trim())}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const json = await res.json().catch(() => ({}));

      if (res.ok && json.completed) {
        try {
          sessionStorage.removeItem(STORAGE_KEY);
          sessionStorage.removeItem(STORAGE_KEY_EMAIL);
        } catch {}
        // Immediately redirect user to login page after verified password reset completion
        router.push('/login?message=PASSWORD_RESET_COMPLETED');
      } else {
        setInfoMessage(tAuth('resetNotCompletedYet'));
      }
    } catch {
      setErrorMessage(tAuth('registerFailed'));
    } finally {
      setVerifyingStatus(false);
    }
  };

  const isCoolingDown = remainingSeconds > 0;

  return (
    <div className="bg-surface text-on-surface min-h-dvh flex flex-col items-center">
      {/* Top App Bar */}
      <header className="w-full top-0 sticky bg-surface border-b border-outline-variant z-50 flex items-center justify-between px-[24px] h-[56px]">
        <Link
          href="/login"
          aria-label={tAuth('backToLogin')}
          className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-surface-container-low transition-colors active:scale-95 duration-100 cursor-pointer"
        >
          <ArrowLeft size={22} className="text-primary" />
        </Link>
        <Image
          src="/logo1.webp"
          alt="Melon"
          width={140}
          height={28}
          className="h-7 w-auto object-contain"
          style={{ width: 'auto' }}
          priority
          unoptimized
        />
        <div className="w-10" />
      </header>

      {/* Main */}
      <main className="w-full max-w-md px-[24px] flex flex-col pt-[32px] flex-grow">
        {/* Typography */}
        <div className="mb-[32px]">
          <h1 className="text-[24px] leading-[32px] font-bold text-on-surface mb-[8px]">
            {tAuth('forgotPasswordTitle')}
          </h1>
          <p className="text-[18px] leading-[28px] text-on-surface-variant">
            {tAuth('forgotPasswordSubtitle')}
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mb-6 p-4 rounded-xl bg-error/10 border border-error/20 text-error text-[14px] leading-[20px] flex items-start gap-3"
          >
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {infoMessage && (
          <div
            role="status"
            className="mb-6 p-4 rounded-xl bg-primary/10 border border-primary/20 text-primary text-[14px] leading-[20px] flex items-start gap-3"
          >
            <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
            <span>{infoMessage}</span>
          </div>
        )}

        {/* Form */}
        <form className="flex flex-col gap-[32px]" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <label
              className="text-[14px] leading-[20px] font-semibold tracking-[0.05em] text-primary uppercase"
              htmlFor="email"
            >
              {tAuth('email')}
            </label>
            <div className="relative group">
              <Mail
                size={20}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors"
              />
              <input
                className="w-full h-[56px] pl-12 pr-4 bg-white border border-outline-variant rounded-xl text-[18px] leading-[28px] text-on-surface transition-all focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:bg-surface-container/40 disabled:text-on-surface-variant"
                id="email"
                name="email"
                placeholder={tAuth('emailPlaceholder')}
                required
                type="email"
                value={email}
                disabled={loading || isCoolingDown}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <button
            className="h-[56px] w-full bg-primary text-on-primary rounded-xl text-[20px] leading-[24px] font-semibold shadow-md hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            type="submit"
            disabled={loading || isCoolingDown}
          >
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span className="text-[16px]">{tCommon('processing')}</span>
              </>
            ) : isCoolingDown ? (
              <span className="text-[16px]">
                {tAuth('sendResetLinkWithTimer', { time: formatTime(remainingSeconds) })}
              </span>
            ) : (
              <>
                <span>{tAuth('sendResetLink')}</span>
                <Send size={18} />
              </>
            )}
          </button>

          {isCoolingDown && (
            <button
              className="h-[52px] w-full border-2 border-primary text-primary bg-transparent hover:bg-primary/5 active:scale-[0.98] rounded-xl text-[16px] font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 -mt-2"
              type="button"
              onClick={handleVerifyResetStatus}
              disabled={verifyingStatus}
            >
              {verifyingStatus ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>{tAuth('checkingResetStatus')}</span>
                </>
              ) : (
                <>
                  <RefreshCw size={18} />
                  <span>{tAuth('verifyResetStatus')}</span>
                </>
              )}
            </button>
          )}
        </form>

        {/* Auto-dismissing Toast notification */}
        {showNotification && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-on-surface text-surface px-6 py-3 rounded-full shadow-2xl text-[16px] z-[100] animate-slide-up">
            {tAuth('checkEmailInbox')}
          </div>
        )}
      </main>

      <footer className="w-full py-[16px] px-[24px] text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-8 h-[1px] bg-outline-variant" />
          <div className="w-8 h-[1px] bg-outline-variant" />
        </div>
      </footer>
    </div>
  );
}
