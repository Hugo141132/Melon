'use client';

import Link from 'next/link';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  AlertCircle,
  Mail,
  KeyRound,
  RefreshCw,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

interface VerificationResponse {
  ok: boolean;
  status: number;
  data?: any;
  error?: { code?: string; message?: string };
}

// Module-level map of in-flight verification promises keyed by token/code
const inFlightVerifications = new Map<string, Promise<VerificationResponse>>();

export function _clearInFlightVerificationsForTesting() {
  inFlightVerifications.clear();
}

function verifyWithDeduplication(payload: {
  email?: string;
  code?: string;
  token?: string;
}): Promise<VerificationResponse> {
  const key = payload.token || `${payload.email}:${payload.code}`;
  let existingPromise = inFlightVerifications.get(key);
  if (!existingPromise) {
    existingPromise = (async () => {
      try {
        const res = await fetch('/api/v1/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        return {
          ok: res.ok,
          status: res.status,
          data: json?.data,
          error: json?.error,
        };
      } catch (err: any) {
        return {
          ok: false,
          status: 0,
          error: { message: err?.message || 'Network error' },
        };
      } finally {
        inFlightVerifications.delete(key);
      }
    })();
    inFlightVerifications.set(key, existingPromise);
  }
  return existingPromise;
}

function VerifyEmailContent() {
  const router = useRouter();
  const tAuth = useTranslations('auth');
  const tCommon = useTranslations('common');
  const tValidation = useTranslations('validation');
  const tErrors = useTranslations('errors');
  const searchParams = useSearchParams();

  const tokenParam = searchParams.get('token');
  const emailParam = searchParams.get('email') || '';

  const [email, setEmail] = useState<string>(emailParam);
  const [isEditingEmail, setIsEditingEmail] = useState<boolean>(!emailParam && !tokenParam);
  const [code, setCode] = useState<string>('');

  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ accountStatus?: string } | null>(null);

  // Resend state & 60s cooldown timer
  const [resendStatus, setResendStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
    'idle'
  );
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

  // Initialize and tick cooldown timer
  useEffect(() => {
    const savedCooldown = sessionStorage.getItem('verify_email_cooldown');
    if (savedCooldown) {
      const remaining = Math.max(0, Math.ceil((parseInt(savedCooldown, 10) - Date.now()) / 1000));
      if (remaining > 0) {
        setCooldownSeconds(remaining);
      } else {
        sessionStorage.removeItem('verify_email_cooldown');
      }
    }
  }, []);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          sessionStorage.removeItem('verify_email_cooldown');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  // Backward compatibility: Auto-verify if legacy token is in URL
  useEffect(() => {
    if (!tokenParam) return;

    let isCurrentMount = true;
    setState('loading');

    verifyWithDeduplication({ token: tokenParam }).then((result) => {
      if (!isCurrentMount) return;

      if (result.ok && result.data) {
        if (result.data.user?.accountStatus === 'PENDING_APPROVAL') {
          router.replace('/status?status=PENDING_APPROVAL');
          return;
        }
        setSuccessInfo({ accountStatus: result.data.user?.accountStatus });
        setState('success');
      } else {
        setState('error');
        setErrorMessage(result.error?.message || tAuth('invalidOrExpiredCode'));
      }
    });

    return () => {
      isCurrentMount = false;
    };
  }, [tokenParam]);

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    const cleanCode = code.trim();

    if (!cleanEmail) {
      setErrorMessage(tValidation('required', { fallback: 'Email is required' }));
      setIsEditingEmail(true);
      return;
    }

    if (!cleanCode || cleanCode.length < 4) {
      setErrorMessage(
        tValidation('required', { fallback: 'Please enter a valid verification code.' })
      );
      return;
    }

    setState('loading');

    const result = await verifyWithDeduplication({
      email: cleanEmail,
      code: cleanCode,
    });

    if (result.ok && result.data) {
      if (result.data.user?.accountStatus === 'PENDING_APPROVAL') {
        router.replace('/status?status=PENDING_APPROVAL');
        return;
      }
      setSuccessInfo({ accountStatus: result.data.user?.accountStatus });
      setState('success');
    } else {
      setState('error');
      setErrorMessage(result.error?.message || tAuth('invalidOrExpiredCode'));
    }
  };

  const handleResendCode = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail || cooldownSeconds > 0 || resendStatus === 'loading') return;

    setResendStatus('loading');
    setResendMessage(null);

    try {
      const res = await fetch('/api/v1/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      if (res.ok) {
        setResendStatus('success');
        setResendMessage(tAuth('resendCodeSuccess'));
        const expiresAt = Date.now() + 60 * 1000;
        sessionStorage.setItem('verify_email_cooldown', expiresAt.toString());
        setCooldownSeconds(60);
      } else {
        setResendStatus('error');
        setResendMessage(tAuth('resendCodeFailed'));
      }
    } catch {
      setResendStatus('error');
      setResendMessage(tErrors('networkError', { fallback: 'Network error. Please try again.' }));
    }
  };

  // State: Token Auto-Verification Loading
  if (tokenParam && (state === 'loading' || state === 'idle')) {
    return (
      <div className="flex flex-col items-center justify-center p-8 gap-4 text-center">
        <Loader2 className="animate-spin text-primary" size={48} />
        <h2 className="text-[20px] font-bold text-on-surface">
          {tAuth('verifyingEmailTitle', { fallback: 'Verifying your email...' })}
        </h2>
        <p className="text-[16px] text-on-surface-variant">{tCommon('processing')}</p>
      </div>
    );
  }

  // State: Token Auto-Verification Error
  if (tokenParam && state === 'error') {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center text-error mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-[20px] font-bold text-on-surface mb-2">
          {errorMessage || tAuth('verifyEmailFailed')}
        </h2>
        <p className="text-[16px] text-on-surface-variant mb-6">
          {tAuth('verifyEmailFailedDesc', {
            fallback: 'The link might have expired or is invalid.',
          })}
        </p>

        <button
          type="button"
          onClick={() => {
            setErrorMessage(null);
            setState('idle');
            router.replace('/verify-email');
          }}
          className="h-[48px] px-8 bg-surface-container border border-outline-variant text-on-surface rounded-xl font-semibold flex items-center justify-center transition-all hover:bg-surface-container-high shadow-sm w-full mb-3 cursor-pointer"
        >
          {tAuth('requestNewLink', { fallback: 'Request New Link' })}
        </button>

        <Link href="/login" className="text-primary hover:underline text-sm font-semibold">
          {tAuth('backToLogin')}
        </Link>
      </div>
    );
  }

  // State: Success (both token and code flow)
  if (state === 'success') {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
          <CheckCircle size={32} />
        </div>
        <h2 className="text-[22px] font-bold text-on-surface mb-2">
          {tAuth('verifyEmailSuccess', { fallback: tAuth('verificationSuccess') })}
        </h2>
        <p className="text-[16px] text-on-surface-variant mb-6">
          {successInfo?.accountStatus === 'PENDING_APPROVAL'
            ? tAuth('pendingApprovalMessage')
            : tAuth('verifyEmailSuccessDesc', { fallback: tAuth('verificationSuccessSubtitle') })}
        </p>

        {successInfo?.accountStatus === 'PENDING_APPROVAL' ? (
          <Link
            href="/status?status=PENDING_APPROVAL"
            className="h-[48px] px-8 bg-primary text-on-primary rounded-xl font-semibold flex items-center justify-center transition-all hover:brightness-110 shadow-md w-full"
          >
            {tAuth('goToStatusPage')}
          </Link>
        ) : (
          <Link
            href="/login"
            className="h-[48px] px-8 bg-primary text-on-primary rounded-xl font-semibold flex items-center justify-center transition-all hover:brightness-110 shadow-md w-full"
          >
            {tAuth('goToLogin')}
          </Link>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Heading */}
      <div className="mb-[24px]">
        <h1 className="text-[24px] leading-[32px] font-bold text-on-surface mb-[8px]">
          {tAuth('enterVerificationCode')}
        </h1>
        <p className="text-[16px] leading-[24px] text-on-surface-variant">
          {tAuth('verificationCodeSubtitle')}
        </p>
      </div>

      {/* Target Email Banner / Switcher */}
      <div className="mb-6 p-4 rounded-xl bg-surface-container-low border border-outline-variant flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-on-surface-variant text-[14px]">
            <Mail size={16} className="text-primary shrink-0" />
            <span className="font-medium text-on-surface truncate max-w-[220px]">
              {email || tAuth('email')}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsEditingEmail(!isEditingEmail)}
            className="text-[13px] font-semibold text-primary hover:underline cursor-pointer"
          >
            {isEditingEmail ? tCommon('cancel') : tAuth('useDifferentEmail')}
          </button>
        </div>

        {isEditingEmail && (
          <div className="mt-2 pt-2 border-t border-outline-variant">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={tAuth('emailPlaceholder')}
              className="w-full h-[44px] px-3 bg-white border border-outline-variant rounded-lg text-[15px] text-on-surface focus:outline-none focus:border-primary"
            />
          </div>
        )}
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div
          role="alert"
          className="mb-6 p-4 rounded-xl bg-error/10 border border-error/20 text-error text-[14px] leading-[20px] flex items-start gap-2.5"
        >
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Resend Status Banner */}
      {resendMessage && (
        <div
          role="status"
          className={`mb-6 p-4 rounded-xl text-[14px] leading-[20px] flex items-start gap-2.5 ${
            resendStatus === 'success'
              ? 'bg-primary/10 border border-primary/20 text-primary'
              : 'bg-error/10 border border-error/20 text-error'
          }`}
        >
          {resendStatus === 'success' ? (
            <CheckCircle size={18} className="mt-0.5 shrink-0" />
          ) : (
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
          )}
          <span>{resendMessage}</span>
        </div>
      )}

      {/* 6-Digit Code Form */}
      <form className="flex flex-col gap-[20px]" onSubmit={handleVerifyCode}>
        <div className="flex flex-col gap-2">
          <label
            className="text-[14px] leading-[20px] font-semibold tracking-[0.05em] text-primary uppercase"
            htmlFor="verification-code-input"
          >
            {tAuth('verificationCode')}
          </label>
          <div className="relative group">
            <KeyRound
              size={20}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors"
            />
            <input
              id="verification-code-input"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={8}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="000000"
              className="w-full h-[56px] pl-12 pr-4 bg-white border border-outline-variant rounded-xl text-[22px] tracking-[6px] font-mono text-on-surface transition-all focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </div>
          <p className="text-[13px] text-on-surface-variant mt-1">{tAuth('codeExpiryNotice')}</p>
        </div>

        <button
          className="h-[56px] w-full bg-primary text-on-primary rounded-xl text-[18px] leading-[24px] font-semibold shadow-md hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 mt-2"
          type="submit"
          disabled={state === 'loading' || !code.trim()}
        >
          {state === 'loading' ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              <span className="text-[16px]">{tCommon('processing')}</span>
            </>
          ) : (
            <span>{tAuth('verifyCodeButton')}</span>
          )}
        </button>
      </form>

      {/* Resend Action with Cooldown */}
      <div className="mt-6 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={handleResendCode}
          disabled={cooldownSeconds > 0 || resendStatus === 'loading' || !email.trim()}
          className="h-[44px] px-6 bg-surface-container border border-outline-variant text-on-surface rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 transition-all hover:bg-surface-container-high w-full disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {resendStatus === 'loading' ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <RefreshCw size={16} className={cooldownSeconds > 0 ? '' : 'text-primary'} />
          )}
          <span>
            {cooldownSeconds > 0
              ? tAuth('resendCodeWithTimer', { time: `${cooldownSeconds}s` })
              : tAuth('resendCode')}
          </span>
        </button>

        <Link href="/login" className="text-primary hover:underline text-sm font-semibold mt-2">
          {tAuth('backToLogin')}
        </Link>
      </div>
    </>
  );
}

export default function VerifyEmailView() {
  const tAuth = useTranslations('auth');

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
        <span className="text-[24px] leading-[32px] font-bold text-primary">Kebun Melon</span>
        <div className="w-10" />
      </header>

      {/* Main */}
      <main className="w-full max-w-md px-[24px] flex flex-col pt-[32px] flex-grow">
        <Suspense
          fallback={
            <div className="flex justify-center p-8">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          }
        >
          <VerifyEmailContent />
        </Suspense>
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
