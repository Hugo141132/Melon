// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProfilePage from '@/app/profile/page';
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
  usePathname: () => '/profile',
  useRouter: () => ({
    push: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe('ProfilePage Auth State Hydration and I18N', () => {
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
        <ProfilePage />
      </NextIntlClientProvider>
    );

    expect(screen.getByText('Nama Lengkap')).toBeInTheDocument();
    expect(screen.getByText('Profil Saya')).toBeInTheDocument();
    expect(screen.getByText('ADMINISTRATOR - ACTIVE')).toBeInTheDocument();
    expect(screen.queryByText('Memuat Profile...')).not.toBeInTheDocument();
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
        <ProfilePage />
      </NextIntlClientProvider>
    );

    expect(screen.getByText('Full Name')).toBeInTheDocument();
    expect(screen.getByText('My Profile')).toBeInTheDocument();
    expect(screen.getByText('ADMINISTRATOR - ACTIVE')).toBeInTheDocument();
    expect(screen.queryByText('Loading profile...')).not.toBeInTheDocument();
  });

  it('verifies Linked Devices is absent, Account & Session Security is present, and client PII is omitted in ID', async () => {
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

    const { container } = render(
      <NextIntlClientProvider locale="id" messages={idMessages}>
        <ProfilePage />
      </NextIntlClientProvider>
    );

    // 1. Linked Devices card is absent
    expect(screen.queryByText('Perangkat Terhubung')).not.toBeInTheDocument();
    expect(screen.queryByText(/Perangkat Aktif/i)).not.toBeInTheDocument();

    // 2. Account & Session Security section is present
    expect(screen.getByText('Keamanan Akun & Sesi')).toBeInTheDocument();
    expect(screen.getByText('Sesi Aktif')).toBeInTheDocument();
    expect(screen.getByText('Sesi Tunggal (1 Perangkat)')).toBeInTheDocument();
    expect(screen.getByText('Status Email')).toBeInTheDocument();
    expect(screen.getByText('Terverifikasi')).toBeInTheDocument();
    expect(screen.getByText('Ubah Kata Sandi')).toBeInTheDocument();

    // 3. Client PII (IP address, user agent) is omitted from DOM
    expect(container.textContent).not.toMatch(/127\.0\.0\.1|192\.168\./i);
    expect(container.textContent).not.toMatch(/Mozilla|Chrome|Safari|User-Agent/i);
  });

  it('verifies Linked Devices is absent, Account & Session Security is present, and client PII is omitted in EN', async () => {
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

    const { container } = render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <ProfilePage />
      </NextIntlClientProvider>
    );

    // 1. Linked Devices card is absent
    expect(screen.queryByText('Linked Devices')).not.toBeInTheDocument();
    expect(screen.queryByText(/Active Devices/i)).not.toBeInTheDocument();

    // 2. Account & Session Security section is present
    expect(screen.getByText('Account & Session Security')).toBeInTheDocument();
    expect(screen.getByText('Active Session')).toBeInTheDocument();
    expect(screen.getByText('Single Active Session (1 Device)')).toBeInTheDocument();
    expect(screen.getByText('Email Status')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('Change Password')).toBeInTheDocument();

    // 3. Client PII (IP address, user agent) is omitted from DOM
    expect(container.textContent).not.toMatch(/127\.0\.0\.1|192\.168\./i);
    expect(container.textContent).not.toMatch(/Mozilla|Chrome|Safari|User-Agent/i);
  });
});
