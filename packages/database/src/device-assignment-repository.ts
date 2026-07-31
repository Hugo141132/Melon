import { PrismaClient, Prisma, AccountStatus, UserRole } from '@prisma/client';
import { UserDeviceAccessDto } from '@kebun-melon/contracts';

export class DeviceAssignmentError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'USER_NOT_FOUND'
      | 'DEVICE_NOT_FOUND'
      | 'CANNOT_ASSIGN_OWNER'
      | 'INVALID_USER_STATUS'
      | 'ACTIVE_ASSIGNMENT_EXISTS'
      | 'ASSIGNMENT_NOT_FOUND'
      | 'UNAUTHORIZED_ACTOR'
      | 'DB_CONSTRAINT_VIOLATION' = 'DB_CONSTRAINT_VIOLATION'
  ) {
    super(message);
    this.name = 'DeviceAssignmentError';
  }
}

export class DeviceAssignmentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Helper to format a raw database UserDeviceAccess row into a safe UserDeviceAccessDto
   */
  private formatAssignmentDto(raw: any): UserDeviceAccessDto {
    return {
      id: raw.id,
      userId: raw.userId,
      deviceId: raw.deviceId,
      canonicalDeviceId: raw.device.deviceId,
      deviceName: raw.device.name,
      assignedByUserId: raw.assignedByUserId,
      assignedByUserName: raw.assignedBy?.fullName || undefined,
      assignedAt: raw.assignedAt,
      revokedAt: raw.revokedAt,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }

  /**
   * Resolves a target user and validates assignment eligibility.
   * Target MUST exist, MUST be role ADMIN, and MUST have accountStatus === ACTIVE.
   */
  async validateTargetUserForAssignment(userId: string, tx: any = this.prisma) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        accountStatus: true,
        userRoles: {
          where: { revokedAt: null },
          select: { role: { select: { code: true } } },
        },
      },
    });

    if (!user) {
      throw new DeviceAssignmentError(`Target user '${userId}' not found.`, 'USER_NOT_FOUND');
    }

    const activeRoles = user.userRoles.map((ur: any) => ur.role.code);

    if (activeRoles.includes(UserRole.OWNER)) {
      throw new DeviceAssignmentError(
        'Owner accounts have implicit global device access and cannot be assigned explicit device access rows.',
        'CANNOT_ASSIGN_OWNER'
      );
    }

    if (user.accountStatus !== AccountStatus.ACTIVE) {
      throw new DeviceAssignmentError(
        `Target user account status is '${user.accountStatus}'. Only ACTIVE Admin accounts can receive device assignments.`,
        'INVALID_USER_STATUS'
      );
    }

    return user;
  }

  /**
   * Resolves a device by canonical hardware deviceId or database UUID.
   */
  async resolveDevice(deviceIdOrId: string, tx: any = this.prisma) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      deviceIdOrId
    );

    const device = await tx.device.findFirst({
      where: isUuid
        ? { OR: [{ id: deviceIdOrId }, { deviceId: deviceIdOrId }] }
        : { deviceId: deviceIdOrId },
      select: {
        id: true,
        deviceId: true,
        name: true,
        accountStatus: true,
      },
    });

    if (!device) {
      throw new DeviceAssignmentError(`Device '${deviceIdOrId}' not found.`, 'DEVICE_NOT_FOUND');
    }

    return device;
  }

  /**
   * Validates actor authorization (MUST be ACTIVE OWNER).
   */
  private async validateOwnerActor(actorUserId: string, tx: any = this.prisma) {
    const actor = await tx.user.findUnique({
      where: { id: actorUserId },
      select: {
        id: true,
        accountStatus: true,
        userRoles: {
          where: { revokedAt: null },
          select: { role: { select: { code: true } } },
        },
      },
    });

    if (!actor || actor.accountStatus !== AccountStatus.ACTIVE) {
      throw new DeviceAssignmentError(
        'Acting user is unauthenticated or not active.',
        'UNAUTHORIZED_ACTOR'
      );
    }

    const activeRoles = actor.userRoles.map((ur: any) => ur.role.code);
    if (!activeRoles.includes(UserRole.OWNER)) {
      throw new DeviceAssignmentError(
        'Only active Owner accounts are authorized to assign or revoke device access.',
        'UNAUTHORIZED_ACTOR'
      );
    }

    return actor;
  }

  /**
   * Lists device assignments for a user.
   * By default returns only active assignments (revokedAt: null).
   */
  async listUserDeviceAssignments(
    userId: string,
    options: { includeRevoked?: boolean } = {}
  ): Promise<UserDeviceAccessDto[]> {
    const whereCondition: any = { userId };
    if (!options.includeRevoked) {
      whereCondition.revokedAt = null;
    }

    const rawList = await this.prisma.userDeviceAccess.findMany({
      where: whereCondition,
      include: {
        device: { select: { deviceId: true, name: true } },
        assignedBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rawList.map((raw) => this.formatAssignmentDto(raw));
  }

  /**
   * Transactionally assigns a device to an active Admin user.
   * Enforces target validation, active duplicate checks, creation of a NEW row upon reassignment,
   * and transactional creation of a 'device.access.assigned' AuditLog.
   */
  async assignDeviceToUser(input: {
    userId: string;
    deviceIdOrId: string;
    actorUserId: string;
    requestId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<UserDeviceAccessDto> {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Validate acting owner
      await this.validateOwnerActor(input.actorUserId, tx);

      // 2. Validate target user (Must be ACTIVE Admin)
      const targetUser = await this.validateTargetUserForAssignment(input.userId, tx);

      // 3. Resolve target device
      const device = await this.resolveDevice(input.deviceIdOrId, tx);

      // 4. Friendly check for existing active assignment
      const existingActive = await tx.userDeviceAccess.findFirst({
        where: {
          userId: targetUser.id,
          deviceId: device.id,
          revokedAt: null,
        },
      });

      if (existingActive) {
        throw new DeviceAssignmentError(
          `User '${targetUser.id}' is already actively assigned to device '${device.deviceId}'.`,
          'ACTIVE_ASSIGNMENT_EXISTS'
        );
      }

      // 5. Insert NEW UserDeviceAccess assignment row
      let assignmentRaw;
      try {
        assignmentRaw = await tx.userDeviceAccess.create({
          data: {
            userId: targetUser.id,
            deviceId: device.id,
            assignedByUserId: input.actorUserId,
            assignedAt: new Date(),
          },
          include: {
            device: { select: { deviceId: true, name: true } },
            assignedBy: { select: { fullName: true } },
          },
        });
      } catch (dbErr: any) {
        if (dbErr?.code === 'P2002') {
          throw new DeviceAssignmentError(
            `Concurrent active assignment exists for user '${targetUser.id}' and device '${device.deviceId}'.`,
            'ACTIVE_ASSIGNMENT_EXISTS'
          );
        }
        throw dbErr;
      }

      // 6. Create AuditLog entry without secrets (SEC-LOG-001)
      await tx.auditLog.create({
        data: {
          eventKey: 'device.access.assigned',
          actorUserId: input.actorUserId,
          targetType: 'UserDeviceAccess',
          targetId: assignmentRaw.id,
          result: 'SUCCESS',
          previousValues: Prisma.DbNull,
          newValues: {
            userId: targetUser.id,
            deviceId: device.id,
            canonicalDeviceId: device.deviceId,
            assignedByUserId: input.actorUserId,
            assignedAt: assignmentRaw.assignedAt,
          },
          requestId: input.requestId || null,
          ipAddress: input.ipAddress || null,
          userAgent: input.userAgent || null,
        },
      });

      return this.formatAssignmentDto(assignmentRaw);
    });
  }

  /**
   * Transactionally revokes an active device assignment for an Admin user.
   * Sets revokedAt = now() on the existing row (DOES NOT DELETE).
   * Creates a 'device.access.removed' AuditLog.
   */
  async revokeDeviceAssignment(input: {
    userId: string;
    deviceIdOrId: string;
    actorUserId: string;
    requestId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<UserDeviceAccessDto> {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Validate acting owner
      await this.validateOwnerActor(input.actorUserId, tx);

      // 2. Resolve device ID
      const device = await this.resolveDevice(input.deviceIdOrId, tx);

      // 3. Locate active assignment
      const activeAssignment = await tx.userDeviceAccess.findFirst({
        where: {
          userId: input.userId,
          deviceId: device.id,
          revokedAt: null,
        },
        include: {
          device: { select: { deviceId: true, name: true } },
          assignedBy: { select: { fullName: true } },
        },
      });

      if (!activeAssignment) {
        throw new DeviceAssignmentError(
          `No active device assignment found for user '${input.userId}' and device '${device.deviceId}'.`,
          'ASSIGNMENT_NOT_FOUND'
        );
      }

      const now = new Date();

      // 4. Update revokedAt timestamp
      const revokedRaw = await tx.userDeviceAccess.update({
        where: { id: activeAssignment.id },
        data: { revokedAt: now },
        include: {
          device: { select: { deviceId: true, name: true } },
          assignedBy: { select: { fullName: true } },
        },
      });

      // 5. Create AuditLog entry without secrets (SEC-LOG-001)
      await tx.auditLog.create({
        data: {
          eventKey: 'device.access.removed',
          actorUserId: input.actorUserId,
          targetType: 'UserDeviceAccess',
          targetId: revokedRaw.id,
          result: 'SUCCESS',
          previousValues: {
            assignedAt: activeAssignment.assignedAt,
            revokedAt: null,
          },
          newValues: {
            revokedAt: now,
          },
          requestId: input.requestId || null,
          ipAddress: input.ipAddress || null,
          userAgent: input.userAgent || null,
        },
      });

      return this.formatAssignmentDto(revokedRaw);
    });
  }
}
