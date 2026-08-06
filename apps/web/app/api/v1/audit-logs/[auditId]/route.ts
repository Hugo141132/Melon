import { NextRequest, NextResponse } from 'next/server';
import { prisma, AuditRepository } from '@kebun-melon/database';
import { requireSession, requirePermission, AuthorizationError } from '@/lib/auth/rbac';

/**
 * GET /api/v1/audit-logs/[auditId]
 * Get single audit log record by ID.
 * Requires active session and 'audit.read' permission (OWNER only).
 */
export async function GET(request: NextRequest, props: { params: Promise<{ auditId: string }> }) {
  const params = await props.params;
  try {
    const session = await requireSession(request);
    requirePermission(session, 'audit.read', 'AUDIT_LOG', params.auditId, request);

    const { auditId } = params;
    if (!auditId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Audit Log ID is required.',
          },
        },
        { status: 400 }
      );
    }

    const auditLog = await AuditRepository.findAuditLogById(prisma, auditId);
    if (!auditLog) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AUDIT_LOG_NOT_FOUND',
            message: `Audit log record with ID '${auditId}' was not found.`,
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: auditLog,
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
          message: 'An unexpected error occurred while retrieving audit log details.',
        },
      },
      { status: 500 }
    );
  }
}
