import { NextResponse } from 'next/server';
import { prisma, UserRepository } from '@kebun-melon/database';
import { UserQueryInputSchema } from '@kebun-melon/contracts';
import { requireSession, requirePermission, AuthorizationError } from '../../../../lib/auth/rbac';

export async function GET(request: Request) {
  const requestId = `req-${Date.now()}`;

  try {
    const session = await requireSession(request);
    requirePermission(session, 'profile.other.read', 'USER', undefined, request);

    const { searchParams } = new URL(request.url);
    const rawQuery = {
      page: searchParams.has('page') ? parseInt(searchParams.get('page')!, 10) : 1,
      pageSize: searchParams.has('pageSize') ? parseInt(searchParams.get('pageSize')!, 10) : 20,
      role: searchParams.get('role') || undefined,
      accountStatus: searchParams.get('accountStatus') || undefined,
      search: searchParams.get('search') || undefined,
      sort: searchParams.get('sort') || 'createdAt:desc',
    };

    const parseResult = UserQueryInputSchema.safeParse(rawQuery);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters.',
            details: parseResult.error.flatten(),
          },
          meta: { requestId },
        },
        { status: 422 }
      );
    }

    const userRepo = new UserRepository(prisma);
    const result = await userRepo.getUsers(parseResult.data);

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
          message: 'An unexpected internal error occurred while fetching users.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
