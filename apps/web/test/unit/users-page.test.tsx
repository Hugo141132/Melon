// @vitest-environment jsdom
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import UserManagementPage from '@/app/users/page';
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
  usePathname: () => '/users',
  useRouter: () => ({
    push: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const mockUsers = [
  {
    id: 'usr-admin-1',
    fullName: 'Budi Santoso',
    email: 'budi@example.com',
    username: 'budi_ops',
    accountStatus: 'ACTIVE',
    emailVerifiedAt: '2026-08-10T10:00:00.000Z',
    lastLoginAt: '2026-09-04T12:00:00.000Z',
    suspendedAt: null,
    deactivatedAt: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    activeRoles: ['ADMIN'],
  },
];

describe('UserManagementPage Auth State Hydration & RBAC Scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/users')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: mockUsers,
              meta: {
                pagination: {
                  page: 1,
                  pageSize: 10,
                  totalItems: 1,
                  totalPages: 1,
                },
              },
            }),
        });
      }
      return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    });
  });

  const renderComponent = () =>
    render(
      <NextIntlClientProvider locale="id" messages={idMessages}>
        <UserManagementPage />
      </NextIntlClientProvider>
    );

  it('1. renders immediately from AuthContext without "Memeriksa sesi pengguna..." blocking spinner', async () => {
    mockAuthContext = {
      user: {
        id: 'usr-owner-1',
        fullName: 'Owner Kebun',
        email: 'owner@kebunmelon.id',
        accountStatus: 'ACTIVE',
        activeRoles: [UserRole.OWNER],
      },
      role: UserRole.OWNER,
      isAuthenticated: true,
    };

    renderComponent();

    // Verification: Checking session spinner must never be in document
    expect(screen.queryByText('Memeriksa sesi pengguna...')).not.toBeInTheDocument();
    expect(screen.queryByText('Checking user session...')).not.toBeInTheDocument();

    // Verify header renders immediately
    expect(
      screen.getByRole('heading', { level: 1, name: 'Manajemen Pengguna' })
    ).toBeInTheDocument();

    // Verify fetch('/api/v1/users') called immediately without waiting for redundant session fetch
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/v1/users?'));
    });

    // Verify user item appears in table
    await waitFor(() => {
      expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
    });
  });

  it('2. displays 403 Forbidden screen immediately when user is ADMIN without session spinner', async () => {
    mockAuthContext = {
      user: {
        id: 'usr-admin-2',
        fullName: 'Admin Lapangan',
        email: 'admin@kebunmelon.id',
        accountStatus: 'ACTIVE',
        activeRoles: [UserRole.ADMIN],
      },
      role: UserRole.ADMIN,
      isAuthenticated: true,
    };

    renderComponent();

    // Verification: Checking session spinner must never be in document
    expect(screen.queryByText('Memeriksa sesi pengguna...')).not.toBeInTheDocument();
    expect(screen.queryByText('Checking user session...')).not.toBeInTheDocument();

    // Verification: 403 Forbidden title is rendered immediately
    expect(
      screen.getByRole('heading', { level: 1, name: 'Akses Terbatas (403 Forbidden)' })
    ).toBeInTheDocument();

    // Verification: /api/v1/users was NOT fetched by non-owner
    expect(global.fetch).not.toHaveBeenCalledWith(expect.stringContaining('/api/v1/users'));
  });
});
