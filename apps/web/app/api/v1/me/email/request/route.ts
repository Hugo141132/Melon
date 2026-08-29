import { NextResponse } from 'next/server';
import { prisma, UserRepository } from '@kebun-melon/database';
import { RequestEmailChangeInputSchema } from '@kebun-melon/contracts';
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
import { sendEmailChangeVerificationEmail } from '../../../../../../lib/email/resend';

export async function POST(request: Request) {
  const requestId = `req-${Date.now()}`;

  try {
    const session = await requireSession(request);
    requireActiveAccount(session);
    requirePermission(session, 'profilee.self.update', 'USER', session.id, request);

    const clientIdentifier = session.id || getClientIp(request);
    const rateLimitInfo = checkRateLimit(clientIdentifier, {
      keyPrefix: 'rate-limit:email-change-request',
      limit: 3,
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

    const parseResult = RequestEmailChangeInputSchema.safeParse(body);
    if (!parseResult.success) {
      const valErrorResponse = NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid email change request payload.',
            details: parseResult.error.flatten(),
          },
          meta: { requestId },
        },
        { status: 422 }
      );
      applyRateLimitToResponse(valErrorResponse, rateLimitInfo);
      return valErrorResponse;
    }

    const { newEmail, currentPassword } = parseResult.data;
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      undefined;
    const userAgent = request.headers.get('user-agent') || undefined;

    const userRepo = new UserRepository(prisma);
    const result = await userRepo.requestEmailChange({
      userId: session.id,
      newEmail,
      currentPassword,
      ipAddress,
      userAgent,
      requestId,
    });

    if (!result.success) {
      let statusCode = 400;
      if (result.error === 'INVALID_CREDENTIALS') statusCode = 401;
      else if (result.error === 'ACCOUNT_NOT_ACTIVE') statusCode = 403;
      else if (result.error === 'USER_NOT_FOUND') statusCode = 404;
      else if (result.error === 'SAME_EMAIL') statusCode = 400;
      else if (result.error === 'DUPLICATE_EMAIL') statusCode = 409;
      else if (result.error === 'INTERNAL_ERROR') statusCode = 500;

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

    // Dispatch verification code to candidate newEmail
    await sendEmailChangeVerificationEmail({
      toEmail: result.pendingEmail!,
      recipientName: result.user?.fullName,
      code: result.code!,
      requestId,
    });

    const response = NextResponse.json(
      {
        success: true,
        data: {
          status: 'VERIFICATION_CODE_SENT',
          expiresAt: result.expiresAt?.toISOString(),
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
          message: 'An unexpected internal error occurred while processing email change request.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
