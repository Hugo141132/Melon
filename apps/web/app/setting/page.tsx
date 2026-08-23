'use client';

import Link from 'next/link';
import Image from 'next/image';
import TopAppBar from '@/components/navigation/TopAppBar';
import { SettingsLocaleSwitcher } from '@/components/settings/locale-switcher';
import { USER_PROFILE } from '@/lib/constants';
import { User as UserIcon, ChevronRight, HelpCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthContext';

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

export default function SettingPage() {
  const tSettings = useTranslations('settings');
  const tAuth = useTranslations('auth');
  const { user, role } = useAuth();

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
            <h2 className="text-[24px] leading-8 font-bold text-app-primary">
              {user?.fullName || USER_PROFILE.name}
            </h2>
            <p className="text-[14px] font-semibold text-app-on-surface-variant">
              {role === 'OWNER'
                ? tAuth('roleOwner')
                : role === 'ADMIN'
                  ? tAuth('roleAdmin')
                  : USER_PROFILE.role}
            </p>
          </div>
        </section>

        {/* Settings List */}
        <div className="space-y-3 animate-fade-in">
          <SettingItem
            icon={<UserIcon size={22} className="text-app-secondary" />}
            iconBg="bg-app-secondary-fixed"
            title={tSettings('profileAndAccount')}
            subtitle={tSettings('profileSubtitle')}
            href="/profile"
          />

          <SettingsLocaleSwitcher />

          <SettingItem
            icon={<HelpCircle size={22} className="text-app-on-surface-variant" />}
            iconBg="bg-app-surface-container"
            title={tSettings('helpAndSupportTitle')}
            subtitle={tSettings('helpAndSupportSubtitle')}
            href="#"
          />
        </div>

        {/* App Metadata */}
        <div className="text-center opacity-60 pt-2 animate-fade-in">
          <p className="text-[12px] text-app-on-surface-variant">Kebun Melon v1.0.0</p>
        </div>
      </main>
    </div>
  );
}
