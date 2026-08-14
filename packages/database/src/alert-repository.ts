import { PrismaClient, Prisma } from '@prisma/client';
import {
  AlertDto,
  AlertQueryInput,
  CreateAlertInput,
  AlertSeverity,
  AlertStatus,
  AlertType,
  PaginatedAlertsDto,
} from '@kebun-melon/contracts';

export class AlertNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AlertNotFoundError';
  }
}

export class AlertRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Formats raw Prisma Alert record into PublicSafe AlertDto.
   */
  private formatAlertDto(alert: any): AlertDto {
    return {
      id: alert.id,
      deviceId: alert.deviceId || null,
      userId: alert.userId || null,
      alertType: alert.alertType,
      severity: alert.severity as AlertSeverity,
      status: alert.status as AlertStatus,
      sourceType: alert.sourceType,
      sourceId: alert.sourceId || null,
      titleKey: alert.titleKey || null,
      messageKey: alert.messageKey || null,
      messageParams:
        alert.messageParams && typeof alert.messageParams === 'object'
          ? (alert.messageParams as Record<string, unknown>)
          : null,
      openedAt: alert.openedAt,
      resolvedAt: alert.resolvedAt || null,
      createdAt: alert.createdAt,
      updatedAt: alert.updatedAt,
    };
  }

  /**
   * Fetches paginated list of alerts.
   * If authorizedDeviceIds is provided (for ADMIN users), restricts device alerts to those IDs
   * while preserving account-level alerts for authorizedUserId.
   * If authorizedDeviceIds is undefined (for OWNER users), fetches global alerts.
   */
  async getAlerts(
    query: AlertQueryInput,
    authorizedDeviceIds?: string[],
    authorizedUserId?: string
  ): Promise<PaginatedAlertsDto> {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.max(1, Math.min(100, query.pageSize || 20));
    const skip = (page - 1) * pageSize;

    const where: Prisma.AlertWhereInput = {};

    // Device / Scope Filtering
    if (authorizedDeviceIds !== undefined) {
      // ADMIN Role Scoping
      if (query.deviceId) {
        if (authorizedDeviceIds.includes(query.deviceId)) {
          where.deviceId = query.deviceId;
        } else {
          // Explicit device requested but user is NOT authorized for it
          return {
            items: [],
            pagination: {
              page,
              pageSize,
              totalItems: 0,
              totalPages: 1,
            },
          };
        }
      } else {
        // No deviceId filter passed: return alerts for assigned devices OR user's own account alerts
        const orConditions: Prisma.AlertWhereInput[] = [{ deviceId: { in: authorizedDeviceIds } }];
        if (authorizedUserId) {
          orConditions.push({ userId: authorizedUserId });
        }
        where.OR = orConditions;
      }
    } else {
      // OWNER Role (Global Scope)
      if (query.deviceId) {
        where.deviceId = query.deviceId;
      }
    }

    if (query.severity) {
      where.severity = query.severity;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.alertType) {
      where.alertType = query.alertType;
    }

    if (query.from || query.to) {
      where.openedAt = {};
      if (query.from) {
        where.openedAt.gte = new Date(query.from);
      }
      if (query.to) {
        where.openedAt.lte = new Date(query.to);
      }
    }

    const [rawSortField, rawSortOrder] = (query.sort || 'openedAt:desc').split(':');
    const sortField = ['openedAt', 'createdAt', 'severity', 'status'].includes(rawSortField)
      ? rawSortField
      : 'openedAt';
    const sortOrder: Prisma.SortOrder = rawSortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc';

    const [totalItems, rawAlerts] = await Promise.all([
      this.prisma.alert.count({ where }),
      this.prisma.alert.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortField]: sortOrder },
      }),
    ]);

    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const items = rawAlerts.map((a) => this.formatAlertDto(a));

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
   * Fetches single Alert by UUID.
   * Enforces OWNER/ADMIN scoping logic.
   */
  async getAlertById(
    alertId: string,
    authorizedDeviceIds?: string[],
    authorizedUserId?: string
  ): Promise<AlertDto | null> {
    const alert = await this.prisma.alert.findUnique({
      where: { id: alertId },
    });

    if (!alert) {
      return null;
    }

    // ADMIN Scope check
    if (authorizedDeviceIds !== undefined) {
      if (alert.deviceId) {
        if (!authorizedDeviceIds.includes(alert.deviceId)) {
          return null;
        }
      } else if (alert.userId) {
        if (alert.userId !== authorizedUserId) {
          return null;
        }
      }
    }

    return this.formatAlertDto(alert);
  }

  /**
   * Creates a new Alert record.
   */
  async createAlert(input: CreateAlertInput): Promise<AlertDto> {
    const created = await this.prisma.alert.create({
      data: {
        deviceId: input.deviceId || null,
        userId: input.userId || null,
        alertType: input.alertType,
        severity: input.severity,
        status: input.status || AlertStatus.OPEN,
        sourceType: input.sourceType || 'device',
        sourceId: input.sourceId || null,
        titleKey: input.titleKey || null,
        messageKey: input.messageKey || null,
        messageParams: input.messageParams
          ? (input.messageParams as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        openedAt: input.openedAt ? new Date(input.openedAt) : new Date(),
      },
    });

    return this.formatAlertDto(created);
  }

  /**
   * Acknowledges an Alert and records an alert.acknowledged AuditLog entry inside a database transaction.
   */
  async acknowledgeAlert(
    alertId: string,
    userId: string,
    note?: string,
    authorizedDeviceIds?: string[]
  ): Promise<{ alertId: string; status: AlertStatus; acknowledgedAt: Date }> {
    const alert = await this.prisma.alert.findUnique({
      where: { id: alertId },
    });

    if (!alert) {
      throw new AlertNotFoundError(`Alert '${alertId}' not found.`);
    }

    if (authorizedDeviceIds !== undefined && alert.deviceId) {
      if (!authorizedDeviceIds.includes(alert.deviceId)) {
        throw new AlertNotFoundError(`Alert '${alertId}' not found or device access revoked.`);
      }
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.alert.update({
        where: { id: alertId },
        data: {
          status: AlertStatus.ACKNOWLEDGED,
        },
      });

      await tx.alertAcknowledgement.create({
        data: {
          alertId,
          acknowledgedByUserId: userId,
          note: note ? note.trim() : null,
          acknowledgedAt: now,
        },
      });

      await tx.auditLog.create({
        data: {
          eventKey: 'alert.acknowledged',
          actorUserId: userId,
          targetType: 'Alert',
          targetId: alertId,
          result: 'SUCCESS',
          previousValues: { status: alert.status },
          newValues: { status: AlertStatus.ACKNOWLEDGED },
          metadata: {
            note: note ? note.trim() : null,
          },
        },
      });
    });

    return {
      alertId,
      status: AlertStatus.ACKNOWLEDGED,
      acknowledgedAt: now,
    };
  }

  /**
   * Creates or returns an existing COMMAND_FAILED alert linked to a device and faucet command.
   * Ensures idempotency: duplicate calls for the same failed command will not create multiple open alerts.
   */
  async createCommandFailureAlert(input: {
    deviceId: string;
    commandId: string;
    reasonCode?: string;
    severity?: AlertSeverity;
    openedAt?: Date;
    metadata?: Record<string, unknown>;
  }): Promise<AlertDto> {
    const isUuid = (val: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

    // Resolve device
    let deviceUuid = input.deviceId;
    let deviceName = input.deviceId;
    const deviceRecord = await this.prisma.device.findFirst({
      where: isUuid(input.deviceId)
        ? { OR: [{ id: input.deviceId }, { deviceId: input.deviceId }] }
        : { deviceId: input.deviceId },
      select: { id: true, deviceId: true, name: true },
    });
    if (deviceRecord) {
      deviceUuid = deviceRecord.id;
      deviceName = deviceRecord.name || deviceRecord.deviceId;
    }

    // Resolve command
    let commandUuid = input.commandId;
    let canonicalCommandId = input.commandId;
    const commandRecord = await this.prisma.faucetCommand.findFirst({
      where: isUuid(input.commandId)
        ? { OR: [{ id: input.commandId }, { commandId: input.commandId }] }
        : { commandId: input.commandId },
      select: { id: true, commandId: true, deviceId: true },
    });
    if (commandRecord) {
      commandUuid = commandRecord.id;
      canonicalCommandId = commandRecord.commandId;
      if (!deviceRecord && commandRecord.deviceId) {
        deviceUuid = commandRecord.deviceId;
      }
    }

    // Idempotency: check if an alert already exists for this faucet command failure
    const existing = await this.prisma.alert.findFirst({
      where: {
        sourceType: 'faucet_command',
        sourceId: commandUuid,
        alertType: AlertType.COMMAND_FAILED,
      },
    });

    if (existing) {
      return this.formatAlertDto(existing);
    }

    const reason = input.reasonCode || 'COMMAND_FAILED';
    const created = await this.prisma.alert.create({
      data: {
        deviceId: deviceUuid,
        alertType: AlertType.COMMAND_FAILED,
        severity: input.severity || AlertSeverity.CRITICAL,
        status: AlertStatus.OPEN,
        sourceType: 'faucet_command',
        sourceId: commandUuid,
        titleKey: 'alerts.commandFailedTitle',
        messageKey: 'alerts.commandFailedMessage',
        messageParams: {
          commandId: canonicalCommandId,
          deviceName,
          reason,
          ...(input.metadata ? { metadata: input.metadata } : {}),
        } as Prisma.InputJsonValue,
        openedAt: input.openedAt || new Date(),
      },
    });

    return this.formatAlertDto(created);
  }

  /**
   * Creates or returns an existing COMMAND_TIMEOUT alert linked to a device and faucet command.
   * Note: Command timeout does NOT claim a known physical state (physical state unconfirmed).
   * Ensures idempotency: duplicate calls for the same command timeout will not create multiple open alerts.
   */
  async createCommandTimeoutAlert(input: {
    deviceId: string;
    commandId: string;
    reasonCode?: string;
    severity?: AlertSeverity;
    openedAt?: Date;
    metadata?: Record<string, unknown>;
  }): Promise<AlertDto> {
    const isUuid = (val: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

    // Resolve device
    let deviceUuid = input.deviceId;
    let deviceName = input.deviceId;
    const deviceRecord = await this.prisma.device.findFirst({
      where: isUuid(input.deviceId)
        ? { OR: [{ id: input.deviceId }, { deviceId: input.deviceId }] }
        : { deviceId: input.deviceId },
      select: { id: true, deviceId: true, name: true },
    });
    if (deviceRecord) {
      deviceUuid = deviceRecord.id;
      deviceName = deviceRecord.name || deviceRecord.deviceId;
    }

    // Resolve command
    let commandUuid = input.commandId;
    let canonicalCommandId = input.commandId;
    const commandRecord = await this.prisma.faucetCommand.findFirst({
      where: isUuid(input.commandId)
        ? { OR: [{ id: input.commandId }, { commandId: input.commandId }] }
        : { commandId: input.commandId },
      select: { id: true, commandId: true, deviceId: true },
    });
    if (commandRecord) {
      commandUuid = commandRecord.id;
      canonicalCommandId = commandRecord.commandId;
      if (!deviceRecord && commandRecord.deviceId) {
        deviceUuid = commandRecord.deviceId;
      }
    }

    // Idempotency: check if an alert already exists for this faucet command timeout
    const existing = await this.prisma.alert.findFirst({
      where: {
        sourceType: 'faucet_command',
        sourceId: commandUuid,
        alertType: AlertType.COMMAND_TIMEOUT,
      },
    });

    if (existing) {
      return this.formatAlertDto(existing);
    }

    const created = await this.prisma.alert.create({
      data: {
        deviceId: deviceUuid,
        alertType: AlertType.COMMAND_TIMEOUT,
        severity: input.severity || AlertSeverity.CRITICAL,
        status: AlertStatus.OPEN,
        sourceType: 'faucet_command',
        sourceId: commandUuid,
        titleKey: 'alerts.commandTimeoutTitle',
        messageKey: 'alerts.commandTimeoutMessage',
        messageParams: {
          commandId: canonicalCommandId,
          deviceName,
          physicalOutcome: 'UNKNOWN',
          ...(input.reasonCode ? { reason: input.reasonCode } : {}),
          ...(input.metadata ? { metadata: input.metadata } : {}),
        } as Prisma.InputJsonValue,
        openedAt: input.openedAt || new Date(),
      },
    });

    return this.formatAlertDto(created);
  }
}
