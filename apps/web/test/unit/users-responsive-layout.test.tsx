// @vitest-environment jsdom
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import UserManagementPage from '@/app/users/page';
import UsersLoading from '@/app/users/loading';
import { NextIntlClientProvider } from 'next-intl';
import idMessages from '@/messages/id.json';
import { UserRole } from '@kebun-melon/contracts';
import { DeviceProvider } from '@/context/DeviceContext';
import { AuthProvider } from '@/context/AuthContext';

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
    id: 'usr-admin-very-long-id-1234567890',
    fullName: 'Budi Santoso Administrator Lapangan',
    email: 'budi.santoso.administrator.lapangan@kebunmelon.id',
    username: 'budi_ops_super_long',
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

const mockAssignments = [
  {
    id: 'assign-001',
    canonicalDeviceId: 'water-tank-node-zi37gz',
    deviceName: 'Water Tank Node Central',
    assignedAt: '2026-08-15T00:00:00.000Z',
    revokedAt: null,
  },
];

const mockAvailableDevices = [
  {
    id: 'dev-001',
    deviceId: 'soil-node-001',
    name: 'Soil Monitoring Node',
  },
];

describe('User Management Mobile Responsive Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/devices') && url.includes('/api/v1/users/')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                assignments: mockAssignments,
              },
            }),
        });
      }
      if (url === '/api/v1/devices' || url.startsWith('/api/v1/devices?')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: mockAvailableDevices,
            }),
        });
      }
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

  it('1. applies responsive stacking classes to search and filter controls', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Budi Santoso Administrator Lapangan')).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText('Cari nama, email, atau username...')).toBeInTheDocument();

    const statusSelect = screen.getByDisplayValue('Semua Status');
    const filterContainer = statusSelect.parentElement;
    expect(filterContainer?.className).toContain('grid');
    expect(filterContainer?.className).toContain('grid-cols-1');
    expect(filterContainer?.className).toContain('sm:grid-cols-2');
    expect(filterContainer?.className).toContain('w-full');
    expect(filterContainer?.className).toContain('sm:w-auto');

    expect(statusSelect.className).toContain('w-full');
    expect(statusSelect.className).toContain('sm:w-auto');
    expect(statusSelect.className).toContain('truncate');
  });

  it('2. ensures user card and email identifiers prevent horizontal overflow with min-w-0 and break-all', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Budi Santoso Administrator Lapangan')).toBeInTheDocument();
    });

    const userHeading = screen.getByText('Budi Santoso Administrator Lapangan');
    expect(userHeading.className).toContain('break-words');

    const emailEl = userHeading.closest('.space-y-1\\.5')?.querySelector('p.font-mono');
    expect(emailEl).toBeInTheDocument();
    expect(emailEl?.className).toContain('break-all');

    const infoContainer = emailEl?.parentElement;
    expect(infoContainer?.className).toContain('min-w-0');
    expect(infoContainer?.className).toContain('flex-1');

    const cardContainer = userHeading.closest('.p-4');
    const actionsToolbar = cardContainer?.querySelector('.border-t');
    expect(actionsToolbar?.className).toContain('flex');
    expect(actionsToolbar?.className).toContain('flex-wrap');
    expect(actionsToolbar?.className).toContain('w-full');
    expect(actionsToolbar?.className).toContain('sm:w-auto');
    expect(actionsToolbar?.className).toContain('border-t');
    expect(actionsToolbar?.className).toContain('sm:border-t-0');

    const buttons = actionsToolbar?.querySelectorAll('button') || [];
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    for (const btn of buttons) {
      expect(btn.className).toContain('flex-1');
      expect(btn.className).toContain('sm:flex-initial');
      expect(btn.className).toContain('min-w-[calc(50%-0.5rem)]');
      expect(btn.className).toContain('justify-center');
    }
  });

  it('3. renders Manage Admin Devices modal with responsive padding, scroll bounds, and stacked assignment controls', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Budi Santoso Administrator Lapangan')).toBeInTheDocument();
    });

    const cardContainer = screen.getByText('Budi Santoso Administrator Lapangan').closest('.p-4');
    const buttons = cardContainer?.querySelectorAll('button') || [];
    const assignBtn = Array.from(buttons).find((b) =>
      b.textContent?.includes('Tugaskan Perangkat')
    );
    expect(assignBtn).toBeDefined();
    fireEvent.click(assignBtn!);

    await waitFor(() => {
      expect(screen.getByText('Kelola Perangkat Admin')).toBeInTheDocument();
    });

    const modalHeading = screen.getByText('Kelola Perangkat Admin');
    const modalDialog = modalHeading.closest('.max-w-lg');
    expect(modalDialog?.className).toContain('p-4');
    expect(modalDialog?.className).toContain('sm:p-6');
    expect(modalDialog?.className).toContain('max-h-[90dvh]');
    expect(modalDialog?.className).toContain('overflow-y-auto');

    const submitAssignBtn = screen.getByRole('button', { name: /Tetapkan/i });
    const assignFormFlex = submitAssignBtn.parentElement;
    expect(assignFormFlex?.className).toContain('flex-col');
    expect(assignFormFlex?.className).toContain('sm:flex-row');
    expect(submitAssignBtn.className).toContain('w-full');
    expect(submitAssignBtn.className).toContain('sm:w-auto');

    await waitFor(() => {
      expect(screen.getByText('Water Tank Node Central')).toBeInTheDocument();
    });
    const deviceItemName = screen.getByText('Water Tank Node Central');
    const deviceRow = deviceItemName.closest('.py-3');
    expect(deviceRow?.className).toContain('flex-col');
    expect(deviceRow?.className).toContain('sm:flex-row');

    const revokeBtn = screen.getByRole('button', { name: /Cabut Akses/i });
    expect(revokeBtn.className).toContain('w-full');
    expect(revokeBtn.className).toContain('sm:w-auto');
  });

  it('4. renders User Detail modal with responsive layout and text wrapping', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Budi Santoso Administrator Lapangan')).toBeInTheDocument();
    });

    const cardContainer = screen.getByText('Budi Santoso Administrator Lapangan').closest('.p-4');
    const buttons = cardContainer?.querySelectorAll('button') || [];
    const viewBtn = Array.from(buttons).find((b) => b.textContent?.includes('Lihat Detail'));
    expect(viewBtn).toBeDefined();
    fireEvent.click(viewBtn!);

    await waitFor(() => {
      expect(screen.getByText('Detail Pengguna')).toBeInTheDocument();
    });

    const modalHeading = screen.getByText('Detail Pengguna');
    const modalDialog = modalHeading.closest('.max-w-lg');
    expect(modalDialog?.className).toContain('p-4');
    expect(modalDialog?.className).toContain('sm:p-6');
    expect(modalDialog?.className).toContain('max-h-[90dvh]');
    expect(modalDialog?.className).toContain('overflow-y-auto');

    const userIdLabel = screen.getByText('ID Pengguna');
    const detailRow = userIdLabel.parentElement;
    expect(detailRow?.className).toContain('flex-col');
    expect(detailRow?.className).toContain('sm:grid');
  });

  it('5. renders loading skeleton with responsive filter grid and card layout', () => {
    render(
      <AuthProvider
        initialSession={
          {
            id: 'usr-owner-1',
            email: 'owner@kebunmelon.id',
            name: 'Owner',
            accountStatus: 'ACTIVE',
            activeRoles: ['OWNER'],
          } as any
        }
      >
        <DeviceProvider>
          <UsersLoading />
        </DeviceProvider>
      </AuthProvider>
    );

    const filtersSkeleton = screen.getByTestId('users-loading-filters');
    expect(filtersSkeleton.className).toContain('flex-col');
    expect(filtersSkeleton.className).toContain('sm:flex-row');

    const tableSkeleton = screen.getByTestId('users-loading-table');
    expect(tableSkeleton).toBeInTheDocument();
  });
});
