// @vitest-environment jsdom
import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
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
    id: '11111111-1111-4111-8111-111111111111',
    fullName: 'Kebun Owner PIC',
    email: 'owner@kebunmelon.id',
    username: 'owner_utama',
    accountStatus: 'ACTIVE',
    emailVerifiedAt: '2026-08-01T00:00:00.000Z',
    lastLoginAt: '2026-09-12T10:00:00.000Z',
    suspendedAt: null,
    deactivatedAt: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    activeRoles: ['OWNER'],
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    fullName: 'Admin Lapangan Satu',
    email: 'admin1@kebunmelon.id',
    username: 'admin_ops1',
    accountStatus: 'ACTIVE',
    emailVerifiedAt: '2026-08-10T10:00:00.000Z',
    lastLoginAt: '2026-09-10T12:00:00.000Z',
    suspendedAt: null,
    deactivatedAt: null,
    createdAt: '2026-08-05T00:00:00.000Z',
    updatedAt: '2026-08-05T00:00:00.000Z',
    activeRoles: ['ADMIN'],
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    fullName: 'Admin Lapangan Dua',
    email: 'admin2@kebunmelon.id',
    username: 'admin_ops2',
    accountStatus: 'SUSPENDED',
    emailVerifiedAt: '2026-08-10T10:00:00.000Z',
    lastLoginAt: '2026-09-08T12:00:00.000Z',
    suspendedAt: '2026-09-09T00:00:00.000Z',
    deactivatedAt: null,
    createdAt: '2026-08-05T00:00:00.000Z',
    updatedAt: '2026-08-05T00:00:00.000Z',
    activeRoles: ['ADMIN'],
  },
];

