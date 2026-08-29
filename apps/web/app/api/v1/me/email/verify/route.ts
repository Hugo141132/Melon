import { NextResponse } from 'next/server';
import { prisma, UserRepository } from '@kebun-melon/database';
import { VerifyEmailChangeInputSchema } from '@kebun-melon/contracts';
import {
  requireSession,
  requireActiveAccount,
  requirePermission,
  AuthorizationError,
} from '../../../../../../lib/auth/rbac';
import {
  checkRateLimit,
  getClientIp,
  createRateLimitResponse,
  applyRateLimitToResponse,
} from '../../../../../../lib/rate-limit';

export async function POST(request: Request) {
  const requestId = `req-${Date.now()}`;

  try {
    const session = await requireSession(request);
    requireActiveAccount(session);
    requirePermission(session, 'profilee.self.update', 'USER', session.id, request);

    const clientIdentifier = session.id || getClientIp(request);
    const rateLimitInfo = checkRateLimit(clientIdentifier, {
      keyPrefix: 'rate-limit:email-change-verify',
      limit: 5,
      windowMs: 60 * 1000,
    });

    if (!rateLimitInfo.allowed) {
      return createRateLimitResponse(rateLimitInfo, requestId);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      const badReqResponse = NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Request body must be valid JSON.',
          },
          meta: { requestId },
        },
        { status: 400 }
      );
      applyRateLimitToResponse(badReqResponse, rateLimitInfo);
      return badReqResponse;
    }

    const parseResult = VerifyEmailChangeInputSchema.safeParse(body);
    if (!parseResult.success) {
      const valErrorResponse = NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid email verification payload.',
            details: parseResult.error.flatten(),
          },
          meta: { requestId },
        },
        { status: 422 }
      );
      applyRateLimitToResponse(valErrorResponse, rateLimitInfo);
      return valErrorResponse;
    }

    const { code } = parseResult.data;
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      undefined;
    const userAgent = request.headers.get('user-agent') || undefined;

    const userRepo = new UserRepository(prisma);
    const result = await userRepo.verifyEmailChange({
      userId: session.id,
      code,
      ipAddress,
      userAgent,
      requestId,
    });

    if (!result.success) {
      let statusCode = 400;
      if (result.error === 'ACCOUNT_NOT_ACTIVE') statusCode = 403;
      else if (result.error === 'USER_NOT_FOUND') statusCode = 404;
      else if (result.error === 'DUPLICATE_EMAIL' || result.error === 'CONCURRENCY_CONFLICT') {
        statusCode = 409;
      } else if (result.error === 'INTERNAL_ERROR') {
        statusCode = 500;
      }

      const errResponse = NextResponse.json(
        {
          success: false,
          error: {
            code: result.error,
            message: result.message,
          },
          meta: { requestId },
        },
        { status: statusCode }
      );
      applyRateLimitToResponse(errResponse, rateLimitInfo);
      return errResponse;
    }

    const response = NextResponse.json(
      {
        success: true,
        data: {
          email: result.email,
          emailVerifiedAt: result.emailVerifiedAt?.toISOString(),
        },
        meta: { requestId },
      },
      { status: 200 }
    );
    applyRateLimitToResponse(response, rateLimitInfo);
    return response;
  } catch (error: any) {
    if (error instanceof AuthorizationError || error?.name === 'AuthorizationError') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
          meta: { requestId },
        },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected internal error occurred while verifying email change.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
