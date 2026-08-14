'use client';

import Link from 'next/link';
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

export default function RegisterPage() {
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
        const json = await res.json();
        if (isMounted && res.ok && json.success) {
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

      const json = await res.json();

      if (!res.ok || !json.success) {
        if (json.error?.code === 'OWNER_ALREADY_EXISTS') {
          setErrorMessage(tAuth('ownerExistsError'));
          setOwnerAvailable(false);
          setSelectedRole('ADMIN');
          setStep(1);
        } else {
          setErrorMessage(json.error?.message || tAuth('registerFailed'));
        }
        setLoadingSubmit(false);
        return;
      }

      if (json.data?.user?.accountStatus === 'ACTIVE') {
        router.push('/login?registered=owner');
      } else {
        router.push('/status?reason=PENDING_APPROVAL');
      }
    } catch {
      setErrorMessage(tErrors('networkError'));
      setLoadingSubmit(false);
    }
  };

  return (
    <div className="bg-background text-on-background min-h-dvh flex flex-col justify-center items-center p-[24px]">
      {/* TopAppBar */}
      <header className="w-full max-w-md top-0 sticky bg-background flex items-center justify-between h-[56px] mb-4">
        <div className="flex items-center gap-4">
          {step === 2 ? (
            <button
              onClick={() => {
                setErrorMessage('');
                setStep(1);
              }}
              type="button"
              className="text-primary hover:bg-surface-container-low transition-colors active:scale-95 duration-150 p-2 rounded-full cursor-pointer"
              aria-label={tAccessibility('backToRole')}
            >
              <ArrowLeft size={22} />
            </button>
          ) : (
            <Link
              href="/login"
              className="text-primary hover:bg-surface-container-low transition-colors active:scale-95 duration-150 p-2 rounded-full cursor-pointer"
            >
              <ArrowLeft size={22} />
            </Link>
          )}
          <h1 className="text-[24px] leading-[32px] font-semibold text-primary">
            {tAuth('registerTitle')}
          </h1>
        </div>
      </header>

      <main className="w-full max-w-md bg-surface-container-lowest bento-shape p-[32px] shadow-sm border border-outline-variant">
        {step === 1 ? (
          /* Step 1: Choose Account Role */
          <section className="space-y-6">
            <div>
              <span className="text-[12px] leading-[16px] font-bold text-secondary tracking-widest uppercase block mb-1">
                {tAuth('step1Of2')}
              </span>
              <h2 className="text-[24px] leading-[32px] font-bold text-primary mb-2">
                {tAuth('chooseRoleTitle')}
              </h2>
              <p className="text-[16px] leading-[24px] text-on-surface-variant">
                {tAuth('chooseRoleSubtitle')}
              </p>
            </div>

            {loadingCapabilities ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-on-surface-variant">
                <Loader2 size={24} className="animate-spin text-primary" />
                <span className="text-[14px]">{tAuth('checkingCapabilities')}</span>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Option 1: OWNER */}
                <button
                  type="button"
                  disabled={!ownerAvailable}
                  onClick={() => {
                    if (ownerAvailable) {
                      setSelectedRole('OWNER');
                    }
                  }}
                  className={`w-full text-left p-5 rounded-2xl border-2 transition-all flex items-start gap-4 ${
                    !ownerAvailable
                      ? 'bg-surface-container/50 border-outline-variant/40 opacity-60 cursor-not-allowed'
                      : selectedRole === 'OWNER'
                        ? 'bg-primary/5 border-primary shadow-sm'
                        : 'bg-surface border-outline/40 hover:border-outline cursor-pointer'
                  }`}
                  aria-disabled={!ownerAvailable}
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                      !ownerAvailable
                        ? 'bg-outline-variant/30 text-on-surface-variant'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    <Crown size={24} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[18px] font-bold text-on-surface">
                        {tUsers('ownerRole')} (Owner)
                      </h3>
                      {selectedRole === 'OWNER' && ownerAvailable && (
                        <CheckCircle2 size={20} className="text-primary" />
                      )}
                    </div>
                    <p className="text-[14px] leading-[20px] text-on-surface-variant mt-1">
                      {tAuth('firstOwnerDesc')}
                    </p>
                    {!ownerAvailable && (
                      <p className="text-[12px] leading-[16px] font-semibold text-error mt-2.5 bg-error-container/20 p-2 rounded-lg border border-error/20">
                        {tAuth('ownerAlreadyExists')}
                      </p>
                    )}
                  </div>
                </button>

                {/* Option 2: ADMIN */}
                <button
                  type="button"
                  onClick={() => setSelectedRole('ADMIN')}
                  className={`w-full text-left p-5 rounded-2xl border-2 transition-all flex items-start gap-4 cursor-pointer ${
                    selectedRole === 'ADMIN'
                      ? 'bg-primary/5 border-primary shadow-sm'
                      : 'bg-surface border-outline/40 hover:border-outline'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                    <ShieldCheck size={24} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[18px] font-bold text-on-surface">
                        {tUsers('adminRole')}
                      </h3>
                      {selectedRole === 'ADMIN' && (
                        <CheckCircle2 size={20} className="text-primary" />
                      )}
                    </div>
                    <p className="text-[14px] leading-[20px] text-on-surface-variant mt-1">
                      {tAuth('adminRegistrationDesc')}
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full mt-4 h-[56px] bg-primary text-on-primary text-[18px] leading-[24px] font-semibold rounded-xl hover:bg-primary-container hover:text-on-primary-container active:scale-[0.98] transition-all shadow-md flex items-center justify-center cursor-pointer"
                >
                  {tAuth('continueToForm')}
                </button>
              </div>
            )}
          </section>
        ) : (
          /* Step 2: Form Details */
          <section>
            <div className="mb-[24px]">
              <span className="text-[12px] leading-[16px] font-bold text-secondary tracking-widest uppercase block mb-1">
                {tAuth('step2Of2', {
                  role: selectedRole === 'OWNER' ? 'PEMILIK (OWNER)' : 'ADMINISTRATOR',
                })}
              </span>
              <h2 className="text-[24px] leading-[32px] font-bold text-primary mb-2">
                {tAuth('fillRegistrationData')}
              </h2>
              <p className="text-[16px] leading-[24px] text-on-surface-variant">
                {selectedRole === 'OWNER'
                  ? tAuth('firstOwnerDesc')
                  : tAuth('adminRegistrationDesc')}
              </p>
            </div>

            {errorMessage && (
              <div className="mb-6 p-3.5 bg-error-container/20 border border-error/30 rounded-xl text-error text-[14px] leading-[20px] flex items-start gap-2.5">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form className="flex flex-col gap-[16px]" onSubmit={handleSubmit}>
              {/* Full Name */}
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="reg-fullname"
                  className="text-[14px] leading-[20px] font-semibold tracking-[0.05em] text-on-surface-variant uppercase"
                >
                  {tAuth('name')}
                </label>
                <div className="relative group">
                  <User
                    size={20}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-secondary transition-colors"
                  />
                  <input
                    type="text"
                    id="reg-fullname"
                    placeholder="Wahyu Pratama"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full h-[56px] pl-12 pr-4 border border-outline rounded-xl bg-surface focus:ring-2 focus:ring-secondary/10 focus:border-secondary text-[18px] leading-[28px] outline-none transition-all text-on-surface"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="reg-email"
                  className="text-[14px] leading-[20px] font-semibold tracking-[0.05em] text-on-surface-variant uppercase"
                >
                  {tAuth('email')}
                </label>
                <div className="relative group">
                  <Mail
                    size={20}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-secondary transition-colors"
                  />
                  <input
                    type="email"
                    id="reg-email"
                    placeholder="Wahyu123@gmail.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full h-[56px] pl-12 pr-4 border border-outline rounded-xl bg-surface focus:ring-2 focus:ring-secondary/10 focus:border-secondary text-[18px] leading-[28px] outline-none transition-all text-on-surface"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="reg-password"
                  className="text-[14px] leading-[20px] font-semibold tracking-[0.05em] text-on-surface-variant uppercase"
                >
                  {tAuth('password')}
                </label>
                <div className="relative group">
                  <Lock
                    size={20}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-secondary transition-colors"
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="reg-password"
                    placeholder={tValidation('passwordPlaceholder')}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full h-[56px] pl-12 pr-12 border border-outline rounded-xl bg-surface focus:ring-2 focus:ring-secondary/10 focus:border-secondary text-[18px] leading-[28px] outline-none transition-all text-on-surface"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-secondary transition-colors flex items-center justify-center w-10 h-10 cursor-pointer"
                    aria-label={showPassword ? tAuth('hidePassword') : tAuth('showPassword')}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <PasswordStrengthMeter password={formData.password} />
                <p className="text-[12px] leading-[16px] font-medium text-on-surface-variant italic">
                  {tValidation('passwordPolicyHint')}
                </p>
              </div>

              {/* Submit */}
              <button
                className="mt-[16px] h-[56px] bg-primary text-on-primary text-[18px] leading-[24px] font-semibold rounded-xl hover:bg-primary-container hover:text-on-primary-container active:scale-[0.98] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                type="submit"
                disabled={loadingSubmit}
              >
                {loadingSubmit ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
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

        <div className="mt-6 pt-4 border-t border-outline-variant/40 flex flex-col items-center gap-[16px]">
          <p className="text-[16px] leading-[24px] text-on-surface-variant">
            {tAuth('alreadyHaveAccount')}{' '}
            <Link href="/login" className="text-secondary font-bold hover:underline">
              {tAuth('loginButton')}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
