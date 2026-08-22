import { cookies } from 'next/headers';
import { prisma, validateSession, SESSION_COOKIE_NAME } from '@kebun-melon/database';
import {
  UserRole,
  AccountStatus,
  DeviceAccountStatus,
  supportsCapability,
  DevicePermissionsDto,
} from '@kebun-melon/contracts';
import { CANONICAL_PERMISSIONS } from '@kebun-melon/database';
import { logAuthorizationDenial } from '@/lib/audit/audit-service';

export class AuthorizationError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export interface AuthenticatedUserSession {
  id: string;
  fullName: string;
  email: string;
  accountStatus: AccountStatus;
  activeRoles: UserRole[];
  assignedDeviceIds?: string[];
}

export async function extractSessionTokenFromRequest(
  request?: Request
): Promise<string | undefined> {
  if (request) {
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      const match = cookieHeader.match(
        new RegExp(`(?:^|; )\\s*${SESSION_COOKIE_NAME}\\s*=\\s*([^;]+)`)
      );
      if (match && match[1]) {
        return match[1];
      }
    }
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }
  }

  try {
    const cookieStore = await cookies();
    return cookieStore.get(SESSION_COOKIE_NAME)?.value;
  } catch {
    return undefined;
  }
}

export async function requireSession(request?: Request): Promise<AuthenticatedUserSession> {
  const token = await extractSessionTokenFromRequest(request);

  if (!token) {
    throw new AuthorizationError(
      401,
      'UNAUTHENTICATED',
      'Authentication session is required to perform this action.'
    );
  }

  const session = await validateSession(prisma, token);
  if (!session) {
    throw new AuthorizationError(
      401,
      'INVALID_SESSION',
      'Session token is invalid, expired, or has been revoked.'
    );
  }

  return {
    id: session.user.id,
    fullName: session.user.fullName,
    email: session.user.email,
    accountStatus: session.user.accountStatus as AccountStatus,
    activeRoles: session.user.activeRoles as UserRole[],
  };
}

export async function getSessionOrNull(
  request?: Request
): Promise<AuthenticatedUserSession | null> {
  try {
    const token = await extractSessionTokenFromRequest(request);
    if (!token) return null;

    const session = await validateSession(prisma, token);
    if (!session) return null;

    return {
      id: session.user.id,
      fullName: session.user.fullName,
      email: session.user.email,
      accountStatus: session.user.accountStatus as AccountStatus,
      activeRoles: session.user.activeRoles as UserRole[],
    };
  } catch {
    return null;
  }
}

export function requireActiveAccount(session: AuthenticatedUserSession): AuthenticatedUserSession {
  if (session.accountStatus !== AccountStatus.ACTIVE) {
    throw new AuthorizationError(
      403,
      'ACCOUNT_NOT_ACTIVE',
      `Account status is ${session.accountStatus}. Only ACTIVE accounts are authorized to perform protected operations.`
    );
  }
  return session;
}

export function requireRole(
  session: AuthenticatedUserSession,
  requiredRole: UserRole
): AuthenticatedUserSession {
  requireActiveAccount(session);

  if (!session.activeRoles.includes(requiredRole)) {
    throw new AuthorizationError(
      403,
      'FORBIDDEN_ROLE',
      `User does not possess the required role: ${requiredRole}.`
    );
  }
  return session;
}

export function requirePermission(
  session: AuthenticatedUserSession,
  permissionCode: string,
  targetType?: string,
  targetId?: string,
  request?: Request
): AuthenticatedUserSession {
  requireActiveAccount(session);

  const permDef = CANONICAL_PERMISSIONS.find((p) => p.code === permissionCode);
  if (!permDef) {
    throw new AuthorizationError(
      403,
      'UNKNOWN_PERMISSION',
      `Access denied: Permission '${permissionCode}' is unknown or invalid.`
    );
  }

  const isOwner = session.activeRoles.includes(UserRole.OWNER);
  const isAdmin = session.activeRoles.includes(UserRole.ADMIN);

  const hasAccess = (isOwner && permDef.ownerAccess) || (isAdmin && permDef.adminAccess);

  if (!hasAccess) {
    logAuthorizationDenial(
      session,
      permissionCode,
      targetType || 'PERMISSION',
      targetId,
      request
    ).catch(() => {});
    throw new AuthorizationError(
      403,
      'INSUFFICIENT_PERMISSION',
      `Access denied: Missing required permission '${permissionCode}'.`
    );
  }

  return session;
}

export function requireSelfOrPermission(
  session: AuthenticatedUserSession,
  targetUserId: string,
  permissionCode: string,
  request?: Request
): AuthenticatedUserSession {
  requireActiveAccount(session);

  if (session.id === targetUserId) {
    return session;
  }

  return requirePermission(session, permissionCode, 'USER', targetUserId, request);
}

