import { prisma, AuditRepository } from '@kebun-melon/database';
import {
  CreateAuditLogInput,
  AuditLogDto,
  AuditResult,
  AuditEventKey,
  UserRole,
} from '@kebun-melon/contracts';

export function extractRequestMetadata(request?: Request): {
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
} {
  if (!request) {
    return { ipAddress: null, userAgent: null, requestId: null };
  }

  const headers = request.headers;
  const ipAddress =
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || null;
  const userAgent = headers.get('user-agent') || null;
  const requestId = headers.get('x-request-id') || headers.get('x-correlation-id') || null;

  return { ipAddress, userAgent, requestId };
}

/**
 * High-level server-side audit logging helper for Next.js API routes and services.
 * Automatically extracts IP, User-Agent, and Request Correlation ID from Request headers.
 */
export async function recordAuditEvent(
  input: CreateAuditLogInput,
  request?: Request
): Promise<AuditLogDto> {
  const reqMeta = extractRequestMetadata(request);

  const fullInput: CreateAuditLogInput = {
    ...input,
    ipAddress: input.ipAddress ?? reqMeta.ipAddress,
    userAgent: input.userAgent ?? reqMeta.userAgent,
    requestId: input.requestId ?? reqMeta.requestId,
  };

  return AuditRepository.createAuditLog(prisma, fullInput);
}

/**
 * Helper to record high-risk authorization denial audit events.
 * Silently catches write errors to ensure audit logging never breaks authorization evaluation.
 */
export async function logAuthorizationDenial(
  session: { id?: string; activeRoles?: UserRole[]; accountStatus?: string } | null,
  permissionCode: string,
  targetType?: string,
  targetId?: string,
  request?: Request
): Promise<AuditLogDto | null> {
  try {
    return await recordAuditEvent(
      {
        eventKey: AuditEventKey.AUTHORISATION_HIGH_RISK_DENIED,
        actorUserId: session?.id || null,
        actorRole: session?.activeRoles?.[0] || null,
        targetType: targetType || 'PERMISSION',
        targetId: targetId || null,
        result: AuditResult.DENIED,
        metadata: {
          permissionCode,
          accountStatus: session?.accountStatus || null,
        },
      },
      request
    );
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Failed to log authorization denial audit record:', err);
    }
    return null;
  }
}
