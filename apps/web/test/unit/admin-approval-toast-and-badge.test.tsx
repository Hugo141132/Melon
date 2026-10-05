import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AdminApprovalToastNotifier from '@/components/notifications/AdminApprovalToastNotifier';
import * as realtimeHook from '@/hooks/use-realtime-monitoring';
import * as authContext from '@/context/AuthContext';
import { UserRole, AccountStatus } from '@kebun-melon/contracts';

describe('Admin Approval Notification & Top Toast Unit Tests', () => {
  let mockHookReturn: realtimeHook.UseRealtimeReturn = {
    status: 'OPEN',
    lastEvent: null,
    error: null,
  };

  let currentOnEvent: ((name: string, data: any) => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    currentOnEvent = undefined;

    mockHookReturn = {
      status: 'OPEN',
      lastEvent: null,
      error: null,
    };

    vi.spyOn(realtimeHook, 'useRealtimeMonitoring').mockImplementation((options) => {
      if (options?.onEvent) {
        currentOnEvent = options.onEvent;
      }
      return mockHookReturn;
    });

    // Default mock as active OWNER
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: {
        id: 'owner-uuid-1',
        fullName: 'Budi Santoso',
        email: 'owner@kebunmelon.com',
        activeRoles: [UserRole.OWNER],
        accountStatus: AccountStatus.ACTIVE,
      },
      role: UserRole.OWNER,
      isAuthenticated: true,
      isOutage: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders top toast when admin.approval.requested event is received by OWNER', async () => {
    render(<AdminApprovalToastNotifier />);

    // Initially no toast is rendered
    expect(screen.queryByTestId('admin-approval-toast')).not.toBeInTheDocument();

    // Emitted admin approval requested event
    await act(async () => {
      if (currentOnEvent) {
        currentOnEvent('admin.approval.requested', {
          userId: 'applicant-101',
          fullName: 'Siti Aminah',
          email: 'siti@example.com',
          requestedAt: '2026-10-05T12:00:00Z',
        });
      }
    });

    const toast = await screen.findByTestId('admin-approval-toast');
    expect(toast).toBeInTheDocument();
    expect(screen.getByText('Siti Aminah')).toBeInTheDocument();
    expect(screen.getByText('siti@example.com')).toBeInTheDocument();

    const reviewLink = screen.getByTestId('btn-toast-review');
    expect(reviewLink).toHaveAttribute('href', '/approvals');
    expect(screen.getByText('Lihat')).toBeInTheDocument();
    expect(screen.queryByText(/MISSING_MESSAGE/i)).not.toBeInTheDocument();
  });

  it('renders review link text as View without missing message in en locale', async () => {
    document.cookie = 'locale=en; path=/';
    render(<AdminApprovalToastNotifier />);

    await act(async () => {
      if (currentOnEvent) {
        currentOnEvent('admin.approval.requested', {
          userId: 'applicant-103',
          fullName: 'Jane Doe',
          email: 'jane@example.com',
          requestedAt: '2026-10-05T12:00:00Z',
        });
      }
    });

    const toast = await screen.findByTestId('admin-approval-toast');
    expect(toast).toBeInTheDocument();
    expect(screen.getByText('View')).toBeInTheDocument();
    expect(screen.queryByText(/MISSING_MESSAGE/i)).not.toBeInTheDocument();
    document.cookie = 'locale=id; path=/';
  });

  it('deduplicates duplicate admin.approval.requested events without multiple re-renders', async () => {
    render(<AdminApprovalToastNotifier />);

    await act(async () => {
      if (currentOnEvent) {
        currentOnEvent('admin.approval.requested', {
          userId: 'applicant-102',
          fullName: 'Ahmad Dahlan',
          email: 'ahmad@example.com',
          requestedAt: '2026-10-05T12:00:00Z',
        });
      }
    });

    expect(await screen.findByText('Ahmad Dahlan')).toBeInTheDocument();

    // Second identical event should be ignored by seenEventKeysRef
    await act(async () => {
      if (currentOnEvent) {
        currentOnEvent('admin.approval.requested', {
          userId: 'applicant-102',
          fullName: 'Ahmad Dahlan',
          email: 'ahmad@example.com',
          requestedAt: '2026-10-05T12:00:00Z',
        });
      }
    });

    // Still only one toast
    expect(screen.getAllByTestId('admin-approval-toast').length).toBe(1);
  });

  it('does NOT render toast if current user role is ADMIN (non-OWNER)', async () => {
    // Switch to ADMIN role
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: {
        id: 'admin-uuid-1',
        fullName: 'Admin User',
        email: 'admin@kebunmelon.com',
        activeRoles: [UserRole.ADMIN],
        accountStatus: AccountStatus.ACTIVE,
      },
      role: UserRole.ADMIN,
      isAuthenticated: true,
      isOutage: false,
    });

    render(<AdminApprovalToastNotifier />);

    await act(async () => {
      if (currentOnEvent) {
        currentOnEvent('admin.approval.requested', {
          userId: 'applicant-103',
          fullName: 'Rahman',
          email: 'rahman@example.com',
          requestedAt: '2026-10-05T12:00:00Z',
        });
      }
    });

    expect(screen.queryByTestId('admin-approval-toast')).not.toBeInTheDocument();
  });

  it('dismisses toast when admin.approval.decided event is received for target user', async () => {
    render(<AdminApprovalToastNotifier />);

    await act(async () => {
      if (currentOnEvent) {
        currentOnEvent('admin.approval.requested', {
          userId: 'applicant-104',
          fullName: 'Dewi Lestari',
          email: 'dewi@example.com',
          requestedAt: '2026-10-05T12:00:00Z',
        });
      }
    });

    expect(await screen.findByText('Dewi Lestari')).toBeInTheDocument();

    // Emitted decision event
    await act(async () => {
      if (currentOnEvent) {
        currentOnEvent('admin.approval.decided', {
          userId: 'applicant-104',
          decision: 'APPROVED',
        });
      }
    });

    expect(screen.queryByTestId('admin-approval-toast')).not.toBeInTheDocument();
  });
});
