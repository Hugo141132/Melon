import { logger } from '../observability/logger';

export type DeviceConnectionState = 'ONLINE' | 'OFFLINE' | 'STALE' | 'UNKNOWN';

export class DeviceStatusProcessor {
  /**
   * Scaffold method for processing device heartbeat, online/offline status, and Last Will messages.
   * Full status tracking logic will be implemented in TASK-0407.
   */
  public async processStatusEvent(
    deviceId: string,
    state: DeviceConnectionState,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    logger.debug('Scaffold: Device status processor received status update', {
      deviceId,
      state,
      metadata,
    });
  }
}

export const deviceStatusProcessor = new DeviceStatusProcessor();
