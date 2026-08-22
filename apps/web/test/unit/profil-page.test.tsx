// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProfilPage from '@/app/profil/page';
import { NextIntlClientProvider } from 'next-intl';
import idMessages from '@/messages/id.json';
import enMessages from '@/messages/en.json';
import { UserRole } from '@kebun-melon/contracts';

let mockAuthContext: any = {
  user: null,
  role: null,
  isAuthenticated: false,
};

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mockAuthContext,
  AuthProvider: ({ children }: any) => <>{children}</>,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/profil',
  useRouter: () => ({
    push: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe('ProfilPage Auth State Hydration and I18N', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              id: 'usr-1',
              fullName: 'Budi Santoso',
              email: 'budi@example.com',
              username: 'budis',
              accountStatus: 'ACTIVE',
              activeRoles: [UserRole.ADMIN],
            },
          }),
      })
    );
  });

  it('renders profile details immediately in Indonesian without blocking spinner', async () => {
    mockAuthContext = {
      user: {
        id: 'usr-1',
        fullName: 'Budi Santoso',
        email: 'budi@example.com',
        accountStatus: 'ACTIVE',
        activeRoles: [UserRole.ADMIN],
      },
      role: UserRole.ADMIN,
      isAuthenticated: true,
    };

    render(
      <NextIntlClientProvider locale="id" messages={idMessages}>
        <ProfilPage />
      </NextIntlClientProvider>
    );

    expect(screen.getByText('Nama Lengkap')).toBeInTheDocument();
    expect(screen.getByText('Profil Saya')).toBeInTheDocument();
    expect(screen.getByText('ADMINISTRATOR - ACTIVE')).toBeInTheDocument();
    expect(screen.queryByText('Memuat profil...')).not.toBeInTheDocument();
  });

  it('renders profile details immediately in English without blocking spinner', async () => {
    mockAuthContext = {
      user: {
        id: 'usr-1',
        fullName: 'Budi Santoso',
        email: 'budi@example.com',
        accountStatus: 'ACTIVE',
        activeRoles: [UserRole.ADMIN],
      },
      role: UserRole.ADMIN,
      isAuthenticated: true,
    };

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <ProfilPage />
      </NextIntlClientProvider>
    );

    expect(screen.getByText('Full Name')).toBeInTheDocument();
    expect(screen.getByText('My Profile')).toBeInTheDocument();
    expect(screen.getByText('ADMINISTRATOR - ACTIVE')).toBeInTheDocument();
    expect(screen.queryByText('Loading profile...')).not.toBeInTheDocument();
  });
});
