// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PengaturanPage from '@/app/pengaturan/page';
import { NextIntlClientProvider } from 'next-intl';
import idMessages from '@/messages/id.json';
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
  usePathname: () => '/pengaturan',
  useRouter: () => ({
    push: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe('PengaturanPage Auth State Hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = () =>
    render(
      <NextIntlClientProvider locale="id" messages={idMessages}>
        <PengaturanPage />
      </NextIntlClientProvider>
    );

  it('renders user details immediately from AuthContext without loading spinner', () => {
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

    renderComponent();

    expect(screen.getAllByText('Budi Santoso').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('ADMINISTRATOR')).toBeInTheDocument();
    expect(screen.queryByText('Memuat...')).not.toBeInTheDocument();
  });

  it('renders Owner-only menu items when user is OWNER', () => {
    mockAuthContext = {
      user: {
        id: 'usr-2',
        fullName: 'Owner Utama',
        email: 'owner@example.com',
        accountStatus: 'ACTIVE',
        activeRoles: [UserRole.OWNER],
      },
      role: UserRole.OWNER,
      isAuthenticated: true,
    };

    renderComponent();

    expect(screen.getAllByText('Owner Utama').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('PEMILIK LAHAN (OWNER)')).toBeInTheDocument();
    expect(screen.getByText('Kelola status dan profil pengguna')).toBeInTheDocument();
    expect(screen.getByText('Kelola persetujuan registrasi Admin')).toBeInTheDocument();
  });

  it('hides Owner-only menu items when user is ADMIN', () => {
    mockAuthContext = {
      user: {
        id: 'usr-3',
        fullName: 'Admin User',
        email: 'admin@example.com',
        accountStatus: 'ACTIVE',
        activeRoles: [UserRole.ADMIN],
      },
      role: UserRole.ADMIN,
      isAuthenticated: true,
    };

    renderComponent();

    expect(screen.getAllByText('Admin User').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('ADMINISTRATOR')).toBeInTheDocument();
    expect(screen.queryByText('Kelola status dan profil pengguna')).not.toBeInTheDocument();
    expect(screen.queryByText('Kelola persetujuan registrasi Admin')).not.toBeInTheDocument();
  });
});
