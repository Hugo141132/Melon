'use client';

import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Bell } from 'lucide-react';
import { USER_PROFILE } from '@/lib/constants';

interface TopAppBarProps {
  showNotification?: boolean;
  notificationCount?: number;
  user?: { fullName: string; email: string; role: string } | null;
}

export default function TopAppBar({
  showNotification = false,
  notificationCount = 0,
  user,
}: TopAppBarProps) {
  const initial = user?.fullName ? user.fullName.charAt(0).toUpperCase() : null;

  return (
    <header className="fixed top-0 w-full z-50 bg-app-surface shadow-[0_4px_20px_rgba(121,86,75,0.12)] flex justify-between items-center px-[1rem] h-14">
      {/* Brand */}
      <div className="flex items-center gap-2">
        <MapPin size={20} className="text-app-primary" strokeWidth={2} fill="none" />
        <span className="font-bold text-[20px] leading-7 text-app-primary tracking-tight">
          Kebun Melon
        </span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {showNotification && (
          <Link href="/notifikasi" className="relative cursor-pointer">
            <Bell size={22} className="text-app-on-surface-variant" />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-app-error text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {notificationCount}
              </span>
            )}
          </Link>
        )}
        <Link href="/profil" className="cursor-pointer">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-app-primary/20 ring-2 ring-app-primary/10 flex items-center justify-center bg-app-primary text-on-primary font-bold text-xs">
            {initial ? (
              initial
            ) : (
              <Image
                src={USER_PROFILE.avatar}
                alt="Profile"
                width={32}
                height={32}
                className="w-full h-full object-cover"
              />
            )}
          </div>
        </Link>
      </div>
    </header>
  );
}
