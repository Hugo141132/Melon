'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import {
  ArrowLeft,
  Mail,
  Phone,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle,
  Loader2,
} from 'lucide-react';

type Step = 1 | 2;

function PasswordStrengthMeter({ password }: { password: string }) {
  const getStrength = (val: string): number => {
    let strength = 0;
    if (val.length >= 4) strength++;
    if (val.length >= 8) strength++;
    if (/[A-Z]/.test(val)) strength++;
    if (/[0-9]/.test(val) || /[^A-Za-z0-9]/.test(val)) strength++;
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
  const [step, setStep] = useState<Step>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    whatsapp: '',
    password: '',
  });

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
  };

  const handleFinish = () => {
    if (!agreed) {
      alert('Silakan setujui Syarat & Ketentuan untuk melanjutkan.');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      // In production: redirect to dashboard
    }, 1500);
  };

  if (step === 1) {
    return (
      <div className="bg-background text-on-background min-h-dvh flex flex-col">
        {/* TopAppBar */}
        <header className="w-full top-0 sticky bg-background flex items-center justify-between px-[24px] h-[56px] z-50">
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-primary hover:bg-surface-container-low transition-colors active:scale-95 duration-150 p-2 rounded-full cursor-pointer"
            >
              <ArrowLeft size={22} />
            </Link>
            <h1 className="text-[24px] leading-[32px] font-semibold text-primary">
              Create Account
            </h1>
          </div>
          <span className="hidden md:block text-[14px] leading-[20px] font-semibold tracking-[0.05em] text-on-surface-variant">
            STEP 1 OF 2
          </span>
        </header>

        <main className="w-full max-w-lg px-[24px] py-[32px] flex-grow flex flex-col">
          <section className="mb-[32px]">
            <h2 className="text-[24px] leading-[32px] font-bold text-primary mb-2">
              Mulai Langkah Pertamamu
            </h2>
            <p className="text-[16px] leading-[24px] text-on-surface-variant">
              Lengkapi detail akun untuk akses penuh ke manajemen melon Anda.
            </p>
          </section>

          <form className="flex flex-col gap-[16px]" onSubmit={handleStep1Submit}>
            {/* Email */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="reg-email"
                className="text-[14px] leading-[20px] font-semibold tracking-[0.05em] text-on-surface-variant uppercase"
              >
                Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  id="reg-email"
                  placeholder="Wahyu123@gmail.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full h-[56px] px-4 pr-12 border border-outline rounded-xl bg-white focus:ring-2 focus:ring-secondary focus:border-secondary text-[18px] leading-[28px] outline-none transition-all"
                />
                <Mail
                  size={18}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-outline"
                />
              </div>
            </div>

            {/* WhatsApp */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="whatsapp"
                className="text-[14px] leading-[20px] font-semibold tracking-[0.05em] text-on-surface-variant uppercase"
              >
                Nomor WhatsApp
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-4 text-[18px] leading-[28px] text-on-surface-variant border-r border-outline pr-3">
                  +62
                </div>
                <input
                  type="tel"
                  id="whatsapp"
                  placeholder="812 xxxx xxxx"
                  value={formData.whatsapp}
                  onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  className="w-full h-[56px] pl-[72px] pr-4 border border-outline rounded-xl bg-white focus:ring-2 focus:ring-secondary focus:border-secondary text-[18px] leading-[28px] outline-none transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="reg-password"
                className="text-[14px] leading-[20px] font-semibold tracking-[0.05em] text-on-surface-variant uppercase"
              >
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="reg-password"
                  placeholder="Minimal 8 karakter"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full h-[56px] px-4 pr-14 border border-outline rounded-xl bg-white focus:ring-2 focus:ring-secondary focus:border-secondary text-[18px] leading-[28px] outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-colors flex items-center justify-center w-10 h-10 cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <PasswordStrengthMeter password={formData.password} />
              <p className="text-[14px] leading-[20px] font-semibold tracking-[0.05em] text-on-surface-variant italic">
                Password minimal 8 karakter agar akunmu tetap aman.
              </p>
            </div>

            {/* Submit */}
            <button
              className="mt-[16px] h-[56px] bg-primary text-on-primary text-[20px] leading-[24px] font-semibold rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              type="submit"
            >
              Lanjut
              <ArrowRight size={20} />
            </button>
          </form>

          <div className="mt-auto py-[32px] flex flex-col items-center gap-[16px]">
            <p className="text-[16px] leading-[24px] text-on-surface-variant">
              Sudah punya akun?{' '}
              <Link href="/login" className="text-secondary font-bold hover:underline">
                Masuk
              </Link>
            </p>
          </div>
        </main>
      </div>
    );
  }

  // Step 2 - Verification
  return (
    <div className="bg-background text-on-background min-h-dvh flex flex-col">
      {/* TopAppBar */}
      <header className="w-full top-0 sticky bg-background z-50 flex items-center justify-between px-[24px] h-[56px]">
        <button
          onClick={() => setStep(1)}
          className="active:scale-95 duration-150 p-2 hover:bg-surface-container-low transition-colors rounded-full flex items-center cursor-pointer"
        >
          <ArrowLeft size={22} className="text-primary" />
        </button>
        <h1 className="text-[24px] leading-[32px] font-semibold text-primary text-center flex-grow">
          Create Account
        </h1>
        <div className="w-10" />
      </header>

      <main className="flex-grow flex flex-col items-center px-[24px] py-[32px] max-w-md mx-auto w-full">
        {/* Illustration */}
        <div className="relative w-48 h-48 mb-4">
          <Image
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuA2wBAfbTx9st1m8lh0Cd9vwdhY68vVd4GNCWe-OPHu43YQT9uads7lkXe-UjPi9GnP99awY77FnbijWaQaLLV3dXQVU142QDbsx_P_uEBIiyfdhJ0uy9sqMSY-TKsEisRcfpd-8qBXF10WqWtppmFPVUyhXxxlTGrXUhmsj50zNsVjxAJqIdchyWbjkWZCvHWU2ry1-C7S4lNLcWwKNbzrRYYy66-GEKbJ8skU4g7OPiAcc-EJnab0XA"
            alt="Email verification illustration"
            width={192}
            height={192}
            className="w-full h-full object-contain"
          />
        </div>
        <h2 className="text-[24px] leading-[32px] font-bold text-primary mb-2">Cek Email Anda</h2>
        <p className="text-[18px] leading-[28px] text-on-surface-variant max-w-xs text-center mb-[32px]">
          Kami telah mengirimkan link verifikasi ke{' '}
          <span className="font-semibold text-primary">
            {formData.email || 'Wahyu123@gmail.com'}
          </span>
        </p>

        {/* Action card */}
        <div className="w-full space-y-[16px] bg-white p-6 rounded-xl border border-outline-variant shadow-sm">
          {/* T&C Checkbox */}
          <label className="flex items-start gap-4 cursor-pointer group">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 w-5 h-5 accent-secondary rounded cursor-pointer"
            />
            <span className="text-[16px] leading-[24px] text-on-surface leading-tight pt-1">
              Saya menyetujui{' '}
              <span className="text-secondary font-semibold hover:underline cursor-pointer">
                Syarat &amp; Ketentuan
              </span>{' '}
              serta{' '}
              <span className="text-secondary font-semibold hover:underline cursor-pointer">
                Kebijakan Privasi
              </span>{' '}
              manajemen perkebunan.
            </span>
          </label>

          {/* Main CTA */}
          <button
            className="w-full h-[56px] bg-primary text-on-primary rounded-xl text-[20px] leading-[24px] font-semibold active:scale-95 transition-all shadow-lg hover:bg-primary-container hover:text-on-primary-container flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
            onClick={handleFinish}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Memproses...
              </>
            ) : (
              <>
                Selesaikan Pendaftaran
                <CheckCircle size={20} />
              </>
            )}
          </button>
        </div>

        <p className="mt-[32px] text-[16px] leading-[24px] text-on-surface-variant">
          Tidak menerima email?{' '}
          <button className="text-secondary font-semibold hover:underline cursor-pointer">
            Kirim ulang
          </button>
        </p>
      </main>
    </div>
  );
}
