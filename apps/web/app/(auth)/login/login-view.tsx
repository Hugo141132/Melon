'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle,
  ShieldAlert,
  KeyRound,
  RefreshCw,
  X,
} from 'lucide-react';
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
  const [canRecover, setCanRecover] = useState(false);
  const messageParam = searchParams.get('message');
  const [successMessage] = useState(
    messageParam === 'PASSWORD_CHANGED' ? tAuth('passwordChangedSuccess') : ''
  );

  // Session Recovery Modal State
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<'confirm' | 'otp'>('confirm');
  const [recoveryChallengeId, setRecoveryChallengeId] = useState<string | null>(null);
  const [recoveryMaskedEmail, setRecoveryMaskedEmail] = useState('');
  const [recoveryOtp, setRecoveryOtp] = useState('');
  const [recoveryCountdown, setRecoveryCountdown] = useState(0);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoverySuccess, setRecoverySuccess] = useState(false);

  // Countdown timer for 60-second OTP expiration
  useEffect(() => {
    if (recoveryCountdown <= 0) return;
    const interval = setInterval(() => {
      setRecoveryCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [recoveryCountdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setCanRecover(false);

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
          setErrorMessage(tAuth('sessionRecoveryPrompt'));
          setCanRecover(true);
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

  const handleRequestRecoveryOtp = async () => {
    setRecoveryError(null);
    setRecoveryLoading(true);
    try {
      const res = await fetch('/api/v1/auth/session-recovery/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setRecoveryError(json.error?.message || tAuth('recoveryFailed'));
        setRecoveryLoading(false);
        return;
      }

      setRecoveryChallengeId(json.data.challengeId);
      setRecoveryMaskedEmail(json.data.maskedEmail);
      setRecoveryCountdown(json.data.expiresInSeconds || 60);
      setRecoveryStep('otp');
      setRecoveryOtp('');
      setRecoveryLoading(false);
      setShowRecoveryModal(true);
    } catch {
      setRecoveryError(tErrors('networkError'));
      setRecoveryLoading(false);
    }
  };

  const handleVerifyRecoveryOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryChallengeId || !recoveryOtp.trim()) return;

    setRecoveryError(null);
    setRecoveryLoading(true);
    try {
      const res = await fetch('/api/v1/auth/session-recovery/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: recoveryChallengeId,
          otp: recoveryOtp.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setRecoveryError(json.error?.message || tAuth('recoveryFailed'));
        setRecoveryLoading(false);
        return;
      }

      setRecoverySuccess(true);
      setRecoveryLoading(false);

      if (setUser && json.data?.user) {
        setUser({
          id: json.data.user.id,
          fullName: json.data.user.fullName,
          email: json.data.user.email,
          accountStatus: json.data.user.accountStatus,
          activeRoles: json.data.user.activeRoles || [json.data.user.role],
        });
      }

      setTimeout(() => {
        setShowRecoveryModal(false);
        router.push(redirectPath);
      }, 600);
    } catch {
      setRecoveryError(tErrors('networkError'));
      setRecoveryLoading(false);
    }
  };

  const closeRecoveryModal = () => {
    setShowRecoveryModal(false);
    setRecoveryStep('confirm');
    setRecoveryChallengeId(null);
    setRecoveryOtp('');
    setRecoveryError(null);
    setRecoveryLoading(false);
  };

  return (
    <>
      <form className="space-y-5" onSubmit={handleSubmit}>
        {successMessage && (
          <div className="p-3.5 bg-primary/10 border border-primary/30 rounded-xl text-primary text-[14px] leading-[20px] flex items-start gap-2.5">
            <CheckCircle size={18} className="mt-0.5 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3.5 bg-error-container/20 border border-error/30 rounded-xl text-error text-[14px] leading-[20px] flex flex-col gap-2">
            <div className="flex items-start gap-2.5">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            {canRecover && (
              <div className="pt-2 border-t border-error/20 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setRecoveryStep('confirm');
                    setRecoveryError(null);
                    setShowRecoveryModal(true);
                  }}
                  className="px-3 py-1.5 bg-primary text-on-primary text-[13px] font-semibold rounded-lg hover:bg-primary-container transition-all active:scale-95 shrink-0 cursor-pointer"
                >
                  {tAuth('sendRecoveryCode')}
                </button>
              </div>
            )}
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

      {/* Session Recovery Modal */}
      {showRecoveryModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        >
          <div className="w-full max-w-md bg-surface-container-lowest rounded-2xl border border-outline-variant/60 p-6 md:p-8 shadow-2xl relative">
            {/* Close Button */}
            <button
              type="button"
              onClick={closeRecoveryModal}
              disabled={recoveryLoading}
              className="absolute right-4 top-4 text-outline hover:text-on-surface p-1 rounded-lg transition-colors cursor-pointer"
              aria-label={tCommon('cancel')}
            >
              <X size={20} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <ShieldAlert size={22} />
              </div>
              <div>
                <h2 className="text-[18px] font-bold text-on-surface leading-tight">
                  {tAuth('sessionRecoveryTitle')}
                </h2>
                <p className="text-[13px] text-on-surface-variant">
                  {recoveryStep === 'confirm'
                    ? tAuth('sessionRecoveryPrompt')
                    : tAuth('sessionRecoverySubtitle')}
                </p>
              </div>
            </div>

            {/* Recovery Error Message */}
            {recoveryError && (
              <div
                role="alert"
                className="mb-4 p-3 bg-error-container/20 border border-error/30 rounded-xl text-error text-[13px] leading-[18px] flex items-start gap-2"
              >
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{recoveryError}</span>
              </div>
            )}

            {/* Recovery Success Message */}
            {recoverySuccess && (
              <div
                role="status"
                className="mb-4 p-3 bg-primary/10 border border-primary/30 rounded-xl text-primary text-[13px] leading-[18px] flex items-start gap-2"
              >
                <CheckCircle size={16} className="mt-0.5 shrink-0" />
                <span>{tAuth('recoverySuccess')}</span>
              </div>
            )}

            {recoveryStep === 'confirm' ? (
              <div className="space-y-4">
                <div className="p-3.5 bg-surface-container-low border border-outline-variant/60 rounded-xl text-[13px] text-on-surface-variant leading-[20px]">
                  Melon Governance enforces strict single active session security. Initiating
                  recovery will send a single-use 6-digit verification code to your registered email
                  to authorize terminating the previous active session.
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeRecoveryModal}
                    disabled={recoveryLoading}
                    className="flex-1 h-[48px] border border-outline-variant text-on-surface font-semibold rounded-xl text-[14px] hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {tCommon('cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleRequestRecoveryOtp}
                    disabled={recoveryLoading}
                    className="flex-1 h-[48px] bg-primary text-on-primary font-semibold rounded-xl text-[14px] hover:bg-primary-container transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {recoveryLoading ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>{tCommon('processing')}</span>
                      </>
                    ) : (
                      <span>{tAuth('sendRecoveryCode')}</span>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleVerifyRecoveryOtp} className="space-y-4">
                <div className="p-3 bg-surface-container-low border border-outline-variant/60 rounded-xl flex items-center justify-between text-[13px]">
                  <span className="text-on-surface-variant truncate">
                    {tAuth('codeSentTo', { email: recoveryMaskedEmail })}
                  </span>
                  <span className="font-mono font-semibold text-primary shrink-0 ml-2">
                    {recoveryCountdown > 0 ? `${recoveryCountdown}s` : '0s'}
                  </span>
                </div>

                <div>
                  <label
                    className="text-[13px] font-semibold text-on-surface mb-1.5 block tracking-wide uppercase"
                    htmlFor="recovery-otp-input"
                  >
                    {tAuth('verificationCode')}
                  </label>
                  <div className="relative group">
                    <KeyRound
                      size={18}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors"
                    />
                    <input
                      id="recovery-otp-input"
                      name="recoveryOtp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]*"
                      maxLength={6}
                      required
                      autoFocus
                      value={recoveryOtp}
                      onChange={(e) => setRecoveryOtp(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="000000"
                      className="w-full h-[52px] pl-12 pr-4 bg-surface border border-outline-variant rounded-xl text-[20px] tracking-[6px] font-mono text-on-surface transition-all focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                  </div>
                  <p className="text-[12px] text-on-surface-variant mt-1.5">
                    {tAuth('recoveryCodeExpiryNotice')}
                  </p>
                </div>

                <div className="pt-2 flex flex-col gap-2.5">
                  <button
                    type="submit"
                    disabled={
                      recoveryLoading || recoveryOtp.trim().length !== 6 || recoveryCountdown === 0
                    }
                    className="w-full h-[48px] bg-primary text-on-primary font-semibold rounded-xl text-[14px] hover:bg-primary-container transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {recoveryLoading ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>{tCommon('processing')}</span>
                      </>
                    ) : (
                      <span>{tAuth('confirmAndRecoverSession')}</span>
                    )}
                  </button>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={closeRecoveryModal}
                      disabled={recoveryLoading}
                      className="text-[13px] text-on-surface-variant hover:text-on-surface hover:underline cursor-pointer"
                    >
                      {tCommon('cancel')}
                    </button>

                    <button
                      type="button"
                      onClick={handleRequestRecoveryOtp}
                      disabled={recoveryLoading || recoveryCountdown > 0}
                      className="text-[13px] text-primary font-semibold hover:underline flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <RefreshCw size={14} className={recoveryLoading ? 'animate-spin' : ''} />
                      <span>
                        {recoveryCountdown > 0
                          ? tAuth('resendCodeWithTimer', { time: `${recoveryCountdown}s` })
                          : tAuth('resendCode')}
                      </span>
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
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
              alt="Melon"
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
