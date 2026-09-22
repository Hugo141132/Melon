import { prisma, validateSession } from '@kebun-melon/database';
import { UserRole, AccountStatus } from '@kebun-melon/contracts';
import { extractSessionTokenFromRequest } from './rbac';

export type ServerDeviceAccessStatus = 'AUTHORIZED' | 'UNAUTHENTICATED' | 'FORBIDDEN';

export interface ServerDeviceAccessResult {
  status: ServerDeviceAccessStatus;
  userId?: string;
  isOwner?: boolean;
  deviceId?: string;
  code?: string;
  message?: string;
}

/**
 * Server-side guard for protected device monitoring routes (/soil, /water, /controls).
 *
 * Validates whether the authenticated user has active access to the specified target device:
 * - If targetDeviceId is null, undefined, or empty (bare route): AUTHORIZED (neutral overview state allowed).
 * - If session is missing or invalid: UNAUTHENTICATED.
 * - If session has OWNER role: AUTHORIZED (global device scope preserved).
 * - If session has ADMIN role:
 *     Validates database user_device_access for active assignment (revokedAt: null).
 *     - If active: AUTHORIZED (assigned device access allowed).
 *     - If revoked or unassigned: FORBIDDEN (code: DEVICE_NOT_ASSIGNED).
 * - Any other role: FORBIDDEN.
 */
export async function validateServerDeviceAccess(
  targetDeviceId?: string | null,
  request?: Request
): Promise<ServerDeviceAccessResult> {
  if (!targetDeviceId || !targetDeviceId.trim()) {
    return { status: 'AUTHORIZED' };
  }

  const cleanDevId = targetDeviceId.trim();
  const token = await extractSessionTokenFromRequest(request);

  if (!token) {
    return {
      status: 'UNAUTHENTICATED',
      deviceId: cleanDevId,
      code: 'UNAUTHENTICATED',
      message: 'Authentication session is required to access device monitoring.',
    };
  }

  let session;
  try {
    session = await validateSession(prisma, token);
  } catch {
    return {
      status: 'UNAUTHENTICATED',
      deviceId: cleanDevId,
      code: 'DATABASE_ERROR',
      message: 'Failed to validate session token against database.',
    };
  }

  if (!session || session.user.accountStatus !== AccountStatus.ACTIVE) {
    return {
      status: 'UNAUTHENTICATED',
      deviceId: cleanDevId,
      code: 'INVALID_SESSION',
      message: 'Session token is invalid, expired, or has been revoked.',
    };
  }

  const activeRoles = (session.user.activeRoles as UserRole[]) || [];

  // 1. OWNER role holds global device access across all sites
  if (activeRoles.includes(UserRole.OWNER)) {
    return {
      status: 'AUTHORIZED',
      userId: session.user.id,
      isOwner: true,
      deviceId: cleanDevId,
    };
  }

  // 2. ADMIN role requires an active (non-revoked) UserDeviceAccess record
  if (activeRoles.includes(UserRole.ADMIN)) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      cleanDevId
    );

    const assignment = await prisma.userDeviceAccess.findFirst({
      where: {
        userId: session.user.id,
        revokedAt: null,
        device: isUuid
          ? {
              OR: [
                { id: cleanDevId },
                { deviceId: cleanDevId },
                { deviceId: { equals: cleanDevId, mode: 'insensitive' } },
              ],
            }
          : {
              OR: [
                { deviceId: cleanDevId },
                { deviceId: { equals: cleanDevId, mode: 'insensitive' } },
              ],
            },
      },
    });

    if (assignment) {
      return {
        status: 'AUTHORIZED',
        userId: session.user.id,
        isOwner: false,
        deviceId: cleanDevId,
      };
    }

    return {
      status: 'FORBIDDEN',
      userId: session.user.id,
      isOwner: false,
      deviceId: cleanDevId,
      code: 'DEVICE_NOT_ASSIGNED',
      message: `Access denied: Device '${cleanDevId}' is not assigned to user or access has been revoked.`,
    };
  }

  return {
    status: 'FORBIDDEN',
    userId: session.user.id,
    isOwner: false,
    deviceId: cleanDevId,
    code: 'INSUFFICIENT_ROLE',
    message: `Role '${activeRoles.join(', ')}' is not authorized to view device '${cleanDevId}'.`,
  };
}
