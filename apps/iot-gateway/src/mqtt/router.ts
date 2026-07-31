export interface ParsedTopic {
  environment: string;
  siteId: string;
  deviceId: string;
  category: 'telemetry' | 'status' | 'heartbeat' | 'command' | 'ack' | 'event';
  subtype?: string;
}

export class MqttTopicRouter {
  /**
   * Topic pattern: agriculture/{environment}/{siteId}/{deviceId}/{category}[/{subtype}]
   */
  public parseTopic(topic: string): ParsedTopic | null {
    const parts = topic.split('/');
    if (parts.length < 5 || parts[0] !== 'agriculture') {
      return null;
    }

    const [, environment, siteId, deviceId, category, subtype] = parts;

    const validCategories = ['telemetry', 'status', 'heartbeat', 'command', 'ack', 'event'];
    if (!validCategories.includes(category)) {
      return null;
    }

    return {
      environment,
      siteId,
      deviceId,
      category: category as ParsedTopic['category'],
      subtype,
    };
  }

  public matchesDevice(topic: string, expectedDeviceId: string): boolean {
    const parsed = this.parseTopic(topic);
    return parsed !== null && parsed.deviceId === expectedDeviceId;
  }
}

export const mqttTopicRouter = new MqttTopicRouter();
