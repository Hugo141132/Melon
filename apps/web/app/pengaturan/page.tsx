'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import TopAppBar from '@/components/navigation/TopAppBar';
import BottomNav from '@/components/navigation/BottomNav';
import { USER_PROFILE } from '@/lib/constants';
import {
  User as UserIcon,
  ChevronRight,
  Bell,
  Settings2,
  HelpCircle,
  ShieldCheck,
  Loader2,
} from 'lucide-react';

interface SettingItemProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  href: string;
}

function SettingItem({ icon, iconBg, title, subtitle, href }: SettingItemProps) {
  return (
    <Link
      href={href}
      className="w-full text-left bg-app-surface-container-lowest p-5 rounded-xl soft-elevation border border-app-outline-variant/20 hover:bg-app-surface-container-low transition-colors flex items-center gap-4 group active:scale-[0.98] cursor-pointer"
    >
      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${iconBg}`}>
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="text-[16px] font-semibold text-app-on-surface">{title}</h3>
        <p className="text-[14px] text-app-on-surface-variant">{subtitle}</p>
      </div>
      <ChevronRight
        size={20}
        className="text-app-outline group-hover:translate-x-1 transition-transform"
      />
    </Link>
  );
}

export default function PengaturanPage() {
  const [user, setUser] = useState<{
    fullName: string;
    email: string;
    role: string;
    accountStatus: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch('/api/v1/auth/session');
        const json = await res.json();
        if (json.success && json.data.authenticated && json.data.user) {
          setUser(json.data.user);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    fetchSession();
  }, []);

  return (
    <div className="bg-app-surface text-app-on-surface min-h-dvh pb-24">
      <TopAppBar />

      <main className="pt-20 px-[1rem] max-w-2xl mx-auto w-full space-y-5">
        {/* User Summary Card */}
        <section className="flex items-center gap-4 bg-app-surface-container-lowest p-5 rounded-xl soft-elevation-lg border border-app-outline-variant/30 animate-fade-in">
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-app-primary-fixed flex-shrink-0">
            <Image
              src={USER_PROFILE.avatar}
              alt={user?.fullName || USER_PROFILE.name}
              width={64}
              height={64}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            {loading ? (
              <div className="flex items-center gap-2 text-app-on-surface-variant">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-[14px]">Memuat profil...</span>
              </div>
            ) : (
              <>
                <h2 className="text-[24px] leading-8 font-bold text-app-primary">
                  {user?.fullName || USER_PROFILE.name}
                </h2>
                <p className="text-[14px] font-semibold text-app-on-surface-variant">
                  {user?.role === 'OWNER'
                    ? 'PEMILIK LAHAN (OWNER)'
                    : user?.role === 'ADMIN'
                      ? 'ADMINISTRATOR'
                      : USER_PROFILE.role}
                </p>
              </>
            )}
          </div>
        </section>

        {/* Settings List */}
        <div className="space-y-3 animate-fade-in">
          <SettingItem
            icon={<UserIcon size={22} className="text-app-secondary" />}
            iconBg="bg-app-secondary-fixed"
            title="Profil & Akun"
            subtitle="Informasi pribadi dan keamanan"
            href="/profil"
          />

          {/* Persetujuan Admin navigation item - visible ONLY to OWNER */}
          {user?.role === 'OWNER' && (
            <SettingItem
              icon={<ShieldCheck size={22} className="text-emerald-700" />}
              iconBg="bg-emerald-100"
              title="Persetujuan Admin"
              subtitle="Kelola persetujuan registrasi Admin"
              href="/approvals"
            />
          )}

          <SettingItem
            icon={<Bell size={22} className="text-app-primary" />}
            iconBg="bg-app-primary/10"
            title="Notifikasi & Lansiran"
            subtitle="Atur peringatan sensor lahan"
            href="/notifikasi"
          />
          <SettingItem
            icon={<Settings2 size={22} className="text-app-tertiary" />}
            iconBg="bg-app-tertiary-fixed/30"
            title="Konfigurasi Alat & Sensor"
            subtitle="Sambungkan dan atur sensor IoT"
            href="#"
          />
          <SettingItem
            icon={<HelpCircle size={22} className="text-app-on-surface-variant" />}
            iconBg="bg-app-surface-container"
            title="Bantuan & Dukungan"
            subtitle="FAQ, tutorialnya, dan kontak"
            href="#"
          />
        </div>

        {/* App Metadata */}
        <div className="text-center opacity-60 pt-2 animate-fade-in">
          <p className="text-[12px] text-app-on-surface-variant">Kebun Melon v1.0.0</p>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
