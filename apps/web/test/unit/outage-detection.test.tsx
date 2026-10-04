import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AuthProvider,
  useAuth,
  AUTH_OUTAGE_EVENT,
  AUTH_UNAUTHORIZED_EVENT,
  OUTAGE_CONSECUTIVE_FAILURE_LIMIT,
} from '@/context/AuthContext';
import { UserRole, AccountStatus } from '@kebun-melon/contracts';
import type { AuthenticatedUserSession } from '@/lib/auth/rbac';

const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    prefetch: vi.fn(),
  }),
  usePathname: () => '/dashboard',
}));

const mockUserSession: AuthenticatedUserSession = {
  id: 'user-001',
  email: 'owner@example.com',
  fullName: 'Owner Test',
  activeRoles: [UserRole.OWNER],
  accountStatus: AccountStatus.ACTIVE,
};

function ConsumerComponent() {
  const { user, isAuthenticated, revalidateSession } = useAuth();
  return (
    <div>
      <span data-testid="auth-status">{isAuthenticated ? 'authenticated' : 'unauthenticated'}</span>
      <span data-testid="user-email">{user?.email || 'none'}</span>
      <button data-testid="btn-revalidate" onClick={() => revalidateSession?.()}>
        Revalidate
      </button>
    </div>
  );
}

describe('Automatic Outage Detection & Client State Protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    sessionStorage.setItem('kebun_melon_device_cache', JSON.stringify([{ id: 'dev-1' }]));
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('triggers outage sign-out when backend encounters 3 consecutive 503 errors', async () => {
    const outageSpy = vi.fn();
    const unauthSpy = vi.fn();
    window.addEventListener(AUTH_OUTAGE_EVENT, outageSpy);
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, unauthSpy);

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    });

    render(
      <AuthProvider initialSession={mockUserSession}>
        <ConsumerComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');

    // Mount check triggers 1 attempt. Reset spies for button-triggered sequence.
    outageSpy.mockClear();
    unauthSpy.mockClear();
    mockReplace.mockClear();

    const btn = screen.getByTestId('btn-revalidate');

    // Button Click 1 (attempt 2 total)
    await act(async () => {
      btn.click();
    });
    expect(outageSpy).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();

    // Button Click 2 (attempt 3 total: threshold reached)
    await act(async () => {
      btn.click();
    });

    expect(outageSpy).toHaveBeenCalledTimes(1);
    expect(unauthSpy).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('kebun_melon_device_cache')).toBeNull();
    // Verify protected content disappeared immediately and was replaced by the Outage View
    expect(screen.queryByTestId('auth-status')).toBeNull();
    expect(screen.getByTestId('outage-title')).toHaveTextContent('Koneksi Server Terputus');
    expect(mockReplace).toHaveBeenCalledWith('/login?reason=outage');

    window.removeEventListener(AUTH_OUTAGE_EVENT, outageSpy);
    window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, unauthSpy);
  });

  it('distinguishes explicit 401 unauthorized from server outage without triggering outage reason', async () => {
    const outageSpy = vi.fn();
    const unauthSpy = vi.fn();
    window.addEventListener(AUTH_OUTAGE_EVENT, outageSpy);
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, unauthSpy);

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });

    render(
      <AuthProvider initialSession={mockUserSession}>
        <ConsumerComponent />
      </AuthProvider>
    );

    // Initial mount check with 401 triggers unauthenticated redirect
    await waitFor(() => {
      expect(unauthSpy).toHaveBeenCalled();
      expect(outageSpy).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalledWith('/login?reason=outage');
    });

    window.removeEventListener(AUTH_OUTAGE_EVENT, outageSpy);
    window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, unauthSpy);
  });

  it('triggers outage on persistent network exceptions (connection refused / timeout)', async () => {
    const outageSpy = vi.fn();
    window.addEventListener(AUTH_OUTAGE_EVENT, outageSpy);

    global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch (ECONNREFUSED)'));

    render(
      <AuthProvider initialSession={mockUserSession}>
        <ConsumerComponent />
      </AuthProvider>
    );

    const btn = screen.getByTestId('btn-revalidate');

    for (let i = 0; i < OUTAGE_CONSECUTIVE_FAILURE_LIMIT; i++) {
      await act(async () => {
        btn.click();
      });
    }

    expect(outageSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('auth-status')).toBeNull();
    expect(screen.getByTestId('outage-title')).toHaveTextContent('Koneksi Server Terputus');
    expect(mockReplace).toHaveBeenCalledWith('/login?reason=outage');

    window.removeEventListener(AUTH_OUTAGE_EVENT, outageSpy);
  });
});
