import { logger } from '../observability/logger';
import { GatewayEnv } from '../config/env';

export interface WebhookPayload {
  event: {
    name: string;
    deviceId?: string;
    data: Record<string, unknown>;
  };
}

export async function publishRealtimeEvent(
  env: GatewayEnv | null,
  eventName: string,
  data: Record<string, unknown>,
  deviceId?: string
): Promise<void> {
  if (!env) {
    logger.warn('Cannot publish realtime event: GatewayEnv not bound');
    return;
  }

  if (!env.WEB_APP_URL) {
    logger.debug('WEB_APP_URL not configured, skipping realtime event publish');
    return;
  }

  if (!env.INTERNAL_SERVICE_TOKEN) {
    logger.warn('INTERNAL_SERVICE_TOKEN not configured, skipping realtime event publish');
    return;
  }

  const url = `${env.WEB_APP_URL.replace(/\/$/, '')}/api/v1/internal/realtime/publish`;

  const payload: WebhookPayload = {
    event: {
      name: eventName,
      deviceId,
      data,
    },
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.INTERNAL_SERVICE_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      logger.warn('Failed to publish realtime event via webhook', {
        status: response.status,
        statusText: response.statusText,
        eventName,
        deviceId,
        response: text,
      });
    }
  } catch (error) {
    logger.error('Error publishing realtime event via webhook', error, {
      eventName,
      deviceId,
    });
  }
}

/**
 * Triggers asynchronous email dispatch for a created alert via the web app internal API.
 * Keeps alert creation completely separated from email dispatch flow.
 */
export async function triggerAlertEmailDispatch(
  env: GatewayEnv | null,
  alertId: string
): Promise<void> {
  if (!env) {
    logger.warn('Cannot trigger alert email dispatch: GatewayEnv not bound');
    return;
  }

  if (!env.WEB_APP_URL) {
    logger.debug('WEB_APP_URL not configured, skipping alert email dispatch');
    return;
  }

  if (!env.INTERNAL_SERVICE_TOKEN) {
    logger.warn('INTERNAL_SERVICE_TOKEN not configured, skipping alert email dispatch');
    return;
  }

  const url = `${env.WEB_APP_URL.replace(/\/$/, '')}/api/v1/internal/alerts/${encodeURIComponent(alertId)}/dispatch-emails`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.INTERNAL_SERVICE_TOKEN}`,
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      logger.warn('Failed to trigger alert email dispatch via webhook', {
        status: response.status,
        statusText: response.statusText,
        alertId,
        response: text,
      });
    } else {
      logger.info('Triggered alert email dispatch via internal webhook', { alertId });
    }
  } catch (error) {
    logger.warn('Network error triggering alert email dispatch webhook', {
      error: error instanceof Error ? error.message : String(error),
      alertId,
    });
  }
}
