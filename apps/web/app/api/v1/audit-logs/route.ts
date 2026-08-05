import { NextRequest, NextResponse } from 'next/server';
import { prisma, AuditRepository } from '@kebun-melon/database';
import { AuditLogQuerySchema } from '@kebun-melon/contracts';
import { requireSession, requirePermission, AuthorizationError } from '@/lib/auth/rbac';

/**
 * GET /api/v1/audit-logs
 * List system audit logs with pagination and filtering.
 * Requires active session and 'audit.read' permission (OWNER only).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    requirePermission(session, 'audit.read', 'AUDIT_LOG', undefined, request);

    const searchParams = request.nextUrl.searchParams;
    const rawQuery = {
      page: searchParams.get('page') || undefined,
      pageSize: searchParams.get('pageSize') || undefined,
      eventKey: searchParams.get('eventKey') || undefined,
      actorUserId: searchParams.get('actorUserId') || undefined,
      targetType: searchParams.get('targetType') || undefined,
      targetId: searchParams.get('targetId') || undefined,
      result: searchParams.get('result') || undefined,
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
    };

    const parseResult = AuditLogQuerySchema.safeParse(rawQuery);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid audit log query parameters.',
            details: parseResult.error.flatten(),
          },
        },
        { status: 422 }
      );
    }

    const paginated = await AuditRepository.findAuditLogs(prisma, parseResult.data);

    return NextResponse.json(
      {
        success: true,
        data: paginated.items,
        pagination: {
          page: paginated.page,
          pageSize: paginated.pageSize,
          totalCount: paginated.totalCount,
          totalPages: paginated.totalPages,
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: err.code,
            message: err.message,
          },
        },
        { status: err.statusCode }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while retrieving audit logs.',
        },
      },
      { status: 500 }
    );
  }
}
