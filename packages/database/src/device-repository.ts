import { PrismaClient, Prisma } from '@prisma/client';
import {
  UpdateDeviceInput,
  DeviceQueryInput,
  PublicSafeDeviceDto,
  DeviceAccountStatus,
  DeviceConnectionStatus,
  DeviceType,
  getCanonicalCapabilitiesForDeviceType,
} from '@kebun-melon/contracts';

export class DeviceConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeviceConflictError';
  }
}

export class DeviceNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeviceNotFoundError';
  }
}

export class DeviceInactiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeviceInactiveError';
  }
}

export interface PaginatedDevicesResult {
  items: PublicSafeDeviceDto[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export class DeviceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Helper to format Prisma device object into PublicSafeDeviceDto.
   * EXCLUDES: internal secrets, DB connection details.
   */
  private formatPublicSafeDto(device: any): PublicSafeDeviceDto {
    const capabilities = Array.isArray(device.capabilities)
      ? device.capabilities.filter((c: any) => c.enabled !== false).map((c: any) => c.capability)
      : [];

    return {
      id: device.id,
      deviceId: device.deviceId,
      siteId: device.siteId,
      name: device.name,
      deviceType: device.deviceType as DeviceType,
      accountStatus: device.accountStatus as DeviceAccountStatus,
      connectionStatus: device.connectionStatus as DeviceConnectionStatus,
      firmwareVersion: device.firmwareVersion,
      hardwareRevision: device.hardwareRevision,
      schemaVersion: device.schemaVersion,
      lastSeenAt: device.lastSeenAt,
      lastMessageAt: device.lastMessageAt,
      latitude: device.latitude !== null ? Number(device.latitude) : null,
      longitude: device.longitude !== null ? Number(device.longitude) : null,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
      deactivatedAt: device.deactivatedAt,
      capabilities,
    };
  }

  /**
   * Fetches paginated devices list.
   * If authorizedDeviceIds is provided (for ADMINs), filters specifically to those devices.
   */
  async getDevices(
    query: DeviceQueryInput,
    authorizedDeviceIds?: string[]
  ): Promise<PaginatedDevicesResult> {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.max(1, Math.min(100, query.pageSize || 20));
    const skip = (page - 1) * pageSize;

    const where: Prisma.DeviceWhereInput = {};

    if (authorizedDeviceIds !== undefined) {
      where.id = { in: authorizedDeviceIds };
    }

    if (query.siteId) {
      where.siteId = query.siteId;
    }

    if (query.deviceType) {
      where.deviceType = query.deviceType;
    }

    if (query.connectionStatus) {
      where.connectionStatus = query.connectionStatus;
    }

    if (query.accountStatus) {
      where.accountStatus = query.accountStatus;
    }

    if (query.search && query.search.trim().length > 0) {
      const searchTerm = query.search.trim();
      where.OR = [
        { deviceId: { contains: searchTerm, mode: 'insensitive' } },
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { firmwareVersion: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const [rawSortField, rawSortOrder] = (query.sort || 'createdAt:desc').split(':');
    const sortField = ['createdAt', 'name', 'deviceId', 'lastSeenAt'].includes(rawSortField)
      ? rawSortField
      : 'createdAt';
    const sortOrder: Prisma.SortOrder = rawSortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc';

    const [totalItems, rawDevices] = await Promise.all([
      this.prisma.device.count({ where }),
      this.prisma.device.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortField]: sortOrder },
        include: {
          capabilities: true,
        },
      }),
    ]);

    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const items = rawDevices.map((d) => this.formatPublicSafeDto(d));

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
   * Retrieves a single device by canonical deviceId string OR UUID id.
   */
  async getDeviceByCanonicalId(identifier: string): Promise<PublicSafeDeviceDto | null> {
    if (!identifier || typeof identifier !== 'string') return null;
    const cleanId = identifier.trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);

    const device = await this.prisma.device.findFirst({
      where: isUuid
        ? {
            OR: [
              { id: cleanId },
              { deviceId: cleanId },
              { deviceId: { equals: cleanId, mode: 'insensitive' } },
            ],
          }
        : {
            OR: [{ deviceId: cleanId }, { deviceId: { equals: cleanId, mode: 'insensitive' } }],
          },
      include: {
        capabilities: true,
      },
    });

    if (!device) {
      return null;
    }

    return this.formatPublicSafeDto(device);
  }

