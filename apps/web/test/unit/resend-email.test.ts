import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildTrustedResetUrl,
  sendPasswordResetEmail,
  DEFAULT_RESEND_FROM_EMAIL,
} from '../../lib/email/resend';
import { Resend } from 'resend';

vi.mock('resend');

describe('TASK-0213 Resend Email Service Unit Tests', () => {
  const origAppUrl = process.env.APP_URL;
  const origPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const origApiKey = process.env.RESEND_API_KEY;
  const origFrom = process.env.RESEND_FROM_EMAIL;
  const origNodeEnv = process.env.NODE_ENV;
  const origAppEnv = process.env.APP_ENV;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (origAppUrl !== undefined) process.env.APP_URL = origAppUrl;
    else delete process.env.APP_URL;

    if (origPublicAppUrl !== undefined) process.env.NEXT_PUBLIC_APP_URL = origPublicAppUrl;
    else delete process.env.NEXT_PUBLIC_APP_URL;

    if (origApiKey !== undefined) process.env.RESEND_API_KEY = origApiKey;
    else delete process.env.RESEND_API_KEY;

    if (origFrom !== undefined) process.env.RESEND_FROM_EMAIL = origFrom;
    else delete process.env.RESEND_FROM_EMAIL;

    if (origAppEnv !== undefined) process.env.APP_ENV = origAppEnv;
    else delete process.env.APP_ENV;

    (process.env as Record<string, string | undefined>).NODE_ENV = origNodeEnv;
  });

  it('builds trusted reset URLs from configured environment variables without trailing slash', () => {
    process.env.APP_URL = 'https://melon.example.com/';
    const url = buildTrustedResetUrl('my-token-123');
    expect(url).toBe('https://melon.example.com/reset-password?token=my-token-123');

    process.env.APP_URL = 'https://app.kebunmelon.id';
    const url2 = buildTrustedResetUrl('token-abc-xyz');
    expect(url2).toBe('https://app.kebunmelon.id/reset-password?token=token-abc-xyz');
  });

  it('safely simulates email delivery when RESEND_API_KEY is unconfigured', async () => {
    delete process.env.RESEND_API_KEY;
    const result = await sendPasswordResetEmail({
      toEmail: 'user@example.com',
      recipientName: 'Test User',
      rawToken: 'token-123',
    });

    expect(result.success).toBe(true);
    expect(result.emailSent).toBe(false);
    expect(result.simulated).toBe(true);
  });

  it('dispatches email via Resend client when configured', async () => {
    process.env.RESEND_API_KEY = 're_test_key_12345';
    process.env.RESEND_FROM_EMAIL = 'Melon Governance <noreply@melonmadura.my.id>';
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';

    const sendMock = vi.fn().mockResolvedValue({
      data: { id: 'email_msg_123' },
      error: null,
    });

    (Resend as unknown as any).mockImplementation(function (this: any) {
      this.emails = { send: sendMock };
    });

    const result = await sendPasswordResetEmail({
      toEmail: 'farmer@example.com',
      recipientName: 'Pak Wahyu',
      rawToken: 'secure-token-999',
      locale: 'id',
    });

    expect(result.success).toBe(true);
    expect(result.emailSent).toBe(true);
    expect(result.id).toBe('email_msg_123');

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Melon Governance <noreply@melonmadura.my.id>',
        to: ['farmer@example.com'],
        subject: 'Atur Ulang Kata Sandi — Melon Governance',
      })
    );
  });

  it('dispatches email using DEFAULT_RESEND_FROM_EMAIL when RESEND_FROM_EMAIL is unconfigured in development', async () => {
    process.env.RESEND_API_KEY = 're_test_key_12345';
    delete process.env.RESEND_FROM_EMAIL;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';

    expect(DEFAULT_RESEND_FROM_EMAIL).toBe('Melon Madura <noreply@melonmadura.my.id>');

    const sendMock = vi.fn().mockResolvedValue({
      data: { id: 'email_msg_default_from' },
      error: null,
    });

    (Resend as unknown as any).mockImplementation(function (this: any) {
      this.emails = { send: sendMock };
    });

    const result = await sendPasswordResetEmail({
      toEmail: 'farmer@example.com',
      recipientName: 'Pak Wahyu',
      rawToken: 'secure-token-default-from',
      locale: 'id',
    });

    expect(result.success).toBe(true);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Melon Madura <noreply@melonmadura.my.id>',
        to: ['farmer@example.com'],
      })
    );
  });

  it('handles Resend API failure gracefully without throwing', async () => {
    process.env.RESEND_API_KEY = 're_test_key_12345';
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';

    const sendMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Domain verification failed' },
    });

    (Resend as unknown as any).mockImplementation(function (this: any) {
      this.emails = { send: sendMock };
    });

    const result = await sendPasswordResetEmail({
      toEmail: 'farmer@example.com',
      recipientName: 'Pak Wahyu',
      rawToken: 'secure-token-999',
      locale: 'en',
    });

    expect(result.success).toBe(false);
    expect(result.emailSent).toBe(false);
    expect(result.error).toBe('Domain verification failed');
  });

  it('rejects unverified onboarding@resend.dev from-email or non-HTTPS APP_URL in strict production', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    (process.env as Record<string, string | undefined>).APP_ENV = 'production';
    process.env.INTERNAL_GATEWAY_URL = 'https://gateway.internal.example.com';
    process.env.INTERNAL_SERVICE_TOKEN = '1234567890123456';
    process.env.APP_URL = 'http://localhost:3000'; // Invalid: HTTP & localhost in prod
    process.env.RESEND_API_KEY = 're_live_key';
    process.env.RESEND_FROM_EMAIL = 'onboarding@resend.dev'; // Invalid: default onboarding domain in prod

    await expect(
      sendPasswordResetEmail({
        toEmail: 'user@example.com',
        rawToken: 'token',
      })
    ).rejects.toThrow(/Production requirement failed/i);
  });

  it('sendVerificationEmail dispatches 6-digit code via Resend client', async () => {
    process.env.RESEND_API_KEY = 're_test_key_12345';
    process.env.RESEND_FROM_EMAIL = 'Melon Governance <noreply@melonmadura.my.id>';
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';

    const sendMock = vi.fn().mockResolvedValue({
      data: { id: 'email_msg_verif_123' },
      error: null,
    });

    (Resend as unknown as any).mockImplementation(function (this: any) {
      this.emails = { send: sendMock };
    });

    const { sendVerificationEmail } = await import('../../lib/email/resend');
    const result = await sendVerificationEmail({
      toEmail: 'farmer@example.com',
      recipientName: 'Pak Wahyu',
      code: '849201',
      locale: 'id',
    });

    expect(result.success).toBe(true);
    expect(result.emailSent).toBe(true);
    expect(result.id).toBe('email_msg_verif_123');

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Melon Governance <noreply@melonmadura.my.id>',
        to: ['farmer@example.com'],
        subject: 'Kode Verifikasi: 849201 — Melon Governance',
      })
    );
  });

  it('retries on rate limit (429) and succeeds on subsequent attempt', async () => {
    process.env.RESEND_API_KEY = 're_test_key_12345';
    process.env.RESEND_FROM_EMAIL = 'Melon Governance <noreply@melonmadura.my.id>';
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';

    let attemptCount = 0;
    const sendMock = vi.fn().mockImplementation(async () => {
      attemptCount++;
      if (attemptCount === 1) {
        return {
          data: null,
          error: { message: 'Too many requests, rate limit exceeded', statusCode: 429 },
        };
      }
      return {
        data: { id: 'email_retry_success_456' },
        error: null,
      };
    });

    (Resend as unknown as any).mockImplementation(function (this: any) {
      this.emails = { send: sendMock };
    });

    const { sendVerificationEmail } = await import('../../lib/email/resend');
    const result = await sendVerificationEmail({
      toEmail: 'farmer@example.com',
      code: '123456',
    });

    expect(result.success).toBe(true);
    expect(result.emailSent).toBe(true);
    expect(result.id).toBe('email_retry_success_456');
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it('dispatches account reactivation email with custom reason via Resend', async () => {
    process.env.RESEND_API_KEY = 're_test_key_12345';
    process.env.RESEND_FROM_EMAIL = 'Melon Governance <noreply@melonmadura.my.id>';
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';

    const sendMock = vi.fn().mockResolvedValue({
      data: { id: 'email_reactivate_123' },
      error: null,
    });

    (Resend as unknown as any).mockImplementation(function (this: any) {
      this.emails = { send: sendMock };
    });

    const { sendAccountReactivationEmail } = await import('../../lib/email/resend');
    const result = await sendAccountReactivationEmail({
      toEmail: 'farmer@example.com',
      recipientName: 'Pak Wahyu',
      reason: 'Selesai masa audit internal',
      locale: 'id',
    });

    expect(result.success).toBe(true);
    expect(result.emailSent).toBe(true);
    expect(result.id).toBe('email_reactivate_123');
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Melon Governance <noreply@melonmadura.my.id>',
        to: ['farmer@example.com'],
        subject: 'Akun Melon Governance Anda Telah Diaktifkan Kembali',
        text: expect.stringContaining('Selesai masa audit internal'),
      })
    );
  });

  it('dispatches account reactivation email with default restoration notice when reason is omitted', async () => {
    process.env.RESEND_API_KEY = 're_test_key_12345';
    process.env.RESEND_FROM_EMAIL = 'Melon Governance <noreply@melonmadura.my.id>';
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';

    const sendMock = vi.fn().mockResolvedValue({
      data: { id: 'email_reactivate_default_456' },
      error: null,
    });

    (Resend as unknown as any).mockImplementation(function (this: any) {
      this.emails = { send: sendMock };
    });

    const { sendAccountReactivationEmail } = await import('../../lib/email/resend');
    const result = await sendAccountReactivationEmail({
      toEmail: 'farmer@example.com',
      recipientName: 'Pak Wahyu',
      reason: '',
      locale: 'en',
    });

    expect(result.success).toBe(true);
    expect(result.emailSent).toBe(true);
    expect(result.id).toBe('email_reactivate_default_456');
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Melon Governance <noreply@melonmadura.my.id>',
        to: ['farmer@example.com'],
        subject: 'Your Melon Governance Account Has Been Reactivated',
        text: expect.stringContaining('Account reactivated by OWNER / PIC.'),
      })
    );
  });

  it('dispatches account suspension email with default reason when omitted', async () => {
    process.env.RESEND_API_KEY = 're_test_key_12345';
    process.env.RESEND_FROM_EMAIL = 'Melon Governance <noreply@melonmadura.my.id>';
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';

    const sendMock = vi.fn().mockResolvedValue({
      data: { id: 'email_suspend_default_789' },
      error: null,
    });

    (Resend as unknown as any).mockImplementation(function (this: any) {
      this.emails = { send: sendMock };
    });

    const { sendAccountSuspensionEmail } = await import('../../lib/email/resend');
    const result = await sendAccountSuspensionEmail({
      toEmail: 'farmer@example.com',
      recipientName: 'Pak Wahyu',
      reason: '',
      locale: 'en',
    });

    expect(result.success).toBe(true);
    expect(result.emailSent).toBe(true);
    expect(result.id).toBe('email_suspend_default_789');
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Melon Governance <noreply@melonmadura.my.id>',
        to: ['farmer@example.com'],
        subject: 'Your Melon Governance Account Has Been Suspended',
        text: expect.stringContaining('Account suspended by OWNER / PIC.'),
      })
    );
  });

  it('dispatches account deletion email with default reason when omitted', async () => {
    process.env.RESEND_API_KEY = 're_test_key_12345';
    process.env.RESEND_FROM_EMAIL = 'Melon Governance <noreply@melonmadura.my.id>';
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';

    const sendMock = vi.fn().mockResolvedValue({
      data: { id: 'email_delete_default_101' },
      error: null,
    });

    (Resend as unknown as any).mockImplementation(function (this: any) {
      this.emails = { send: sendMock };
    });

    const { sendAccountDeletionEmail } = await import('../../lib/email/resend');
    const result = await sendAccountDeletionEmail({
      toEmail: 'farmer@example.com',
      recipientName: 'Pak Wahyu',
      reason: '',
      locale: 'en',
    });

    expect(result.success).toBe(true);
    expect(result.emailSent).toBe(true);
    expect(result.id).toBe('email_delete_default_101');
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Melon Governance <noreply@melonmadura.my.id>',
        to: ['farmer@example.com'],
        subject: 'Account Deletion Notification — Melon Governance',
        text: expect.stringContaining('Account permanently deleted by OWNER / PIC.'),
      })
    );
  });

  it('provides dedicated email-safe PNG logo attachment with solid background for email clients', async () => {
    const { getLogoAttachment, getEmailLogoUrl } = await import('../../lib/email/resend');
    const attachment = getLogoAttachment();

    expect(attachment).toBeDefined();
    expect(attachment?.filename).toBe('logo1-email.png');
    expect(attachment?.contentType).toBe('image/png');
    expect(attachment?.contentId).toBe('logo1');
    expect(attachment?.content).toBeInstanceOf(Buffer);
    expect(attachment?.content.length).toBeGreaterThan(1000);

    // Verify PNG magic number bytes (0x89 0x50 0x4E 0x47)
    expect(attachment?.content[0]).toBe(0x89);
    expect(attachment?.content[1]).toBe(0x50);
    expect(attachment?.content[2]).toBe(0x4e);
    expect(attachment?.content[3]).toBe(0x47);

    // Verify CID reference is returned
    expect(getEmailLogoUrl()).toBe('cid:logo1');
  });

  it('automatically attaches email-safe logo CID to Resend email payload', async () => {
    process.env.RESEND_API_KEY = 're_test_key_12345';
    process.env.RESEND_FROM_EMAIL = 'Melon Governance <noreply@melonmadura.my.id>';
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';

    const sendMock = vi.fn().mockResolvedValue({
      data: { id: 'email_with_logo_attachment' },
      error: null,
    });

    (Resend as unknown as any).mockImplementation(function (this: any) {
      this.emails = { send: sendMock };
    });

    const { sendVerificationEmail } = await import('../../lib/email/resend');
    await sendVerificationEmail({
      toEmail: 'farmer@example.com',
      code: '654321',
    });

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: expect.arrayContaining([
          expect.objectContaining({
            filename: 'logo1-email.png',
            contentType: 'image/png',
            contentId: 'logo1',
          }),
        ]),
      })
    );
  });
});
