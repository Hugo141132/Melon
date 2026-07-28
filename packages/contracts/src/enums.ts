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
