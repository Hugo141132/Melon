import fs from 'fs';
import path from 'path';
import { Resend } from 'resend';
import { Logger } from '@/lib/observability/logger';
import { validateServerEnv } from '@/lib/env/server';
import {
  DEFAULT_SUSPENSION_REASON,
  DEFAULT_DELETION_REASON,
  DEFAULT_REACTIVATION_REASON,
} from '@kebun-melon/contracts';

const logger = new Logger({ serviceName: 'web:email' });

export const DEFAULT_RESEND_FROM_EMAIL = 'Melon Madura <noreply@melonmadura.my.id>';

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

export interface SendVerificationEmailInput {
  toEmail: string;
  recipientName?: string;
  rawToken?: string;
  code?: string;
  locale?: string;
  requestId?: string;
}

export interface SendVerificationEmailResult {
  success: boolean;
  emailSent: boolean;
  simulated?: boolean;
  id?: string;
  error?: string;
}

/**
 * Helper to determine if a Resend error is retryable (rate limit, 5xx server error, network timeout).
 */
function isRetryableError(error: any): boolean {
  if (!error) return false;
  const msg = typeof error === 'string' ? error : error?.message || String(error);
  const status = error?.statusCode || error?.status;
  if (status === 429 || (typeof status === 'number' && status >= 500 && status <= 599)) {
    return true;
  }
  return /rate_limit|rate limit|too many requests|429|timeout|fetch failed|econnreset|etimedout|internal_server_error|500|502|503|504|network/i.test(
    msg
  );
}

/**
 * Cached inline attachment representation of logo1.webp.
 */
let cachedLogoAttachment:
  { filename: string; content: Buffer; contentType: string; contentId: string } | null | undefined;

export function getLogoAttachment():
  { filename: string; content: Buffer; contentType: string; contentId: string } | undefined {
  if (cachedLogoAttachment !== undefined) {
    return cachedLogoAttachment || undefined;
  }

  try {
    const candidatePaths = [
      path.join(process.cwd(), 'apps/web/public/logo1.webp'),
      path.join(process.cwd(), 'public/logo1.webp'),
      path.join(process.cwd(), 'docs/assets/logo1.webp'),
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        cachedLogoAttachment = {
          filename: 'logo1.webp',
          content: fs.readFileSync(p),
          contentType: 'image/webp',
          contentId: 'logo1',
        };
        return cachedLogoAttachment;
      }
    }
  } catch {
    // Fail safe
  }

  cachedLogoAttachment = null;
  return undefined;
}

/**
 * Dispatches an email via Resend with bounded exponential backoff retries for transient errors.
 * Automatically attaches inline branding logo (CID) to ensure reliable rendering across all email clients.
 */
