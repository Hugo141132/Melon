import { PrismaClient } from '@prisma/client';
import { AccountStatus, UserRole, AlertSeverity } from '@kebun-melon/contracts';
import crypto from 'crypto';

export interface AlertRecipient {
  userId: string;
  email: string;
  fullName: string;
  preferredLocale: string;
  emailAlertsEnabled: boolean;
}

export type AlertEmailDispatchStatusType =
  'SENT' | 'FAILED' | 'DISABLED_BY_PREFERENCE' | 'SIMULATED';

export interface RecordDispatchInput {
  alertId: string;
  userId: string;
  deviceId?: string | null;
  recipientEmail: string;
  status: AlertEmailDispatchStatusType;
  resendId?: string | null;
  errorMessage?: string | null;
}

export class AlertNotificationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Resolves authorized recipients for an alert based on RBAC and device access rules.
   * - ACTIVE Owners (global device view access).
   * - ACTIVE Admins with active assignment in UserDeviceAccess (where revokedAt IS NULL).
   * - System-wide alerts (deviceId is null) are resolved strictly to ACTIVE Owners.
   * - All candidate recipients must have emailVerifiedAt !== null.
   */
  async resolveAlertRecipients(alertId: string): Promise<{
    alert: {
      id: string;
      deviceId: string | null;
      deviceName?: string;
      alertType: string;
      severity: AlertSeverity;
      titleKey: string | null;
      messageKey: string | null;
      messageParams: Record<string, any> | null;
      openedAt: Date;
    } | null;
    recipients: AlertRecipient[];
  }> {
    const alert = await this.prisma.alert.findUnique({
      where: { id: alertId },
      include: {
        device: {
          select: {
            id: true,
            deviceId: true,
            name: true,
          },
        },
      },
    });

    if (!alert) {
      return { alert: null, recipients: [] };
    }

    const deviceName = alert.device?.name || alert.device?.deviceId || undefined;

    // 1. Query all active owners with verified emails
    const owners = await this.prisma.user.findMany({
      where: {
        accountStatus: AccountStatus.ACTIVE,
        emailVerifiedAt: { not: null },
        userRoles: {
          some: {
            role: { code: UserRole.OWNER },
            revokedAt: null,
          },
        },
      },
      include: {
        userPreference: true,
      },
    });

    // 2. If alert is linked to a device, query active admins assigned to that device
    let assignedAdmins: typeof owners = [];
    if (alert.deviceId) {
      assignedAdmins = await this.prisma.user.findMany({
        where: {
          accountStatus: AccountStatus.ACTIVE,
          emailVerifiedAt: { not: null },
          userRoles: {
            some: {
              role: { code: UserRole.ADMIN },
              revokedAt: null,
            },
          },
          assignedDeviceAccess: {
            some: {
              deviceId: alert.deviceId,
              revokedAt: null,
            },
          },
        },
        include: {
          userPreference: true,
        },
      });
    }

    // Merge and deduplicate by user ID
    const userMap = new Map<string, (typeof owners)[0]>();
    for (const u of owners) {
      userMap.set(u.id, u);
    }
    for (const u of assignedAdmins) {
      userMap.set(u.id, u);
    }

    const recipients: AlertRecipient[] = Array.from(userMap.values()).map((u) => {
      const pref = u.userPreference as any;
      return {
        userId: u.id,
        email: u.email,
        fullName: u.fullName,
        preferredLocale: pref?.preferredLocale || 'id',
        emailAlertsEnabled: pref?.emailAlertsEnabled !== undefined ? pref.emailAlertsEnabled : true,
      };
    });

    return {
      alert: {
        id: alert.id,
        deviceId: alert.deviceId,
        deviceName,
        alertType: alert.alertType,
        severity: alert.severity as AlertSeverity,
        titleKey: alert.titleKey,
        messageKey: alert.messageKey,
        messageParams: (alert.messageParams as Record<string, any>) || null,
        openedAt: alert.openedAt,
      },
      recipients,
    };
  }

  /**
   * Checks if an alert has already been successfully dispatched to a given user.
   */
  async isAlertAlreadyDispatched(alertId: string, userId: string): Promise<boolean> {
    const existing = await (this.prisma as any).alertEmailDispatch?.findUnique?.({
      where: {
        alertId_userId: {
          alertId,
          userId,
        },
      },
    });

    if (existing) {
      return existing.status === 'SENT';
    }

    // Fallback query if client models were not yet regenerated
    try {
      const rows: any[] = await this.prisma.$queryRaw`
        SELECT status FROM alert_email_dispatches
        WHERE alert_id = ${alertId}::uuid AND user_id = ${userId}::uuid
        LIMIT 1
      `;
      return rows.length > 0 && rows[0].status === 'SENT';
    } catch {
      return false;
    }
  }

  /**
   * Records an alert email dispatch attempt for audit and idempotency tracking.
   */
  async recordDispatch(input: RecordDispatchInput): Promise<void> {
    try {
      if ((this.prisma as any).alertEmailDispatch?.upsert) {
        await (this.prisma as any).alertEmailDispatch.upsert({
          where: {
            alertId_userId: {
              alertId: input.alertId,
              userId: input.userId,
            },
          },
          update: {
            status: input.status,
            resendId: input.resendId || null,
            errorMessage: input.errorMessage || null,
            dispatchedAt: new Date(),
          },
          create: {
            alertId: input.alertId,
            userId: input.userId,
            deviceId: input.deviceId || null,
            recipientEmail: input.recipientEmail,
            status: input.status,
            resendId: input.resendId || null,
            errorMessage: input.errorMessage || null,
          },
        });
        return;
      }
    } catch {
      // Fall through to raw SQL
    }

    // Direct SQL upsert fallback ensuring idempotency
    const id = crypto.randomUUID();
    const now = new Date();
    await this.prisma.$executeRaw`
      INSERT INTO alert_email_dispatches (
        id, alert_id, user_id, device_id, recipient_email, status, resend_id, error_message, dispatched_at, created_at
      ) VALUES (
        ${id}::uuid,
        ${input.alertId}::uuid,
        ${input.userId}::uuid,
        ${input.deviceId ? input.deviceId : null}::uuid,
        ${input.recipientEmail},
        ${input.status}::"AlertEmailDispatchStatus",
        ${input.resendId || null},
        ${input.errorMessage || null},
        ${now},
        ${now}
      )
      ON CONFLICT (alert_id, user_id)
      DO UPDATE SET
        status = EXCLUDED.status,
        resend_id = EXCLUDED.resend_id,
        error_message = EXCLUDED.error_message,
        dispatched_at = EXCLUDED.dispatched_at;
    `;
  }
}
