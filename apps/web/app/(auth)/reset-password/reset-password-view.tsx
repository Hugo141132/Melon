'use client';

import Link from 'next/link';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Lock, Eye, EyeOff, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

function ResetPasswordForm() {
  const tAuth = useTranslations('auth');
  const tCommon = useTranslations('common');
  const searchParams = useSearchParams();

  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!token) {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center text-error mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-[20px] font-bold text-on-surface mb-2">
          {tAuth('invalidOrExpiredToken')}
        </h2>
        <p className="text-[16px] text-on-surface-variant mb-6">
          {tAuth('forgotPasswordSubtitle')}
        </p>
        <Link
          href="/forgot-password"
          className="h-[48px] px-6 bg-primary text-on-primary rounded-xl font-semibold flex items-center justify-center transition-all hover:brightness-110"
        >
          {tAuth('requestNewLink')}
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (newPassword !== confirmPassword) {
      setErrorMessage(tAuth('passwordMismatch'));
      return;
    }

    setState('loading');

    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          newPassword,
          newPasswordConfirmation: confirmPassword,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (res.ok) {
        setState('success');
      } else {
        setState('error');
        setErrorMessage(json?.error?.message || tAuth('resetPasswordFailed'));
      }
    } catch {
      setState('error');
      setErrorMessage(tAuth('resetPasswordFailed'));
    }
  };

  if (state === 'success') {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
          <CheckCircle size={32} />
        </div>
        <h2 className="text-[22px] font-bold text-on-surface mb-2">
          {tAuth('resetPasswordSuccess')}
        </h2>
        <p className="text-[16px] text-on-surface-variant mb-6">{tAuth('loginSubtitle')}</p>
        <Link
          href="/login"
          className="h-[48px] px-8 bg-primary text-on-primary rounded-xl font-semibold flex items-center justify-center transition-all hover:brightness-110 shadow-md"
        >
          {tAuth('goToLogin')}
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Typography */}
      <div className="mb-[32px]">
        <h1 className="text-[24px] leading-[32px] font-bold text-on-surface mb-[8px]">
          {tAuth('resetPasswordTitle')}
        </h1>
        <p className="text-[18px] leading-[28px] text-on-surface-variant">
          {tAuth('resetPasswordSubtitle')}
        </p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="mb-6 p-4 rounded-xl bg-error/10 border border-error/20 text-error text-[14px] leading-[20px]"
        >
          {errorMessage}
        </div>
      )}

      {/* Form */}
      <form className="flex flex-col gap-[24px]" onSubmit={handleSubmit}>
        {/* New Password Input */}
        <div className="flex flex-col gap-2">
          <label
            className="text-[14px] leading-[20px] font-semibold tracking-[0.05em] text-primary uppercase"
            htmlFor="newPassword"
          >
            {tAuth('newPassword')}
          </label>
          <div className="relative group">
            <Lock
              size={20}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors"
            />
            <input
              className="w-full h-[56px] pl-12 pr-12 bg-white border border-outline-variant rounded-xl text-[18px] leading-[28px] text-on-surface transition-all focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              id="newPassword"
              name="newPassword"
              required
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? tAuth('hidePassword') : tAuth('showPassword')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-colors"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        {/* Confirm Password Input */}
        <div className="flex flex-col gap-2">
          <label
            className="text-[14px] leading-[20px] font-semibold tracking-[0.05em] text-primary uppercase"
            htmlFor="confirmPassword"
          >
            {tAuth('confirmNewPassword')}
          </label>
          <div className="relative group">
            <Lock
              size={20}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors"
            />
            <input
              className="w-full h-[56px] pl-12 pr-12 bg-white border border-outline-variant rounded-xl text-[18px] leading-[28px] text-on-surface transition-all focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              id="confirmPassword"
              name="confirmPassword"
              required
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? tAuth('hidePassword') : tAuth('showPassword')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-colors"
            >
              {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        <button
          className="h-[56px] w-full bg-primary text-on-primary rounded-xl text-[20px] leading-[24px] font-semibold shadow-md hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 mt-2"
          type="submit"
          disabled={state === 'loading'}
        >
          {state === 'loading' ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              <span className="text-[16px]">{tCommon('processing')}</span>
            </>
          ) : (
            <span>{tAuth('resetPasswordButton')}</span>
          )}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordView() {
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
          <ResetPasswordForm />
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
