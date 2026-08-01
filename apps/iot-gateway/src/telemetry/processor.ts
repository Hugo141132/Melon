import { logger } from '../observability/logger';

export interface TelemetryIngestionResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class TelemetryProcessor {
  /**
   * Processing incoming reservoir/water-tank telemetry via MQTT (Path B).
   * Soil and Water Quality telemetry use HTTPS REST API endpoints on web backend (Path A).
   */
  public async processTelemetry(
    deviceId: string,
    telemetryType: 'soil' | 'water' | 'reservoir',
    payload: Record<string, unknown>
  ): Promise<TelemetryIngestionResponse> {
    logger.debug('Gateway telemetry processor received message', {
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
