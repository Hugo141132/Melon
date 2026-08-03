'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Leaf, Droplets, Sliders, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Beranda', Icon: Home },
  { href: '/tanah', label: 'Lahan', Icon: Leaf },
  { href: '/air', label: 'Air', Icon: Droplets },
  { href: '/controls', label: 'Kontrol', Icon: Sliders },
  { href: '/notifikasi', label: 'Notifikasi', Icon: Bell },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 w-full z-50 rounded-t-xl bg-app-surface-container-lowest shadow-[0_-4px_20px_rgba(121,86,75,0.12)] flex justify-around items-center h-20 px-2 pb-safe">
      {navItems.map(({ href, label, Icon }) => {
        const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-full transition-all duration-200 active:scale-90 cursor-pointer',
              isActive
                ? 'bg-app-primary-container text-app-on-primary-container'
                : 'text-app-on-surface-variant hover:text-app-primary'
            )}
          >
            <Icon
              size={20}
              strokeWidth={isActive ? 2.5 : 1.8}
              fill={isActive ? 'currentColor' : 'none'}
            />
            <span
              className={cn('text-[11px] leading-4 font-medium', isActive ? 'font-semibold' : '')}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
