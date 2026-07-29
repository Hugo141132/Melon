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

export async function GET(request: Request, { params }: { params: { userId: string } }) {
  const requestId = `req-${Date.now()}`;

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

    const userRepo = new UserRepository(prisma);
    const activeRoles = await userRepo.readActiveRoleAssignments(sessionInfo.user.id);

    if (!activeRoles.includes(UserRole.OWNER)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Owner access required to view pending registration details.',
          },
          meta: { requestId },
        },
        { status: 403 }
      );
    }

    const targetUserId = params.userId;
    if (!targetUserId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Target userId parameter is required.',
          },
          meta: { requestId },
        },
        { status: 400 }
      );
    }

    const item = await userRepo.getPendingApprovalById(targetUserId);

    if (!item) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'Pending admin registration not found.',
          },
          meta: { requestId },
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: item,
        meta: { requestId },
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected internal error occurred while fetching registration detail.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
