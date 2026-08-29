// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailChangeModal } from '@/app/profile/EmailChangeModal';
import { NextIntlClientProvider } from 'next-intl';
import idMessages from '@/messages/id.json';
import enMessages from '@/messages/en.json';

describe('TASK-0216 EmailChangeModal UI Test Suite', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    currentEmail: 'current.user@example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('renders Step 1 with password and new email inputs in ID', () => {
    render(
      <NextIntlClientProvider locale="id" messages={idMessages}>
        <EmailChangeModal {...defaultProps} />
      </NextIntlClientProvider>
    );

    expect(screen.getByText('Ubah Alamat Email')).toBeInTheDocument();
    expect(screen.getByText('Kata Sandi Lama')).toBeInTheDocument();
    expect(screen.getByText('Alamat Email Baru')).toBeInTheDocument();
    expect(screen.getByText('Kirim Kode Verifikasi')).toBeInTheDocument();
  });

  it('renders Step 1 with password and new email inputs in EN', () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <EmailChangeModal {...defaultProps} />
      </NextIntlClientProvider>
    );

    expect(screen.getByText('Change Email Address')).toBeInTheDocument();
    expect(screen.getByText('Current Password')).toBeInTheDocument();
    expect(screen.getByText('New Email Address')).toBeInTheDocument();
    expect(screen.getByText('Send Verification Code')).toBeInTheDocument();
  });

  it('validates that new email cannot match current email', async () => {
    render(
      <NextIntlClientProvider locale="id" messages={idMessages}>
        <EmailChangeModal {...defaultProps} />
      </NextIntlClientProvider>
    );

    const passwordInput = screen.getByPlaceholderText('Masukkan kata sandi lama');
    const emailInput = screen.getByPlaceholderText('nama@contoh.com');
    const submitBtn = screen.getByText('Kirim Kode Verifikasi');

    fireEvent.change(passwordInput, { target: { value: 'Secret123!' } });
    fireEvent.change(emailInput, { target: { value: 'current.user@example.com' } });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText('Alamat email baru tidak boleh sama dengan email saat ini.')
    ).toBeInTheDocument();
  });

  it('advances to Step 2 upon successful request and displays 60s cooldown timer', async () => {
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: { status: 'VERIFICATION_CODE_SENT', expiresAt: new Date().toISOString() },
          }),
      })
    );

    render(
      <NextIntlClientProvider locale="id" messages={idMessages}>
        <EmailChangeModal {...defaultProps} />
      </NextIntlClientProvider>
    );

    const passwordInput = screen.getByPlaceholderText('Masukkan kata sandi lama');
    const emailInput = screen.getByPlaceholderText('nama@contoh.com');
    const submitBtn = screen.getByText('Kirim Kode Verifikasi');

    fireEvent.change(passwordInput, { target: { value: 'Secret123!' } });
    fireEvent.change(emailInput, { target: { value: 'candidate.new@example.com' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('candidate.new@example.com')).toBeInTheDocument();
      expect(screen.getByText('Kode Verifikasi (6 Digit)')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
    });

    expect(sessionStorage.getItem('email_change_resend_cooldown')).toBeTruthy();
  });

  it('handles verification submission, calls onSuccess with promoted email, and clears cooldown', async () => {
    // Step 1 mock: success
    global.fetch = vi
      .fn()
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: { status: 'VERIFICATION_CODE_SENT', expiresAt: new Date().toISOString() },
            }),
        })
      )
      // Step 2 mock: verify success
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                email: 'candidate.new@example.com',
                emailVerifiedAt: new Date().toISOString(),
              },
            }),
        })
      );

    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <EmailChangeModal {...defaultProps} onSuccess={onSuccess} onClose={onClose} />
      </NextIntlClientProvider>
    );

    // Fill Step 1
    fireEvent.change(screen.getByPlaceholderText('Enter current password'), {
      target: { value: 'Secret123!' },
    });
    fireEvent.change(screen.getByPlaceholderText('name@example.com'), {
      target: { value: 'candidate.new@example.com' },
    });
    fireEvent.click(screen.getByText('Send Verification Code'));

    // In Step 2
    const codeInput = await screen.findByPlaceholderText('000000');
    fireEvent.change(codeInput, { target: { value: '654321' } });

    const verifyBtn = screen.getByText('Verify & Save Email');
    fireEvent.click(verifyBtn);

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith('candidate.new@example.com');
      expect(onClose).toHaveBeenCalled();
    });

    expect(sessionStorage.getItem('email_change_resend_cooldown')).toBeNull();
  });

  it('displays error message when candidate email is already in use (409 Conflict)', async () => {
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 409,
        json: () =>
          Promise.resolve({
            success: false,
            error: { code: 'DUPLICATE_EMAIL', message: 'Email address already in use.' },
          }),
      })
    );

    render(
      <NextIntlClientProvider locale="id" messages={idMessages}>
        <EmailChangeModal {...defaultProps} />
      </NextIntlClientProvider>
    );

    fireEvent.change(screen.getByPlaceholderText('Masukkan kata sandi lama'), {
      target: { value: 'Secret123!' },
    });
    fireEvent.change(screen.getByPlaceholderText('nama@contoh.com'), {
      target: { value: 'taken@example.com' },
    });
    fireEvent.click(screen.getByText('Kirim Kode Verifikasi'));

    expect(
      await screen.findByText('Alamat email sudah digunakan oleh akun lain.')
    ).toBeInTheDocument();
  });

  it('allows user to navigate back to Step 1 from Step 2', async () => {
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: { status: 'VERIFICATION_CODE_SENT', expiresAt: new Date().toISOString() },
          }),
      })
    );

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <EmailChangeModal {...defaultProps} />
      </NextIntlClientProvider>
    );

    fireEvent.change(screen.getByPlaceholderText('Enter current password'), {
      target: { value: 'Secret123!' },
    });
    fireEvent.change(screen.getByPlaceholderText('name@example.com'), {
      target: { value: 'candidate.new@example.com' },
    });
    fireEvent.click(screen.getByText('Send Verification Code'));

    await screen.findByPlaceholderText('000000');

    // Click back button
    const backBtn = screen.getByLabelText('Back');
    fireEvent.click(backBtn);

    // Verify back on Step 1
    expect(screen.getByPlaceholderText('Enter current password')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('name@example.com')).toBeInTheDocument();
  });
});
