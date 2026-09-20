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

    if (!tokenResult.success) {
      // DEC-AUTH-108: Explicit feedback for unregistered email to prevent operational confusion
      const notFoundResponse = NextResponse.json(
        {
          success: false,
          error: {
            code: 'EMAIL_NOT_FOUND',
            message: 'Alamat email tidak terdaftar dalam sistem kami.',
          },
          meta: {
            requestId,
          },
        },
        { status: 404 }
      );
      applyRateLimitToResponse(notFoundResponse, rateLimitInfo);
      return notFoundResponse;
    }

    // Dispatch email via Resend (awaited securely)
    await sendPasswordResetEmail({
      toEmail: tokenResult.user.email,
      recipientName: tokenResult.user.fullName,
      rawToken: tokenResult.rawToken,
      requestId,
    });

    const response = NextResponse.json(
      {
        success: true,
        message: 'Tautan untuk mengatur ulang kata sandi telah dikirim ke email Anda.',
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

/**
 * GET /api/v1/auth/forgot-password?email=<email>
 * Checks if the latest password reset token for the given email has been consumed (completed).
 */
export async function GET(request: Request) {
  const requestId = `req-${Date.now()}`;
  const { searchParams } = new URL(request.url);
  const rawEmail = searchParams.get('email');

  if (!rawEmail || typeof rawEmail !== 'string') {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Parameter email wajib disertakan.',
        },
        meta: { requestId },
      },
      { status: 400 }
    );
  }

  const env = validateServerEnv();
  const clientIp = getClientIp(request);
  const rateLimitInfo = checkRateLimit(clientIp, {
    keyPrefix: 'forgot-password-status',
    limit: 10,
    windowMs: env.RATE_LIMIT_WINDOW_MS,
  });

  if (!rateLimitInfo.allowed) {
    return createRateLimitResponse(rateLimitInfo, requestId);
  }

  try {
    const normalised = rawEmail.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalised },
      select: { id: true },
    });

    if (!user) {
      const response = NextResponse.json(
        {
          success: true,
          completed: false,
          meta: { requestId },
        },
        { status: 200 }
      );
      applyRateLimitToResponse(response, rateLimitInfo);
      return response;
    }

    // Look for the latest token generated within the token expiry window (last 30 minutes)
    const latestToken = await prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        createdAt: {
          gte: new Date(Date.now() - 30 * 60 * 1000),
        },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        usedAt: true,
        expiresAt: true,
      },
    });

    const isCompleted = !!latestToken && latestToken.usedAt !== null;

    const response = NextResponse.json(
      {
        success: true,
        completed: isCompleted,
        usedAt: latestToken?.usedAt ? latestToken.usedAt.toISOString() : null,
        meta: { requestId },
      },
      { status: 200 }
    );
    applyRateLimitToResponse(response, rateLimitInfo);
    return response;
  } catch (err: any) {
    const errResponse = NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Gagal memeriksa status reset kata sandi.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
    applyRateLimitToResponse(errResponse, rateLimitInfo);
    return errResponse;
  }
}
