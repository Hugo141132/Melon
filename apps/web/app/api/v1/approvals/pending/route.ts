import { NextResponse } from 'next/server';
import { prisma, UserRepository } from '@kebun-melon/database';
import { UserRole } from '@kebun-melon/contracts';
import { requireSession, requireRole, AuthorizationError } from '../../../../../lib/auth/rbac';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const requestId = `req-${Date.now()}`;

  try {
    let session;
    try {
      session = await requireSession(request);
      requireRole(session, UserRole.OWNER);
    } catch (err: any) {
      if (err instanceof AuthorizationError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: err.code,
              message: err.message,
            },
            meta: { requestId },
          },
          { status: err.statusCode }
        );
      }
      throw err;
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const search = searchParams.get('search') || undefined;
    const sortParam = searchParams.get('sort');
    const sort = sortParam === 'createdAt:asc' ? 'createdAt:asc' : 'createdAt:desc';

    const userRepo = new UserRepository(prisma);
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
