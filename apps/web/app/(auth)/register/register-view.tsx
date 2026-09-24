'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Loader2,
  AlertCircle,
  Crown,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

function PasswordStrengthMeter({ password }: { password: string }) {
  const getStrength = (val: string): number => {
    let strength = 0;
    if (val.length >= 12) strength++;
    if (/[A-Z]/.test(val)) strength++;
    if (/[a-z]/.test(val)) strength++;
    if (/[0-9]/.test(val) && /[^A-Za-z0-9]/.test(val)) strength++;
    return strength;
  };

  const strength = getStrength(password);
  const colors = ['', 'bg-error', 'bg-tertiary', 'bg-secondary', 'bg-primary'];

  return (
    <div className="flex gap-1 mt-1">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= strength ? colors[strength] : 'bg-surface-container'}`}
        />
      ))}
    </div>
  );
}

export default function RegisterView() {
  const router = useRouter();

  const tAuth = useTranslations('auth');
  const tCommon = useTranslations('common');
  const tValidation = useTranslations('validation');
  const tUsers = useTranslations('users');
  const tAccessibility = useTranslations('accessibility');
  const tErrors = useTranslations('errors');

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedRole, setSelectedRole] = useState<'OWNER' | 'ADMIN'>('ADMIN');

  const [ownerAvailable, setOwnerAvailable] = useState<boolean>(false);
  const [loadingCapabilities, setLoadingCapabilities] = useState<boolean>(true);

  const [showPassword, setShowPassword] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
  });

  useEffect(() => {
    let isMounted = true;
    const checkCapabilities = async () => {
      setLoadingCapabilities(true);
      try {
        const res = await fetch('/api/v1/auth/register/capabilities');
        const json = await res.json().catch(() => null);
        if (isMounted && res.ok && json?.success) {
          setOwnerAvailable(json.data.ownerRegistrationAvailable);
        }
      } catch {
        if (isMounted) {
          setOwnerAvailable(false);
        }
      } finally {
        if (isMounted) {
          setLoadingCapabilities(false);
        }
      }
    };

    checkCapabilities();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!formData.fullName.trim() || !formData.email.trim() || !formData.password) {
      setErrorMessage(tValidation('allFieldsRequired'));
      return;
    }

    try {
      setLoadingSubmit(true);
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.fullName.trim(),
          email: formData.email.trim(),
          password: formData.password,
          role: selectedRole,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        if (json?.error?.code === 'OWNER_ALREADY_EXISTS') {
          setErrorMessage(tAuth('ownerExistsError'));
          setOwnerAvailable(false);
          setSelectedRole('ADMIN');
          setStep(1);
        } else {
          setErrorMessage(json?.error?.message || tAuth('registerFailed'));
        }
        setLoadingSubmit(false);
        return;
      }

      // Registration successful. Both OWNER and ADMIN need to verify their email.
      router.push(`/verify-email?email=${encodeURIComponent(formData.email.trim())}`);
    } catch {
      setErrorMessage(tErrors('networkError'));
      setLoadingSubmit(false);
    }
  };

  return (
    <div className="bg-background text-on-background min-h-dvh flex flex-col justify-center items-center px-4 py-8 sm:p-6 md:p-8">
      <div className="w-full max-w-[480px] bg-surface-container-lowest rounded-2xl border border-outline-variant/60 shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden">
        {/* Unified Integrated Header & Logo Area */}
        <header className="px-6 sm:px-8 pt-6 pb-4 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container-lowest">
          <div className="flex items-center gap-3">
            {step === 2 ? (
              <button
                onClick={() => {
                  setErrorMessage('');
                  setStep(1);
                }}
                type="button"
                className="text-on-surface hover:text-primary hover:bg-surface-container-low p-2 rounded-xl transition-colors cursor-pointer"
                aria-label={tAccessibility('backToRole')}
              >
                <ArrowLeft size={20} />
              </button>
            ) : (
              <Link
                href="/login"
                className="text-on-surface hover:text-primary hover:bg-surface-container-low p-2 rounded-xl transition-colors cursor-pointer"
                aria-label={tAccessibility('backToRole')}
              >
                <ArrowLeft size={20} />
              </Link>
            )}
            <div>
              <h1 className="text-[18px] sm:text-[20px] font-bold text-on-surface leading-tight">
                {tAuth('registerTitle')}
              </h1>
              <span className="text-[12px] font-semibold text-secondary uppercase tracking-wider block">
                {step === 1
                  ? tAuth('step1Of2')
                  : tAuth('step2Of2', {
                      role: selectedRole === 'OWNER' ? 'PEMILIK (OWNER)' : 'ADMINISTRATOR',
                    })}
              </span>
            </div>
          </div>

          <div className="shrink-0 pl-2">
            <Image
              src="/logo1.webp"
              alt="Melon"
              width={120}
              height={30}
              className="h-7 w-auto object-contain"
              style={{ width: 'auto' }}
              priority
              unoptimized
            />
          </div>
        </header>

        <main className="p-6 sm:p-8 bg-surface-container-lowest">
          {step === 1 ? (
            /* Step 1: Choose Account Role */
            <section className="space-y-5">
              <div>
                <h2 className="text-[20px] sm:text-[22px] font-bold text-primary mb-1.5">
                  {tAuth('chooseRoleTitle')}
                </h2>
                <p className="text-[14px] leading-[22px] text-on-surface-variant">
                  {tAuth('chooseRoleSubtitle')}
                </p>
              </div>

              {loadingCapabilities ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-on-surface-variant">
                  <Loader2 size={24} className="animate-spin text-primary" />
                  <span className="text-[14px]">{tAuth('checkingCapabilities')}</span>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {/* Option 1: OWNER */}
                  <button
                    type="button"
                    disabled={!ownerAvailable}
                    onClick={() => {
                      if (ownerAvailable) {
                        setSelectedRole('OWNER');
                      }
                    }}
                    className={`w-full text-left p-4 sm:p-5 rounded-xl border transition-all flex items-start gap-4 ${
                      !ownerAvailable
                        ? 'bg-surface-container-low/50 border-outline-variant/30 opacity-60 cursor-not-allowed'
                        : selectedRole === 'OWNER'
                          ? 'bg-primary/[0.03] border-2 border-primary shadow-sm'
                          : 'bg-surface-container-lowest border-outline-variant/60 hover:border-outline hover:bg-surface-container-low/30 cursor-pointer'
                    }`}
                    aria-disabled={!ownerAvailable}
                  >
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                        !ownerAvailable
                          ? 'bg-outline-variant/30 text-on-surface-variant'
                          : selectedRole === 'OWNER'
                            ? 'bg-primary/10 text-primary'
                            : 'bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      <Crown size={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[16px] sm:text-[17px] font-bold text-on-surface">
                          {tUsers('ownerRole')}
                        </h3>
                        {selectedRole === 'OWNER' && ownerAvailable && (
                          <CheckCircle2 size={18} className="text-primary shrink-0 ml-2" />
                        )}
                      </div>
                      <p className="text-[13px] leading-[19px] text-on-surface-variant mt-0.5">
                        {tAuth('firstOwnerDesc')}
                      </p>
                      {!ownerAvailable && (
                        <p className="text-[12px] leading-[16px] font-medium text-error mt-2 bg-error-container/20 p-2 rounded-lg border border-error/20">
                          {tAuth('ownerAlreadyExists')}
                        </p>
                      )}
                    </div>
                  </button>

                  {/* Option 2: ADMIN */}
                  <button
                    type="button"
                    onClick={() => setSelectedRole('ADMIN')}
                    className={`w-full text-left p-4 sm:p-5 rounded-xl border transition-all flex items-start gap-4 cursor-pointer ${
                      selectedRole === 'ADMIN'
                        ? 'bg-primary/[0.03] border-2 border-primary shadow-sm'
                        : 'bg-surface-container-lowest border-outline-variant/60 hover:border-outline hover:bg-surface-container-low/30'
                    }`}
                  >
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                        selectedRole === 'ADMIN'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      <ShieldCheck size={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[16px] sm:text-[17px] font-bold text-on-surface">
                          {tUsers('adminRole')}
                        </h3>
                        {selectedRole === 'ADMIN' && (
                          <CheckCircle2 size={18} className="text-primary shrink-0 ml-2" />
                        )}
                      </div>
                      <p className="text-[13px] leading-[19px] text-on-surface-variant mt-0.5">
                        {tAuth('adminRegistrationDesc')}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="w-full mt-3 h-[52px] bg-primary text-on-primary text-[16px] leading-[22px] font-semibold rounded-xl hover:bg-primary-container hover:text-on-primary-container active:scale-[0.99] transition-all shadow-sm flex items-center justify-center cursor-pointer"
                  >
                    {tAuth('continueToForm')}
                  </button>
                </div>
              )}
            </section>
          ) : (
            /* Step 2: Form Details */
            <section>
              <div className="mb-5">
                <h2 className="text-[20px] sm:text-[22px] font-bold text-primary mb-1.5">
                  {tAuth('fillRegistrationData')}
                </h2>
                <p className="text-[14px] leading-[22px] text-on-surface-variant">
                  {selectedRole === 'OWNER'
                    ? tAuth('firstOwnerDesc')
                    : tAuth('adminRegistrationDesc')}
                </p>
              </div>

              {errorMessage && (
                <div className="mb-5 p-3.5 bg-error-container/20 border border-error/30 rounded-xl text-error text-[14px] leading-[20px] flex items-start gap-2.5">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                {/* Full Name */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="reg-fullname"
                    className="text-[12px] leading-[16px] font-semibold tracking-wider text-on-surface-variant uppercase"
                  >
                    {tAuth('name')}
                  </label>
                  <div className="relative group">
                    <User
                      size={18}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors"
                    />
                    <input
                      type="text"
                      id="reg-fullname"
                      placeholder="Wahyu Pratama"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full h-[52px] pl-11 pr-4 border border-outline-variant/70 rounded-xl bg-surface-container-lowest focus:ring-1 focus:ring-primary focus:border-primary text-[15px] leading-[24px] outline-none transition-all text-on-surface placeholder:text-outline/60"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="reg-email"
                    className="text-[12px] leading-[16px] font-semibold tracking-wider text-on-surface-variant uppercase"
                  >
                    {tAuth('email')}
                  </label>
                  <div className="relative group">
                    <Mail
                      size={18}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors"
                    />
                    <input
                      type="email"
                      id="reg-email"
                      placeholder="Wahyu123@gmail.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full h-[52px] pl-11 pr-4 border border-outline-variant/70 rounded-xl bg-surface-container-lowest focus:ring-1 focus:ring-primary focus:border-primary text-[15px] leading-[24px] outline-none transition-all text-on-surface placeholder:text-outline/60"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="reg-password"
                    className="text-[12px] leading-[16px] font-semibold tracking-wider text-on-surface-variant uppercase"
                  >
                    {tAuth('password')}
                  </label>
                  <div className="relative group">
                    <Lock
                      size={18}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors"
                    />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="reg-password"
                      placeholder={tValidation('passwordPlaceholder')}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full h-[52px] pl-11 pr-11 border border-outline-variant/70 rounded-xl bg-surface-container-lowest focus:ring-1 focus:ring-primary focus:border-primary text-[15px] leading-[24px] outline-none transition-all text-on-surface placeholder:text-outline/60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-colors flex items-center justify-center w-8 h-8 cursor-pointer"
                      aria-label={showPassword ? tAuth('hidePassword') : tAuth('showPassword')}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <PasswordStrengthMeter password={formData.password} />
                  <p className="text-[12px] leading-[16px] font-medium text-on-surface-variant/80 italic">
                    {tValidation('passwordPolicyHint')}
                  </p>
                </div>

                {/* Submit */}
                <button
                  className="mt-2 h-[52px] bg-primary text-on-primary text-[16px] leading-[22px] font-semibold rounded-xl hover:bg-primary-container hover:text-on-primary-container active:scale-[0.99] transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  type="submit"
                  disabled={loadingSubmit}
                >
                  {loadingSubmit ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>{tCommon('processing')}</span>
                    </>
                  ) : selectedRole === 'OWNER' ? (
                    tAuth('registerAsOwner')
                  ) : (
                    tAuth('registerAsAdmin')
                  )}
                </button>
              </form>
            </section>
          )}

          {/* Integrated Footer with subtle border separator */}
          <footer className="mt-6 pt-5 border-t border-outline-variant/30 text-center">
            <p className="text-[14px] leading-[20px] text-on-surface-variant">
              {tAuth('alreadyHaveAccount')}{' '}
              <Link
                href="/login"
                className="text-primary font-bold hover:underline underline-offset-4"
              >
                {tAuth('loginButton')}
              </Link>
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
