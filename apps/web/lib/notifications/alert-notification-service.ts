import { prisma, AlertNotificationRepository } from '@kebun-melon/database';
import { Logger } from '@/lib/observability/logger';
import { sendAlertNotificationEmail } from '@/lib/email/resend';

const logger = new Logger({ serviceName: 'web:alert-notifications' });

import idMessages from '@/messages/id.json';
import enMessages from '@/messages/en.json';

const dictionaries: Record<'id' | 'en', Record<string, any>> = {
  id: idMessages,
  en: enMessages,
};

function resolveKeyFromDictionary(dict: Record<string, any>, fullKey: string): string | null {
  if (!dict || !fullKey) return null;
  const parts = fullKey.split('.');
  let current: any = dict;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return null;
    }
  }
  return typeof current === 'string' ? current : null;
}

function interpolateTemplate(template: string, params?: Record<string, any> | null): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return params[key] !== undefined ? String(params[key]) : `{${key}}`;
  });
}

export function formatAlertContent(
  titleKey: string | null,
  messageKey: string | null,
  messageParams: Record<string, any> | null,
  locale: string
): { title: string; message: string } {
  const isId = (locale || 'id').toLowerCase().startsWith('id');
  const langKey: 'id' | 'en' = isId ? 'id' : 'en';
  const dict = dictionaries[langKey];

  let rawTitle: string | null = null;
  if (titleKey) {
    rawTitle = resolveKeyFromDictionary(dict, titleKey);
    if (!rawTitle && !titleKey.includes('.')) {
      rawTitle = resolveKeyFromDictionary(dict, `alerts.${titleKey}`);
    }
  }
  if (!rawTitle) {
    rawTitle = titleKey || (isId ? 'Notifikasi Peringatan' : 'Operational Alert');
  }
  const title = interpolateTemplate(rawTitle, messageParams);

  let rawMsg: string | null = null;
  if (messageKey) {
    rawMsg = resolveKeyFromDictionary(dict, messageKey);
    if (!rawMsg && !messageKey.includes('.')) {
      rawMsg = resolveKeyFromDictionary(dict, `alerts.${messageKey}`);
    }
  }
  if (!rawMsg) {
    rawMsg =
      messageKey ||
      (isId
        ? 'Sistem pemantauan telah mendeteksi peringatan operasional pada perangkat ini.'
        : 'An operational alert has been triggered for this device.');
  }
  const message = interpolateTemplate(rawMsg, messageParams);

  return { title, message };
}

export interface DispatchAlertEmailsResult {
  success: boolean;
  alertId: string;
  totalEligible: number;
  sent: number;
  skipped: number;
  failed: number;
  error?: string;
}

/**
 * Dispatches alert notification emails to all authorized users based on RBAC and device access.
 * Runs independently from alert creation and records all dispatches for idempotency.
 */
export async function dispatchAlertEmails(
  alertId: string,
  options?: { requestId?: string }
): Promise<DispatchAlertEmailsResult> {
  const reqLogger = logger.child({
    alertId,
    requestId: options?.requestId,
  });

  try {
    const repo = new AlertNotificationRepository(prisma);
    const { alert, recipients } = await repo.resolveAlertRecipients(alertId);

    if (!alert) {
      reqLogger.warn(`Alert '${alertId}' not found for email dispatch.`);
      return {
        success: false,
        alertId,
        totalEligible: 0,
        sent: 0,
        skipped: 0,
        failed: 0,
        error: 'ALERT_NOT_FOUND',
      };
    }

    reqLogger.info(`Resolved ${recipients.length} eligible recipients for alert '${alertId}'.`);

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const recipient of recipients) {
      // 1. Check user preference
      if (!recipient.emailAlertsEnabled) {
        reqLogger.info(
          `Skipping user ${recipient.userId} (${recipient.email}): email alerts disabled by preference.`
        );
        await repo.recordDispatch({
          alertId: alert.id,
          userId: recipient.userId,
          deviceId: alert.deviceId,
          recipientEmail: recipient.email,
          status: 'DISABLED_BY_PREFERENCE',
        });
        skipped++;
        continue;
      }

      // 2. Check idempotency (already dispatched successfully)
      const alreadySent = await repo.isAlertAlreadyDispatched(alert.id, recipient.userId);
      if (alreadySent) {
        reqLogger.info(
          `Skipping user ${recipient.userId} (${recipient.email}): alert already dispatched.`
        );
        skipped++;
        continue;
      }

      // 3. Format localized email content
      const { title, message } = formatAlertContent(
        alert.titleKey,
        alert.messageKey,
        {
          ...(alert.messageParams || {}),
          deviceName: alert.deviceName || 'Device',
        },
        recipient.preferredLocale
      );

      // 4. Send email via Resend
      const result = await sendAlertNotificationEmail({
        toEmail: recipient.email,
        recipientName: recipient.fullName,
        alertType: alert.alertType,
        severity: alert.severity,
        title,
        message,
        deviceName: alert.deviceName,
        openedAt: alert.openedAt,
        locale: recipient.preferredLocale,
        requestId: options?.requestId,
      });

      // 5. Record dispatch status
      if (result.success) {
        await repo.recordDispatch({
          alertId: alert.id,
          userId: recipient.userId,
          deviceId: alert.deviceId,
          recipientEmail: recipient.email,
          status: result.simulated ? 'SIMULATED' : 'SENT',
          resendId: result.id,
        });
        sent++;
      } else {
        await repo.recordDispatch({
          alertId: alert.id,
          userId: recipient.userId,
          deviceId: alert.deviceId,
          recipientEmail: recipient.email,
          status: 'FAILED',
          errorMessage: result.error,
        });
        failed++;
      }
    }

    reqLogger.info(
      `Alert '${alertId}' email dispatch completed: sent=${sent}, skipped=${skipped}, failed=${failed}.`
    );

    return {
      success: true,
      alertId,
      totalEligible: recipients.length,
      sent,
      skipped,
      failed,
    };
  } catch (err: any) {
    reqLogger.error(`Unexpected error during alert email dispatch: ${err?.message || err}`);
    return {
      success: false,
      alertId,
      totalEligible: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      error: err?.message || 'INTERNAL_ERROR',
    };
  }
}
