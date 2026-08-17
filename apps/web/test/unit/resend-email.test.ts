import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildTrustedResetUrl, sendPasswordResetEmail } from '../../lib/email/resend';
import { Resend } from 'resend';

vi.mock('resend');

describe('TASK-0213 Resend Email Service Unit Tests', () => {
  const origAppUrl = process.env.APP_URL;
  const origPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const origApiKey = process.env.RESEND_API_KEY;
  const origFrom = process.env.RESEND_FROM_EMAIL;
  const origNodeEnv = process.env.NODE_ENV;

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
    process.env.RESEND_FROM_EMAIL = 'Kebun Melon <noreply@kebunmelon.id>';
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
        from: 'Kebun Melon <noreply@kebunmelon.id>',
        to: ['farmer@example.com'],
        subject: 'Atur Ulang Kata Sandi — Kebun Melon',
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
});
