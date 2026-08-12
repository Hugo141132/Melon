'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { MapPin, Bell } from 'lucide-react';
import { USER_PROFILE } from '@/lib/constants';
import DeviceSelector from './DeviceSelector';
import Sidebar from './Sidebar';

interface TopAppBarProps {
  showNotification?: boolean;
  notificationCount?: number;
  showDeviceSelector?: boolean;
  user?: { fullName?: string; email?: string; role?: string } | null;
}

export default function TopAppBar({
  showNotification = false,
  notificationCount = 0,
  showDeviceSelector = true,
  user,
}: TopAppBarProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pathname = usePathname();

  // Show DeviceSelector ONLY on /soil, /water, and /controls
  const isSelectorAllowedPage = ['/soil', '/water', '/controls'].includes(pathname);
  const shouldShowDeviceSelector = showDeviceSelector && isSelectorAllowedPage;

  const userDisplayName = user?.fullName || user?.email || '';
  const initial = userDisplayName ? userDisplayName.charAt(0).toUpperCase() : null;

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  const handleLogoMouseEnter = () => {
    clearHoverTimer();
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setSidebarOpen(true);
    }
  };

  const handleLogoMouseLeave = () => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      hoverTimerRef.current = setTimeout(() => {
        setSidebarOpen(false);
      }, 200);
    }
  };

  const handleSidebarMouseEnter = () => {
    clearHoverTimer();
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setSidebarOpen(true);
    }
  };

  const handleSidebarMouseLeave = () => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      hoverTimerRef.current = setTimeout(() => {
        setSidebarOpen(false);
      }, 200);
    }
  };

  const handleLogoClick = () => {
    setSidebarOpen((prev) => !prev);
  };

  const handleLogoFocus = () => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      clearHoverTimer();
      setSidebarOpen(true);
    }
  };

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearHoverTimer();
    };
  }, [sidebarOpen, clearHoverTimer]);

  return (
    <>
      <header className="fixed top-0 w-full z-40 bg-app-surface shadow-[0_4px_20px_rgba(121,86,75,0.12)] flex justify-between items-center px-[1rem] h-14 gap-2 relative">
        {/* Top-Left Logo / Brand (Triggers Sidebar) */}
        <button
          type="button"
          onClick={handleLogoClick}
          onMouseEnter={handleLogoMouseEnter}
          onMouseLeave={handleLogoMouseLeave}
          onFocus={handleLogoFocus}
          aria-label="Buka navigasi sidebar"
          aria-expanded={sidebarOpen}
          className="flex items-center gap-2 flex-shrink-0 cursor-pointer p-1.5 -ml-1.5 rounded-xl hover:bg-app-surface-container-low transition-colors group text-left z-10"
          data-testid="top-logo-trigger"
        >
          <div className="w-8 h-8 rounded-xl bg-app-primary/10 flex items-center justify-center text-app-primary group-hover:bg-app-primary group-hover:text-white transition-colors">
            <MapPin size={18} strokeWidth={2} />
          </div>
          <span className="font-bold text-[18px] sm:text-[20px] leading-7 text-app-primary tracking-tight hidden xs:inline">
            Kebun Melon
          </span>
        </button>

        {/* Device Selector — Centered in Top Bar */}
        {shouldShowDeviceSelector && (
          <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 max-w-xs sm:max-w-md w-full flex justify-center pointer-events-none z-10">
            <div className="pointer-events-auto">
              <DeviceSelector />
            </div>
          </div>
        )}

        {/* Right Side Actions */}
        <div className="flex items-center gap-3 flex-shrink-0 ml-auto z-10">
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

      {/* Backdrop Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 animate-fade-in cursor-pointer"
          data-testid="sidebar-backdrop"
          aria-hidden="true"
        />
      )}

      {/* Embedded Left Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
        userRole={user?.role}
        userName={userDisplayName}
      />
    </>
  );
}