async function sendWithRetry(
  resend: Resend,
  payload: {
    from: string;
    to: string[];
    subject: string;
    html: string;
    text: string;
    attachments?: any[];
  },
  reqLogger: any,
  maxAttempts = 3
): Promise<{ success: boolean; id?: string; error?: string }> {
  let lastError: string | undefined;

  const logoAttachment = getLogoAttachment();
  const emailPayload = {
    ...payload,
    attachments: payload.attachments || (logoAttachment ? [logoAttachment] : undefined),
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await resend.emails.send(emailPayload as any);

      if (result.error) {
        lastError = result.error.message;
        reqLogger.warn(
          `Resend delivery attempt ${attempt}/${maxAttempts} error: ${result.error.message}`
        );

        if (attempt < maxAttempts && isRetryableError(result.error)) {
          const delayMs = Math.min(2000, 300 * Math.pow(2, attempt - 1) + Math.random() * 100);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        return { success: false, error: result.error.message };
      }

      return { success: true, id: result.data?.id };
    } catch (err: any) {
      lastError = err?.message || String(err);
      reqLogger.warn(`Resend exception on attempt ${attempt}/${maxAttempts}: ${lastError}`);

      if (attempt < maxAttempts && isRetryableError(err)) {
        const delayMs = Math.min(2000, 300 * Math.pow(2, attempt - 1) + Math.random() * 100);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      return { success: false, error: lastError };
    }
  }

  return { success: false, error: lastError || 'Email delivery failed after retries' };
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
 * Builds trusted public URL or CID reference for email header branding logo (logo1.webp).
 * Uses CID inline attachment when available, eliminating dependency on localhost image proxying in Gmail/Outlook.
 */
export function getEmailLogoUrl(): string {
  if (getLogoAttachment()) {
    return 'cid:logo1';
  }

  const env = validateServerEnv();
  const rawBaseUrl =
    env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'http://localhost:3000';
  const baseUrl = rawBaseUrl.replace(/\/+$/, '');
  return `${baseUrl}/logo1.webp`;
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
  const logoUrl = getEmailLogoUrl();

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
    .header img { height: 40px; width: auto; max-width: 220px; display: inline-block; object-fit: contain; margin: 0 auto; }
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
      <img src="${logoUrl}" alt="Kebun Melon" width="220" height="44" style="height: 40px; width: auto; max-width: 220px; display: inline-block; object-fit: contain; margin: 0 auto;" />
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
    env.RESEND_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || DEFAULT_RESEND_FROM_EMAIL;

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
    const result = await sendWithRetry(
      resend,
      {
        from: fromEmail,
        to: [input.toEmail],
        subject,
        html,
        text,
      },
      reqLogger
    );

    if (!result.success) {
      reqLogger.error('Resend delivery reported error: ' + (result.error || 'Unknown error'));
      return {
        success: false,
        emailSent: false,
        error: result.error,
      };
    }

    reqLogger.info('Password reset email dispatched successfully via Resend');
    return {
      success: true,
      emailSent: true,
      id: result.id,
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

/**
 * Generates bilingual HTML content for 6-digit email verification email.
 */
function getVerificationCodeEmailHtml(
  name: string,
  code: string,
  locale: string
): { subject: string; html: string; text: string } {
  const isId = locale === 'id';
  const logoUrl = getEmailLogoUrl();

  const subject = isId
    ? `Kode Verifikasi: ${code} — Kebun Melon`
    : `Verification Code: ${code} — Kebun Melon`;

  const greeting = isId ? `Halo ${name || 'Pengguna'},` : `Hello ${name || 'User'},`;
  const intro = isId
    ? 'Terima kasih telah mendaftar di Kebun Melon. Masukkan 6 digit kode verifikasi berikut pada halaman verifikasi email Anda untuk mengonfirmasi kepemilikan akun:'
    : 'Thank you for registering at Kebun Melon. Enter the following 6-digit verification code on the email verification page to confirm your account ownership:';
  const expiryNotice = isId
    ? 'Kode verifikasi ini berlaku selama 15 menit dan hanya dapat digunakan sekali.'
    : 'This verification code is valid for 15 minutes and can only be used once.';
  const securityNotice = isId
    ? 'Jangan bagikan kode ini kepada siapa pun. Tim Kebun Melon tidak akan pernah meminta kode verifikasi Anda.'
    : 'Do not share this code with anyone. Kebun Melon team will never ask for your verification code.';
  const ignoreNotice = isId
    ? 'Jika Anda tidak mendaftar di Kebun Melon, silakan abaikan email ini.'
    : 'If you did not register at Kebun Melon, please ignore this email.';

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
    .header img { height: 40px; width: auto; max-width: 220px; display: inline-block; object-fit: contain; margin: 0 auto; }
    .content { font-size: 16px; line-height: 1.6; }
    .code-box { text-align: center; margin: 28px 0; }
    .code-card { display: inline-block; background-color: #f0fdf4; border: 2px dashed #16a34a; border-radius: 12px; padding: 18px 36px; }
    .code-text { font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #166534; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; margin: 0; }
    .footer { margin-top: 32px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${logoUrl}" alt="Kebun Melon" width="220" height="44" style="height: 40px; width: auto; max-width: 220px; display: inline-block; object-fit: contain; margin: 0 auto;" />
    </div>
    <div class="content">
      <p><strong>${greeting}</strong></p>
      <p>${intro}</p>
      <div class="code-box">
        <div class="code-card">
          <p class="code-text">${code}</p>
        </div>
      </div>
      <p style="color: #166534; font-weight: 600; font-size: 14px; text-align: center;">${expiryNotice}</p>
      <p style="color: #64748b; font-size: 14px; margin-top: 20px;">${securityNotice}</p>
      <p style="color: #64748b; font-size: 14px;">${ignoreNotice}</p>
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

KODE VERIFIKASI / VERIFICATION CODE:
------------------------------------
${code}
------------------------------------

${expiryNotice}
${securityNotice}
${ignoreNotice}

© ${new Date().getFullYear()} Kebun Melon Monitoring System.
  `.trim();

  return { subject, html, text };
}

/**
 * Sends an email verification email with 6-digit code via the approved Resend provider.
 * Implements bounded retry handling for transient errors.
 */
export async function sendVerificationEmail(
  input: SendVerificationEmailInput
): Promise<SendVerificationEmailResult> {
  const reqLogger = logger.child({
    requestId: input.requestId,
  });

  const env = validateServerEnv();
  const code = input.code || input.rawToken || '';
  const locale = input.locale || env.DEFAULT_LOCALE || 'id';
  const name = input.recipientName || '';

  const { subject, html, text } = getVerificationCodeEmailHtml(name, code, locale);

  const apiKey = env.RESEND_API_KEY || process.env.RESEND_API_KEY;
  const fromEmail =
    env.RESEND_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || DEFAULT_RESEND_FROM_EMAIL;

  // In test environment or when API key is unconfigured in development, simulate safely
  if (!apiKey || env.NODE_ENV === 'test' || process.env.NODE_ENV === 'test') {
    reqLogger.info(
      'Resend API key unconfigured or test environment active; simulated email verification delivery'
    );
    return {
      success: true,
      emailSent: false,
      simulated: true,
    };
  }

  try {
    const resend = new Resend(apiKey);
    const result = await sendWithRetry(
      resend,
      {
        from: fromEmail,
        to: [input.toEmail],
        subject,
        html,
        text,
      },
      reqLogger
    );

    if (!result.success) {
      reqLogger.error('Resend delivery reported error: ' + (result.error || 'Unknown error'));
      return {
        success: false,
        emailSent: false,
        error: result.error,
      };
    }

    reqLogger.info('Email verification code dispatched successfully via Resend');
    return {
      success: true,
      emailSent: true,
      id: result.id,
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

/**
 * Generates bilingual HTML content for 6-digit email change verification code.
 */
function getEmailChangeCodeEmailHtml(
  name: string,
  code: string,
  locale: string
): { subject: string; html: string; text: string } {
  const isId = locale === 'id';
  const logoUrl = getEmailLogoUrl();

  const subject = isId
    ? `Kode Verifikasi Perubahan Email: ${code} — Kebun Melon`
    : `Email Change Verification Code: ${code} — Kebun Melon`;

  const greeting = isId ? `Halo ${name || 'Pengguna'},` : `Hello ${name || 'User'},`;
  const intro = isId
    ? 'Kami menerima permintaan untuk mengubah alamat email akun Kebun Melon Anda. Masukkan 6 digit kode verifikasi berikut untuk mengonfirmasi perubahan email ini:'
    : 'We received a request to change the email address for your Kebun Melon account. Enter the following 6-digit verification code to confirm this email change:';
  const expiryNotice = isId
    ? 'Kode verifikasi ini berlaku selama 15 menit dan hanya dapat digunakan sekali.'
    : 'This verification code is valid for 15 minutes and can only be used once.';
  const securityNotice = isId
    ? 'Jangan bagikan kode ini kepada siapa pun. Tim Kebun Melon tidak akan pernah meminta kode verifikasi Anda.'
    : 'Do not share this code with anyone. Kebun Melon team will never ask for your verification code.';
  const ignoreNotice = isId
    ? 'Jika Anda tidak meminta perubahan alamat email di Kebun Melon, silakan abaikan email ini. Alamat email Anda saat ini tidak akan berubah.'
    : 'If you did not request to change your email address on Kebun Melon, please ignore this email. Your current email address will remain unchanged.';

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
    .header img { height: 40px; width: auto; max-width: 220px; display: inline-block; object-fit: contain; margin: 0 auto; }
    .content { font-size: 16px; line-height: 1.6; }
    .code-box { text-align: center; margin: 28px 0; }
    .code-card { display: inline-block; background-color: #f0fdf4; border: 2px dashed #16a34a; border-radius: 12px; padding: 18px 36px; }
    .code-text { font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #166534; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; margin: 0; }
    .footer { margin-top: 32px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${logoUrl}" alt="Kebun Melon" width="220" height="44" style="height: 40px; width: auto; max-width: 220px; display: inline-block; object-fit: contain; margin: 0 auto;" />
    </div>
    <div class="content">
      <p><strong>${greeting}</strong></p>
      <p>${intro}</p>
      <div class="code-box">
        <div class="code-card">
          <p class="code-text">${code}</p>
        </div>
      </div>
      <p style="color: #166534; font-weight: 600; font-size: 14px; text-align: center;">${expiryNotice}</p>
      <p style="color: #64748b; font-size: 14px; margin-top: 20px;">${securityNotice}</p>
      <p style="color: #64748b; font-size: 14px;">${ignoreNotice}</p>
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

KODE VERIFIKASI PERUBAHAN EMAIL / EMAIL CHANGE VERIFICATION CODE:
-----------------------------------------------------------------
${code}
-----------------------------------------------------------------

${expiryNotice}
${securityNotice}
${ignoreNotice}

© ${new Date().getFullYear()} Kebun Melon Monitoring System.
  `.trim();

  return { subject, html, text };
}

/**
 * Sends an email change verification code email via the approved Resend provider.
 * Implements bounded retry handling for transient errors.
 */
export async function sendEmailChangeVerificationEmail(
  input: SendVerificationEmailInput
): Promise<SendVerificationEmailResult> {
  const reqLogger = logger.child({
    requestId: input.requestId,
  });

  const env = validateServerEnv();
  const code = input.code || input.rawToken || '';
  const locale = input.locale || env.DEFAULT_LOCALE || 'id';
  const name = input.recipientName || '';

  const { subject, html, text } = getEmailChangeCodeEmailHtml(name, code, locale);

  const apiKey = env.RESEND_API_KEY || process.env.RESEND_API_KEY;
  const fromEmail =
    env.RESEND_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || DEFAULT_RESEND_FROM_EMAIL;

  // In test environment or when API key is unconfigured in development, simulate safely
  if (!apiKey || env.NODE_ENV === 'test' || process.env.NODE_ENV === 'test') {
    reqLogger.info(
      'Resend API key unconfigured or test environment active; simulated email change verification delivery'
    );
    return {
      success: true,
      emailSent: false,
      simulated: true,
    };
  }

  try {
    const resend = new Resend(apiKey);
    const result = await sendWithRetry(
      resend,
      {
        from: fromEmail,
        to: [input.toEmail],
        subject,
        html,
        text,
      },
      reqLogger
    );

    if (!result.success) {
      reqLogger.error(
        'Resend delivery reported error for email change: ' + (result.error || 'Unknown error')
      );
      return {
        success: false,
        emailSent: false,
        error: result.error,
      };
    }

    reqLogger.info('Email change verification code dispatched successfully via Resend');
    return {
      success: true,
      emailSent: true,
      id: result.id,
    };
  } catch (err: any) {
    reqLogger.error(
      'Unexpected exception during Resend email change dispatch: ' + (err?.message || String(err))
    );
    return {
      success: false,
      emailSent: false,
      error: err?.message || 'Email delivery failed',
    };
  }
}

export interface SendAccountNoticeEmailInput {
  toEmail: string;
  recipientName: string;
  reason: string;
  locale?: string;
  requestId?: string;
}

export interface SendAccountNoticeEmailResult {
  success: boolean;
  emailSent: boolean;
  id?: string;
  simulated?: boolean;
  error?: string;
}

function getAccountSuspensionEmailHtml(
  name: string,
  reason: string,
  locale: string
): { subject: string; html: string; text: string } {
  const isId = locale === 'id';
  const resolvedReason = reason?.trim() || DEFAULT_SUSPENSION_REASON;
  const logoUrl = getEmailLogoUrl();

  const subject = isId
    ? 'Akun Kebun Melon Anda Ditangguhkan'
    : 'Your Kebun Melon Account Has Been Suspended';

  const greeting = isId ? `Halo ${name || 'Pengguna'},` : `Hello ${name || 'User'},`;
  const intro = isId
    ? 'Akun Anda di Kebun Melon Monitoring System telah ditangguhkan oleh OWNER / PIC.'
    : 'Your account on the Kebun Melon Monitoring System has been suspended by OWNER / PIC.';
  const reasonLabel = isId ? 'Alasan Penangguhan:' : 'Reason for Suspension:';
  const sessionNotice = isId
    ? 'Semua sesi aktif Anda telah dicabut secara otomatis. Anda tidak dapat mengakses sistem selama status akun ditangguhkan.'
    : 'All of your active sessions have been automatically revoked. You cannot access the system while your account is suspended.';
  const appealNotice = isId
    ? 'Jika Anda merasa ini adalah kekeliruan atau ingin mengajukan pengaktifan kembali, silakan hubungi OWNER / PIC.'
    : 'If you believe this is an error or wish to appeal for reactivation, please contact OWNER / PIC.';

  const html = `
<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8F9FA; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1F2937;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8F9FA; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #E5E7EB; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: left; border-bottom: 1px solid #F3F4F6;">
              <img src="${logoUrl}" alt="Kebun Melon" width="180" height="36" style="height: 32px; width: auto; max-width: 180px; display: block; object-fit: contain;" />
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <div style="display: inline-block; padding: 6px 12px; background-color: #FEF3C7; border: 1px solid #FCD34D; border-radius: 8px; color: #92400E; font-size: 13px; font-weight: 700; margin-bottom: 16px;">
                ${isId ? 'Pemberitahuan Penangguhan Akun' : 'Account Suspension Notice'}
              </div>
              <h1 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #111827; line-height: 1.4;">
                ${subject}
              </h1>
              <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #4B5563;">
                ${greeting}
              </p>
              <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #4B5563;">
                ${intro}
              </p>

              <!-- Reason Box -->
              <div style="background-color: #FFFBEB; border-left: 4px solid #F59E0B; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
                <p style="margin: 0 0 6px; font-size: 13px; font-weight: 700; color: #92400E; text-transform: uppercase; letter-spacing: 0.5px;">${reasonLabel}</p>
                <p style="margin: 0; font-size: 14px; color: #78350F; line-height: 1.5; text-align: left; word-break: break-word;">${resolvedReason}</p>
              </div>

              <p style="margin: 0 0 12px; font-size: 14px; line-height: 1.6; color: #6B7280;">
                ${sessionNotice}
              </p>
              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #6B7280;">
                ${appealNotice}
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #FAFAFA; border-top: 1px solid #F3F4F6; text-align: left; font-size: 13px; color: #9CA3AF; line-height: 1.5;">
              <p style="margin: 0;">© ${new Date().getFullYear()} Kebun Melon Monitoring System.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
${subject}

${greeting}

${intro}

${reasonLabel}
${resolvedReason}

${sessionNotice}

${appealNotice}

© ${new Date().getFullYear()} Kebun Melon Monitoring System.
  `.trim();

  return { subject, html, text };
}

function getAccountDeletionEmailHtml(
  name: string,
  reason: string,
  locale: string
): { subject: string; html: string; text: string } {
  const isId = locale === 'id';
  const resolvedReason = reason?.trim() || DEFAULT_DELETION_REASON;
  const logoUrl = getEmailLogoUrl();

  const subject = isId
    ? 'Pemberitahuan Penghapusan Akun — Kebun Melon'
    : 'Account Deletion Notification — Kebun Melon';

  const greeting = isId ? `Halo ${name || 'Pengguna'},` : `Hello ${name || 'User'},`;
  const intro = isId
    ? 'Akun Anda di Kebun Melon Monitoring System telah dihapus secara permanen oleh OWNER / PIC.'
    : 'Your account on the Kebun Melon Monitoring System has been permanently deleted by OWNER / PIC.';
  const reasonLabel = isId ? 'Alasan Penghapusan:' : 'Reason for Deletion:';
  const deletionNotice = isId
    ? 'Tindakan ini bersifat permanen dan tidak dapat dibatalkan. Semua sesi aktif, hak akses perangkat, dan preferensi akun Anda telah dihapus secara penuh dari sistem.'
    : 'This action is permanent and irreversible. All of your active sessions, device assignments, and account preferences have been completely purged from the system.';
  const thankYouNotice = isId
    ? 'Terima kasih atas kontribusi Anda selama menggunakan layanan Kebun Melon.'
    : 'Thank you for your contributions during your time with Kebun Melon.';

  const html = `
<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8F9FA; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1F2937;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8F9FA; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #E5E7EB; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: left; border-bottom: 1px solid #F3F4F6;">
              <img src="${logoUrl}" alt="Kebun Melon" width="180" height="36" style="height: 32px; width: auto; max-width: 180px; display: block; object-fit: contain;" />
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <div style="display: inline-block; padding: 6px 12px; background-color: #FEE2E2; border: 1px solid #FCA5A5; border-radius: 8px; color: #991B1B; font-size: 13px; font-weight: 700; margin-bottom: 16px;">
                ${isId ? 'Penghapusan Akun Permanen' : 'Permanent Account Deletion'}
              </div>
              <h1 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #111827; line-height: 1.4;">
                ${subject}
              </h1>
              <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #4B5563;">
                ${greeting}
              </p>
              <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #4B5563;">
                ${intro}
              </p>

              <!-- Reason Box -->
              <div style="background-color: #FEF2F2; border-left: 4px solid #EF4444; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
                <p style="margin: 0 0 6px; font-size: 13px; font-weight: 700; color: #991B1B; text-transform: uppercase; letter-spacing: 0.5px;">${reasonLabel}</p>
                <p style="margin: 0; font-size: 14px; color: #7F1D1D; line-height: 1.5; text-align: left; word-break: break-word;">${resolvedReason}</p>
              </div>

              <p style="margin: 0 0 12px; font-size: 14px; line-height: 1.6; color: #6B7280;">
                ${deletionNotice}
              </p>
              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #6B7280;">
                ${thankYouNotice}
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #FAFAFA; border-top: 1px solid #F3F4F6; text-align: left; font-size: 13px; color: #9CA3AF; line-height: 1.5;">
              <p style="margin: 0;">© ${new Date().getFullYear()} Kebun Melon Monitoring System.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
${subject}

${greeting}

${intro}

${reasonLabel}
${resolvedReason}

${deletionNotice}

${thankYouNotice}

© ${new Date().getFullYear()} Kebun Melon Monitoring System.
  `.trim();

  return { subject, html, text };
}

/**
 * Sends an account suspension notification email via the approved Resend provider.
 */
export async function sendAccountSuspensionEmail(
  input: SendAccountNoticeEmailInput
): Promise<SendAccountNoticeEmailResult> {
  const reqLogger = logger.child({
    requestId: input.requestId,
  });

  const env = validateServerEnv();
  const locale = input.locale || env.DEFAULT_LOCALE || 'id';
  const name = input.recipientName || '';
  const reason = input.reason || '';

  const { subject, html, text } = getAccountSuspensionEmailHtml(name, reason, locale);

  const apiKey = env.RESEND_API_KEY || process.env.RESEND_API_KEY;
  const fromEmail =
    env.RESEND_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || DEFAULT_RESEND_FROM_EMAIL;

  if (!apiKey || env.NODE_ENV === 'test' || process.env.NODE_ENV === 'test') {
    reqLogger.info('Simulated account suspension email delivery to ' + input.toEmail);
    return {
      success: true,
      emailSent: false,
      simulated: true,
    };
  }

  try {
    const resend = new Resend(apiKey);
    const result = await sendWithRetry(
      resend,
      {
        from: fromEmail,
        to: [input.toEmail],
        subject,
        html,
        text,
      },
      reqLogger
    );

    if (!result.success) {
      reqLogger.error(
        'Resend delivery reported error for account suspension: ' +
          (result.error || 'Unknown error')
      );
      return {
        success: false,
        emailSent: false,
        error: result.error,
      };
    }

    reqLogger.info('Account suspension email dispatched successfully via Resend');
    return {
      success: true,
      emailSent: true,
      id: result.id,
    };
  } catch (err: any) {
    reqLogger.error(
      'Unexpected exception during Resend suspension email dispatch: ' +
        (err?.message || String(err))
    );
    return {
      success: false,
      emailSent: false,
      error: err?.message || 'Email delivery failed',
    };
  }
}

/**
 * Sends a permanent account deletion notification email via the approved Resend provider.
 */
export async function sendAccountDeletionEmail(
  input: SendAccountNoticeEmailInput
): Promise<SendAccountNoticeEmailResult> {
  const reqLogger = logger.child({
    requestId: input.requestId,
  });

  const env = validateServerEnv();
  const locale = input.locale || env.DEFAULT_LOCALE || 'id';
  const name = input.recipientName || '';
  const reason = input.reason || '';

  const { subject, html, text } = getAccountDeletionEmailHtml(name, reason, locale);

  const apiKey = env.RESEND_API_KEY || process.env.RESEND_API_KEY;
  const fromEmail =
    env.RESEND_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || DEFAULT_RESEND_FROM_EMAIL;

  if (!apiKey || env.NODE_ENV === 'test' || process.env.NODE_ENV === 'test') {
    reqLogger.info('Simulated account deletion email delivery to ' + input.toEmail);
    return {
      success: true,
      emailSent: false,
      simulated: true,
    };
  }

  try {
    const resend = new Resend(apiKey);
    const result = await sendWithRetry(
      resend,
      {
        from: fromEmail,
        to: [input.toEmail],
        subject,
        html,
        text,
      },
      reqLogger
    );

    if (!result.success) {
      reqLogger.error(
        'Resend delivery reported error for account deletion: ' + (result.error || 'Unknown error')
      );
      return {
        success: false,
        emailSent: false,
        error: result.error,
      };
    }

    reqLogger.info('Account deletion email dispatched successfully via Resend');
    return {
      success: true,
      emailSent: true,
      id: result.id,
    };
  } catch (err: any) {
    reqLogger.error(
      'Unexpected exception during Resend deletion email dispatch: ' + (err?.message || String(err))
    );
    return {
      success: false,
      emailSent: false,
      error: err?.message || 'Email delivery failed',
    };
  }
}

function getAccountReactivationEmailHtml(
  name: string,
  reason: string,
  locale: string
): { subject: string; html: string; text: string } {
  const isId = locale === 'id';
  const resolvedReason = reason?.trim() || DEFAULT_REACTIVATION_REASON;
  const logoUrl = getEmailLogoUrl();

  const subject = isId
    ? 'Akun Kebun Melon Anda Telah Diaktifkan Kembali'
    : 'Your Kebun Melon Account Has Been Reactivated';

  const greeting = isId ? `Halo ${name || 'Pengguna'},` : `Hello ${name || 'User'},`;
  const intro = isId
    ? 'Akun Anda di Kebun Melon Monitoring System telah diaktifkan kembali oleh OWNER / PIC.'
    : 'Your account on the Kebun Melon Monitoring System has been reactivated by OWNER / PIC.';

  const reasonLabel = isId ? 'Alasan / Catatan:' : 'Reason / Notes:';

  const accessNotice = isId
    ? 'Anda dapat masuk kembali ke aplikasi menggunakan kredensial akun Anda.'
    : 'You may now log in to the application using your account credentials.';
  const supportNotice = isId
    ? 'Jika Anda tidak mengenali aktivitas ini atau membutuhkan bantuan, silakan hubungi OWNER / PIC.'
    : 'If you do not recognize this activity or require assistance, please contact OWNER / PIC.';

  const html = `
<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8F9FA; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1F2937;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8F9FA; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #E5E7EB; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: left; border-bottom: 1px solid #F3F4F6;">
              <img src="${logoUrl}" alt="Kebun Melon" width="180" height="36" style="height: 32px; width: auto; max-width: 180px; display: block; object-fit: contain;" />
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <div style="display: inline-block; padding: 6px 12px; background-color: #DCFCE7; border: 1px solid #86EFAC; border-radius: 8px; color: #166534; font-size: 13px; font-weight: 700; margin-bottom: 16px;">
                ${isId ? 'Akun Diaktifkan Kembali' : 'Account Reactivated'}
              </div>
              <h1 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #111827; line-height: 1.4;">
                ${subject}
              </h1>
              <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #4B5563;">
                ${greeting}
              </p>
              <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #4B5563;">
                ${intro}
              </p>

              <!-- Reason Box -->
              <div style="background-color: #F0FDF4; border-left: 4px solid #22C55E; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
                <p style="margin: 0 0 6px; font-size: 13px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">${reasonLabel}</p>
                <p style="margin: 0; font-size: 14px; color: #14532D; line-height: 1.5; text-align: left; word-break: break-word;">${resolvedReason}</p>
              </div>

              <p style="margin: 0 0 12px; font-size: 14px; line-height: 1.6; color: #6B7280;">
                ${accessNotice}
              </p>
              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #6B7280;">
                ${supportNotice}
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #FAFAFA; border-top: 1px solid #F3F4F6; text-align: left; font-size: 13px; color: #9CA3AF; line-height: 1.5;">
              <p style="margin: 0;">© ${new Date().getFullYear()} Kebun Melon Monitoring System.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
${subject}

${greeting}

${intro}

${reasonLabel}
${resolvedReason}

${accessNotice}

${supportNotice}

© ${new Date().getFullYear()} Kebun Melon Monitoring System.
  `.trim();

  return { subject, html, text };
}

/**
 * Sends an account reactivation notification email via the approved Resend provider.
 */
export async function sendAccountReactivationEmail(
  input: SendAccountNoticeEmailInput
): Promise<SendAccountNoticeEmailResult> {
  const reqLogger = logger.child({
    requestId: input.requestId,
  });

  const env = validateServerEnv();
  const locale = input.locale || env.DEFAULT_LOCALE || 'id';
  const name = input.recipientName || '';
  const reason = input.reason || '';

  const { subject, html, text } = getAccountReactivationEmailHtml(name, reason, locale);

  const apiKey = env.RESEND_API_KEY || process.env.RESEND_API_KEY;
  const fromEmail =
    env.RESEND_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || DEFAULT_RESEND_FROM_EMAIL;

  if (!apiKey || env.NODE_ENV === 'test' || process.env.NODE_ENV === 'test') {
    reqLogger.info('Simulated account reactivation email delivery to ' + input.toEmail);
    return {
      success: true,
      emailSent: false,
      simulated: true,
    };
  }

  try {
    const resend = new Resend(apiKey);
    const result = await sendWithRetry(
      resend,
      {
        from: fromEmail,
        to: [input.toEmail],
        subject,
        html,
        text,
      },
      reqLogger
    );

    if (!result.success) {
      reqLogger.error(
        'Resend delivery reported error for account reactivation: ' +
          (result.error || 'Unknown error')
      );
      return {
        success: false,
        emailSent: false,
        error: result.error,
      };
    }

    reqLogger.info('Account reactivation email dispatched successfully via Resend');
    return {
      success: true,
      emailSent: true,
      id: result.id,
    };
  } catch (err: any) {
    reqLogger.error(
      'Unexpected exception during Resend reactivation email dispatch: ' +
        (err?.message || String(err))
    );
    return {
      success: false,
      emailSent: false,
      error: err?.message || 'Email delivery failed',
    };
  }
}
