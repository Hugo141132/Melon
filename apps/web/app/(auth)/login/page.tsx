'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) {
      setLoading(true);
      setTimeout(() => setLoading(false), 2000);
    }
  };

  return (
    <div className="bg-surface text-on-surface min-h-dvh flex flex-col justify-center items-center p-[24px]">
      <main className="w-full max-w-md bg-surface-container-lowest bento-shape p-[32px] shadow-sm border border-outline-variant">
        {/* Header */}
        <header className="mb-[32px] text-center">
          <h1 className="text-[32px] leading-[40px] font-bold tracking-[-0.01em] text-primary mb-2 md:text-[32px] text-[24px]">
            Masuk ke Kebun Melon
          </h1>
          <p className="text-[16px] leading-[24px] text-on-surface-variant">
            Kelola lahan melon Anda dengan lebih mudah
          </p>
        </header>

        <form className="space-y-6" onSubmit={handleSubmit}>
          {/* Email */}
          <div className="space-y-2">
            <label
              className="text-[14px] leading-[20px] font-semibold tracking-[0.05em] text-on-surface-variant uppercase block"
              htmlFor="email"
            >
              Alamat Email
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
              Kata Sandi
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
                aria-label={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
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
              Lupa Password?
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
                  <span className="text-[16px]">Memproses...</span>
                </>
              ) : (
                'Masuk'
              )}
            </button>
          </div>
        </form>
      </main>

      {/* Footer */}
      <footer className="mt-[32px] text-center">
        <p className="text-[16px] leading-[24px] text-on-surface-variant">
          Belum punya akun?{' '}
          <Link href="/register" className="text-secondary font-bold hover:underline">
            Daftar Lahan Baru
          </Link>
        </p>
      </footer>
    </div>
  );
}
