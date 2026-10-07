import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAlertBadge, ALERT_UPDATED_EVENT, resetAlertBadgeState } from '@/hooks/useAlertBadge';
import * as authContext from '@/context/AuthContext';
import { UserRole, AccountStatus } from '@kebun-melon/contracts';

let mockPathname = '/';

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

function ConsumerA() {
  const { count, isLoading } = useAlertBadge();
  return (
    <div data-testid="consumer-a">
      <span data-testid="count-a">{count}</span>
      <span data-testid="loading-a">{isLoading ? 'loading' : 'idle'}</span>
    </div>
  );
}

function ConsumerB() {
  const { count, isLoading, refetch } = useAlertBadge();
  return (
    <div data-testid="consumer-b">
      <span data-testid="count-b">{count}</span>
      <span data-testid="loading-b">{isLoading ? 'loading' : 'idle'}</span>
      <button data-testid="btn-refetch-b" onClick={() => refetch(true)}>
        Refetch
      </button>
    </div>
  );
}

function DualBadgeApp() {
  return (
    <div>
      <ConsumerA />
      <ConsumerB />
    </div>
  );
}

describe('useAlertBadge Hook Shared State & Deduplication Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = '/';
    resetAlertBadgeState();

    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: {
        id: 'user-1',
        fullName: 'Admin User',
        email: 'admin@kebunmelon.com',
        activeRoles: [UserRole.ADMIN],
        accountStatus: AccountStatus.ACTIVE,
      },
      role: UserRole.ADMIN,
      isAuthenticated: true,
      isOutage: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deduplicates concurrent fetches across multiple consumers and shares state', async () => {
    let fetchCount = 0;
    const globalFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/alerts')) {
        fetchCount++;
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({
            success: true,
            meta: { pagination: { totalItems: 7 } },
          }),
        };
      }
      return { ok: false, status: 404, headers: new Headers(), json: async () => ({}) };
    });
    vi.stubGlobal('fetch', globalFetch);

    render(<DualBadgeApp />);

    await waitFor(() => {
      expect(screen.getByTestId('count-a').textContent).toBe('7');
      expect(screen.getByTestId('count-b').textContent).toBe('7');
    });

    // Despite ConsumerA and ConsumerB mounting simultaneously, only ONE fetch should occur
    expect(fetchCount).toBe(1);
  });

  it('suppresses alert badge fetch when route is /notifications', async () => {
    mockPathname = '/notifications';
    let fetchCount = 0;
    const globalFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/alerts')) {
        fetchCount++;
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({
            success: true,
            meta: { pagination: { totalItems: 12 } },
          }),
        };
      }
      return { ok: false, status: 404, headers: new Headers(), json: async () => ({}) };
    });
    vi.stubGlobal('fetch', globalFetch);

    render(<DualBadgeApp />);

    // Should remain 0 and not trigger fetch on /notifications
    expect(screen.getByTestId('count-a').textContent).toBe('0');
    expect(screen.getByTestId('count-b').textContent).toBe('0');
    expect(fetchCount).toBe(0);
  });

  it('synchronizes count directly when ALERT_UPDATED_EVENT contains detail.count', async () => {
    mockPathname = '/notifications';
    const globalFetch = vi.fn();
    vi.stubGlobal('fetch', globalFetch);

    render(<DualBadgeApp />);

    expect(screen.getByTestId('count-a').textContent).toBe('0');
    expect(screen.getByTestId('count-b').textContent).toBe('0');

    // Simulate event dispatched from /notifications page
    act(() => {
      window.dispatchEvent(new CustomEvent(ALERT_UPDATED_EVENT, { detail: { count: 4 } }));
    });

    expect(screen.getByTestId('count-a').textContent).toBe('4');
    expect(screen.getByTestId('count-b').textContent).toBe('4');
    // Still zero network fetches made
    expect(globalFetch).not.toHaveBeenCalled();
  });

  it('respects HTTP 429 response and suppresses further background fetches', async () => {
    let fetchCount = 0;
    const globalFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/alerts')) {
        fetchCount++;
        return {
          ok: false,
          status: 429,
          headers: new Headers({ 'Retry-After': '60' }),
          json: async () => ({ success: false, error: 'Too Many Requests' }),
        };
      }
      return { ok: false, status: 404, headers: new Headers(), json: async () => ({}) };
    });
    vi.stubGlobal('fetch', globalFetch);

    render(<DualBadgeApp />);

    await waitFor(() => {
      expect(fetchCount).toBe(1);
    });

    // Attempting a non-forced fetch right after 429 should be suppressed by the backoff window
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(fetchCount).toBe(1);
  });
});