export interface DeviceAuthorizationOptions {
  isDeviceAssignedToUser?: (userId: string, deviceId: string) => Promise<boolean> | boolean;
  isDeviceActiveAndControllable?: (deviceId: string) => Promise<boolean> | boolean;
}

export async function requireDeviceViewAccess(
  session: AuthenticatedUserSession,
  targetDeviceId: string,
  options?: DeviceAuthorizationOptions
): Promise<AuthenticatedUserSession> {
  requireActiveAccount(session);

  if (session.activeRoles.includes(UserRole.OWNER)) {
    return session;
  }

  if (session.activeRoles.includes(UserRole.ADMIN)) {
    if (options?.isDeviceAssignedToUser) {
      const isAssigned = await options.isDeviceAssignedToUser(session.id, targetDeviceId);
      if (isAssigned) {
        return session;
      }
      throw new AuthorizationError(
        403,
        'DEVICE_NOT_ASSIGNED',
        `Access denied: Device '${targetDeviceId}' is not assigned to user or access has been revoked.`
      );
    }

    if (session.assignedDeviceIds) {
      if (session.assignedDeviceIds.includes(targetDeviceId)) {
        return session;
      }
      throw new AuthorizationError(
        403,
        'DEVICE_NOT_ASSIGNED',
        `Access denied: Device '${targetDeviceId}' is not assigned to user.`
      );
    }

    // Default fallback to DB lookup if isDeviceAssignedToUser was not passed and assignedDeviceIds is undefined
    const cleanDevId = targetDeviceId.trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      cleanDevId
    );
    const assignment = await prisma.userDeviceAccess.findFirst({
      where: {
        userId: session.id,
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
      return session;
    }

    throw new AuthorizationError(
      403,
      'DEVICE_NOT_ASSIGNED',
      `Access denied: Device '${targetDeviceId}' is not assigned to user or access has been revoked.`
    );
  }

  throw new AuthorizationError(
    403,
    'FORBIDDEN_DEVICE_ACCESS',
    `Access denied: User possesses no valid device access roles.`
  );
}

export async function requireDeviceControlAccess(
  session: AuthenticatedUserSession,
  targetDeviceId: string,
  options?: DeviceAuthorizationOptions
): Promise<AuthenticatedUserSession> {
  requireActiveAccount(session);

  const isFaucetEnabled =
    process.env.ENABLE_FAUCET_CONTROL === 'true' || process.env.ENABLE_FAUCET_CONTROL === '1';
  if (!isFaucetEnabled) {
    throw new AuthorizationError(
      403,
      'FAUCET_CONTROL_DISABLED',
      'Access denied: Faucet control feature flag ENABLE_FAUCET_CONTROL is currently disabled.'
    );
  }

  requirePermission(session, 'device.control.dispense');

  await requireDeviceViewAccess(session, targetDeviceId, options);

  if (options?.isDeviceActiveAndControllable) {
    const isControllable = await options.isDeviceActiveAndControllable(targetDeviceId);
    if (!isControllable) {
      throw new AuthorizationError(
        403,
        'DEVICE_NOT_CONTROLLABLE',
        `Access denied: Device '${targetDeviceId}' is not currently active and controllable.`
      );
    }
  }

  return session;
}

/**
 * Computes dynamic device permissions DTO (canView, canControl) per user session and device state.
 * Preserves RBAC, active account status, device capabilities, and ENABLE_FAUCET_CONTROL feature flag.
 */
export function computeDevicePermissions(
  session: AuthenticatedUserSession,
  device: {
    accountStatus: string;
    capabilities?: string[] | { capability: string; enabled?: boolean }[];
  },
  isAssigned: boolean = true
): DevicePermissionsDto {
  if (session.accountStatus !== AccountStatus.ACTIVE) {
    return { canView: false, canControl: false };
  }

  const isOwner = session.activeRoles.includes(UserRole.OWNER);
  const isAdmin = session.activeRoles.includes(UserRole.ADMIN);

  const canView = isOwner || (isAdmin && isAssigned);
  if (!canView) {
    return { canView: false, canControl: false };
  }

  const isFaucetEnabled =
    process.env.ENABLE_FAUCET_CONTROL === 'true' || process.env.ENABLE_FAUCET_CONTROL === '1';

  const isDeviceActive = device.accountStatus === DeviceAccountStatus.ACTIVE;
  const hasControlCap = supportsCapability(device, 'FAUCET_CONTROL');

  const canControl =
    isFaucetEnabled && isDeviceActive && hasControlCap && (isOwner || (isAdmin && isAssigned));

  return {
    canView,
    canControl,
  };
}
