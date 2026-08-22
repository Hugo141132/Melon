'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Radio,
  Bell,
  Cpu,
  Users,
  ShieldCheck,
  Settings,
  User,
  X,
  MapPin,
  ChevronRight,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

export interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const SIDEBAR_NAV_ITEMS = [
  { href: '/', key: 'home', icon: Home },
  { href: '/sensor', key: 'sensor', icon: Radio },
  { href: '/notifikasi', key: 'alerts', icon: Bell },
  { href: '/devices', key: 'devices', icon: Cpu },
  { href: '/users', key: 'users', icon: Users, roleRequired: 'OWNER' },
  { href: '/approvals', key: 'approvals', icon: ShieldCheck, roleRequired: 'OWNER' },
  { href: '/pengaturan', key: 'settings', icon: Settings },
  { href: '/profil', key: 'profile', icon: User },
];

export default function Sidebar({ isOpen, onClose, onMouseEnter, onMouseLeave }: SidebarProps) {
  const pathname = usePathname();
  const tNav = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const { user, role } = useAuth();

  const userName = user?.fullName || user?.email || '';
  const displayName = userName ? userName.trim().replace(/^pak\s+/i, '') : '';
  const headerTitle = displayName || tCommon('user');

  return (
    <aside
      aria-label={tNav('mainNavigation')}
      role="navigation"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        'fixed top-0 left-0 h-full w-64 sm:w-72 bg-app-surface-container-lowest border-r border-app-outline-variant/30 shadow-2xl z-50 flex flex-col justify-between transition-transform duration-300 ease-in-out',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}
      data-testid="sidebar-drawer"
    >
      {/* Sidebar Header */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between p-4 border-b border-app-outline-variant/20 bg-app-surface-container-low/30">
          <Link
            href="/"
            onClick={onClose}
            className="flex items-center gap-2.5 text-app-primary font-bold text-lg cursor-pointer min-w-0"
          >
            <div className="w-8 h-8 rounded-xl bg-app-primary/10 flex items-center justify-center text-app-primary flex-shrink-0">
              <MapPin size={18} strokeWidth={2.2} />
            </div>
            <span
              className="tracking-tight truncate"
              title={headerTitle}
              data-testid="sidebar-display-name"
            >
              {headerTitle}
            </span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-app-on-surface-variant hover:text-app-on-surface rounded-xl hover:bg-app-surface-container transition-colors cursor-pointer flex-shrink-0"
            aria-label={tNav('closeSidebar')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Menu List */}
        <nav className="p-3 space-y-1 overflow-y-auto flex-1">
          {SIDEBAR_NAV_ITEMS.filter((item) => !item.roleRequired || item.roleRequired === role).map(
            (item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(item.href)) ||
                (item.href === '/sensor' &&
                  ['/sensor', '/soil', '/water', '/controls'].includes(pathname));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group',
                    isActive
                      ? 'bg-app-primary text-white shadow-sm'
                      : 'text-app-on-surface-variant hover:bg-app-surface-container-low hover:text-app-primary'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                  data-testid={`sidebar-item-${item.href.replace('/', '') || 'home'}`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      size={18}
                      className={cn(
                        'transition-transform group-hover:scale-110',
                        isActive
                          ? 'text-white'
                          : 'text-app-on-surface-variant group-hover:text-app-primary'
                      )}
                    />
                    <span>{tNav(item.key as any)}</span>
                  </div>
                  <ChevronRight
                    size={14}
                    className={cn(
                      'opacity-0 transition-opacity',
                      isActive ? 'opacity-100 text-white' : 'group-hover:opacity-60'
                    )}
                  />
                </Link>
              );
            }
          )}
        </nav>
      </div>
    </aside>
  );
}
