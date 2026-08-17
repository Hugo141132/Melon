import { Resend } from 'resend';
import { Logger } from '@/lib/observability/logger';
import { validateServerEnv } from '@/lib/env/server';

const logger = new Logger({ serviceName: 'web:email' });

export interface SendPasswordResetEmailInput {
  toEmail: string;
  recipientName?: string;
  rawToken: string;
  locale?: string;
  requestId?: string;
}

export interface SendPasswordResetEmailResult {
  success: boolean;
  emailSent: boolean;
  simulated?: boolean;
  id?: string;
  error?: string;
}

/**
 * Builds trusted reset password link using ONLY configured server environment URL.
 * Never relies on untrusted request Host headers.
 */
export function buildTrustedResetUrl(rawToken: string): string {
  const env = validateServerEnv();
  const rawBaseUrl =
    env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'http://localhost:3000';
  const baseUrl = rawBaseUrl.replace(/\/+$/, '');
  return `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
}

/**
 * Generates bilingual HTML content for password reset email.
 */
function getEmailHtml(
  name: string,
  resetUrl: string,
  locale: string
): { subject: string; html: string; text: string } {
  const isId = locale === 'id';

  const subject = isId
    ? 'Atur Ulang Kata Sandi — Kebun Melon'
    : 'Reset Your Password — Kebun Melon';

  const greeting = isId ? `Halo ${name || 'Pengguna'},` : `Hello ${name || 'User'},`;
  const intro = isId
    ? 'Kami menerima permintaan untuk mengatur ulang kata sandi akun Kebun Melon Anda. Klik tombol di bawah ini untuk membuat kata sandi baru:'
    : 'We received a request to reset the password for your Kebun Melon account. Click the button below to create a new password:';
  const buttonText = isId ? 'Atur Ulang Kata Sandi' : 'Reset Password';
  const expiryNotice = isId
    ? 'Tautan ini hanya berlaku sekali dan akan kadaluwarsa dalam 15 menit.'
    : 'This link is single-use and will expire in 15 minutes.';
  const ignoreNotice = isId
    ? 'Jika Anda tidak meminta pengaturan ulang kata sandi ini, abaikan email ini. Akun Anda tetap aman.'
    : 'If you did not request a password reset, please ignore this email. Your account remains secure.';
  const linkFallback = isId
    ? 'Jika tombol di atas tidak berfungsi, salin dan tempel tautan berikut ke peramban Anda:'
    : 'If the button above does not work, copy and paste the following link into your browser:';

  const html = `
<!DOCTYPE html>
<html lang="${isId ? 'id' : 'en'}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7f4; margin: 0; padding: 24px; color: #1e293b; }
    .container { max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { color: #166534; font-size: 24px; margin: 0; font-weight: 700; }
    .content { font-size: 16px; line-height: 1.6; }
    .btn-container { text-align: center; margin: 28px 0; }
    .btn { display: inline-block; background-color: #16a34a; color: #ffffff !important; padding: 14px 28px; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 8px; }
    .footer { margin-top: 32px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #64748b; text-align: center; }
    .fallback { word-break: break-all; font-size: 13px; color: #64748b; background-color: #f8fafc; padding: 12px; border-radius: 6px; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Kebun Melon</h1>
    </div>
    <div class="content">
      <p><strong>${greeting}</strong></p>
      <p>${intro}</p>
      <div class="btn-container">
        <a href="${resetUrl}" class="btn" target="_blank" rel="noopener noreferrer">${buttonText}</a>
      </div>
      <p style="color: #64748b; font-size: 14px;">${expiryNotice}</p>
      <p style="color: #64748b; font-size: 14px;">${ignoreNotice}</p>
      <div class="fallback">
        <p style="margin: 0 0 6px 0;">${linkFallback}</p>
        <a href="${resetUrl}" style="color: #16a34a;">${resetUrl}</a>
      </div>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Kebun Melon Monitoring System. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
Kebun Melon
==============================

${greeting}

${intro}

${resetUrl}

${expiryNotice}
${ignoreNotice}

© ${new Date().getFullYear()} Kebun Melon Monitoring System.
  `.trim();

  return { subject, html, text };
}

/**
 * Sends a password recovery email via the approved Resend provider.
 * Awaits delivery safely, logs operations securely without exposing tokens or passwords.
 */
export async function sendPasswordResetEmail(
  input: SendPasswordResetEmailInput
): Promise<SendPasswordResetEmailResult> {
  const reqLogger = logger.child({
    requestId: input.requestId,
  });

  const env = validateServerEnv();
  const resetUrl = buildTrustedResetUrl(input.rawToken);
  const locale = input.locale || env.DEFAULT_LOCALE || 'id';
  const name = input.recipientName || '';

  const { subject, html, text } = getEmailHtml(name, resetUrl, locale);

  const apiKey = env.RESEND_API_KEY || process.env.RESEND_API_KEY;
  const fromEmail =
    env.RESEND_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || 'Kebun Melon <onboarding@resend.dev>';

  // In test environment or when API key is unconfigured in development, simulate safely
  if (!apiKey || env.NODE_ENV === 'test' || process.env.NODE_ENV === 'test') {
    reqLogger.info(
      'Resend API key unconfigured or test environment active; simulated password reset email delivery'
    );
    return {
      success: true,
      emailSent: false,
      simulated: true,
    };
  }

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: fromEmail,
      to: [input.toEmail],
      subject,
      html,
      text,
    });

    if (result.error) {
      reqLogger.error('Resend delivery reported error: ' + result.error.message);
      return {
        success: false,
        emailSent: false,
        error: result.error.message,
      };
    }

    reqLogger.info('Password reset email dispatched successfully via Resend');
    return {
      success: true,
      emailSent: true,
      id: result.data?.id,
    };
  } catch (err: any) {
    reqLogger.error(
      'Unexpected exception during Resend email dispatch: ' + (err?.message || String(err))
    );
    return {
      success: false,
      emailSent: false,
      error: err?.message || 'Email delivery failed',
    };
  }
}
