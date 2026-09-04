// @vitest-environment jsdom
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DeviceRegistryPage from '@/app/devices/page';
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
  usePathname: () => '/devices',
  useRouter: () => ({
    push: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const mockDevices = [
  {
    id: 'd9b0e271-9df6-48c9-95e2-6aa14eb91981',
    deviceId: 'soil-node-001',
    siteId: 'site-1',
    name: 'Soil Node Greenhouse A',
    deviceType: 'SOIL_NODE',
    accountStatus: 'ACTIVE',
    connectionStatus: 'ONLINE',
    firmwareVersion: '1.0.0',
    hardwareRevision: 'rev-A',
    schemaVersion: '1.0',
    lastSeenAt: '2026-09-04T10:00:00.000Z',
    lastMessageAt: '2026-09-04T10:00:00.000Z',
    latitude: -6.2,
    longitude: 106.8,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    deactivatedAt: null,
    capabilities: ['SOIL_NPK', 'SOIL_MOISTURE'],
  },
];

describe('DeviceRegistryPage Auth State Hydration & Permission Scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/devices')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: mockDevices,
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
        <DeviceRegistryPage />
      </NextIntlClientProvider>
    );

  it('1. renders immediately from AuthContext without "Memeriksa sesi pengguna..." blocking spinner', async () => {
    mockAuthContext = {
      user: {
        id: 'usr-1',
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
      screen.getByRole('heading', { level: 1, name: 'Manajemen Perangkat' })
    ).toBeInTheDocument();

    // Verify fetch('/api/v1/devices') called immediately without waiting for redundant session fetch
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/v1/devices?'));
    });

    // Verify device item appears
    await waitFor(() => {
      expect(screen.getByText('Soil Node Greenhouse A')).toBeInTheDocument();
    });
  });

  it('2. displays canonical deviceId and Owner action buttons (Edit & Deactivate) when user is OWNER', async () => {
    mockAuthContext = {
      user: {
        id: 'usr-1',
        fullName: 'Owner Kebun',
        email: 'owner@kebunmelon.id',
        accountStatus: 'ACTIVE',
        activeRoles: [UserRole.OWNER],
      },
      role: UserRole.OWNER,
      isAuthenticated: true,
    };

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Soil Node Greenhouse A')).toBeInTheDocument();
    });

    // DEC-DEV-028: Canonical deviceId is visible to OWNER
    expect(screen.getByText('soil-node-001')).toBeInTheDocument();

    // Edit and Deactivate action buttons are visible for OWNER
    expect(screen.getByTitle('Ubah')).toBeInTheDocument();
    expect(screen.getByTitle('Nonaktifkan Perangkat?')).toBeInTheDocument();
  });

  it('3. conceals Owner action buttons (Edit & Deactivate) when user is ADMIN', async () => {
    mockAuthContext = {
      user: {
        id: 'usr-2',
        fullName: 'Admin Lapangan',
        email: 'admin@kebunmelon.id',
        accountStatus: 'ACTIVE',
        activeRoles: [UserRole.ADMIN],
      },
      role: UserRole.ADMIN,
      isAuthenticated: true,
    };

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Soil Node Greenhouse A')).toBeInTheDocument();
    });

    // Edit and Deactivate action buttons must NOT be visible to ADMIN
    expect(screen.queryByTitle('Ubah')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Nonaktifkan Perangkat?')).not.toBeInTheDocument();
  });
});
