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
 * Dispatches an email via Resend with bounded exponential backoff retries for transient errors.
 */
async function sendWithRetry(
  resend: Resend,
  payload: { from: string; to: string[]; subject: string; html: string; text: string },
  reqLogger: any,
  maxAttempts = 3
): Promise<{ success: boolean; id?: string; error?: string }> {
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await resend.emails.send(payload);

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
 * Builds trusted verify email link using ONLY configured server environment URL.
 * Never relies on untrusted request Host headers.
 */
export function buildTrustedVerifyEmailUrl(rawToken: string): string {
  const env = validateServerEnv();
  const rawBaseUrl =
    env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'http://localhost:3000';
  const baseUrl = rawBaseUrl.replace(/\/+$/, '');
  return `${baseUrl}/verify-email?token=${encodeURIComponent(rawToken)}`;
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
    .header h1 { color: #166534; font-size: 24px; margin: 0; font-weight: 700; }
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
      <h1>Kebun Melon</h1>
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
    env.RESEND_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || 'Kebun Melon <onboarding@resend.dev>';

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
    .header h1 { color: #166534; font-size: 24px; margin: 0; font-weight: 700; }
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
      <h1>Kebun Melon</h1>
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
    env.RESEND_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || 'Kebun Melon <onboarding@resend.dev>';

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
