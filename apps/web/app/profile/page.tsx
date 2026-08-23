'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  MoreVertical,
  Edit2,
  Lock,
  Smartphone,
  LogOut,
  CheckCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { USER_PROFILE } from '@/lib/constants';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthContext';

interface UserProfileState {
  id: string;
  fullName: string;
  email: string;
  username: string | null;
  accountStatus: string;
  activeRoles: string[];
}

export default function ProfilePage() {
  const tProfile = useTranslations('profile');
  const tCommon = useTranslations('common');
  const tAuth = useTranslations('auth');
  const { user, isAuthenticated } = useAuth();

  const [profile, setProfile] = useState<UserProfileState | null>(
    user
      ? {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          username: null,
          accountStatus: user.accountStatus,
          activeRoles: user.activeRoles,
        }
      : null
  );
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [username, setUsername] = useState('');

  // UI states
  const [loading, setLoading] = useState(!user);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [unauthenticated, setUnauthenticated] = useState(!isAuthenticated && !user);
  const [loggingOut, setLoggingOut] = useState(false);

  // Sync state if user changes from auth context
  useEffect(() => {
    if (user) {
      setFullName((prev) => prev || user.fullName || '');
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              id: user.id,
              fullName: prev.fullName || user.fullName,
              email: user.email,
              accountStatus: user.accountStatus,
              activeRoles: user.activeRoles,
            }
          : {
              id: user.id,
              fullName: user.fullName,
              email: user.email,
              username: null,
              accountStatus: user.accountStatus,
              activeRoles: user.activeRoles,
            }
      );
      setLoading(false);
      setUnauthenticated(false);
    }
  }, [user]);

  // Fetch real profile from backend GET /api/v1/me in background
  useEffect(() => {
    let isMounted = true;
    async function loadProfile() {
      try {
        setErrorMsg(null);
        const res = await fetch('/api/v1/me');

        if (res.status === 401 || res.status === 403) {
          if (isMounted && !user) {
            setUnauthenticated(true);
            setLoading(false);
          }
          return;
        }

        const json = await res.json();
        if (json.success && json.data) {
          if (isMounted) {
            setProfile(json.data);
            setFullName(json.data.fullName || '');
            setUsername(json.data.username || '');
          }
        } else {
          if (isMounted && !user) {
            setErrorMsg(json.error?.message || 'Gagal memuat profil pengguna.');
          }
        }
      } catch {
        if (isMounted && !user) {
          setErrorMsg('Terjadi kesalahan koneksi saat memuat profil.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    try {
      const payload: { fullName?: string; username?: string | null } = {};
      if (fullName.trim()) payload.fullName = fullName.trim();
      payload.username = username.trim() ? username.trim() : null;

      const res = await fetch('/api/v1/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.status === 401 || res.status === 403) {
        setUnauthenticated(true);
        setSaving(false);
        return;
      }

      const json = await res.json();

      if (res.ok && json.success && json.data) {
        setProfile(json.data);
        setFullName(json.data.fullName || '');
        setUsername(json.data.username || '');
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        if (res.status === 422) {
          setErrorMsg(json.error?.message || 'Data yang dimasukkan tidak valid.');
        } else {
          setErrorMsg(json.error?.message || 'Gagal menyimpan perubahan profil.');
        }
      }
    } catch {
      setErrorMsg('Terjadi kesalahan koneksi saat menyimpan profil.');
    } finally {
      setSaving(false);
    }
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

  // 1. Unauthenticated state
  if (unauthenticated && !user) {
    return (
      <div className="bg-app-surface text-app-on-surface min-h-dvh flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center space-y-4 soft-elevation">
          <AlertCircle className="w-12 h-12 text-app-error mx-auto" />
          <h2 className="text-xl font-bold">Sesi Berakhir</h2>
          <p className="text-sm text-app-on-surface-variant">
            Sesi Anda telah berakhir atau akun tidak aktif. Silakan masuk kembali.
          </p>
          <Link
            href="/login"
            className="block w-full py-3 bg-app-primary text-white rounded-xl font-semibold active:scale-95 transition-transform"
          >
            Kembali ke Login
          </Link>
        </div>
      </div>
    );
  }

  // 2. Loading state only when no cached/hydrated user is available
  if (loading && !profile && !user) {
    return (
      <div className="bg-app-surface text-app-on-surface min-h-dvh flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-app-primary animate-spin" />
          <span className="text-sm font-medium text-app-on-surface-variant">
            {tProfile('loading')}
          </span>
        </div>
      </div>
    );
  }

  const roleDisplay = (profile?.activeRoles || user?.activeRoles || []).includes('OWNER')
    ? tAuth('roleOwner')
    : tAuth('roleAdmin');

  return (
    <div className="bg-app-surface text-app-on-surface min-h-dvh pb-32 font-sans">
      {/* Top AppBar */}
      <header className="bg-app-surface sticky top-0 z-50 w-full shadow-sm">
        <div className="flex justify-between items-center px-[1rem] py-[8px] w-full h-16">
          <div className="flex items-center gap-4">
            <Link
              href="/setting"
              className="active:scale-95 transition-transform p-2 rounded-full hover:bg-app-surface-container-highest cursor-pointer"
            >
              <ArrowLeft size={22} className="text-app-on-surface" />
            </Link>
            <h1 className="text-[20px] font-bold text-app-on-surface">{tProfile('title')}</h1>
          </div>
          <button className="active:scale-95 transition-transform p-2 cursor-pointer">
            <MoreVertical size={22} className="text-app-primary" />
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-[1rem] pt-[1rem] space-y-[1.5rem]">
        {/* Error banner if any */}
        {errorMsg && (
          <div className="bg-app-error-container/20 border border-app-error text-app-error p-4 rounded-xl flex items-center gap-3 text-sm font-medium">
            <AlertCircle size={18} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Section 1: Personal Info */}
        <section className="space-y-[1rem]">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="relative">
              <div className="w-28 h-28 rounded-full border-4 border-white soft-elevation overflow-hidden bg-app-surface-container">
                <Image
                  src={USER_PROFILE.avatar}
                  alt={fullName || user?.fullName || USER_PROFILE.name}
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
                {roleDisplay} - {profile?.accountStatus || user?.accountStatus || 'ACTIVE'}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {/* Nama Lengkap (Editable) */}
            <div className="space-y-2">
              <label className="text-[14px] font-semibold text-app-on-surface-variant px-1 block">
                {tProfile('fullName')}
              </label>
              <input
                className="w-full h-[56px] px-4 bg-white border-[1.5px] border-app-outline-variant rounded-xl focus:border-app-primary focus:ring-1 focus:ring-app-primary outline-none transition-all text-[16px]"
                placeholder={tProfile('fullName')}
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={saving}
              />
            </div>

            {/* Email (Read-Only) */}
            <div className="space-y-2">
              <label className="text-[14px] font-semibold text-app-on-surface-variant px-1 block">
                {tProfile('email')}
              </label>
              <input
                className="w-full h-[56px] px-4 bg-app-surface-container-low border-[1.5px] border-app-outline-variant rounded-xl text-app-on-surface-variant outline-none cursor-not-allowed text-[16px]"
                type="email"
                value={profile?.email || user?.email || ''}
                disabled
              />
            </div>

            {/* Username / Alias (Editable) */}
            <div className="space-y-2">
              <label className="text-[14px] font-semibold text-app-on-surface-variant px-1 block">
                Username / Alias (Opsional)
              </label>
              <input
                className="w-full h-[56px] px-4 bg-white border-[1.5px] border-app-outline-variant rounded-xl focus:border-app-primary focus:ring-1 focus:ring-app-primary outline-none transition-all text-[16px]"
                placeholder="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>
        </section>

        {/* Section 2: Security */}
        <section className="space-y-[1rem]">
          <h2 className="text-[20px] font-semibold text-app-on-surface px-1">
            {tProfile('securityTitle')}
          </h2>
          <div className="bg-white rounded-2xl soft-elevation overflow-hidden divide-y divide-app-surface-container">
            {/* Password */}
            <button className="w-full flex items-center justify-between p-4 active:bg-app-surface-container transition-colors text-left group cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-app-surface-container-low flex items-center justify-center text-app-primary">
                  <Lock size={18} />
                </div>
                <div>
                  <p className="text-[16px] font-semibold text-app-on-surface">
                    {tProfile('changePassword')}
                  </p>
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
                  <p className="text-[16px] font-semibold text-app-on-surface">
                    {tProfile('linkedDevices')}
                  </p>
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
            <span>{loggingOut ? tCommon('loading') : tProfile('logout')}</span>
          </button>
        </section>
      </main>

      {/* Fixed Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md px-[1rem] pb-8 pt-4 border-t border-app-surface-container z-40">
        <div className="max-w-md mx-auto">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-[56px] bg-app-primary text-white rounded-xl text-[20px] font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-app-primary/20 cursor-pointer disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                {tCommon('saving')}
              </>
            ) : saved ? (
              <>
                <CheckCircle size={20} fill="white" />
                {tProfile('savedToast')}
              </>
            ) : (
              tCommon('save')
            )}
          </button>
        </div>
      </div>

      {/* Toast */}
      {saved && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 bg-app-on-surface text-app-surface px-6 py-3 rounded-full shadow-2xl text-[14px] z-[100] animate-slide-up">
          {tProfile('savedToast')}
        </div>
      )}
    </div>
  );
}
