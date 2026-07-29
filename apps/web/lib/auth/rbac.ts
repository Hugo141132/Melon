import { cookies } from 'next/headers';
import { prisma, validateSession, SESSION_COOKIE_NAME } from '@kebun-melon/database';
import { UserRole, AccountStatus } from '@kebun-melon/contracts';
import { CANONICAL_PERMISSIONS } from '@kebun-melon/database';

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

export function extractSessionTokenFromRequest(request?: Request): string | undefined {
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
    const cookieStore = cookies();
    return cookieStore.get(SESSION_COOKIE_NAME)?.value;
  } catch {
    return undefined;
  }
}

export async function requireSession(request?: Request): Promise<AuthenticatedUserSession> {
  const token = extractSessionTokenFromRequest(request);

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
  permissionCode: string
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
  permissionCode: string
): AuthenticatedUserSession {
  requireActiveAccount(session);

  if (session.id === targetUserId) {
    return session;
  }

  return requirePermission(session, permissionCode);
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
    if (session.assignedDeviceIds && session.assignedDeviceIds.includes(targetDeviceId)) {
      return session;
    }

    if (options?.isDeviceAssignedToUser) {
      const isAssigned = await options.isDeviceAssignedToUser(session.id, targetDeviceId);
      if (isAssigned) {
        return session;
      }
    }

    throw new AuthorizationError(
      403,
      'DEVICE_NOT_ASSIGNED',
      `Access denied: Device '${targetDeviceId}' is not assigned to user.`
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
