import { PrismaClient } from '@prisma/client';
import {
  AccountStatus,
  UserRole as ContractUserRole,
  PublicSafeUserDto,
  toPublicSafeUserDto,
  normaliseEmail,
  RawDbUserWithRoles,
} from '@kebun-melon/contracts';

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
