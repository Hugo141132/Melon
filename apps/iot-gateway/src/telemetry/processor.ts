import { logger } from '../observability/logger';

export class TelemetryProcessor {
  /**
   * Scaffold method for processing incoming soil or water telemetry.
   * Business logic and database persistence will be implemented in TASK-0405 / TASK-0406.
   */
  public async processTelemetry(
    deviceId: string,
    telemetryType: 'soil' | 'water' | 'reservoir',
    payload: Record<string, unknown>
  ): Promise<{ success: boolean; messageId?: string }> {
    logger.debug('Scaffold: Telemetry processor received message', {
      deviceId,
      telemetryType,
      payloadKeys: Object.keys(payload),
    });

    return {
      success: true,
    };
  }
}

export const telemetryProcessor = new TelemetryProcessor();
