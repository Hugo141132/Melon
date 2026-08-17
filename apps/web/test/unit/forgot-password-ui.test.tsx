// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ForgotPasswordView from '../../app/(auth)/forgot-password/forgot-password-view';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe('TASK-0213 Forgot Password UI Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('1. Renders empty email input with neutral placeholder and enabled submit button initially', () => {
    render(<ForgotPasswordView />);

    const emailInput = screen.getByLabelText(/Alamat Email|Email Address/i) as HTMLInputElement;
    expect(emailInput.value).toBe('');
    expect(emailInput.placeholder).toMatch(/Masukkan alamat email Anda|Enter your email address/i);
    expect(emailInput.disabled).toBe(false);

    const submitBtn = screen.getByRole('button', { name: /Kirim Link Reset|Send Reset Link/i });
    expect(submitBtn).toBeEnabled();
  });

  it('2. Submits email, shows toast notification, starts 15:00 countdown, and disables submit button', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        message: 'If an account exists with that email, a password reset link has been sent.',
      }),
    });

    render(<ForgotPasswordView />);

    const emailInput = screen.getByLabelText(/Alamat Email|Email Address/i);
    const submitBtn = screen.getByRole('button', { name: /Kirim Link Reset|Send Reset Link/i });

    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Silakan periksa kotak masuk email Anda|Please check your email inbox/i)
      ).toBeInTheDocument();
      expect(screen.getByRole('button')).toHaveTextContent(/15:00/);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/auth/forgot-password',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'user@example.com' }),
      })
    );

    // Verify sessionStorage persisted cooldown
    const stored = sessionStorage.getItem('kebun_melon_pw_reset_cooldown_until');
    expect(stored).not.toBeNull();
    expect(parseInt(stored!, 10)).toBeGreaterThan(Date.now());
  });

  it('3. Auto-dismisses toast notification after 5 seconds', async () => {
    vi.useFakeTimers();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(<ForgotPasswordView />);

    const emailInput = screen.getByLabelText(/Alamat Email|Email Address/i);
    const submitBtn = screen.getByRole('button');

    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.click(submitBtn);

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      screen.getByText(/Silakan periksa kotak masuk email Anda|Please check your email inbox/i)
    ).toBeInTheDocument();

    // Advance 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(
      screen.queryByText(/Silakan periksa kotak masuk email Anda|Please check your email inbox/i)
    ).not.toBeInTheDocument();
  });

  it('4. Restores active cooldown timer from sessionStorage upon re-render or refresh', () => {
    const cooldownUntil = Date.now() + 10 * 60 * 1000; // 10 minutes remaining (10:00)
    sessionStorage.setItem('kebun_melon_pw_reset_cooldown_until', cooldownUntil.toString());

    render(<ForgotPasswordView />);

    const submitBtn = screen.getByRole('button');
    expect(submitBtn).toBeDisabled();
    expect(submitBtn).toHaveTextContent(/10:00/);
  });

  it('5. Re-enables submit button and clears storage when countdown finishes', () => {
    vi.useFakeTimers();

    const cooldownUntil = Date.now() + 2 * 1000; // 2 seconds remaining
    sessionStorage.setItem('kebun_melon_pw_reset_cooldown_until', cooldownUntil.toString());

    render(<ForgotPasswordView />);

    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('button')).toHaveTextContent(/00:02/);

    // Advance past expiration
    act(() => {
      vi.advanceTimersByTime(2500);
    });

    const submitBtn = screen.getByRole('button');
    expect(submitBtn).toBeEnabled();
    expect(submitBtn).toHaveTextContent(/Kirim Link Reset|Send Reset Link/i);
    expect(sessionStorage.getItem('kebun_melon_pw_reset_cooldown_until')).toBeNull();
  });

  it('6. Displays error banner when server returns an error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many requests. Please try again later.',
        },
      }),
    });

    render(<ForgotPasswordView />);

    const emailInput = screen.getByLabelText(/Alamat Email|Email Address/i);
    const submitBtn = screen.getByRole('button');

    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Too many requests/i);
    });
  });
});
