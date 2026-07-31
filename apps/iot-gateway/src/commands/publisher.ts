import { GatewayMqttClient } from '../mqtt/client';
import { logger } from '../observability/logger';

export class CommandPublisher {
  /**
   * Scaffold method for publishing faucet commands to MQTT devices.
   * Full implementation will be added in TASK-0804.
   */
  public async publishCommand(
    mqttClient: GatewayMqttClient,
    deviceId: string,
    commandId: string,
    commandPayload: Record<string, unknown>
  ): Promise<{ published: boolean }> {
    if (!mqttClient.isConnected()) {
      logger.warn('Cannot publish command: MQTT client is disconnected', {
        deviceId,
        commandId,
      });
      return { published: false };
    }

    const topic = `agriculture/production/site-01/${deviceId}/command/faucet`;
    const payloadBuffer = Buffer.from(
      JSON.stringify({
        commandId,
        deviceId,
        ...commandPayload,
      })
    );

    // Faucet commands must never be retained (retain = false)
    await mqttClient.publish(topic, payloadBuffer, 1, false);

    logger.info('Scaffold: Faucet command published', {
      deviceId,
      commandId,
      topic,
    });

    return { published: true };
  }
}

export const commandPublisher = new CommandPublisher();
