// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import LoginView from '../../app/(auth)/login/login-view';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    role: null,
    setUser: vi.fn(),
    logout: vi.fn(),
    revalidateAuth: vi.fn(),
  }),
}));

describe('TASK-0218 Login View Single-Session Recovery UI Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Renders login form and displays recovery prompt on 409 ACTIVE_SESSION_EXISTS', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        success: false,
        error: {
          code: 'ACTIVE_SESSION_EXISTS',
          message: 'An active session already exists for this account.',
          canRecover: true,
        },
      }),
    });

    render(<LoginView />);

    const emailInput = screen.getByLabelText(/Alamat Email|Email/i);
    const passwordInput = screen.getByLabelText(/Kata Sandi|Password/i);
    const submitBtn = screen.getByRole('button', { name: /Masuk|Sign In|Log In/i });

    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'ValidPassword123!' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(
          /sesi aktif di peramban atau perangkat lain|active session on another browser or device/i
        )
      ).toBeInTheDocument();
      // Recovery button appears
      expect(
        screen.getByRole('button', { name: /Kirim Kode Pemulihan|Send Recovery Code/i })
      ).toBeInTheDocument();
    });
  });

  it('2. Clicking recovery button opens modal, requests challenge, and displays 6-digit OTP step with countdown', async () => {
    render(<LoginView />);

    const emailInput = screen.getByLabelText(/Alamat Email|Email/i);
    const passwordInput = screen.getByLabelText(/Kata Sandi|Password/i);
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'ValidPassword123!' } });

    // 1st fetch: login returns 409
    // 2nd fetch: challenge returns 200
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          success: false,
          error: {
            code: 'ACTIVE_SESSION_EXISTS',
            message: 'Active session exists',
            canRecover: true,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            challengeId: '11111111-1111-1111-1111-111111111111',
            expiresInSeconds: 60,
            maskedEmail: 'u***r@example.com',
          },
        }),
      });

    const submitBtn = screen.getByRole('button', { name: /Masuk|Sign In|Log In/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Kirim Kode Pemulihan|Send Recovery Code/i })
      ).toBeInTheDocument();
    });

    const recoverBtn = screen.getByRole('button', {
      name: /Kirim Kode Pemulihan|Send Recovery Code/i,
    });
    fireEvent.click(recoverBtn);

    // Modal dialog is shown
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');
    const modalSendCodeBtn = within(dialog).getByRole('button', {
      name: /Kirim Kode Pemulihan|Send Recovery Code/i,
    });
    fireEvent.click(modalSendCodeBtn);

    // In OTP step, shows masked email and OTP input
    await waitFor(() => {
      expect(within(dialog).getByText(/u\*\*\*r@example\.com/)).toBeInTheDocument();
      expect(within(dialog).getByPlaceholderText('000000')).toBeInTheDocument();
      expect(
        within(dialog).getByRole('button', {
          name: /Konfirmasi & Pulihkan Sesi|Confirm & Recover Session/i,
        })
      ).toBeInTheDocument();
    });
  });

  it('3. Submitting 6-digit OTP calls verify endpoint and redirects on success', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          user: {
            id: '11111111-1111-1111-1111-111111111111',
            fullName: 'User Name',
            email: 'user@example.com',
            role: 'ADMIN',
            activeRoles: ['ADMIN'],
            accountStatus: 'ACTIVE',
          },
        },
      }),
    });

    render(<LoginView />);

    // Simulate opening modal and getting to OTP step directly by triggering login 409
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          success: false,
          error: {
            code: 'ACTIVE_SESSION_EXISTS',
            message: 'Active session exists',
            canRecover: true,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            challengeId: '11111111-1111-1111-1111-111111111111',
            expiresInSeconds: 60,
            maskedEmail: 'u***r@example.com',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            user: {
              id: '11111111-1111-1111-1111-111111111111',
              fullName: 'User Name',
              email: 'user@example.com',
              role: 'ADMIN',
              activeRoles: ['ADMIN'],
              accountStatus: 'ACTIVE',
            },
          },
        }),
      });

    const emailInput = screen.getByLabelText(/Alamat Email|Email/i);
    const passwordInput = screen.getByLabelText(/Kata Sandi|Password/i);
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'ValidPassword123!' } });

    const submitBtn = screen.getByRole('button', { name: /Masuk|Sign In|Log In/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Kirim Kode Pemulihan|Send Recovery Code/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', { name: /Kirim Kode Pemulihan|Send Recovery Code/i })
    );

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');
    const modalSendCodeBtn = within(dialog).getByRole('button', {
      name: /Kirim Kode Pemulihan|Send Recovery Code/i,
    });
    fireEvent.click(modalSendCodeBtn);

    await waitFor(() => {
      expect(within(dialog).getByPlaceholderText('000000')).toBeInTheDocument();
    });

    const otpInput = within(dialog).getByPlaceholderText('000000');
    fireEvent.change(otpInput, { target: { value: '654321' } });

    const confirmBtn = within(dialog).getByRole('button', {
      name: /Konfirmasi & Pulihkan Sesi|Confirm & Recover Session/i,
    });
    expect(confirmBtn).toBeEnabled();
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/auth/session-recovery/verify',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            challengeId: '11111111-1111-1111-1111-111111111111',
            otp: '654321',
          }),
        })
      );
    });
  });
});
