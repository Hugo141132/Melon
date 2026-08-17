'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/';

  const tAuth = useTranslations('auth');
  const tCommon = useTranslations('common');
  const tValidation = useTranslations('validation');
  const tErrors = useTranslations('errors');

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email || !password) {
      setErrorMessage(tValidation('emailAndPasswordRequired'));
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        if (json.error?.code === 'ACCOUNT_PENDING_APPROVAL') {
          router.push('/status');
          return;
        }
        setErrorMessage(json.error?.message || tAuth('loginFailed'));
        setLoading(false);
        return;
      }

      router.push(redirectPath);
      router.refresh();
    } catch {
      setErrorMessage(tErrors('networkError'));
      setLoading(false);
    }
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {errorMessage && (
        <div className="p-3.5 bg-error-container/20 border border-error/30 rounded-xl text-error text-[14px] leading-[20px] flex items-start gap-2.5">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Email */}
      <div className="space-y-2">
        <label
          className="text-[14px] leading-[20px] font-semibold tracking-[0.05em] text-on-surface-variant uppercase block"
          htmlFor="email"
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
            id="email"
            placeholder="Wahyu123@gmail.com"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>

      {/* Password */}
      <div className="space-y-2">
        <label
          className="text-[14px] leading-[20px] font-semibold tracking-[0.05em] text-on-surface-variant uppercase block"
          htmlFor="password"
        >
          {tAuth('password')}
        </label>
        <div className="relative group">
          <Lock
            size={20}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-secondary transition-colors"
          />
          <input
            className="w-full h-[56px] pl-12 pr-12 bg-surface border border-outline rounded-xl text-[18px] leading-[28px] text-on-surface focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/10 transition-all"
            id="password"
            placeholder="••••••••"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-secondary active:scale-90 transition-all cursor-pointer"
            onClick={() => setShowPassword(!showPassword)}
            type="button"
            aria-label={showPassword ? tAuth('hidePassword') : tAuth('showPassword')}
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
      </div>

      {/* Forgot password link */}
      <div className="flex items-center justify-end py-1">
        <Link
          href="/forgot-password"
          className="text-[14px] leading-[20px] font-semibold tracking-[0.05em] text-secondary hover:underline underline-offset-4 decoration-2"
        >
          {tAuth('forgotPassword')}
        </Link>
      </div>

      {/* Submit */}
      <div className="pt-2">
        <button
          className="w-full h-[56px] bg-primary text-on-primary rounded-xl text-[24px] leading-[32px] font-semibold hover:bg-primary-container hover:text-on-primary-container transition-all active:scale-[0.98] duration-100 shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          type="submit"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              <span className="text-[16px]">{tCommon('processing')}</span>
            </>
          ) : (
            tAuth('loginButton')
          )}
        </button>
      </div>
    </form>
  );
}

export default function LoginView() {
  const tAuth = useTranslations('auth');
  const tCommon = useTranslations('common');

  return (
    <div className="bg-surface text-on-surface min-h-dvh flex flex-col justify-center items-center p-[24px]">
      <main className="w-full max-w-md bg-surface-container-lowest bento-shape p-[32px] shadow-sm border border-outline-variant">
        {/* Header */}
        <header className="mb-[32px] text-center">
          <h1 className="text-[32px] leading-[40px] font-bold tracking-[-0.01em] text-primary mb-2 md:text-[32px] text-[24px]">
            {tAuth('loginHeading')}
          </h1>
          <p className="text-[16px] leading-[24px] text-on-surface-variant">
            {tAuth('loginSubtitle')}
          </p>
        </header>

        <Suspense fallback={<div className="text-center py-8">{tCommon('loading')}</div>}>
          <LoginForm />
        </Suspense>
      </main>

      {/* Footer */}
      <footer className="mt-[32px] text-center">
        <p className="text-[16px] leading-[24px] text-on-surface-variant">
          {tAuth('noAccount')}{' '}
          <Link href="/register" className="text-secondary font-bold hover:underline">
            {tAuth('registerLand')}
          </Link>
        </p>
      </footer>
    </div>
  );
}
