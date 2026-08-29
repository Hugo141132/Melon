'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, Mail, Eye, EyeOff, ArrowLeft, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface EmailChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newEmail: string) => void;
  currentEmail: string;
}

const COOLDOWN_STORAGE_KEY = 'email_change_resend_cooldown';

export function EmailChangeModal({
  isOpen,
  onClose,
  onSuccess,
  currentEmail,
}: EmailChangeModalProps) {
  const tProfile = useTranslations('profile');
  const tCommon = useTranslations('common');

  // Step state: 1 = Password + New Email; 2 = Enter 6-digit code
  const [step, setStep] = useState<1 | 2>(1);

  // Form states
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [code, setCode] = useState('');

  // UI status
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Initialize and tick resend cooldown timer from sessionStorage
  useEffect(() => {
    if (!isOpen) return;

    const storedCooldown = sessionStorage.getItem(COOLDOWN_STORAGE_KEY);
    if (storedCooldown) {
      const remaining = Math.max(0, Math.ceil((parseInt(storedCooldown, 10) - Date.now()) / 1000));
      setCooldown(remaining);
    }
  }, [isOpen]);

  useEffect(() => {
    if (cooldown <= 0) return;

    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          sessionStorage.removeItem(COOLDOWN_STORAGE_KEY);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldown]);

  const setResendCooldown = (seconds = 60) => {
    setCooldown(seconds);
    sessionStorage.setItem(COOLDOWN_STORAGE_KEY, String(Date.now() + seconds * 1000));
  };

  const handleResetModal = () => {
    setStep(1);
    setCurrentPassword('');
    setNewEmail('');
    setCode('');
    setErrorMsg(null);
    setLoading(false);
    setResending(false);
  };

  const handleClose = () => {
    if (loading || resending) return;
    handleResetModal();
    onClose();
  };

  if (!isOpen) return null;

  // Step 1: Request code
  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = newEmail.trim().toLowerCase();

    if (!currentPassword) {
      setErrorMsg(tProfile('currentPasswordRequired'));
      return;
    }
    if (!cleanEmail) {
      setErrorMsg(tProfile('newEmailRequired'));
      return;
    }
    if (cleanEmail === currentEmail.trim().toLowerCase()) {
      setErrorMsg(tProfile('sameEmailError'));
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/v1/me/email/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newEmail: cleanEmail }),
      });

      const json = await res.json().catch(() => ({}));

      if (res.ok && json.success) {
        setStep(2);
        setResendCooldown(60);
      } else {
        if (res.status === 401) {
          setErrorMsg(tProfile('invalidCurrentPassword'));
        } else if (res.status === 409) {
          setErrorMsg(tProfile('duplicateEmailError'));
        } else if (res.status === 429) {
          setErrorMsg(tProfile('tooManyRequests') || 'Too many requests. Please try again later.');
        } else {
          setErrorMsg(json.error?.message || tProfile('requestEmailChangeFailed'));
        }
      }
    } catch {
      setErrorMsg(tProfile('connectionError') || 'Network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Resend code
  const handleResendCode = async () => {
    if (cooldown > 0 || resending) return;
    const cleanEmail = newEmail.trim().toLowerCase();

    setResending(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/v1/me/email/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newEmail: cleanEmail }),
      });

      const json = await res.json().catch(() => ({}));

      if (res.ok && json.success) {
        setResendCooldown(60);
      } else {
        setErrorMsg(json.error?.message || tProfile('requestEmailChangeFailed'));
      }
    } catch {
      setErrorMsg(tProfile('connectionError') || 'Network error occurred. Please try again.');
    } finally {
      setResending(false);
    }
  };

  // Step 2: Verify code
  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim();

    if (!cleanCode) {
      setErrorMsg(tProfile('verificationCodeRequired'));
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/v1/me/email/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cleanCode }),
      });

      const json = await res.json().catch(() => ({}));

      if (res.ok && json.success) {
        sessionStorage.removeItem(COOLDOWN_STORAGE_KEY);
        const promotedEmail = json.data?.email || newEmail.trim().toLowerCase();
        onSuccess(promotedEmail);
        handleClose();
      } else {
        if (res.status === 409) {
          setErrorMsg(tProfile('duplicateEmailError'));
        } else if (res.status === 429) {
          setErrorMsg(tProfile('tooManyRequests') || 'Too many requests. Please try again later.');
        } else {
          setErrorMsg(json.error?.message || tProfile('invalidVerificationCode'));
        }
      }
    } catch {
      setErrorMsg(tProfile('connectionError') || 'Network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-app-surface-variant/80 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-slide-up flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-app-surface-container-low">
          <div className="flex items-center gap-3 text-app-on-surface">
            {step === 2 && (
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setErrorMsg(null);
                }}
                disabled={loading || resending}
                className="p-1 -ml-2 text-app-on-surface-variant hover:bg-app-surface-container rounded-full transition-colors disabled:opacity-50"
                aria-label={tCommon('back') || 'Back'}
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <div className="w-10 h-10 rounded-full bg-app-surface-container-low flex items-center justify-center text-app-primary">
              <Mail size={18} />
            </div>
            <h2 className="text-xl font-bold">{tProfile('changeEmailTitle')}</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading || resending}
            className="p-2 text-app-on-surface-variant hover:bg-app-surface-container rounded-full transition-colors disabled:opacity-50"
            aria-label={tCommon('close') || 'Close'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">
          {errorMsg && (
            <div className="mb-6 bg-app-error-container/20 border border-app-error text-app-error px-4 py-3 rounded-xl flex items-start gap-3 text-[14px] font-medium leading-tight">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {step === 1 ? (
            /* STEP 1: Enter current password and new email */
            <form onSubmit={handleRequestSubmit} className="space-y-5">
              <p className="text-sm text-app-on-surface-variant leading-relaxed">
                {tProfile('changeEmailSubtitle')}
              </p>

              {/* Current Password */}
              <div className="space-y-1.5">
                <label className="text-[14px] font-semibold text-app-on-surface-variant px-1 block">
                  {tProfile('currentPassword')}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    disabled={loading}
                    className="w-full h-[52px] pl-4 pr-12 bg-app-surface-container-lowest border-[1.5px] border-app-outline-variant rounded-xl focus:border-app-primary focus:ring-1 focus:ring-app-primary outline-none transition-all text-[16px]"
                    placeholder={tProfile('currentPasswordPlaceholder')}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-app-on-surface-variant hover:text-app-primary transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* New Email Address */}
              <div className="space-y-1.5">
                <label className="text-[14px] font-semibold text-app-on-surface-variant px-1 block">
                  {tProfile('newEmail')}
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  disabled={loading}
                  className="w-full h-[52px] px-4 bg-app-surface-container-lowest border-[1.5px] border-app-outline-variant rounded-xl focus:border-app-primary focus:ring-1 focus:ring-app-primary outline-none transition-all text-[16px]"
                  placeholder={tProfile('newEmailPlaceholder')}
                  required
                />
              </div>

              {/* Submit Button */}
              <div className="pt-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-[52px] bg-app-primary text-white rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-app-primary/20 cursor-pointer disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>{tCommon('loading')}</span>
                    </>
                  ) : (
                    <span>{tProfile('sendVerificationCode')}</span>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* STEP 2: Enter 6-digit verification code */
            <form onSubmit={handleVerifySubmit} className="space-y-5">
              <div className="text-center space-y-1">
                <p className="text-sm text-app-on-surface-variant">
                  {tProfile('enterVerificationCodePrompt')}
                </p>
                <p className="text-sm font-semibold text-app-primary break-all">
                  {newEmail.trim().toLowerCase()}
                </p>
              </div>

              {/* 6-digit Code Input */}
              <div className="space-y-1.5">
                <label className="text-[14px] font-semibold text-app-on-surface-variant px-1 block text-center">
                  {tProfile('verificationCode')}
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  disabled={loading}
                  autoFocus
                  className="w-full h-[56px] text-center text-2xl font-mono tracking-widest bg-app-surface-container-lowest border-[1.5px] border-app-outline-variant rounded-xl focus:border-app-primary focus:ring-1 focus:ring-app-primary outline-none transition-all font-bold text-app-primary"
                  placeholder="000000"
                  required
                />
              </div>

              {/* Resend button / timer */}
              <div className="text-center">
                {cooldown > 0 ? (
                  <p className="text-xs text-app-on-surface-variant">
                    {tProfile('resendCooldown', { seconds: cooldown })}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={resending || loading}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-app-primary hover:underline cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={resending ? 'animate-spin' : ''} />
                    <span>{tProfile('resendCode')}</span>
                  </button>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-3">
                <button
                  type="submit"
                  disabled={loading || code.length < 6}
                  className="w-full h-[52px] bg-app-primary text-white rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-app-primary/20 cursor-pointer disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>{tCommon('loading')}</span>
                    </>
                  ) : (
                    <span>{tProfile('verifyAndChangeEmail')}</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
