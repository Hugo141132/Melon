/**
 * Canonical User & Access Enums required by TASK-0201
 * Source of truth: docs/RBAC.md, docs/DATABASE.md, docs/API.md, Prisma Schema
 */

export enum UserRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
}

export enum AccountStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  ACTIVE = 'ACTIVE',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED',
  DEACTIVATED = 'DEACTIVATED',
}

export enum MonitoringStatus {
  NORMAL = 'NORMAL',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
  UNKNOWN = 'UNKNOWN',
  UNAVAILABLE = 'UNAVAILABLE',
  INVALID = 'INVALID',
}

export enum TelemetryValidationStatus {
  VALID = 'VALID',
  PARTIAL = 'PARTIAL',
  INVALID = 'INVALID',
  QUARANTINED = 'QUARANTINED',
}

export enum AlertSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export enum AlertStatus {
  OPEN = 'OPEN',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
}

export enum AlertType {
  DEVICE_OFFLINE = 'DEVICE_OFFLINE',
  STALE_MONITORING = 'STALE_MONITORING',
  COMMAND_FAILED = 'COMMAND_FAILED',
  COMMAND_TIMEOUT = 'COMMAND_TIMEOUT',
}

export enum FaucetCommandStatus {
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  TIMEOUT = 'TIMEOUT',
  EXPIRED = 'EXPIRED',
}
