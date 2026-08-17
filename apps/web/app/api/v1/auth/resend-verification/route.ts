import { NextResponse } from 'next/server';
import { prisma, UserRepository } from '@kebun-melon/database';
import { ResendVerificationEmailInputSchema, normaliseEmail } from '@kebun-melon/contracts';
import { ZodError } from 'zod';
import {
  checkRateLimit,
  getClientIp,
  createRateLimitResponse,
  applyRateLimitToResponse,
} from '@/lib/rate-limit';
import { validateServerEnv } from '@/lib/env/server';
import { sendVerificationEmail } from '@/lib/email/resend';

export async function POST(request: Request) {
  const requestId = `req-${Date.now()}`;
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined;
  const userAgent = request.headers.get('user-agent') || undefined;

  const env = validateServerEnv();
  const clientIp = getClientIp(request);

  const rateLimitInfo = checkRateLimit(clientIp, {
    keyPrefix: 'resend-verification',
    limit: 3, // Similar to forgot password
    windowMs: env.RATE_LIMIT_WINDOW_MS,
  });

  if (!rateLimitInfo.allowed) {
    return createRateLimitResponse(rateLimitInfo, requestId);
  }

  try {
    const rawBody = await request.json().catch(() => ({}));
    const body = ResendVerificationEmailInputSchema.parse(rawBody);
    const normalisedEmail = normaliseEmail(body.email);

    const userRepository = new UserRepository(prisma);

    // Check if user exists and is not verified
    const user = await prisma.user.findUnique({
      where: { email: normalisedEmail },
    });

    // To prevent email enumeration, always return success even if user doesn't exist
    // or is already verified.
    if (user && !user.emailVerifiedAt) {
      const tokenResult = await userRepository.createEmailVerificationToken({
        userId: user.id,
        requestId,
        ipAddress,
        userAgent,
      });

      if (tokenResult.success) {
        await sendVerificationEmail({
          toEmail: user.email,
          recipientName: user.fullName,
          rawToken: tokenResult.rawToken,
          requestId,
        });
      }
    }

    const response = NextResponse.json(
      {
        success: true,
        message: 'If the email is registered and unverified, a verification link has been sent.',
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

    const errResponse = NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while resending verification email.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
    applyRateLimitToResponse(errResponse, rateLimitInfo);
    return errResponse;
  }
}