describe('TASK-0212 User Management UI Improvements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthContext = {
      user: {
        id: '11111111-1111-4111-8111-111111111111',
        fullName: 'Kebun Owner PIC',
        email: 'owner@kebunmelon.id',
        accountStatus: 'ACTIVE',
        activeRoles: [UserRole.OWNER],
      },
      role: UserRole.OWNER,
      isAuthenticated: true,
    };

    global.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
      if (url.includes('/api/v1/users/bulk-delete')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                deletedCount: JSON.parse(options.body).userIds.length,
                deletedUserIds: JSON.parse(options.body).userIds,
              },
            }),
        });
      }
      if (url.includes('/api/v1/users') && options?.method === 'DELETE') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true }),
        });
      }
      if ((url.includes('/suspend') || url.includes('/activate')) && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true }),
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
                  totalItems: 3,
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

  it('1. role dropdown displays clean translated labels without redundant (OWNER) or (ADMIN)', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Admin Lapangan Satu')).toBeInTheDocument();
    });

    const roleSelect = screen.getByDisplayValue('Semua Peran');
    expect(roleSelect).toBeInTheDocument();

    const options = Array.from(roleSelect.querySelectorAll('option')).map((o) => o.textContent);
    expect(options).toContain('Semua Peran');
    expect(options).toContain('OWNER / PIC');
    expect(options).toContain('Administrator');

    // Strict requirement: no redundant concatenated '(OWNER)' or '(ADMIN)'
    expect(options).not.toContain('Pemilik / PIC');
    expect(options).not.toContain('Administrator (ADMIN)');
    expect(options).not.toContain('OWNER / PIC (OWNER)');
  });

  it('2. Owner account checkbox is disabled with protection tooltip, while Admins are selectable', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Admin Lapangan Satu')).toBeInTheDocument();
    });

    // Owner account row checkbox
    const ownerHeading = screen.getByRole('heading', { level: 3, name: 'Kebun Owner PIC' });
    const ownerRow = ownerHeading.closest('.p-4');
    const ownerCheckbox = ownerRow?.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(ownerCheckbox).toBeDisabled();

    // Admin account row checkbox
    const admin1Heading = screen.getByRole('heading', { level: 3, name: 'Admin Lapangan Satu' });
    const admin1Row = admin1Heading.closest('.p-4');
    const admin1Checkbox = admin1Row?.querySelector(
      'input[type="checkbox"]:not([disabled])'
    ) as HTMLInputElement;
    expect(admin1Checkbox).toBeInTheDocument();
    expect(admin1Checkbox).not.toBeDisabled();
  });

  it('3. Select All checkbox selects all eligible non-owner accounts and shows bulk actions banner', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Admin Lapangan Satu')).toBeInTheDocument();
    });

    const selectAllLabel = screen.getByText('Pilih Semua Akun');
    const selectAllCheckbox = selectAllLabel.parentElement?.querySelector(
      'input[type="checkbox"]'
    ) as HTMLInputElement;
    expect(selectAllCheckbox).toBeInTheDocument();

    // Click select all
    fireEvent.click(selectAllCheckbox);

    // Banner should appear
    await waitFor(() => {
      expect(screen.getAllByText(/2 akun dipilih/i).length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText(idMessages.users.deleteSelected)).toBeInTheDocument();
    expect(screen.getByText(idMessages.users.deselectAll)).toBeInTheDocument();

    // Click Batal Pilih clears selection
    fireEvent.click(screen.getByText(idMessages.users.deselectAll));
    await waitFor(() => {
      expect(screen.queryByText(idMessages.users.deselectAll)).not.toBeInTheDocument();
    });
  });

  it('4. Bulk permanent deletion requires reason (min 5 chars) and submits correctly', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Admin Lapangan Satu')).toBeInTheDocument();
    });

    // Select Admin 1
    const admin1Checkbox = screen.getByLabelText(
      'Pilih akun Admin Lapangan Satu untuk tindakan massal'
    );
    fireEvent.click(admin1Checkbox);

    await waitFor(() => {
      expect(screen.getAllByText(/1 akun dipilih/i).length).toBeGreaterThanOrEqual(1);
    });
    const bulkDeleteBtn = screen.getByRole('button', {
      name: new RegExp(idMessages.users.deleteSelected, 'i'),
    });
    fireEvent.click(bulkDeleteBtn);

    await waitFor(() => {
      expect(screen.getByText('Hapus Permanen Akun Terpilih')).toBeInTheDocument();
    });
    const modal4 = screen
      .getByText('Hapus Permanen Akun Terpilih')
      .closest('.fixed.inset-0') as HTMLElement;
    expect(modal4).not.toBeNull();
    // Verification: Warning message section must be removed from lifecycle modal
    expect(
      within(modal4).queryByText(idMessages.users.permanentDeleteNotice)
    ).not.toBeInTheDocument();
    expect(within(modal4).queryByText(idMessages.users.bulkDeleteWarning)).not.toBeInTheDocument();
    expect(screen.getAllByText('Admin Lapangan Satu').length).toBeGreaterThanOrEqual(2);

    const confirmBtn = screen.getByRole('button', { name: /Hapus Permanen \(\d+ Akun\)/i });
    expect(confirmBtn).not.toBeDisabled(); // Optional reason: enabled by default

    const reasonInput = screen.getByPlaceholderText(idMessages.users.reasonPlaceholder);
    fireEvent.change(reasonInput, { target: { value: 'Pembersihan akun staf magang selesai' } });
    expect(confirmBtn).not.toBeDisabled();

    // Click confirm
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/users/bulk-delete',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            userIds: ['22222222-2222-4222-8222-222222222222'],
            reason: 'Pembersihan akun staf magang selesai',
          }),
        })
      );
    });
  });

  it('5. Individual user cards do not have delete buttons; permanent deletion occurs via bulk selection workflow', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Admin Lapangan Satu')).toBeInTheDocument();
    });

    const admin1Heading = screen.getByRole('heading', { level: 3, name: 'Admin Lapangan Satu' });
    const admin1Row = admin1Heading.closest('.p-4');

    // Confirm individual card does NOT contain a delete button
    const deleteBtn = admin1Row?.querySelector('button.bg-red-50');
    expect(deleteBtn).toBeNull();
    const deleteBtnByText = Array.from(admin1Row?.querySelectorAll('button') || []).find((b) =>
      b.textContent?.includes(idMessages.users.deleteAccount)
    );
    expect(deleteBtnByText).toBeUndefined();

    // Confirm individual card still has suspend button
    const suspendBtn = Array.from(admin1Row?.querySelectorAll('button') || []).find((b) =>
      b.textContent?.includes('Tangguhkan')
    );
    expect(suspendBtn).toBeDefined();

    // Deletion for single account must be triggered via its checkbox
    const admin1Checkbox = screen.getByLabelText(
      'Pilih akun Admin Lapangan Satu untuk tindakan massal'
    );
    fireEvent.click(admin1Checkbox);

    await waitFor(() => {
      expect(screen.getAllByText(/1 akun dipilih/i).length).toBeGreaterThanOrEqual(1);
    });

    const bulkDeleteBtn = screen.getByRole('button', {
      name: new RegExp(idMessages.users.deleteSelected, 'i'),
    });
    fireEvent.click(bulkDeleteBtn);

    await waitFor(() => {
      expect(screen.getByText('Hapus Permanen Akun Terpilih')).toBeInTheDocument();
    });
    const modal5 = screen
      .getByText('Hapus Permanen Akun Terpilih')
      .closest('.fixed.inset-0') as HTMLElement;
    expect(modal5).not.toBeNull();
    // Verification: Warning message section must be removed from lifecycle modal
    expect(
      within(modal5).queryByText(idMessages.users.permanentDeleteNotice)
    ).not.toBeInTheDocument();
    expect(within(modal5).queryByText(idMessages.users.bulkDeleteWarning)).not.toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /Hapus Permanen \(1 Akun\)/i });
    expect(confirmBtn).not.toBeDisabled();

    const reasonInput = screen.getByPlaceholderText(idMessages.users.reasonPlaceholder);
    fireEvent.change(reasonInput, { target: { value: 'Perjanjian kerja telah berakhir' } });
    expect(confirmBtn).not.toBeDisabled();

    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/users/bulk-delete',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            userIds: ['22222222-2222-4222-8222-222222222222'],
            reason: 'Perjanjian kerja telah berakhir',
          }),
        })
      );
    });
  });

  it('6. Single account suspension allows optional reason and submits', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Admin Lapangan Satu')).toBeInTheDocument();
    });

    const admin1Heading = screen.getByRole('heading', { level: 3, name: 'Admin Lapangan Satu' });
    const admin1Row = admin1Heading.closest('.p-4');
    const suspendBtn = Array.from(admin1Row?.querySelectorAll('button') || []).find((b) =>
      b.textContent?.includes('Tangguhkan')
    );
    expect(suspendBtn).toBeDefined();
    fireEvent.click(suspendBtn!);

    await waitFor(() => {
      expect(screen.getByText('Konfirmasi Penangguhan')).toBeInTheDocument();
    });
    // Verification: Warning message section must be removed from lifecycle modal
    expect(screen.queryByText(idMessages.users.suspendNotice)).not.toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: 'Ya, Tangguhkan' });
    expect(confirmBtn).not.toBeDisabled();

    const reasonInput = screen.getByPlaceholderText(idMessages.users.reasonPlaceholder);
    fireEvent.change(reasonInput, { target: { value: 'Pelanggaran SOP operasional lapangan' } });
    expect(confirmBtn).not.toBeDisabled();

    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/users/22222222-2222-4222-8222-222222222222/suspend',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            reason: 'Pelanggaran SOP operasional lapangan',
          }),
        })
      );
    });
  });

  it('7. User Detail modal renders translated role labels', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Admin Lapangan Satu')).toBeInTheDocument();
    });

    const admin1Heading = screen.getByRole('heading', { level: 3, name: 'Admin Lapangan Satu' });
    const admin1Row = admin1Heading.closest('.p-4');
    const viewBtn = Array.from(admin1Row?.querySelectorAll('button') || []).find((b) =>
      b.textContent?.includes('Lihat Detail')
    );
    expect(viewBtn).toBeDefined();
    fireEvent.click(viewBtn!);

    await waitFor(() => {
      expect(screen.getByText('Detail Pengguna')).toBeInTheDocument();
    });

    const roleLabel = screen.getByText('Peran');
    const roleValue = roleLabel.parentElement?.querySelector('.sm\\:col-span-2');
    expect(roleValue?.textContent).toBe('Administrator');
  });

  it('8. Single account reactivation triggers confirmation modal and submits activate endpoint', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Admin Lapangan Dua')).toBeInTheDocument();
    });

    const admin2Heading = screen.getByRole('heading', { level: 3, name: 'Admin Lapangan Dua' });
    const admin2Row = admin2Heading.closest('.p-4');
    const reactivateBtn = Array.from(admin2Row?.querySelectorAll('button') || []).find((b) =>
      b.textContent?.includes('Aktifkan Kembali')
    );
    expect(reactivateBtn).toBeDefined();
    fireEvent.click(reactivateBtn!);

    await waitFor(() => {
      expect(screen.getByText(idMessages.users.confirmActivationTitle)).toBeInTheDocument();
    });
    // Verification: Warning message section must be removed from lifecycle modal
    expect(screen.queryByText(idMessages.users.activateNotice)).not.toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: idMessages.users.confirmActivateBtn });
    expect(confirmBtn).not.toBeDisabled();

    const reasonInput = screen.getByPlaceholderText(idMessages.users.reasonPlaceholder);
    fireEvent.change(reasonInput, { target: { value: 'Selesai masa audit operasional' } });

    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/users/33333333-3333-4333-8333-333333333333/activate',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            reason: 'Selesai masa audit operasional',
          }),
        })
      );
    });
  });
});
