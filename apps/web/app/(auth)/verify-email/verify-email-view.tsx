'use client';

import Link from 'next/link';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, CheckCircle, AlertCircle, Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface VerificationResponse {
  ok: boolean;
  status: number;
  data?: any;
  error?: { code?: string; message?: string };
}

// Module-level map of in-flight verification promises keyed by token (strictly in-flight only)
const inFlightVerifications = new Map<string, Promise<VerificationResponse>>();

export function _clearInFlightVerificationsForTesting() {
  inFlightVerifications.clear();
}

function verifyTokenWithDeduplication(token: string): Promise<VerificationResponse> {
  let existingPromise = inFlightVerifications.get(token);
  if (!existingPromise) {
    existingPromise = (async () => {
      try {
        const res = await fetch('/api/v1/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
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
        inFlightVerifications.delete(token);
      }
    })();
    inFlightVerifications.set(token, existingPromise);
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
  const token = searchParams.get('token');
  const emailParam = searchParams.get('email');

  const [state, setState] = useState<
    'idle' | 'loading' | 'success' | 'error' | 'instruction' | 'form'
  >('idle');
  const [activeEmail, setActiveEmail] = useState<string>(emailParam || '');
  const [inputEmail, setInputEmail] = useState<string>(emailParam || '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
    'idle'
  );
  const [submittingForm, setSubmittingForm] = useState(false);

  useEffect(() => {
    if (!token) {
      if (emailParam) {
        setActiveEmail(emailParam);
        setInputEmail(emailParam);
        setState('instruction');
      } else {
        setState('form');
      }
      return;
    }

    let isCurrentMount = true;
    setState('loading');

    verifyTokenWithDeduplication(token).then((result) => {
      if (!isCurrentMount) {
        // Component unmounted (e.g. StrictMode initial unmount or navigation away)
        return;
      }

      if (result.ok && result.data) {
        if (result.data.user?.accountStatus === 'PENDING_APPROVAL') {
          router.replace('/status?status=PENDING_APPROVAL');
          return;
        }
        setState('success');
      } else {
        setState('error');
        setErrorMessage(result.error?.message || tAuth('verifyEmailFailed'));
      }
    });

    return () => {
      isCurrentMount = false;
    };
  }, [token, emailParam]);

  const handleResend = async () => {
    if (!activeEmail) return;
    setResendStatus('loading');
    try {
      const res = await fetch('/api/v1/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: activeEmail.trim() }),
      });
      if (res.ok) {
        setResendStatus('success');
      } else {
        setResendStatus('error');
      }
    } catch {
      setResendStatus('error');
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmed = inputEmail.trim();
    if (!trimmed) {
      setFormError(tValidation('required', { fallback: 'This field is required' }));
      return;
    }

    try {
      setSubmittingForm(true);
      const res = await fetch('/api/v1/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });

      if (res.ok) {
        setActiveEmail(trimmed);
        setResendStatus('idle');
        setState('instruction');
      } else {
        setFormError(
          tAuth('resendFailed', {
            fallback: 'Failed to send verification email. Please try again.',
          })
        );
      }
    } catch {
      setFormError(tErrors('networkError', { fallback: 'Network error. Please try again.' }));
    } finally {
      setSubmittingForm(false);
    }
  };

  // State: Form (direct email input)
  if (state === 'form') {
    return (
      <div className="flex flex-col items-center">
        <header className="mb-6 text-center">
          <h2 className="text-[24px] leading-[32px] font-bold text-primary mb-2">
            {tAuth('verifyEmailHeading', { fallback: 'Email Verification' })}
          </h2>
          <p className="text-[16px] leading-[24px] text-on-surface-variant">
            {tAuth('verifyEmailPrompt', {
              fallback: 'Enter your email address to receive a verification link.',
            })}
          </p>
        </header>

        {formError && (
          <div className="w-full mb-6 p-3.5 bg-error-container/20 border border-error/30 rounded-xl text-error text-[14px] leading-[20px] flex items-start gap-2.5">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form className="w-full space-y-6" onSubmit={handleFormSubmit}>
          <div className="space-y-2">
            <label
              className="text-[14px] leading-[20px] font-semibold tracking-[0.05em] text-on-surface-variant uppercase block"
              htmlFor="verify-email-input"
            >
              {tAuth('email')}
            </label>
            <div className="relative group">
              <Mail
                size={20}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-secondary transition-colors"
              />
              <input
                className="w-full h-[56px] pl-12 pr-4 bg-surface border border-outline rounded-xl text-[18px] leading-[28px] text-on-surface focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/10 transition-all"
                id="verify-email-input"
                placeholder={tAuth('emailPlaceholder', { fallback: 'Enter your email address' })}
                type="email"
                value={inputEmail}
                onChange={(e) => setInputEmail(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <button
            className="w-full h-[56px] bg-primary text-on-primary rounded-xl text-[18px] leading-[24px] font-semibold hover:bg-primary-container hover:text-on-primary-container transition-all active:scale-[0.98] duration-100 shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            type="submit"
            disabled={submittingForm}
          >
            {submittingForm ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>{tCommon('processing')}</span>
              </>
            ) : (
              tAuth('sendVerificationLink', { fallback: 'Send Verification Link' })
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/login" className="text-primary hover:underline text-sm font-semibold">
            {tAuth('backToLogin')}
          </Link>
        </div>
      </div>
    );
  }

  // State: Instruction (check email & resend button)
  if (state === 'instruction') {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
          <CheckCircle size={32} />
        </div>
        <h2 className="text-[22px] font-bold text-on-surface mb-2">
          {tAuth('checkYourEmail', { fallback: 'Check your email' })}
        </h2>
        <p className="text-[16px] text-on-surface-variant mb-6">
          {tAuth('verifyEmailInstruction', {
            fallback: 'We sent a verification link to',
          })}{' '}
          <span className="font-semibold text-on-surface">{activeEmail}</span>
        </p>

        <button
          onClick={handleResend}
          disabled={resendStatus === 'loading'}
          className="h-[48px] px-8 bg-surface-container border border-outline-variant text-on-surface rounded-xl font-semibold flex items-center justify-center transition-all hover:bg-surface-container-high shadow-sm w-full disabled:opacity-60 disabled:cursor-not-allowed mb-3 cursor-pointer"
        >
          {resendStatus === 'loading' ? <Loader2 className="animate-spin mr-2" size={20} /> : null}
          {resendStatus === 'success'
            ? tAuth('resendSuccess', { fallback: 'Email sent!' })
            : tAuth('resendEmail', { fallback: 'Resend Verification Email' })}
        </button>

        {resendStatus === 'error' && (
          <p className="text-error text-sm mb-3">
            {tAuth('resendFailed', { fallback: 'Failed to resend. Please try again.' })}
          </p>
        )}

        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setState('form');
          }}
          className="text-on-surface-variant hover:text-primary text-sm font-medium mb-4 underline cursor-pointer"
        >
          {tAuth('useDifferentEmail', { fallback: 'Use a different email address' })}
        </button>

        <Link href="/login" className="text-primary hover:underline text-sm font-semibold">
          {tAuth('backToLogin')}
        </Link>
      </div>
    );
  }

  // State: Loading (token verification in progress)
  if (state === 'loading' || state === 'idle') {
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

  // State: Success
  if (state === 'success') {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
          <CheckCircle size={32} />
        </div>
        <h2 className="text-[22px] font-bold text-on-surface mb-2">
          {tAuth('verifyEmailSuccess', { fallback: 'Email verified successfully!' })}
        </h2>
        <p className="text-[16px] text-on-surface-variant mb-6">
          {tAuth('verifyEmailSuccessDesc', {
            fallback:
              'Your email address is now verified. You can now login or continue to the application.',
          })}
        </p>
        <Link
          href="/login"
          className="h-[48px] px-8 bg-primary text-on-primary rounded-xl font-semibold flex items-center justify-center transition-all hover:brightness-110 shadow-md w-full"
        >
          {tAuth('goToLogin')}
        </Link>
      </div>
    );
  }

  // State: Error (token verification failed)
  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center text-error mb-4">
        <AlertCircle size={32} />
      </div>
      <h2 className="text-[20px] font-bold text-on-surface mb-2">
        {errorMessage || tAuth('verifyEmailFailed')}
      </h2>
      <p className="text-[16px] text-on-surface-variant mb-6">
        {tAuth('verifyEmailFailedDesc', { fallback: 'The link might have expired or is invalid.' })}
      </p>

      <button
        type="button"
        onClick={() => {
          setFormError(null);
          setState('form');
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
