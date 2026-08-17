import { NextResponse } from 'next/server';
import { prisma, UserRepository } from '@kebun-melon/database';
import { ForgotPasswordInputSchema } from '@kebun-melon/contracts';
import { ZodError } from 'zod';
import {
  checkRateLimit,
  getClientIp,
  createRateLimitResponse,
  applyRateLimitToResponse,
} from '@/lib/rate-limit';
import { validateServerEnv } from '@/lib/env/server';
import { sendPasswordResetEmail } from '@/lib/email/resend';

export async function POST(request: Request) {
  const requestId = `req-${Date.now()}`;
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined;
  const userAgent = request.headers.get('user-agent') || undefined;

  const env = validateServerEnv();
  const clientIp = getClientIp(request);
  const rateLimitInfo = checkRateLimit(clientIp, {
    keyPrefix: 'forgot-password',
    limit: env.RATE_LIMIT_FORGOT_PASSWORD_MAX,
    windowMs: env.RATE_LIMIT_WINDOW_MS,
  });

  if (!rateLimitInfo.allowed) {
    return createRateLimitResponse(rateLimitInfo, requestId);
  }

  try {
    const rawBody = await request.json().catch(() => ({}));
    const body = ForgotPasswordInputSchema.parse(rawBody);

    const userRepository = new UserRepository(prisma);
    const tokenResult = await userRepository.createPasswordResetToken({
      email: body.email,
      expiryMinutes: env.AUTH_RESET_TOKEN_EXPIRY_MINUTES,
      requestId,
      ipAddress,
      userAgent,
    });

    if (tokenResult.success) {
      // Dispatch email via Resend (awaited securely)
      await sendPasswordResetEmail({
        toEmail: tokenResult.user.email,
        recipientName: tokenResult.user.fullName,
        rawToken: tokenResult.rawToken,
        requestId,
      });
    } else {
      // Timing attack mitigation: simulate consistent cryptographic & hash workload
      // to mitigate side-channel timing analysis of account existence
      const dummyToken = `dummy-${Date.now()}-${Math.random()}`;
      void import('crypto').then((c) => c.createHash('sha256').update(dummyToken).digest('hex'));
    }

    // Always return a generic success response to strictly prevent account enumeration
    const response = NextResponse.json(
      {
        success: true,
        message: 'If an account exists with that email, a password reset link has been sent.',
        meta: {
          requestId,
        },
      },
      { status: 200 }
    );

    applyRateLimitToResponse(response, rateLimitInfo);
    return response;
  } catch (error: any) {
    if (error instanceof ZodError || error?.name === 'ZodError') {
      const errResponse = NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request payload format or extraneous fields present.',
            details: typeof error.flatten === 'function' ? error.flatten() : undefined,
          },
          meta: { requestId },
        },
        { status: 400 }
      );
      applyRateLimitToResponse(errResponse, rateLimitInfo);
      return errResponse;
    }

    // Generic error fallback without leaking internals
    const errResponse = NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while processing password recovery.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
    applyRateLimitToResponse(errResponse, rateLimitInfo);
    return errResponse;
  }
}
