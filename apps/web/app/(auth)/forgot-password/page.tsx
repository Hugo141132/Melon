'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { ArrowLeft, Mail, Send, Loader2, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'sent'>('idle');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setState('loading');
    setTimeout(() => setState('sent'), 1500);
    setTimeout(() => setState('idle'), 5500);
  };

  return (
    <div className="bg-surface text-on-surface min-h-dvh flex flex-col items-center">
      {/* Top App Bar */}
      <header className="w-full top-0 sticky bg-surface border-b border-outline-variant z-50 flex items-center justify-between px-[24px] h-[56px]">
        <Link
          href="/login"
          aria-label="Back"
          className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-surface-container-low transition-colors active:scale-95 duration-100 cursor-pointer"
        >
          <ArrowLeft size={22} className="text-primary" />
        </Link>
        <span className="text-[24px] leading-[32px] font-bold text-primary">Kebun Melon</span>
        <div className="w-10" />
      </header>

      {/* Main */}
      <main className="w-full max-w-md px-[24px] flex flex-col pt-[32px] flex-grow">
        {/* Illustration */}
        <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-[32px] border border-outline-variant bg-surface-container-low shadow-sm">
          <div className="absolute inset-0 flex items-center justify-center p-[16px]">
            <Image
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBuTgEOmVPEaPavbBtNEp8HNzQEuR2hjd1umTRpIlQtLxD2MRieg4Sa--NuZIxZeZQf1kxw3XXQCqXsN9dEOo5fZ1NZUEYHS7BvQrPjNaAlr8fH8mZJEsnayCBYovaN4VD5F2fLeiqUzhFF0Z4ZE4-IIs1WAcMS_AzdCQEoFSbd-Si_N3b4ZGv89ibHZ_MMYS_s6igqVdZXlGn0xBj4LkT9igVsq2F5ZpUdkv7KSggrZRcc76_9PiRU1w"
              alt="Melon illustration"
              width={192}
              height={192}
              className="w-48 h-48 object-contain drop-shadow-xl"
            />
          </div>
        </div>

        {/* Typography */}
        <div className="mb-[32px]">
          <h1 className="text-[24px] leading-[32px] font-bold text-on-surface mb-[8px]">
            Lupa Kata Sandi
          </h1>
          <p className="text-[18px] leading-[28px] text-on-surface-variant">
            Kami akan mengirimkan link untuk mengatur ulang kata sandi ke email Anda.
          </p>
        </div>

        {/* Form */}
        <form className="flex flex-col gap-[32px]" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <label
              className="text-[14px] leading-[20px] font-semibold tracking-[0.05em] text-primary uppercase"
              htmlFor="email"
            >
              Email
            </label>
            <div className="relative group">
              <Mail
                size={20}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors"
              />
              <input
                className="w-full h-[56px] pl-12 pr-4 bg-white border border-outline-variant rounded-xl text-[18px] leading-[28px] text-on-surface transition-all focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                id="email"
                name="email"
                placeholder="Wahyu123@gmail.com"
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <button
            className="h-[56px] w-full bg-primary text-on-primary rounded-xl text-[20px] leading-[24px] font-semibold shadow-md hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
            type="submit"
            disabled={state === 'loading' || state === 'sent'}
          >
            {state === 'loading' && (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span className="text-[16px]">Mengirim...</span>
              </>
            )}
            {state === 'sent' && (
              <>
                <CheckCircle size={20} />
                <span className="text-[16px]">Email Terkirim</span>
              </>
            )}
            {state === 'idle' && (
              <>
                <span>Kirim Link Reset</span>
                <Send size={18} />
              </>
            )}
          </button>
        </form>

        {/* Toast notification */}
        {state === 'sent' && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-on-surface text-surface px-6 py-3 rounded-full shadow-2xl text-[16px] z-[100] animate-slide-up">
            Silakan periksa kotak masuk email Anda.
          </div>
        )}
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
