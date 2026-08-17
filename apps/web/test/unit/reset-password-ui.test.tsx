// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ResetPasswordView from '../../app/(auth)/reset-password/reset-password-view';

let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe('TASK-0213 Reset Password UI Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockSearchParams = new URLSearchParams();
  });

  it('renders invalid/expired token banner when token param is missing', () => {
    mockSearchParams = new URLSearchParams(''); // No token

    render(<ResetPasswordView />);

    expect(
      screen.getByText(
        /Tautan reset ini tidak valid, sudah kadaluwarsa, atau telah digunakan|This reset link is invalid, expired, or has already been used/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Minta Tautan Baru|Request New Link/i })
    ).toBeInTheDocument();
  });

  it('renders password inputs and handles successful submission', async () => {
    mockSearchParams = new URLSearchParams('token=test-reset-token-12345');

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Password has been successfully reset.',
        data: {
          user: { id: 'user-01', email: 'test@example.com', fullName: 'Test User' },
          revokedSessionsCount: 1,
        },
      }),
    });

    render(<ResetPasswordView />);

    const newPassInput = screen.getByLabelText(/^Kata Sandi Baru$|^New Password$/i);
    const confirmPassInput = screen.getByLabelText(
      /^Konfirmasi Kata Sandi Baru$|^Confirm New Password$/i
    );
    const submitBtn = screen.getByRole('button', {
      name: /Simpan Kata Sandi Baru|Reset Password/i,
    });

    fireEvent.change(newPassInput, { target: { value: 'SuperSecret123!' } });
    fireEvent.change(confirmPassInput, { target: { value: 'SuperSecret123!' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Kata sandi berhasil diatur ulang|Password successfully reset/i)
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /Menuju Halaman Masuk|Go to Login/i })
      ).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/auth/reset-password',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          token: 'test-reset-token-12345',
          newPassword: 'SuperSecret123!',
          newPasswordConfirmation: 'SuperSecret123!',
        }),
      })
    );
  });

  it('validates password mismatch on client before sending network request', async () => {
    mockSearchParams = new URLSearchParams('token=test-reset-token-12345');
    global.fetch = vi.fn();

    render(<ResetPasswordView />);

    const newPassInput = screen.getByLabelText(/^Kata Sandi Baru$|^New Password$/i);
    const confirmPassInput = screen.getByLabelText(
      /^Konfirmasi Kata Sandi Baru$|^Confirm New Password$/i
    );
    const submitBtn = screen.getByRole('button', {
      name: /Simpan Kata Sandi Baru|Reset Password/i,
    });

    fireEvent.change(newPassInput, { target: { value: 'PasswordA123!' } });
    fireEvent.change(confirmPassInput, { target: { value: 'PasswordB123!' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        /Kata sandi tidak cocok|Passwords do not match/i
      );
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('displays server error banner when reset fails', async () => {
    mockSearchParams = new URLSearchParams('token=expired-token-999');

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'This password reset token has expired.',
        },
      }),
    });

    render(<ResetPasswordView />);

    const newPassInput = screen.getByLabelText(/^Kata Sandi Baru$|^New Password$/i);
    const confirmPassInput = screen.getByLabelText(
      /^Konfirmasi Kata Sandi Baru$|^Confirm New Password$/i
    );
    const submitBtn = screen.getByRole('button', {
      name: /Simpan Kata Sandi Baru|Reset Password/i,
    });

    fireEvent.change(newPassInput, { target: { value: 'SuperSecret123!' } });
    fireEvent.change(confirmPassInput, { target: { value: 'SuperSecret123!' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/This password reset token has expired/i);
    });
  });
});
