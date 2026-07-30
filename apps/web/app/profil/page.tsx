'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import {
  ArrowLeft,
  MoreVertical,
  Edit2,
  Lock,
  Smartphone,
  LogOut,
  CheckCircle,
} from 'lucide-react';
import { USER_PROFILE } from '@/lib/constants';

export default function ProfilPage() {
  const [name, setName] = useState(USER_PROFILE.name);
  const [phone, setPhone] = useState(USER_PROFILE.phone);
  const [saved, setSaved] = useState(false);

  const [loggingOut, setLoggingOut] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network error during logout cleanup
    } finally {
      window.location.href = '/login';
    }
  };

  return (
    <div className="bg-app-surface text-app-on-surface min-h-dvh pb-32 font-sans">
      {/* Top AppBar */}
      <header className="bg-app-surface sticky top-0 z-50 w-full shadow-sm">
        <div className="flex justify-between items-center px-[1rem] py-[8px] w-full h-16">
          <div className="flex items-center gap-4">
            <Link
              href="/pengaturan"
              className="active:scale-95 transition-transform p-2 rounded-full hover:bg-app-surface-container-highest cursor-pointer"
            >
              <ArrowLeft size={22} className="text-app-on-surface" />
            </Link>
            <h1 className="text-[20px] font-bold text-app-on-surface">Profil &amp; Keamanan</h1>
          </div>
          <button className="active:scale-95 transition-transform p-2 cursor-pointer">
            <MoreVertical size={22} className="text-app-primary" />
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-[1rem] pt-[1rem] space-y-[1.5rem]">
        {/* Section 1: Personal Info */}
        <section className="space-y-[1rem]">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="relative">
              <div className="w-28 h-28 rounded-full border-4 border-white soft-elevation overflow-hidden bg-app-surface-container">
                <Image
                  src={USER_PROFILE.avatar}
                  alt={USER_PROFILE.name}
                  width={112}
                  height={112}
                  className="w-full h-full object-cover"
                />
              </div>
              <button className="absolute bottom-0 right-0 bg-app-primary text-white p-2 rounded-full shadow-lg border-2 border-white active:scale-90 transition-transform cursor-pointer">
                <Edit2 size={14} />
              </button>
            </div>
            <div className="flex items-center gap-2 px-4 py-1.5 bg-app-on-primary-container text-app-primary rounded-full">
              <CheckCircle size={16} fill="currentColor" />
              <span className="text-[14px] font-semibold">
                {USER_PROFILE.role} - Akun Terverifikasi
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {/* Nama Lengkap */}
            <div className="space-y-2">
              <label className="text-[14px] font-semibold text-app-on-surface-variant px-1 block">
                Nama Lengkap
              </label>
              <input
                className="w-full h-[56px] px-4 bg-white border-[1.5px] border-app-outline-variant rounded-xl focus:border-app-primary focus:ring-1 focus:ring-app-primary outline-none transition-all text-[16px]"
                placeholder="Wahyu"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* WhatsApp */}
            <div className="space-y-2">
              <label className="text-[14px] font-semibold text-app-on-surface-variant px-1 block">
                Nomor WhatsApp
              </label>
              <div className="relative">
                <input
                  className="w-full h-[56px] px-4 pr-12 bg-white border-[1.5px] border-app-outline-variant rounded-xl focus:border-app-primary focus:ring-1 focus:ring-app-primary outline-none transition-all text-[16px]"
                  placeholder="0812-xxxx-xxxx"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <CheckCircle
                  size={20}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-app-primary"
                  fill="currentColor"
                />
              </div>
            </div>

            {/* Nama Lahan */}
            <div className="space-y-2">
              <label className="text-[14px] font-semibold text-app-on-surface-variant px-1 block">
                Nama Lahan
              </label>
              <input
                className="w-full h-[56px] px-4 bg-white border-[1.5px] border-app-outline-variant rounded-xl focus:border-app-primary focus:ring-1 focus:ring-app-primary outline-none transition-all text-[16px]"
                placeholder="Kebun Melon Pak Wahyu"
                type="text"
              />
            </div>
          </div>
        </section>

        {/* Section 2: Security */}
        <section className="space-y-[1rem]">
          <h2 className="text-[20px] font-semibold text-app-on-surface px-1">Keamanan Akun</h2>
          <div className="bg-white rounded-2xl soft-elevation overflow-hidden divide-y divide-app-surface-container">
            {/* Password */}
            <button className="w-full flex items-center justify-between p-4 active:bg-app-surface-container transition-colors text-left group cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-app-surface-container-low flex items-center justify-center text-app-primary">
                  <Lock size={18} />
                </div>
                <div>
                  <p className="text-[16px] font-semibold text-app-on-surface">Ubah Kata Sandi</p>
                  <p className="text-[12px] text-app-on-surface-variant">
                    Terakhir diubah {USER_PROFILE.lastPasswordChange}
                  </p>
                </div>
              </div>
              <ArrowLeft
                size={18}
                className="text-app-on-surface-variant rotate-180 group-active:translate-x-1 transition-transform"
              />
            </button>

            {/* Devices */}
            <button className="w-full flex items-center justify-between p-4 active:bg-app-surface-container transition-colors text-left group cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-app-surface-container-low flex items-center justify-center text-app-primary">
                  <Smartphone size={18} />
                </div>
                <div>
                  <p className="text-[16px] font-semibold text-app-on-surface">Perangkat Tertaut</p>
                  <p className="text-[12px] text-app-primary font-medium">
                    {USER_PROFILE.devicesCount} Perangkat Aktif
                  </p>
                </div>
              </div>
              <ArrowLeft
                size={18}
                className="text-app-on-surface-variant rotate-180 group-active:translate-x-1 transition-transform"
              />
            </button>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="pt-4">
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center gap-3 p-4 text-app-error font-semibold active:bg-app-error-container/10 transition-colors rounded-xl cursor-pointer disabled:opacity-60"
          >
            <LogOut size={20} />
            <span>{loggingOut ? 'Keluar...' : 'Keluar dari Akun'}</span>
          </button>
        </section>
      </main>

      {/* Fixed Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md px-[1rem] pb-8 pt-4 border-t border-app-surface-container z-40">
        <div className="max-w-md mx-auto">
          <button
            onClick={handleSave}
            className="w-full h-[56px] bg-app-primary text-white rounded-xl text-[20px] font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-app-primary/20 cursor-pointer"
          >
            {saved ? (
              <>
                <CheckCircle size={20} fill="white" />
                Tersimpan!
              </>
            ) : (
              'Simpan Perubahan'
            )}
          </button>
        </div>
      </div>

      {/* Toast */}
      {saved && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 bg-app-on-surface text-app-surface px-6 py-3 rounded-full shadow-2xl text-[14px] z-[100] animate-slide-up">
          Perubahan berhasil disimpan
        </div>
      )}
    </div>
  );
}
