import { PrismaClient, Prisma } from '@prisma/client';
import {
  AccountStatus,
  UserRole as ContractUserRole,
  PublicSafeUserDto,
  toPublicSafeUserDto,
  normaliseEmail,
  RawDbUserWithRoles,
  OwnerUserProfileUpdateInput,
  AuditEventKey,
} from '@kebun-melon/contracts';
import { revokeAllUserSessions } from './session-service';
import { validatePasswordPolicy, hashPassword, verifyPassword } from './password-service';

export interface UpdateOtherUserProfileInput {
  targetUserId: string;
  actorUserId: string;
  data: OwnerUserProfileUpdateInput;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export type UpdateOtherUserProfileResult =
  | { success: true; user: PublicSafeUserDto }
  | {
      success: false;
      error: 'USER_NOT_FOUND' | 'FORBIDDEN_TARGET' | 'CONCURRENCY_CONFLICT' | 'INTERNAL_ERROR';
      message: string;
    };

export interface ChangeUserPasswordInput {
  userId: string;
  currentPassword?: string;
  newPassword: string;
  actorUserId: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export type ChangeUserPasswordResult =
  | { success: true; revokedSessionsCount: number; user: PublicSafeUserDto }
  | {
      success: false;
      error:
        | 'USER_NOT_FOUND'
        | 'INVALID_CURRENT_PASSWORD'
        | 'WEAK_PASSWORD'
        | 'ACCOUNT_NOT_ACTIVE'
        | 'INTERNAL_ERROR';
      message: string;
    };

export interface UserLifecycleInput {
  targetUserId: string;
  actorUserId: string;
  reason?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export type UserLifecycleResult =
  | { success: true; user: PublicSafeUserDto }
  | {
      success: false;
      error:
        | 'USER_NOT_FOUND'
        | 'FORBIDDEN_TARGET'
        | 'INVALID_STATUS_TRANSITION'
        | 'LAST_OWNER_PROTECTION'
        | 'INTERNAL_ERROR';
      message: string;
      currentStatus?: AccountStatus;
    };

export interface ApproveAdminInput {
  targetUserId: string;
  decidedByUserId: string;
  decisionNote?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  notifyFn?: (applicant: { id: string; email: string; fullName: string }) => Promise<void>;
}

export type ApproveAdminResult =
  | {
      success: true;
      user: PublicSafeUserDto;
      approvalRecordId: string;
      auditLogId: string;
    }
  | {
      success: false;
      error: 'USER_NOT_FOUND' | 'INVALID_STATUS' | 'CONCURRENCY_CONFLICT' | 'INTERNAL_ERROR';
      message: string;
      currentStatus?: AccountStatus;
    };

export interface RejectAdminInput {
  targetUserId: string;
  decidedByUserId: string;
  decisionNote?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  notifyFn?: (applicant: { id: string; email: string; fullName: string }) => Promise<void>;
}

export type RejectAdminResult =
  | {
      success: true;
      user: PublicSafeUserDto;
      approvalRecordId: string;
      auditLogId: string;
    }
  | {
      success: false;
      error: 'USER_NOT_FOUND' | 'INVALID_STATUS' | 'CONCURRENCY_CONFLICT' | 'INTERNAL_ERROR';
      message: string;
      currentStatus?: AccountStatus;
    };

export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Finds a user by ID and returns a public-safe DTO.
   * Uses Prisma select allow-list to ensure passwordHash, sessionTokenHash,
   * approval notes, and secret metadata are never fetched from the database.
   * Returns null if user is not found.
   */
  async findUserById(id: string): Promise<PublicSafeUserDto | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        email: true,
        username: true,
        accountStatus: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        suspendedAt: true,
        deactivatedAt: true,
        createdAt: true,
        updatedAt: true,
        userRoles: {
          where: { revokedAt: null },
          select: {
            id: true,
            userId: true,
            roleId: true,
            assignedByUserId: true,
            assignedAt: true,
            revokedAt: true,
            role: {
              select: {
                code: true,
              },
            },
          },
        },
      },
    });

    if (!user) return null;

    return toPublicSafeUserDto(this.mapPrismaUserToRawDbUser(user));
  }

  /**
   * Finds a user by email (automatically normalised with trim and lowercase)
   * and returns a public-safe DTO. Uses Prisma select allow-list.
   * Returns null if user is not found.
   */
  async findUserByNormalisedEmail(email: string): Promise<PublicSafeUserDto | null> {
    const normalised = normaliseEmail(email);

    const user = await this.prisma.user.findUnique({
      where: { email: normalised },
      select: {
        id: true,
        fullName: true,
        email: true,
        username: true,
        accountStatus: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        suspendedAt: true,
        deactivatedAt: true,
        createdAt: true,
        updatedAt: true,
        userRoles: {
          where: { revokedAt: null },
          select: {
            id: true,
            userId: true,
            roleId: true,
            assignedByUserId: true,
            assignedAt: true,
            revokedAt: true,
            role: {
              select: {
                code: true,
              },
            },
          },
        },
      },
    });

    if (!user) return null;

    return toPublicSafeUserDto(this.mapPrismaUserToRawDbUser(user));
  }

  /**
   * Reads account status for a given user ID.
   * Uses minimal Prisma select (accountStatus column only).
   * Returns null if user does not exist.
   */
  async readAccountStatus(userId: string): Promise<AccountStatus | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { accountStatus: true },
    });

    if (!user) return null;

    return user.accountStatus as AccountStatus;
  }

  /**
   * Reads active role assignments for a user.
   * Filters by revokedAt = null in the database query.
   */
  async readActiveRoleAssignments(userId: string): Promise<ContractUserRole[]> {
    const assignments = await this.prisma.userRoleAssignment.findMany({
      where: {
        userId,
        revokedAt: null,
      },
      select: {
        role: {
          select: {
            code: true,
          },
        },
      },
    });

    const activeRoles: ContractUserRole[] = [];
    for (const a of assignments) {
      if (a.role?.code) {
        activeRoles.push(a.role.code as ContractUserRole);
      }
    }

    return activeRoles;
  }

  /**
   * Retrieves a paginated list of pending admin registrations for Owner approval interface.
   * Filters strictly by accountStatus = PENDING_APPROVAL.
   * Selects ONLY public-safe allow-listed fields (id, fullName, email, accountStatus, createdAt).
   * Password hashes, tokens, and sensitive metadata are NEVER fetched from DB.
   */
  async getPendingApprovals(options?: {
    page?: number;
    pageSize?: number;
    search?: string;
    sort?: 'createdAt:asc' | 'createdAt:desc';
  }): Promise<{
    items: Array<{
      userId: string;
      fullName: string;
      email: string;
      accountStatus: AccountStatus;
      createdAt: Date;
    }>;
    pagination: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
    };
  }> {
    const page = Math.max(1, options?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options?.pageSize ?? 20));
    const skip = (page - 1) * pageSize;
    const search = options?.search?.trim();
    const sort = options?.sort ?? 'createdAt:desc';

    const where: any = {
      accountStatus: AccountStatus.PENDING_APPROVAL,
    };

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy =
      sort === 'createdAt:asc' ? { createdAt: 'asc' as const } : { createdAt: 'desc' as const };

    const [users, totalItems] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          email: true,
          accountStatus: true,
          createdAt: true,
        },
        orderBy,
        skip,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    const items = users.map((u) => ({
      userId: u.id,
      fullName: u.fullName,
      email: u.email,
      accountStatus: u.accountStatus as AccountStatus,
      createdAt: u.createdAt,
    }));

    const totalPages = Math.ceil(totalItems / pageSize) || 1;

    return {
      items,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    };
  }

  /**
   * Retrieves a single pending admin registration detail by userId.
   * Asserts that target user exists AND has accountStatus = PENDING_APPROVAL.
   * Selects ONLY public-safe allow-listed fields.
   * Returns null if user is missing or not in PENDING_APPROVAL state.
   */
  async getPendingApprovalById(userId: string): Promise<{
    userId: string;
    fullName: string;
    email: string;
    accountStatus: AccountStatus;
    createdAt: Date;
  } | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        accountStatus: true,
        createdAt: true,
      },
    });

    if (!user || user.accountStatus !== AccountStatus.PENDING_APPROVAL) {
      return null;
    }

    return {
      userId: user.id,
      fullName: user.fullName,
      email: user.email,
      accountStatus: user.accountStatus as AccountStatus,
      createdAt: user.createdAt,
    };
  }

  /**
   * Transactionally approves a pending admin registration (TASK-0207).
   * Verifies current account status is PENDING_APPROVAL.
   * Updates accountStatus to APPROVED (or ACTIVE per system policy).
   * Creates an AccountApproval audit history record.
   * Inserts an AuditLog entry (without secrets).
   * Executes notification callback post-commit (notification error does not rollback decision).
   */
  async approvePendingAdmin(input: ApproveAdminInput): Promise<ApproveAdminResult> {
    try {
      const txResult = await this.prisma.$transaction(
        async (tx) => {
          // 1. Fetch user to verify current state
          const targetUser = await tx.user.findUnique({
            where: { id: input.targetUserId },
            select: {
              id: true,
              fullName: true,
              email: true,
              username: true,
              accountStatus: true,
              createdAt: true,
              updatedAt: true,
            },
          });

          if (!targetUser) {
            return {
              success: false as const,
              error: 'USER_NOT_FOUND' as const,
              message: `Target user with ID '${input.targetUserId}' does not exist.`,
            };
          }

          if (targetUser.accountStatus !== AccountStatus.PENDING_APPROVAL) {
            return {
              success: false as const,
              error: 'INVALID_STATUS' as const,
              message: `Target user is in status '${targetUser.accountStatus}', not PENDING_APPROVAL. Approval cannot be processed.`,
              currentStatus: targetUser.accountStatus as AccountStatus,
            };
          }

          // 2. Update account status to ACTIVE (Owner approval directly activates Admin)
          const updatedUser = await tx.user.update({
            where: { id: input.targetUserId },
            data: { accountStatus: AccountStatus.ACTIVE },
            select: {
              id: true,
              fullName: true,
              email: true,
              username: true,
              accountStatus: true,
              emailVerifiedAt: true,
              lastLoginAt: true,
              suspendedAt: true,
              deactivatedAt: true,
              createdAt: true,
              updatedAt: true,
              userRoles: {
                where: { revokedAt: null },
                select: {
                  id: true,
                  userId: true,
                  roleId: true,
                  assignedByUserId: true,
                  assignedAt: true,
                  revokedAt: true,
                  role: { select: { code: true } },
                },
              },
            },
          });

          // 3. Create AccountApproval history entry
          const approvalRecord = await tx.accountApproval.create({
            data: {
              applicantUserId: targetUser.id,
              decision: 'APPROVE',
              previousStatus: AccountStatus.PENDING_APPROVAL,
              newStatus: AccountStatus.ACTIVE,
              decidedByUserId: input.decidedByUserId,
              decisionNote: input.decisionNote?.trim() || null,
            },
          });

          // 4. Log AuditLog event (strictly no secrets/passwords/tokens)
          const auditLog = await tx.auditLog.create({
            data: {
              eventKey: AuditEventKey.ACCOUNT_APPROVED,
              actorUserId: input.decidedByUserId,
              actorRole: ContractUserRole.OWNER,
              targetType: 'USER',
              targetId: targetUser.id,
              result: 'SUCCESS',
              previousValues: { accountStatus: AccountStatus.PENDING_APPROVAL },
              newValues: { accountStatus: AccountStatus.ACTIVE },
              metadata: {
                decision: 'APPROVE',
                decisionNote: input.decisionNote?.trim() || null,
                applicantEmail: targetUser.email,
                applicantFullName: targetUser.fullName,
              },
              requestId: input.requestId || null,
              ipAddress: input.ipAddress || null,
              userAgent: input.userAgent || null,
            },
          });

          return {
            success: true as const,
            user: toPublicSafeUserDto(this.mapPrismaUserToRawDbUser(updatedUser)),
            approvalRecordId: approvalRecord.id,
            auditLogId: auditLog.id,
            applicantInfo: {
              id: targetUser.id,
              email: targetUser.email,
              fullName: targetUser.fullName,
            },
          };
        },
        {
          isolationLevel: 'RepeatableRead',
        }
      );

      if (!txResult.success) {
        return txResult;
      }

      // 5. Fire optional notification callback AFTER successful transaction commit
      if (input.notifyFn && txResult.applicantInfo) {
        try {
          await input.notifyFn(txResult.applicantInfo);
        } catch {
          // Notification failure is non-blocking and must not fail or roll back decision
        }
      }

      return {
        success: true,
        user: txResult.user,
        approvalRecordId: txResult.approvalRecordId,
        auditLogId: txResult.auditLogId,
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'A database transaction error occurred during account approval.',
      };
    }
  }

  /**
   * Transactionally rejects a pending admin registration (TASK-0208).
   * Verifies current account status is PENDING_APPROVAL.
   * Updates accountStatus to REJECTED.
   * Creates an AccountApproval history record with decision='REJECT'.
   * Inserts an AuditLog entry with eventKey='ACCOUNT_APPROVAL_REJECT' (without secrets).
   * Executes notification callback post-commit (notification error does not rollback decision).
   */
  async rejectPendingAdmin(input: RejectAdminInput): Promise<RejectAdminResult> {
    try {
      const txResult = await this.prisma.$transaction(
        async (tx) => {
          // 1. Fetch user to verify current state
          const targetUser = await tx.user.findUnique({
            where: { id: input.targetUserId },
            select: {
              id: true,
              fullName: true,
              email: true,
              username: true,
              accountStatus: true,
              createdAt: true,
              updatedAt: true,
            },
          });

          if (!targetUser) {
            return {
              success: false as const,
              error: 'USER_NOT_FOUND' as const,
              message: `Target user with ID '${input.targetUserId}' does not exist.`,
            };
          }

          if (targetUser.accountStatus !== AccountStatus.PENDING_APPROVAL) {
            return {
              success: false as const,
              error: 'INVALID_STATUS' as const,
              message: `Target user is in status '${targetUser.accountStatus}', not PENDING_APPROVAL. Rejection cannot be processed.`,
              currentStatus: targetUser.accountStatus as AccountStatus,
            };
          }

          // 2. Update account status to REJECTED
          const updatedUser = await tx.user.update({
            where: { id: input.targetUserId },
            data: { accountStatus: AccountStatus.REJECTED },
            select: {
              id: true,
              fullName: true,
              email: true,
              username: true,
              accountStatus: true,
              emailVerifiedAt: true,
              lastLoginAt: true,
              suspendedAt: true,
              deactivatedAt: true,
              createdAt: true,
              updatedAt: true,
              userRoles: {
                where: { revokedAt: null },
                select: {
                  id: true,
                  userId: true,
                  roleId: true,
                  assignedByUserId: true,
                  assignedAt: true,
                  revokedAt: true,
                  role: { select: { code: true } },
                },
              },
            },
          });

          // 3. Create AccountApproval history entry
          const approvalRecord = await tx.accountApproval.create({
            data: {
              applicantUserId: targetUser.id,
              decision: 'REJECT',
              previousStatus: AccountStatus.PENDING_APPROVAL,
              newStatus: AccountStatus.REJECTED,
              decidedByUserId: input.decidedByUserId,
              decisionNote: input.decisionNote?.trim() || null,
            },
          });

          // 4. Log AuditLog event (strictly no secrets/passwords/tokens)
          const auditLog = await tx.auditLog.create({
            data: {
              eventKey: AuditEventKey.ACCOUNT_REJECTED,
              actorUserId: input.decidedByUserId,
              actorRole: ContractUserRole.OWNER,
              targetType: 'USER',
              targetId: targetUser.id,
              result: 'SUCCESS',
              previousValues: { accountStatus: AccountStatus.PENDING_APPROVAL },
              newValues: { accountStatus: AccountStatus.REJECTED },
              metadata: {
                decision: 'REJECT',
                decisionNote: input.decisionNote?.trim() || null,
                applicantEmail: targetUser.email,
                applicantFullName: targetUser.fullName,
              },
              requestId: input.requestId || null,
              ipAddress: input.ipAddress || null,
              userAgent: input.userAgent || null,
            },
          });

          return {
            success: true as const,
            user: toPublicSafeUserDto(this.mapPrismaUserToRawDbUser(updatedUser)),
            approvalRecordId: approvalRecord.id,
            auditLogId: auditLog.id,
            applicantInfo: {
              id: targetUser.id,
              email: targetUser.email,
              fullName: targetUser.fullName,
            },
          };
        },
        {
          isolationLevel: 'RepeatableRead',
        }
      );

      if (!txResult.success) {
        return txResult;
      }

      // 5. Fire optional notification callback AFTER successful transaction commit
      if (input.notifyFn && txResult.applicantInfo) {
        try {
          await input.notifyFn(txResult.applicantInfo);
        } catch {
          // Notification failure is non-blocking and must not fail or roll back decision
        }
      }

      return {
        success: true,
        user: txResult.user,
        approvalRecordId: txResult.approvalRecordId,
        auditLogId: txResult.auditLogId,
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'A database transaction error occurred during account rejection.',
      };
    }
  }

  /**
   * Updates user profile fields (fullName, username) transactionally.
   * Rejects unallowlisted fields.
   * Inserts an AuditLog entry with eventKey='profile.self.updated' (without secrets).
   */
  async updateUserProfile(input: {
    userId: string;
    data: { fullName?: string; username?: string | null };
    requestId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{
    success: boolean;
    user?: PublicSafeUserDto;
    error?: 'USER_NOT_FOUND' | 'INTERNAL_ERROR';
    message?: string;
  }> {
    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          const existingUser = await tx.user.findUnique({
            where: { id: input.userId },
            select: {
              id: true,
              fullName: true,
              username: true,
              email: true,
              accountStatus: true,
              createdAt: true,
              updatedAt: true,
            },
          });

          if (!existingUser) {
            return {
              success: false as const,
              error: 'USER_NOT_FOUND' as const,
              message: `User with ID '${input.userId}' not found.`,
            };
          }

          const previousValues: Record<string, any> = {};
          const newValues: Record<string, any> = {};
          const updateData: Record<string, any> = {};

          if (input.data.fullName !== undefined && input.data.fullName !== existingUser.fullName) {
            previousValues.fullName = existingUser.fullName;
            newValues.fullName = input.data.fullName;
            updateData.fullName = input.data.fullName;
          }

          if (input.data.username !== undefined && input.data.username !== existingUser.username) {
            previousValues.username = existingUser.username;
            newValues.username = input.data.username;
            updateData.username = input.data.username;
          }

          let updatedUser;
          if (Object.keys(updateData).length > 0) {
            updatedUser = await tx.user.update({
              where: { id: input.userId },
              data: updateData,
              select: {
                id: true,
                fullName: true,
                email: true,
                username: true,
                accountStatus: true,
                emailVerifiedAt: true,
                lastLoginAt: true,
                suspendedAt: true,
                deactivatedAt: true,
                createdAt: true,
                updatedAt: true,
                userRoles: {
                  where: { revokedAt: null },
                  select: {
                    id: true,
                    userId: true,
                    roleId: true,
                    assignedByUserId: true,
                    assignedAt: true,
                    revokedAt: true,
                    role: { select: { code: true } },
                  },
                },
              },
            });

            // Create AuditLog record (SEC-LOG-001)
            await tx.auditLog.create({
              data: {
                eventKey: 'profile.self.updated',
                actorUserId: input.userId,
                targetType: 'USER',
                targetId: input.userId,
                result: 'SUCCESS',
                previousValues,
                newValues,
                requestId: input.requestId || null,
                ipAddress: input.ipAddress || null,
                userAgent: input.userAgent || null,
              },
            });
          } else {
            updatedUser = await tx.user.findUnique({
              where: { id: input.userId },
              select: {
                id: true,
                fullName: true,
                email: true,
                username: true,
                accountStatus: true,
                emailVerifiedAt: true,
                lastLoginAt: true,
                suspendedAt: true,
                deactivatedAt: true,
                createdAt: true,
                updatedAt: true,
                userRoles: {
                  where: { revokedAt: null },
                  select: {
                    id: true,
                    userId: true,
                    roleId: true,
                    assignedByUserId: true,
                    assignedAt: true,
                    revokedAt: true,
                    role: { select: { code: true } },
                  },
                },
              },
            });
          }

          return {
            success: true as const,
            user: toPublicSafeUserDto(this.mapPrismaUserToRawDbUser(updatedUser)),
          };
        },
        {
          isolationLevel: 'RepeatableRead',
        }
      );

      return result;
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'A database transaction error occurred during profile update.',
      };
    }
  }

  /**
   * Transactionally updates a user's password and revokes ALL active sessions (TASK-0908).
   * Enforces password policy, Argon2id hashing, transactional session revocation, and secret-redacted audit logging.
   */
  async changeUserPassword(input: ChangeUserPasswordInput): Promise<ChangeUserPasswordResult> {
    try {
      const policyCheck = validatePasswordPolicy(input.newPassword);
      if (!policyCheck.valid) {
        return {
          success: false,
          error: 'WEAK_PASSWORD',
          message: policyCheck.reason || 'Password does not meet required security policy.',
        };
      }

      const user = await this.prisma.user.findUnique({
        where: { id: input.userId },
        select: {
          id: true,
          fullName: true,
          email: true,
          username: true,
          passwordHash: true,
          accountStatus: true,
        },
      });

      if (!user) {
        return {
          success: false,
          error: 'USER_NOT_FOUND',
          message: `User with ID '${input.userId}' not found.`,
        };
      }

      if (user.accountStatus !== AccountStatus.ACTIVE) {
        return {
          success: false,
          error: 'ACCOUNT_NOT_ACTIVE',
          message: `Account is ${user.accountStatus}. Only ACTIVE accounts can update password.`,
        };
      }

      if (input.currentPassword) {
        const isCurrentValid = await verifyPassword(user.passwordHash, input.currentPassword);
        if (!isCurrentValid) {
          return {
            success: false,
            error: 'INVALID_CURRENT_PASSWORD',
            message: 'Current password provided is incorrect.',
          };
        }
      }

      const newHash = await hashPassword(input.newPassword);

      const result = await this.prisma.$transaction(
        async (tx) => {
          const updatedUser = await tx.user.update({
            where: { id: input.userId },
            data: { passwordHash: newHash },
            select: {
              id: true,
              fullName: true,
              email: true,
              username: true,
              accountStatus: true,
              emailVerifiedAt: true,
              lastLoginAt: true,
              suspendedAt: true,
              deactivatedAt: true,
              createdAt: true,
              updatedAt: true,
              userRoles: {
                where: { revokedAt: null },
                select: {
                  id: true,
                  userId: true,
                  roleId: true,
                  assignedByUserId: true,
                  assignedAt: true,
                  revokedAt: true,
                  role: { select: { code: true } },
                },
              },
            },
          });

          // Revoke ALL active sessions for the user transactionally
          const revokedCount = await revokeAllUserSessions(tx, input.userId);

          // Audit log for password change (strictly without secrets)
          await tx.auditLog.create({
            data: {
              eventKey: AuditEventKey.ACCOUNT_PASSWORD_CHANGED,
              actorUserId: input.actorUserId,
              targetType: 'USER',
              targetId: input.userId,
              result: 'SUCCESS',
              previousValues: Prisma.JsonNull,
              newValues: Prisma.JsonNull,
              metadata: { revokedSessionsCount: revokedCount },
              requestId: input.requestId || null,
              ipAddress: input.ipAddress || null,
              userAgent: input.userAgent || null,
            },
          });

          return {
            success: true as const,
            revokedSessionsCount: revokedCount,
            user: toPublicSafeUserDto(this.mapPrismaUserToRawDbUser(updatedUser)),
          };
        },
        { isolationLevel: 'RepeatableRead' }
      );

      return result;
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'A database error occurred during password change.',
      };
    }
  }

  /**
   * Retrieves a paginated list of users for Owner user-management.
   * EXCLUDES passwordHash, sessionTokenHash, and secrets.
   */
  async getUsers(options?: {
    page?: number;
    pageSize?: number;
    role?: ContractUserRole;
    accountStatus?: AccountStatus;
    search?: string;
    sort?: 'createdAt:asc' | 'createdAt:desc' | 'fullName:asc' | 'fullName:desc';
  }): Promise<{
    items: PublicSafeUserDto[];
    pagination: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
    };
  }> {
    const page = Math.max(1, options?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options?.pageSize ?? 20));
    const skip = (page - 1) * pageSize;
    const search = options?.search?.trim();
    const sort = options?.sort ?? 'createdAt:desc';

    const where: any = {};

    if (options?.accountStatus) {
      where.accountStatus = options.accountStatus;
    } else {
      where.accountStatus = { not: AccountStatus.DEACTIVATED };
    }

    if (options?.role) {
      where.userRoles = {
        some: {
          revokedAt: null,
          role: { code: options.role },
        },
      };
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
      ];
    }

    let orderBy: any = { createdAt: 'desc' };
    if (sort === 'createdAt:asc') orderBy = { createdAt: 'asc' };
    else if (sort === 'fullName:asc') orderBy = { fullName: 'asc' };
    else if (sort === 'fullName:desc') orderBy = { fullName: 'desc' };

    const selectFields = {
      id: true,
      fullName: true,
      email: true,
      username: true,
      accountStatus: true,
      emailVerifiedAt: true,
      lastLoginAt: true,
      suspendedAt: true,
      deactivatedAt: true,
      createdAt: true,
      updatedAt: true,
      userRoles: {
        where: { revokedAt: null },
        select: {
          id: true,
          userId: true,
          roleId: true,
          assignedByUserId: true,
          assignedAt: true,
          revokedAt: true,
          role: { select: { code: true } },
        },
      },
    };

    const [users, totalItems] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: selectFields,
        orderBy,
        skip,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    const items = users.map((u) => toPublicSafeUserDto(this.mapPrismaUserToRawDbUser(u)));
    const totalPages = Math.ceil(totalItems / pageSize) || 1;

    return {
      items,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    };
  }

  /**
   * Retrieves a single user for Owner management view.
   * EXCLUDES passwordHash, sessionTokenHash, and secrets.
   */
  async getUserManagementById(userId: string): Promise<PublicSafeUserDto | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        username: true,
        accountStatus: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        suspendedAt: true,
        deactivatedAt: true,
        createdAt: true,
        updatedAt: true,
        userRoles: {
          where: { revokedAt: null },
          select: {
            id: true,
            userId: true,
            roleId: true,
            assignedByUserId: true,
            assignedAt: true,
            revokedAt: true,
            role: { select: { code: true } },
          },
        },
      },
    });

    if (!user) return null;

    return toPublicSafeUserDto(this.mapPrismaUserToRawDbUser(user));
  }

  /**
   * Updates another user's profile (fullName and/or username).
   * Email is strictly READ-ONLY.
   * Owner profiles cannot be edited through this endpoint.
   */
  async updateOtherUserProfile(
    input: UpdateOtherUserProfileInput
  ): Promise<UpdateOtherUserProfileResult> {
    try {
      const targetUser = await this.findUserById(input.targetUserId);
      if (!targetUser) {
        return {
          success: false,
          error: 'USER_NOT_FOUND',
          message: `Target user with ID '${input.targetUserId}' does not exist.`,
        };
      }

      if (targetUser.activeRoles.includes(ContractUserRole.OWNER)) {
        return {
          success: false,
          error: 'FORBIDDEN_TARGET',
          message: 'Owner profiles cannot be edited through this endpoint.',
        };
      }

      const updateData: { fullName?: string; username?: string | null } = {};
      if (input.data.fullName !== undefined) updateData.fullName = input.data.fullName.trim();
      if (input.data.username !== undefined)
        updateData.username = input.data.username ? input.data.username.trim() : null;

      const previousValues = {
        fullName: targetUser.fullName,
        username: targetUser.username,
      };

      const result = await this.prisma.$transaction(
        async (tx) => {
          const updated = await tx.user.update({
            where: { id: input.targetUserId },
            data: updateData,
            select: {
              id: true,
              fullName: true,
              email: true,
              username: true,
              accountStatus: true,
              emailVerifiedAt: true,
              lastLoginAt: true,
              suspendedAt: true,
              deactivatedAt: true,
              createdAt: true,
              updatedAt: true,
              userRoles: {
                where: { revokedAt: null },
                select: {
                  id: true,
                  userId: true,
                  roleId: true,
                  assignedByUserId: true,
                  assignedAt: true,
                  revokedAt: true,
                  role: { select: { code: true } },
                },
              },
            },
          });

          await tx.auditLog.create({
            data: {
              eventKey: 'profile.other.updated',
              actorUserId: input.actorUserId,
              targetType: 'USER',
              targetId: input.targetUserId,
              result: 'SUCCESS',
              previousValues,
              newValues: updateData,
              requestId: input.requestId || null,
              ipAddress: input.ipAddress || null,
              userAgent: input.userAgent || null,
            },
          });

          return toPublicSafeUserDto(this.mapPrismaUserToRawDbUser(updated));
        },
        { isolationLevel: 'RepeatableRead' }
      );

      return { success: true, user: result };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'A database error occurred while updating the target user profile.',
      };
    }
  }

  /**
   * Transactionally suspends an ACTIVE user account.
   * Atomically sets accountStatus = SUSPENDED, revokes all sessions, and logs audit event.
   * Target must be ADMIN (Owner accounts cannot be suspended).
   */
  async suspendUser(input: UserLifecycleInput): Promise<UserLifecycleResult> {
    try {
      const targetUser = await this.findUserById(input.targetUserId);
      if (!targetUser) {
        return {
          success: false,
          error: 'USER_NOT_FOUND',
          message: `Target user with ID '${input.targetUserId}' does not exist.`,
        };
      }

      if (
        targetUser.activeRoles.includes(ContractUserRole.OWNER) ||
        input.targetUserId === input.actorUserId
      ) {
        return {
          success: false,
          error: 'FORBIDDEN_TARGET',
          message: 'Owner accounts cannot be suspended.',
        };
      }

      if (targetUser.accountStatus !== AccountStatus.ACTIVE) {
        return {
          success: false,
          error: 'INVALID_STATUS_TRANSITION',
          message: `Only ACTIVE accounts can be suspended. Current status is ${targetUser.accountStatus}.`,
          currentStatus: targetUser.accountStatus,
        };
      }

      const now = new Date();

      const result = await this.prisma.$transaction(
        async (tx) => {
          const updated = await tx.user.update({
            where: { id: input.targetUserId },
            data: {
              accountStatus: AccountStatus.SUSPENDED,
              suspendedAt: now,
            },
            select: {
              id: true,
              fullName: true,
              email: true,
              username: true,
              accountStatus: true,
              emailVerifiedAt: true,
              lastLoginAt: true,
              suspendedAt: true,
              deactivatedAt: true,
              createdAt: true,
              updatedAt: true,
              userRoles: {
                where: { revokedAt: null },
                select: {
                  id: true,
                  userId: true,
                  roleId: true,
                  assignedByUserId: true,
                  assignedAt: true,
                  revokedAt: true,
                  role: { select: { code: true } },
                },
              },
            },
          });

          // Soft-revoke all sessions for target user atomically inside transaction
          await revokeAllUserSessions(tx, input.targetUserId);

          // Audit log (strictly without secrets)
          await tx.auditLog.create({
            data: {
              eventKey: 'account.suspended',
              actorUserId: input.actorUserId,
              targetType: 'USER',
              targetId: input.targetUserId,
              result: 'SUCCESS',
              previousValues: { accountStatus: targetUser.accountStatus },
              newValues: { accountStatus: AccountStatus.SUSPENDED, suspendedAt: now },
              metadata: { reason: input.reason?.trim() || null },
              requestId: input.requestId || null,
              ipAddress: input.ipAddress || null,
              userAgent: input.userAgent || null,
            },
          });

          return toPublicSafeUserDto(this.mapPrismaUserToRawDbUser(updated));
        },
        { isolationLevel: 'RepeatableRead' }
      );

      return { success: true, user: result };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'A database error occurred while suspending the target user.',
      };
    }
  }

  /**
   * Transactionally deactivates an ACTIVE or SUSPENDED user account.
   * Atomically sets accountStatus = DEACTIVATED, revokes all sessions, and logs audit event.
   * Target must be ADMIN (Owner accounts cannot be deactivated).
   */
  /**
   * Deactivates/Deletes an Admin user permanently.
   */
  async deactivateUser(input: UserLifecycleInput): Promise<UserLifecycleResult> {
    const res = await this.deleteUserPermanently(input);
    if (!res.success) {
      return {
        success: false,
        error: (res.error as any) || 'INTERNAL_ERROR',
        message: res.message || 'Failed to deactivate user.',
        currentStatus: res.currentStatus,
      };
    }
    return {
      success: true,
      user: {
        id: input.targetUserId,
        fullName: '',
        email: '',
        username: null,
        accountStatus: AccountStatus.DEACTIVATED,
        emailVerifiedAt: null,
        lastLoginAt: null,
        suspendedAt: null,
        deactivatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        activeRoles: [],
      },
    };
  }

  /**
   * Permanently deletes an ADMIN user account and all dependent records in a single database transaction.
   * Target MUST be ADMIN and MUST NOT be PENDING_APPROVAL or OWNER.
   */
  async deleteUserPermanently(input: UserLifecycleInput): Promise<{
    success: boolean;
    error?: string;
    message?: string;
    currentStatus?: AccountStatus;
  }> {
    try {
      const targetUser = await this.getUserManagementById(input.targetUserId);
      if (!targetUser) {
        return {
          success: false,
          error: 'NOT_FOUND',
          message: 'Target user account not found.',
        };
      }

      if (
        targetUser.activeRoles.includes(ContractUserRole.OWNER) ||
        input.targetUserId === input.actorUserId
      ) {
        return {
          success: false,
          error: 'FORBIDDEN_TARGET',
          message: 'Owner accounts cannot be deleted.',
        };
      }

      if (targetUser.accountStatus === AccountStatus.PENDING_APPROVAL) {
        return {
          success: false,
          error: 'CANNOT_DELETE_PENDING_APPROVAL',
          message: 'Pending approval accounts must be processed through the approval workflow.',
          currentStatus: targetUser.accountStatus,
        };
      }

      await this.prisma.$transaction(
        async (tx) => {
          const targetId = input.targetUserId;

          // 1. Delete all sessions
          await tx.session.deleteMany({
            where: { userId: targetId },
          });

          // 2. Delete user preferences
          await tx.userPreference.deleteMany({
            where: { userId: targetId },
          });

          // 3. Delete user role assignments
          await tx.userRoleAssignment.deleteMany({
            where: { userId: targetId },
          });

          // 4. Delete account approvals (where applicant or decidedBy)
          await tx.accountApproval.deleteMany({
            where: {
              OR: [{ applicantUserId: targetId }, { decidedByUserId: targetId }],
            },
          });

          // 5. Delete user device access assignments
          await tx.userDeviceAccess.deleteMany({
            where: {
              OR: [{ userId: targetId }, { assignedByUserId: targetId }],
            },
          });

          // 6. Delete faucet commands & command events initiated by target user
          const userCommands = await tx.faucetCommand.findMany({
            where: { initiatedByUserId: targetId },
            select: { id: true },
          });
          if (userCommands.length > 0) {
            const commandIds = userCommands.map((c) => c.id);
            await tx.faucetCommandEvent.deleteMany({
              where: { faucetCommandId: { in: commandIds } },
            });
            await tx.faucetCommand.deleteMany({
              where: { initiatedByUserId: targetId },
            });
          }

          // 7. Delete alert acknowledgements by target user
          await tx.alertAcknowledgement.deleteMany({
            where: { acknowledgedByUserId: targetId },
          });

          // 8. Anonymize/nullify audit log actorUserId where target was actor
          await tx.auditLog.updateMany({
            where: { actorUserId: targetId },
            data: { actorUserId: null },
          });

          // 9. Audit log event for permanent deletion (strictly non-PII)
          await tx.auditLog.create({
            data: {
              eventKey: 'account.deleted',
              actorUserId: input.actorUserId,
              targetType: 'USER',
              targetId: targetId,
              result: 'SUCCESS',
              previousValues: {
                accountStatus: targetUser.accountStatus,
                targetRole: 'ADMIN',
              },
              newValues: Prisma.JsonNull,
              metadata: { reason: input.reason?.trim() || null },
              requestId: input.requestId || null,
              ipAddress: input.ipAddress || null,
              userAgent: input.userAgent || null,
            },
          });

          // 10. Delete the User row itself
          await tx.user.delete({
            where: { id: targetId },
          });
        },
        { isolationLevel: 'RepeatableRead' }
      );

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'A database error occurred while deleting the target user.',
      };
    }
  }

  /**
   * Transactionally activates/reactivates a SUSPENDED, DEACTIVATED, or APPROVED user account.
   * PENDING_APPROVAL users must go through approval workflow.
   * REJECTED users cannot be directly activated.
   */
  async activateUser(input: UserLifecycleInput): Promise<UserLifecycleResult> {
    try {
      const targetUser = await this.findUserById(input.targetUserId);
      if (!targetUser) {
        return {
          success: false,
          error: 'USER_NOT_FOUND',
          message: `Target user with ID '${input.targetUserId}' does not exist.`,
        };
      }

      if (targetUser.activeRoles.includes(ContractUserRole.OWNER)) {
        return {
          success: false,
          error: 'FORBIDDEN_TARGET',
          message: 'Owner accounts do not require reactivation.',
        };
      }

      if (targetUser.accountStatus === AccountStatus.PENDING_APPROVAL) {
        return {
          success: false,
          error: 'INVALID_STATUS_TRANSITION',
          message: 'Pending approval accounts must be processed through the approval workflow.',
          currentStatus: targetUser.accountStatus,
        };
      }

      if (targetUser.accountStatus === AccountStatus.REJECTED) {
        return {
          success: false,
          error: 'INVALID_STATUS_TRANSITION',
          message: 'Rejected accounts cannot be directly activated.',
          currentStatus: targetUser.accountStatus,
        };
      }

      if (targetUser.accountStatus === AccountStatus.ACTIVE) {
        return {
          success: false,
          error: 'INVALID_STATUS_TRANSITION',
          message: 'Account is already ACTIVE.',
          currentStatus: targetUser.accountStatus,
        };
      }

      const result = await this.prisma.$transaction(
        async (tx) => {
          const updated = await tx.user.update({
            where: { id: input.targetUserId },
            data: {
              accountStatus: AccountStatus.ACTIVE,
              suspendedAt: null,
              deactivatedAt: null,
            },
            select: {
              id: true,
              fullName: true,
              email: true,
              username: true,
              accountStatus: true,
              emailVerifiedAt: true,
              lastLoginAt: true,
              suspendedAt: true,
              deactivatedAt: true,
              createdAt: true,
              updatedAt: true,
              userRoles: {
                where: { revokedAt: null },
                select: {
                  id: true,
                  userId: true,
                  roleId: true,
                  assignedByUserId: true,
                  assignedAt: true,
                  revokedAt: true,
                  role: { select: { code: true } },
                },
              },
            },
          });

          // Audit log (strictly without secrets)
          await tx.auditLog.create({
            data: {
              eventKey: 'account.activated',
              actorUserId: input.actorUserId,
              targetType: 'USER',
              targetId: input.targetUserId,
              result: 'SUCCESS',
              previousValues: { accountStatus: targetUser.accountStatus },
              newValues: { accountStatus: AccountStatus.ACTIVE },
              metadata: { reason: input.reason?.trim() || null },
              requestId: input.requestId || null,
              ipAddress: input.ipAddress || null,
              userAgent: input.userAgent || null,
            },
          });

          return toPublicSafeUserDto(this.mapPrismaUserToRawDbUser(updated));
        },
        { isolationLevel: 'RepeatableRead' }
      );

      return { success: true, user: result };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'A database error occurred while activating the target user.',
      };
    }
  }

  /**
   * Private helper to convert Prisma allow-listed selection into contract interface.
   * Sets dummy empty passwordHash internally for toPublicSafeUserDto mapper compliance.
   */
  private mapPrismaUserToRawDbUser(user: any): RawDbUserWithRoles {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      username: user.username,
      passwordHash: '', // Omitted at DB select query level
      accountStatus: user.accountStatus as AccountStatus,
      emailVerifiedAt: user.emailVerifiedAt,
      lastLoginAt: user.lastLoginAt,
      suspendedAt: user.suspendedAt,
      deactivatedAt: user.deactivatedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      userRoles: user.userRoles?.map((ur: any) => ({
        id: ur.id,
        userId: ur.userId,
        roleId: ur.roleId,
        assignedByUserId: ur.assignedByUserId,
        assignedAt: ur.assignedAt,
        revokedAt: ur.revokedAt,
        role: ur.role ? { code: ur.role.code as ContractUserRole } : undefined,
      })),
    };
  }
}
