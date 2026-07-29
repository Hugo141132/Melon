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

export async function GET(request: Request) {
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

    // Verify active roles directly from DB userRoleAssignments
    const userRepo = new UserRepository(prisma);
    const activeRoles = await userRepo.readActiveRoleAssignments(sessionInfo.user.id);

    if (!activeRoles.includes(UserRole.OWNER)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Owner access required to view pending approvals list.',
          },
          meta: { requestId },
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const search = searchParams.get('search') || undefined;
    const sortParam = searchParams.get('sort');
    const sort = sortParam === 'createdAt:asc' ? 'createdAt:asc' : 'createdAt:desc';

    const result = await userRepo.getPendingApprovals({
      page,
      pageSize,
      search,
      sort,
    });

    return NextResponse.json(
      {
        success: true,
        data: result.items,
        meta: {
          requestId,
          pagination: result.pagination,
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
          message: 'An unexpected internal error occurred while fetching pending approvals.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
