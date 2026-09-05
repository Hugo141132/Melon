import { describe, it, expect } from 'vitest';
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
});
