import { PrismaClient, Prisma } from '@prisma/client';
import {
  AlertDto,
  AlertQueryInput,
  CreateAlertInput,
  AlertSeverity,
  AlertStatus,
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
}