  /**
   * Updates existing device metadata and/or external canonical deviceId (Owner-only operation).
   * Per DEC-DEV-028:
   * - Internal database primary key UUID (devices.id) is strictly immutable.
   * - Relational foreign keys (user_device_access, readings, commands, alerts) reference devices.id and remain 100% intact.
   * - Canonical deviceId uniqueness is strictly enforced across devices.
   * - Operational reconciliation of physical ESP32/NodeMCU firmware and EMQX broker credentials/ACLs
   *   following a deviceId rename is TBD / BLOCKING automation.
   * Audits action using device.updated event.
   */
  async updateDevice(
    deviceIdOrId: string,
    input: UpdateDeviceInput,
    actorUserId: string
  ): Promise<PublicSafeDeviceDto> {
    const target = await this.getDeviceByCanonicalId(deviceIdOrId);
    if (!target) {
      throw new DeviceNotFoundError(`Device '${deviceIdOrId}' not found.`);
    }

    const updateData: Prisma.DeviceUpdateInput = {};

    if (input.deviceId !== undefined && input.deviceId.trim() !== target.deviceId) {
      const trimmedDeviceId = input.deviceId.trim();
      const existingConflict = await this.prisma.device.findFirst({
        where: {
          deviceId: trimmedDeviceId,
          id: { not: target.id },
        },
      });

      if (existingConflict) {
        throw new DeviceConflictError(
          `Device with canonical deviceId '${trimmedDeviceId}' already exists.`
        );
      }

      updateData.deviceId = trimmedDeviceId;
    }

    if (input.name !== undefined) updateData.name = input.name;
    if (input.deviceType !== undefined) updateData.deviceType = input.deviceType;
    if (input.accountStatus !== undefined) updateData.accountStatus = input.accountStatus;
    if (input.firmwareVersion !== undefined) updateData.firmwareVersion = input.firmwareVersion;
    if (input.hardwareRevision !== undefined) updateData.hardwareRevision = input.hardwareRevision;
    if (input.schemaVersion !== undefined) updateData.schemaVersion = input.schemaVersion;
    if (input.siteId !== undefined) {
      updateData.site = input.siteId ? { connect: { id: input.siteId } } : { disconnect: true };
    }
    if (input.latitude !== undefined) {
      updateData.latitude = input.latitude !== null ? new Prisma.Decimal(input.latitude) : null;
    }
    if (input.longitude !== undefined) {
      updateData.longitude = input.longitude !== null ? new Prisma.Decimal(input.longitude) : null;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const dev = await tx.device.update({
        where: { id: target.id },
        data: updateData,
        include: { capabilities: true },
      });

      if (input.deviceType !== undefined) {
        await this.reconcileDeviceCapabilities(dev.id, tx);
      }

      const isUuidActor =
        actorUserId && typeof actorUserId === 'string' && actorUserId.trim().length > 0;
      await tx.auditLog.create({
        data: {
          eventKey: 'device.updated',
          actorUserId: isUuidActor ? actorUserId : null,
          targetType: 'Device',
          targetId: dev.id,
          result: 'SUCCESS',
          previousValues: {
            deviceId: target.deviceId,
            name: target.name,
            deviceType: target.deviceType,
            accountStatus: target.accountStatus,
          },
          newValues: {
            deviceId: dev.deviceId,
            name: dev.name,
            deviceType: dev.deviceType,
            accountStatus: dev.accountStatus,
          },
        },
      });

      return dev;
    });

