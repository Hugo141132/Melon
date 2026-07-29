import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  prisma,
  validateSession,
  UserRepository,
  SESSION_COOKIE_NAME,
} from '@kebun-melon/database';
import { UserRole } from '@kebun-melon/contracts';

function extractSessionToken(request: Request): string | undefined {
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(
      new RegExp(`(?:^|; )\\s*${SESSION_COOKIE_NAME}\\s*=\\s*([^;]+)`)
    );
    if (match && match[1]) {
      return match[1];
    }
  }
  try {
    const cookieStore = cookies();
    return cookieStore.get(SESSION_COOKIE_NAME)?.value;
  } catch {
    return undefined;
  }
}

export async function POST(request: Request, { params }: { params: { userId: string } }) {
  const requestId = `req-${Date.now()}`;
  const userId = params.userId;

  try {
    const token = extractSessionToken(request);

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required. Please log in.',
          },
          meta: { requestId },
        },
        { status: 401 }
      );
    }

    const sessionInfo = await validateSession(prisma, token);

    if (!sessionInfo) {
      const response = NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Session invalid or expired. Please log in again.',
          },
          meta: { requestId },
        },
        { status: 401 }
      );

      response.cookies.set(SESSION_COOKIE_NAME, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 0,
      });

      return response;
    }

    // Verify active roles directly from DB userRoleAssignments
    const userRepo = new UserRepository(prisma);
    const activeRoles = await userRepo.readActiveRoleAssignments(sessionInfo.user.id);

    if (!activeRoles.includes(UserRole.OWNER)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Owner access required to reject admin registrations.',
          },
          meta: { requestId },
        },
        { status: 403 }
      );
    }

    // Parse and validate optional decisionNote from body
    let decisionNote: string | undefined;
    try {
      const body = await request.json();
      if (body && typeof body.decisionNote === 'string') {
        const trimmed = body.decisionNote.trim();
        if (trimmed.length > 1000) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Catatan penolakan (decisionNote) maksimal 1000 karakter.',
              },
              meta: { requestId },
            },
            { status: 422 }
          );
        }
        decisionNote = trimmed;
      }
    } catch {
      // Empty body is acceptable
    }

    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      undefined;
    const userAgent = request.headers.get('user-agent') || undefined;

    const result = await userRepo.rejectPendingAdmin({
      targetUserId: userId,
      decidedByUserId: sessionInfo.user.id,
      decisionNote,
      requestId,
      ipAddress,
      userAgent,
    });

    if (!result.success) {
      if (result.error === 'USER_NOT_FOUND') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'USER_NOT_FOUND',
              message: result.message,
            },
            meta: { requestId },
          },
          { status: 404 }
        );
      }

      if (result.error === 'INVALID_STATUS' || result.error === 'CONCURRENCY_CONFLICT') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'CONFLICT',
              message: result.message,
              details: result.currentStatus ? { currentStatus: result.currentStatus } : undefined,
            },
            meta: { requestId },
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: result.message,
          },
          meta: { requestId },
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          user: result.user,
          approvalRecordId: result.approvalRecordId,
        },
        meta: {
          requestId,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected internal error occurred during account rejection.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
