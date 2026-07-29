import { PrismaClient } from '@prisma/client';
import {
  AccountStatus,
  UserRole as ContractUserRole,
  PublicSafeUserDto,
  toPublicSafeUserDto,
  normaliseEmail,
  RawDbUserWithRoles,
} from '@kebun-melon/contracts';

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

          // 2. Update account status to APPROVED
          const updatedUser = await tx.user.update({
            where: { id: input.targetUserId },
            data: { accountStatus: AccountStatus.APPROVED },
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
              newStatus: AccountStatus.APPROVED,
              decidedByUserId: input.decidedByUserId,
              decisionNote: input.decisionNote?.trim() || null,
            },
          });

          // 4. Log AuditLog event (strictly no secrets/passwords/tokens)
          const auditLog = await tx.auditLog.create({
            data: {
              eventKey: 'ACCOUNT_APPROVAL_APPROVE',
              actorUserId: input.decidedByUserId,
              actorRole: ContractUserRole.OWNER,
              targetType: 'USER',
              targetId: targetUser.id,
              result: 'SUCCESS',
              previousValues: { accountStatus: AccountStatus.PENDING_APPROVAL },
              newValues: { accountStatus: AccountStatus.APPROVED },
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