    return (await this.getDeviceByCanonicalId(updated.id))!;
  }

  /**
   * Idempotent capability reconciliation helper for a single device.
   * Ensures the device's persisted capability rows strictly match its canonical deviceType profile.
   * Removes obsolete or cross-profile capabilities and creates missing canonical capabilities.
   * Can be executed within an existing Prisma transaction client (tx).
   */
  async reconcileDeviceCapabilities(
    deviceDbId: string,
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    const prismaClient = tx || this.prisma;

    const device = await prismaClient.device.findUnique({
      where: { id: deviceDbId },
      include: { capabilities: true },
    });

    if (!device) return;

    const canonicalCaps = getCanonicalCapabilitiesForDeviceType(device.deviceType as DeviceType);
    const existingCapMap = new Map(device.capabilities.map((c) => [c.capability, c]));

    // 1. Remove obsolete or cross-profile capability rows
    const obsoleteIds = device.capabilities
      .filter((c) => !canonicalCaps.includes(c.capability))
      .map((c) => c.id);

    if (obsoleteIds.length > 0) {
      await prismaClient.deviceCapability.deleteMany({
        where: { id: { in: obsoleteIds } },
      });
    }

    // 2. Add missing canonical capability rows
    const missingCaps = canonicalCaps.filter((cap) => !existingCapMap.has(cap));

    if (missingCaps.length > 0) {
      await prismaClient.deviceCapability.createMany({
        data: missingCaps.map((cap) => ({
          deviceId: deviceDbId,
          capability: cap,
          enabled: true,
          source: 'PROVISIONED',
        })),
        skipDuplicates: true,
      });
    }
  }

  /**
   * One-time maintenance method to reconcile existing database records.
   * Scans existing devices in the database and cleans up obsolete rows (e.g. RELAY_CONTROL, SOLENOID_VALVE_CONTROL).
   */
  async reconcileExistingDeviceCapabilitiesOnce(): Promise<{ reconciledDeviceCount: number }> {
    const devices = await this.prisma.device.findMany({ select: { id: true } });
    for (const dev of devices) {
      await this.reconcileDeviceCapabilities(dev.id);
    }
    return { reconciledDeviceCount: devices.length };
  }

  /**
   * Deactivates a device in the registry (Owner-only operation).
   * Sets accountStatus = DEACTIVATED, connectionStatus = INACTIVE, deactivatedAt = now().
   * Inactive devices cannot receive commands.
   */
  async deactivateDevice(deviceIdOrId: string, actorUserId: string): Promise<PublicSafeDeviceDto> {
    const target = await this.getDeviceByCanonicalId(deviceIdOrId);
    if (!target) {
      throw new DeviceNotFoundError(`Device '${deviceIdOrId}' not found.`);
    }

    const deactivated = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const dev = await tx.device.update({
        where: { id: target.id },
        data: {
          accountStatus: DeviceAccountStatus.DEACTIVATED,
          connectionStatus: DeviceConnectionStatus.INACTIVE,
          deactivatedAt: now,
        },
        include: { capabilities: true },
      });

      const isUuidActor =
        actorUserId && typeof actorUserId === 'string' && actorUserId.trim().length > 0;
      await tx.auditLog.create({
        data: {
          eventKey: 'device.deactivated',
          actorUserId: isUuidActor ? actorUserId : null,
          targetType: 'Device',
          targetId: dev.id,
          result: 'SUCCESS',
          previousValues: {
            accountStatus: target.accountStatus,
            connectionStatus: target.connectionStatus,
          },
          newValues: {
            accountStatus: dev.accountStatus,
            connectionStatus: dev.connectionStatus,
            deactivatedAt: now,
          },
        },
      });

      return dev;
    });

    return this.formatPublicSafeDto(deactivated);
  }

  /**
   * Permanently deletes a device from the database (Owner-only operation).
   * Transactionally deletes/reconciles dependent foreign keys in proper order before removing the device row.
   * Audits action using device.deleted event.
   */
  async deleteDevicePermanently(
    deviceIdOrId: string,
    actorUserId: string
  ): Promise<PublicSafeDeviceDto> {
    const target = await this.getDeviceByCanonicalId(deviceIdOrId);
    if (!target) {
      throw new DeviceNotFoundError(`Device '${deviceIdOrId}' not found.`);
    }

    const deletedDto = { ...target };

    await this.prisma.$transaction(async (tx) => {
      // 1. Delete capabilities (Cascade in schema, explicitly ensured)
      await tx.deviceCapability.deleteMany({ where: { deviceId: target.id } });

      // 2. Delete user device access assignments
      await tx.userDeviceAccess.deleteMany({ where: { deviceId: target.id } });

      // 3. Delete device status events
      await tx.deviceStatusEvent.deleteMany({ where: { deviceId: target.id } });

      // 4. Delete telemetry readings
      await tx.soilReading.deleteMany({ where: { deviceId: target.id } });
      await tx.waterReading.deleteMany({ where: { deviceId: target.id } });
      await tx.reservoirWaterReading.deleteMany({ where: { deviceId: target.id } });
      await tx.sensorBatteryReading.deleteMany({ where: { deviceId: target.id } });

      // 5. Delete faucet command events and faucet commands
      const commandIds = (
        await tx.faucetCommand.findMany({
          where: { deviceId: target.id },
          select: { id: true },
        })
      ).map((c) => c.id);

      if (commandIds.length > 0) {
        await tx.faucetCommandEvent.deleteMany({
          where: { faucetCommandId: { in: commandIds } },
        });
        await tx.faucetCommand.deleteMany({ where: { deviceId: target.id } });
      }

      // 6. Delete alert acknowledgements and alerts
      const alertIds = (
        await tx.alert.findMany({
          where: { deviceId: target.id },
          select: { id: true },
        })
      ).map((a) => a.id);

      if (alertIds.length > 0) {
        await tx.alertAcknowledgement.deleteMany({
          where: { alertId: { in: alertIds } },
        });
        await tx.alert.deleteMany({ where: { deviceId: target.id } });
      }

      // 7. Clear user preferences referencing this device as default
      await tx.userPreference.updateMany({
        where: { defaultDeviceId: target.id },
        data: { defaultDeviceId: null },
      });

      // 8. Delete the device row itself
      await tx.device.delete({ where: { id: target.id } });

      // 9. Record minimal audit event (no secrets/credentials)
      const isUuidActor =
        actorUserId && typeof actorUserId === 'string' && actorUserId.trim().length > 0;
      await tx.auditLog.create({
        data: {
          eventKey: 'device.deleted',
          actorUserId: isUuidActor ? actorUserId : null,
          targetType: 'Device',
          targetId: target.id,
          result: 'SUCCESS',
          previousValues: {
            deviceType: target.deviceType,
            accountStatus: target.accountStatus,
          },
        },
      });
    });

    return deletedDto;
  }
}
