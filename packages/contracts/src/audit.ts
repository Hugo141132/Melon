import { z } from 'zod';
import { UserRole } from './enums';

/**
 * Canonical Audit Event Keys
 * Source of truth: docs/DATABASE.md §12.1, docs/SECURITY.md
 */
export enum AuditEventKey {
  ACCOUNT_REGISTRATION_CREATED = 'account.registration.created',
  ACCOUNT_APPROVED = 'account.approved',
  ACCOUNT_REJECTED = 'account.rejected',
  ACCOUNT_SUSPENDED = 'account.suspended',
  ACCOUNT_ACTIVATED = 'account.activated',
  ACCOUNT_DEACTIVATED = 'account.deactivated',
  ACCOUNT_DELETED = 'account.deleted',
  ACCOUNT_PASSWORD_CHANGED = 'account.password.changed',
  PROFILE_SELF_UPDATED = 'profile.self.updated',
  PROFILE_OTHER_UPDATED = 'profile.other.updated',
  DEVICE_ACCESS_ASSIGNED = 'device.access.assigned',
  DEVICE_ACCESS_REMOVED = 'device.access.removed',
  AUTH_LOGIN_SUCCESS = 'auth.login.success',
  AUTH_LOGIN_FAILED = 'auth.login.failed',
  AUTH_LOGOUT = 'auth.logout',
  FAUCET_COMMAND_CREATED = 'faucet.command.created',
  FAUCET_COMMAND_COMPLETED = 'faucet.command.completed',
  FAUCET_COMMAND_FAILED = 'faucet.command.failed',
  FAUCET_COMMAND_TIMEOUT = 'faucet.command.timeout',
  ALERT_ACKNOWLEDGED = 'alert.acknowledged',
  AUTHORISATION_HIGH_RISK_DENIED = 'authorisation.high_risk.denied',
}

/**
 * Audit Event Results
 */
export enum AuditResult {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  DENIED = 'DENIED',
}

/**
 * List of sensitive key patterns for secret redaction
 */
const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /pass/i,
  /hash/i,
  /token/i,
  /secret/i,
  /credential/i,
  /private_?key/i,
  /auth_?header/i,
  /cookie/i,
  /api_?key/i,
  /bearer/i,
];

/**
 * Recursively sanitizes any sensitive keys from objects or arrays
 * Replaces sensitive values with '[REDACTED]'
 */
export function redactSecrets<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactSecrets(item)) as unknown as T;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));

    if (isSensitive) {
      result[key] = '[REDACTED]';
    } else if (value !== null && typeof value === 'object') {
      result[key] = redactSecrets(value);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

/**
 * Zod schema for single Audit Log DTO returned to client
 */
export const AuditLogDtoSchema = z.object({
  id: z.string().uuid(),
  eventKey: z.string().min(1).max(150),
  actorUserId: z.string().uuid().nullable(),
  actorRole: z.nativeEnum(UserRole).nullable().optional(),
  targetType: z.string().max(80).nullable().optional(),
  targetId: z.string().uuid().nullable().optional(),
  result: z.string().max(30),
  previousValues: z.record(z.unknown()).nullable().optional(),
  newValues: z.record(z.unknown()).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  requestId: z.string().max(150).nullable().optional(),
  ipAddress: z.string().max(45).nullable().optional(),
  userAgent: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
});

export type AuditLogDto = z.infer<typeof AuditLogDtoSchema>;

/**
 * Zod schema for audit log query parameters
 */
export const AuditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  eventKey: z.string().optional(),
  actorUserId: z.string().uuid().optional(),
  targetType: z.string().optional(),
  targetId: z.string().uuid().optional(),
  result: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type AuditLogQuery = z.infer<typeof AuditLogQuerySchema>;

/**
 * Input contract for creating an audit log
 */
export interface CreateAuditLogInput {
  eventKey: string;
  actorUserId?: string | null;
  actorRole?: UserRole | null;
  targetType?: string | null;
  targetId?: string | null;
  result: AuditResult | string;
  previousValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}
