'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthContext';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/';
  const { setUser } = useAuth();

  const tAuth = useTranslations('auth');
  const tCommon = useTranslations('common');
  const tValidation = useTranslations('validation');
  const tErrors = useTranslations('errors');

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const messageParam = searchParams.get('message');
  const [successMessage] = useState(
    messageParam === 'PASSWORD_CHANGED' ? tAuth('passwordChangedSuccess') : ''
  );

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
        if (json.error?.code === 'EMAIL_NOT_VERIFIED') {
          router.push(`/verify-email?email=${encodeURIComponent(email.trim())}`);
          return;
        }
        if (json.error?.code === 'ACTIVE_SESSION_EXISTS') {
          setErrorMessage(tAuth('activeSessionExists'));
          setLoading(false);
          return;
        }
        setErrorMessage(json.error?.message || tAuth('loginFailed'));
        setLoading(false);
        return;
      }

      if (setUser && json.data?.user) {
        setUser({
          id: json.data.user.id,
          fullName: json.data.user.fullName,
          email: json.data.user.email,
          accountStatus: json.data.user.accountStatus,
          activeRoles: json.data.user.activeRoles || [json.data.user.role],
        });
      }

      router.push(redirectPath);
    } catch {
      setErrorMessage(tErrors('networkError'));
      setLoading(false);
    }
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {successMessage && (
        <div className="p-3.5 bg-primary/10 border border-primary/30 rounded-xl text-primary text-[14px] leading-[20px] flex items-start gap-2.5">
          <CheckCircle size={18} className="mt-0.5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-error-container/20 border border-error/30 rounded-xl text-error text-[14px] leading-[20px] flex items-start gap-2.5">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Email */}
      <div>
        <label className="text-[14px] font-semibold text-on-surface mb-1.5 block" htmlFor="email">
          {tAuth('email')}
        </label>
        <div className="relative group">
          <Mail
            size={20}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors"
          />
          <input
            className="w-full h-[56px] pl-12 pr-4 bg-surface border border-outline-variant hover:border-outline focus:border-primary rounded-xl text-[16px] text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-outline/60"
            id="email"
            placeholder="Wahyu123@gmail.com"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>

      {/* Password */}
      <div>
        <label
          className="text-[14px] font-semibold text-on-surface mb-1.5 block"
          htmlFor="password"
        >
          {tAuth('password')}
        </label>
        <div className="relative group">
          <Lock
            size={20}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors"
          />
          <input
            className="w-full h-[56px] pl-12 pr-12 bg-surface border border-outline-variant hover:border-outline focus:border-primary rounded-xl text-[16px] text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-outline/60"
            id="password"
            placeholder="••••••••"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-primary active:scale-95 transition-all p-1 cursor-pointer"
            onClick={() => setShowPassword(!showPassword)}
            type="button"
            aria-label={showPassword ? tAuth('hidePassword') : tAuth('showPassword')}
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
      </div>

      {/* Forgot password link */}
      <div className="flex items-center justify-end pt-0.5">
        <Link
          href="/forgot-password"
          className="text-[14px] font-medium text-primary hover:underline underline-offset-4"
        >
          {tAuth('forgotPassword')}
        </Link>
      </div>

      {/* Submit */}
      <div className="pt-2">
        <button
          className="w-full h-[56px] bg-primary text-on-primary rounded-xl text-[17px] font-semibold hover:bg-primary-container transition-all active:scale-[0.99] duration-150 shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          type="submit"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              <span className="text-[15px]">{tCommon('processing')}</span>
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
      <main className="w-full max-w-md bg-surface-container-lowest bento-shape p-[32px] md:p-[36px] shadow-sm border border-outline-variant/60 rounded-3xl">
        {/* Header */}
        <header className="mb-[28px] text-center">
          <div className="flex justify-center mb-4">
            <Image
              src="/logo1.webp"
              alt="Kebun Melon"
              width={240}
              height={48}
              className="h-9 w-auto object-contain"
              style={{ width: 'auto' }}
              priority
              unoptimized
            />
          </div>
          <h1 className="text-[28px] md:text-[32px] leading-[36px] md:leading-[40px] font-bold text-primary mb-1.5">
            {tAuth('loginHeading')}
          </h1>
          <p className="text-[15px] leading-[22px] text-on-surface-variant">
            {tAuth('loginSubtitle')}
          </p>
        </header>

        <Suspense fallback={<div className="text-center py-8">{tCommon('loading')}</div>}>
          <LoginForm />
        </Suspense>
      </main>

      {/* Footer */}
      <footer className="mt-[28px] text-center">
        <p className="text-[15px] leading-[22px] text-on-surface-variant">
          {tAuth('noAccount')}{' '}
          <Link
            href="/register"
            className="text-primary font-semibold hover:underline underline-offset-4"
          >
            {tAuth('registerLand')}
          </Link>
        </p>
      </footer>
    </div>
  );
}
