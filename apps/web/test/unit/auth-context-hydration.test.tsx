import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AccountStatus, UserRole } from '@kebun-melon/contracts';
import type { AuthenticatedUserSession } from '@/lib/auth/rbac';

describe('AuthContext Hydration & Stale SSR Protection Suite', () => {
  const mockUserSession: AuthenticatedUserSession = {
    id: '11111111-2222-3333-4444-555555555555',
    fullName: 'Test Farm Operator',
    email: 'operator@kebunmelon.id',
    accountStatus: AccountStatus.ACTIVE,
    activeRoles: [UserRole.OWNER],
  };

  let originalLocation: Location;

  beforeEach(() => {
    originalLocation = window.location;
    let hrefValue = 'http://localhost/dashboard';
    const mockLocation = {
      ...originalLocation,
      get href() {
        return hrefValue;
      },
      set href(v: string) {
        hrefValue = v;
      },
      pathname: '/dashboard',
    };
    try {
      Object.defineProperty(window, 'location', {
        value: mockLocation,
        writable: true,
        configurable: true,
      });
    } catch {
      // fallback
    }
  });

  afterEach(() => {
    try {
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
        configurable: true,
      });
    } catch {
      // fallback
    }
  });

  it('1. Initializes with initialSession when non-null on mount', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider initialSession={mockUserSession}>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.id).toBe(mockUserSession.id);
    expect(result.current.user?.fullName).toBe('Test Farm Operator');
    expect(result.current.role).toBe(UserRole.OWNER);
  });

  it('2. Initializes with null session on public pages (/login)', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider initialSession={null}>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.role).toBeNull();
  });

  it('3. Synchronously hydrates AuthContext via setUser() without waiting for SSR refresh', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider initialSession={null}>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(false);

    act(() => {
      result.current.setUser?.(mockUserSession);
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.fullName).toBe('Test Farm Operator');
    expect(result.current.role).toBe(UserRole.OWNER);
  });

  it('4. Stale initialSession=null does NOT clobber freshly authenticated client state', () => {
    let currentInitialSession: AuthenticatedUserSession | null = null;

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider initialSession={currentInitialSession}>{children}</AuthProvider>
    );

    const { result, rerender } = renderHook(() => useAuth(), { wrapper });

    // Client logs in
    act(() => {
      result.current.setUser?.(mockUserSession);
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.fullName).toBe('Test Farm Operator');

    // Background pass sends stale initialSession = null
    currentInitialSession = null;
    rerender();

    // Client state remains preserved
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.fullName).toBe('Test Farm Operator');
    expect(result.current.user?.id).toBe(mockUserSession.id);
  });

  it('5. New non-null initialSession updates session (e.g. hard refresh SSR)', () => {
    let currentInitialSession: AuthenticatedUserSession | null = null;

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider initialSession={currentInitialSession}>{children}</AuthProvider>
    );

    const { result, rerender } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(false);

    // Hard refresh or fresh SSR navigation provides new session
    const updatedSession: AuthenticatedUserSession = {
      ...mockUserSession,
      fullName: 'Updated Operator Name',
    };
    currentInitialSession = updatedSession;
    rerender();

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.fullName).toBe('Updated Operator Name');
  });

  it('6. Explicit setUser(null) clears session on logout', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider initialSession={mockUserSession}>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(true);

    act(() => {
      result.current.setUser?.(null);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.role).toBeNull();
  });

  it('7. Server session loss (initialSession transitioning from authenticated to null) clears client state', () => {
    let currentInitialSession: AuthenticatedUserSession | null = mockUserSession;

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider initialSession={currentInitialSession}>{children}</AuthProvider>
    );

    const { result, rerender } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.id).toBe(mockUserSession.id);

    // Server re-evaluation finds no session (e.g. cookie removed / session expired)
    currentInitialSession = null;
    rerender();

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.role).toBeNull();
  });

  it('8. dispatchUnauthenticatedEvent / invalidateSession clears client auth state immediately', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider initialSession={mockUserSession}>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.fullName).toBe('Test Farm Operator');

    act(() => {
      result.current.invalidateSession?.();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.role).toBeNull();
  });

  it('9. Active user remains authenticated when active session validation returns valid session', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            authenticated: true,
            user: {
              id: mockUserSession.id,
              fullName: mockUserSession.fullName,
              email: mockUserSession.email,
              role: UserRole.OWNER,
              accountStatus: AccountStatus.ACTIVE,
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider initialSession={mockUserSession}>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(true);

    await act(async () => {
      await result.current.revalidateSession?.();
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.id).toBe(mockUserSession.id);
    expect(fetchSpy).toHaveBeenCalledWith('/api/v1/auth/session', expect.any(Object));

    fetchSpy.mockRestore();
  });

  it('10. Missing session cookie (session endpoint returns authenticated: false) on window focus clears client state', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            authenticated: false,
            user: null,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider initialSession={mockUserSession}>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isAuthenticated).toBe(true);

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.role).toBeNull();
    expect(window.location.href).toBe('/login?redirect=%2Fdashboard');

    fetchSpy.mockRestore();
  });

  it('11. HTTP 401 Unauthorized from session endpoint on visibilitychange clears client state', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Session expired' },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider initialSession={mockUserSession}>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isAuthenticated).toBe(true);

    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.role).toBeNull();
    expect(window.location.href).toBe('/login?redirect=%2Fdashboard');

    fetchSpy.mockRestore();
  });

  it('12. Debounce prevents redundant session validation calls within 2 seconds', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { authenticated: true, user: mockUserSession },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider initialSession={mockUserSession}>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isAuthenticated).toBe(true);

    // Initial mount might trigger 1 check
    const callsBefore = fetchSpy.mock.calls.length;

    // Trigger rapid focus events
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('focus'));
    });

    // Should not fire multiple additional network requests due to 2000ms debounce
    expect(fetchSpy.mock.calls.length).toBeLessThanOrEqual(callsBefore + 1);

    fetchSpy.mockRestore();
  });
});
