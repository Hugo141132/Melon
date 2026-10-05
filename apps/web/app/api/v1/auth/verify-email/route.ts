import { NextResponse } from 'next/server';
import { prisma, UserRepository } from '@kebun-melon/database';
import { VerifyEmailInputSchema, UserRole } from '@kebun-melon/contracts';
import { ZodError } from 'zod';
import {
  checkRateLimit,
  getClientIp,
  createRateLimitResponse,
  applyRateLimitToResponse,
} from '@/lib/rate-limit';
import { validateServerEnv } from '@/lib/env/server';
import { realtimeEventHub } from '@/lib/realtime/event-hub';
import { sendAdminApprovalRequestEmail } from '@/lib/email/resend';
import { logger } from '@/lib/observability/logger';

export async function POST(request: Request) {
  const requestId = `req-${Date.now()}`;
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined;
  const userAgent = request.headers.get('user-agent') || undefined;

  const env = validateServerEnv();
  const clientIp = getClientIp(request);

  // Reuse the reset password rate limit or create a new one, here we reuse the register or reset window size,
  // but using a separate key prefix.
  const rateLimitInfo = checkRateLimit(clientIp, {
    keyPrefix: 'verify-email',
    limit: 5, // 5 attempts per window
    windowMs: env.RATE_LIMIT_WINDOW_MS,
  });

  if (!rateLimitInfo.allowed) {
    return createRateLimitResponse(rateLimitInfo, requestId);
  }

  try {
    const rawBody = await request.json().catch(() => ({}));
    const body = VerifyEmailInputSchema.parse(rawBody);

    const userRepository = new UserRepository(prisma);
    const result = await userRepository.verifyEmailWithToken({
      email: body.email,
      code: body.code,
      token: body.token,
      requestId,
      ipAddress,
      userAgent,
    });

    if (!result.success) {
      let statusCode = 400;
      if (result.error === 'INTERNAL_ERROR') {
        statusCode = 500;
      } else if (result.error === 'CONCURRENCY_CONFLICT') {
        statusCode = 409;
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
        message: 'Email address has been successfully verified.',
        data: {
          user: {
            id: result.user.id,
            email: result.user.email,
            fullName: result.user.fullName,
            accountStatus: result.user.accountStatus,
            emailVerifiedAt: result.user.emailVerifiedAt,
          },
        },
        meta: {
          requestId,
        },
      },
      { status: 200 }
    );

    // If user is pending approval (Admin applicant), notify active OWNERs via email and SSE
    if (result.user.accountStatus === 'PENDING_APPROVAL') {
      try {
        const activeOwners = await prisma.user.findMany({
          where: {
            userRoles: {
              some: {
                role: { code: UserRole.OWNER },
                revokedAt: null,
              },
            },
            accountStatus: 'ACTIVE',
            emailVerifiedAt: { not: null },
          },
          select: {
            id: true,
            email: true,
            fullName: true,
            userPreference: {
              select: {
                preferredLocale: true,
              },
            },
          },
        });

        if (activeOwners.length === 0) {
          logger.warn(
            'No active verified OWNER accounts found in database. Admin approval request email send not attempted.',
            { requestId, applicantId: result.user.id }
          );
        } else {
          logger.info(
            `Found ${activeOwners.length} active verified OWNER account(s). Dispatching approval notification emails.`,
            { requestId, ownerCount: activeOwners.length, applicantId: result.user.id }
          );
        }

        // Broadcast real-time SSE event to online OWNERs
        realtimeEventHub.publish({
          name: 'admin.approval.requested',
          data: {
            userId: result.user.id,
            fullName: result.user.fullName,
            email: result.user.email,
            requestedAt: new Date().toISOString(),
          },
        });

        // Dispatch localized transactional notification email to each active OWNER in parallel
        await Promise.allSettled(
          activeOwners.map(async (owner) => {
            try {
              const sendRes = await sendAdminApprovalRequestEmail({
                toEmail: owner.email,
                recipientName: owner.fullName,
                applicantName: result.user.fullName,
                applicantEmail: result.user.email,
                locale: owner.userPreference?.preferredLocale || env.DEFAULT_LOCALE || 'id',
                requestId,
              });

              if (!sendRes.success) {
                logger.error(
                  `Resend provider rejected approval request email for OWNER [sanitized ID: ${owner.id}]: ${sendRes.error}`,
                  undefined,
                  { requestId, ownerId: owner.id, error: sendRes.error }
                );
              } else if (sendRes.simulated) {
                logger.info(
                  `Approval request email for OWNER [sanitized ID: ${owner.id}] was simulated (test/unconfigured environment).`,
                  { requestId, ownerId: owner.id }
                );
              } else {
                logger.info(
                  `Approval request email accepted by Resend provider with ID: ${sendRes.id}`,
                  { requestId, ownerId: owner.id, messageId: sendRes.id }
                );
              }
            } catch (err: any) {
              logger.error(
                `Unexpected exception dispatching approval email to OWNER [sanitized ID: ${owner.id}]`,
                err,
                { requestId, ownerId: owner.id }
              );
            }
          })
        );
      } catch (notifyErr) {
        // Fail-safe: Notification dispatch error does not affect verification success response
        logger.error('Error dispatching admin approval notifications:', notifyErr, {
          requestId,
          applicantId: result.user.id,
        });
      }
    }

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
          message: 'An unexpected error occurred while verifying email.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
    applyRateLimitToResponse(errResponse, rateLimitInfo);
    return errResponse;
  }
}
