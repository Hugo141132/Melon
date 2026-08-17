// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VerifyEmailView, {
  _clearInFlightVerificationsForTesting,
} from '../../app/(auth)/verify-email/verify-email-view';

let mockSearchParams = new URLSearchParams();

export const mockRouter = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
}));

describe('TASK-0214 Verify Email UI Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    _clearInFlightVerificationsForTesting();
    mockSearchParams = new URLSearchParams();
    mockRouter.push.mockClear();
    mockRouter.replace.mockClear();
    mockRouter.refresh.mockClear();
  });

  it('1. Token present: shows verifying loading state and calls POST /api/v1/auth/verify-email', async () => {
    mockSearchParams = new URLSearchParams({ token: 'test-raw-token-123' });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Email address has been successfully verified.',
        data: {
          user: {
            id: '111',
            email: 'owner@example.com',
            fullName: 'Test Owner',
            emailVerifiedAt: new Date().toISOString(),
          },
        },
      }),
    });

    render(<VerifyEmailView />);

    await waitFor(() => {
      expect(
        screen.getByText(/Email verified successfully!|Email berhasil diverifikasi!/i)
      ).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/auth/verify-email',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: 'test-raw-token-123' }),
      })
    );
  });

  it('1.5. Token present (Admin): redirects to status page upon successful verification', async () => {
    mockSearchParams = new URLSearchParams({ token: 'test-raw-token-admin' });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Email address has been successfully verified.',
        data: {
          user: {
            id: '222',
            email: 'admin@example.com',
            fullName: 'Test Admin',
            accountStatus: 'PENDING_APPROVAL',
            emailVerifiedAt: new Date().toISOString(),
          },
        },
      }),
    });

    render(<VerifyEmailView />);

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/status?status=PENDING_APPROVAL');
    });
  });

  it('2. Token invalid/expired: shows error message with button to request a new link', async () => {
    mockSearchParams = new URLSearchParams({ token: 'expired-token' });

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Email verification token has expired.',
        },
      }),
    });

    render(<VerifyEmailView />);

    await waitFor(() => {
      expect(
        screen.getByText(/Email verification token has expired|Verifikasi email gagal/i)
      ).toBeInTheDocument();
    });

    const requestNewBtn = screen.getByRole('button', {
      name: /Request New Link|Minta Tautan Baru/i,
    });
    expect(requestNewBtn).toBeInTheDocument();

    // Clicking request new link switches to the email input form
    fireEvent.click(requestNewBtn);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Send Verification Link|Kirim Tautan Verifikasi/i })
      ).toBeInTheDocument();
    });
  });

  it('3. Email param present (from login redirect or register): shows check email instruction and functional resend button', async () => {
    mockSearchParams = new URLSearchParams({ email: 'owner@kebunmelon.local' });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        message: 'If the email is registered and unverified, a verification link has been sent.',
      }),
    });

    render(<VerifyEmailView />);

    expect(screen.getByText('owner@kebunmelon.local')).toBeInTheDocument();

    const resendBtn = screen.getByRole('button', {
      name: /Resend Verification Email|Kirim Ulang Email Verifikasi|Resend Email/i,
    });
    expect(resendBtn).toBeEnabled();

    fireEvent.click(resendBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/auth/resend-verification',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'owner@kebunmelon.local' }),
        })
      );
    });
  });

  it('4. No query param: renders direct email form, submits to resend endpoint, transitions to instruction view', async () => {
    mockSearchParams = new URLSearchParams();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        message: 'If the email is registered and unverified, a verification link has been sent.',
      }),
    });

    render(<VerifyEmailView />);

    const emailInput = screen.getByLabelText(/Alamat Email|Email Address/i);
    const submitBtn = screen.getByRole('button', {
      name: /Send Verification Link|Kirim Tautan Verifikasi/i,
    });

    fireEvent.change(emailInput, { target: { value: 'custom.owner@example.com' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/auth/resend-verification',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'custom.owner@example.com' }),
        })
      );
      expect(screen.getByText('custom.owner@example.com')).toBeInTheDocument();
    });
  });

  it('5. React.StrictMode double-invocation: makes exactly 1 POST request and Admin redirects to /status?status=PENDING_APPROVAL', async () => {
    mockSearchParams = new URLSearchParams({ token: 'strict-mode-admin-token' });

    global.fetch = vi.fn().mockImplementation(async () => {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        ok: true,
        json: async () => ({
          success: true,
          message: 'Email address has been successfully verified.',
          data: {
            user: {
              id: 'strict-admin-id',
              email: 'strictadmin@example.com',
              fullName: 'Strict Mode Admin',
              accountStatus: 'PENDING_APPROVAL',
              emailVerifiedAt: new Date().toISOString(),
            },
          },
        }),
      };
    });

    render(
      <React.StrictMode>
        <VerifyEmailView />
      </React.StrictMode>
    );

    // Initial render shows loading/verifying
    expect(
      screen.getByText(/Verifying your email...|Memverifikasi email Anda.../i)
    ).toBeInTheDocument();

    // Verify it leaves Processing and redirects
    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/status?status=PENDING_APPROVAL');
    });

    // Exactly 1 POST request was made despite StrictMode mounting twice
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/auth/verify-email',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: 'strict-mode-admin-token' }),
      })
    );
  });

  it('6. React.StrictMode double-invocation (Owner): makes exactly 1 POST request and transitions to success view', async () => {
    mockSearchParams = new URLSearchParams({ token: 'strict-mode-owner-token' });

    global.fetch = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        ok: true,
        json: async () => ({
          success: true,
          message: 'Email address has been successfully verified.',
          data: {
            user: {
              id: 'strict-owner-id',
              email: 'strictowner@example.com',
              fullName: 'Strict Mode Owner',
              accountStatus: 'ACTIVE',
              emailVerifiedAt: new Date().toISOString(),
            },
          },
        }),
      };
    });

    render(
      <React.StrictMode>
        <VerifyEmailView />
      </React.StrictMode>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Email verified successfully!|Email berhasil diverifikasi!/i)
      ).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('7. React.StrictMode double-invocation (Error): makes exactly 1 POST request and transitions to controlled error view', async () => {
    mockSearchParams = new URLSearchParams({ token: 'strict-mode-expired-token' });

    global.fetch = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        ok: false,
        json: async () => ({
          success: false,
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Email verification token has expired.',
          },
        }),
      };
    });

    render(
      <React.StrictMode>
        <VerifyEmailView />
      </React.StrictMode>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Email verification token has expired|Verifikasi email gagal/i)
      ).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('button', { name: /Request New Link|Minta Tautan Baru/i })
    ).toBeInTheDocument();
  });

  it('8. Remount during in-flight request: delivers result to second mount without duplicate POST', async () => {
    mockSearchParams = new URLSearchParams({ token: 'remount-admin-token' });

    let resolveFetch: (value: any) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    global.fetch = vi.fn().mockImplementation(() => fetchPromise);

    // First mount
    const { unmount } = render(<VerifyEmailView />);

    // Unmount while request is still pending
    unmount();

    // Second mount with the same token
    render(<VerifyEmailView />);

    // Resolve the original request
    resolveFetch!({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Email address has been successfully verified.',
        data: {
          user: {
            id: 'remount-admin-id',
            email: 'remountadmin@example.com',
            fullName: 'Remount Admin',
            accountStatus: 'PENDING_APPROVAL',
            emailVerifiedAt: new Date().toISOString(),
          },
        },
      }),
    });

    // The second mount should receive the result and trigger router.replace
    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/status?status=PENDING_APPROVAL');
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('9. Cache eviction after success: subsequent mount with same token contacts backend again and receives used-token error', async () => {
    mockSearchParams = new URLSearchParams({ token: 'reused-token-test' });

    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // First call succeeds
        return {
          ok: true,
          json: async () => ({
            success: true,
            message: 'Email address has been successfully verified.',
            data: {
              user: {
                id: 'reused-user-1',
                email: 'reused@example.com',
                fullName: 'Reused User',
                accountStatus: 'ACTIVE',
                emailVerifiedAt: new Date().toISOString(),
              },
            },
          }),
        };
      }
      // Second call (link reopened later) fails with TOKEN_ALREADY_USED
      return {
        ok: false,
        json: async () => ({
          success: false,
          error: {
            code: 'TOKEN_ALREADY_USED',
            message: 'Email verification token has already been used.',
          },
        }),
      };
    });

    // 1st visit: mounts and resolves
    const { unmount } = render(<VerifyEmailView />);
    await waitFor(() => {
      expect(
        screen.getByText(/Email verified successfully!|Email berhasil diverifikasi!/i)
      ).toBeInTheDocument();
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Unmount
    unmount();

    // 2nd visit: reopen link later with same token
    render(<VerifyEmailView />);

    // Must contact backend again and display the error response
    await waitFor(() => {
      expect(
        screen.getByText(/Email verification token has already been used|Verifikasi email gagal/i)
      ).toBeInTheDocument();
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('10. Cache eviction after network failure: temporary failure does not poison future verification', async () => {
    mockSearchParams = new URLSearchParams({ token: 'network-retry-token' });

    let attempt = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      attempt++;
      if (attempt === 1) {
        // First attempt fails with network error
        throw new Error('Network timeout');
      }
      // Second attempt succeeds
      return {
        ok: true,
        json: async () => ({
          success: true,
          message: 'Email address has been successfully verified.',
          data: {
            user: {
              id: 'retry-owner-id',
              email: 'retryowner@example.com',
              fullName: 'Retry Owner',
              accountStatus: 'ACTIVE',
              emailVerifiedAt: new Date().toISOString(),
            },
          },
        }),
      };
    });

    // 1st attempt: mounts and encounters error
    const { unmount } = render(<VerifyEmailView />);
    await waitFor(() => {
      expect(screen.getByText(/Network timeout|Verifikasi email gagal/i)).toBeInTheDocument();
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);

    unmount();

    // 2nd attempt: component remounts / retries after network recovers
    render(<VerifyEmailView />);

    // Should fetch again and succeed
    await waitFor(() => {
      expect(
        screen.getByText(/Email verified successfully!|Email berhasil diverifikasi!/i)
      ).toBeInTheDocument();
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
