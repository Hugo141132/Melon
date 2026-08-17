import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useGuestGuard } from '@/lib/auth/use-guest-guard';

const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe('TASK-0213 useGuestGuard Hook Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('1. Redirects to / when user has a genuinely valid, active authenticated session', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          authenticated: true,
          user: {
            id: 'user-1',
            email: 'admin@kebunmelon.id',
            accountStatus: 'ACTIVE',
          },
        },
      }),
    });

    const { result } = renderHook(() => useGuestGuard('/'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/');
    });

    expect(result.current.isChecking).toBe(false);
  });

  it('2. Does NOT redirect when user has no active session (unauthenticated)', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          authenticated: false,
          user: null,
        },
      }),
    });

    const { result } = renderHook(() => useGuestGuard('/'));

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('3. Does NOT redirect when session token is expired, revoked, or invalid', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          authenticated: false,
          user: null,
        },
      }),
    });

    const { result } = renderHook(() => useGuestGuard('/'));

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('4. Does NOT redirect to dashboard when user account is PENDING_APPROVAL', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          authenticated: true,
          user: {
            id: 'user-pending',
            email: 'pending@kebunmelon.id',
            accountStatus: 'PENDING_APPROVAL',
          },
        },
      }),
    });

    const { result } = renderHook(() => useGuestGuard('/'));

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('5. Handles fetch network errors gracefully without crashing or redirecting', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useGuestGuard('/'));

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });
});
