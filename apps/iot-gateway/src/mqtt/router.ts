export type AllowedEnvironment = 'development' | 'staging' | 'production';

export type TopicCategory =
  'telemetry' | 'status' | 'heartbeat' | 'command' | 'ack' | 'event' | 'config';

export interface ParsedTopic {
  environment: AllowedEnvironment;
  siteId: string;
  deviceId: string;
  category: TopicCategory;
  subtype?: string;
}

export interface TopicValidationResult {
  valid: boolean;
  parsed?: ParsedTopic;
  error?: string;
}

const ALLOWED_ENVIRONMENTS: ReadonlySet<string> = new Set(['development', 'staging', 'production']);

const VALID_SLUG_REGEX = /^[a-zA-Z0-9_-]+$/;

// Category to allowed subtypes mapping
// null indicates that NO subtype is allowed (topic length must be exactly 5)
// Set of strings indicates required subtypes (topic length must be exactly 6)
const CATEGORY_SUBTYPE_MAP: Record<TopicCategory, ReadonlySet<string> | null> = {
  telemetry: new Set(['soil', 'water']),
  status: null,
  heartbeat: null,
  command: new Set(['faucet']),
  ack: new Set(['faucet', 'config']),
  event: new Set(['faucet']),
  config: null,
};

export class MqttTopicRouter {
  /**
   * Parses an MQTT topic into its component parts.
   * Pattern: agriculture/{environment}/{siteId}/{deviceId}/{category}[/{subtype}]
   *
   * @param topic Raw topic string
   * @param expectedEnv Optional environment isolation check (e.g. APP_ENV)
   */
  public parseTopic(topic: string, expectedEnv?: string): ParsedTopic | null {
    const result = this.validateTopic(topic, expectedEnv);
    return result.valid ? result.parsed! : null;
  }

  /**
   * Full topic validation returning detailed result with error reasoning.
   */
  public validateTopic(topic: string, expectedEnv?: string): TopicValidationResult {
    if (!topic || typeof topic !== 'string') {
      return { valid: false, error: 'Topic must be a non-empty string' };
    }

    if (topic.includes('+') || topic.includes('#')) {
      return { valid: false, error: 'Wildcards (+ or #) are not allowed in message topics' };
    }

    const parts = topic.split('/');
    if (parts[0] !== 'agriculture') {
      return { valid: false, error: 'Root topic segment must be "agriculture"' };
    }

    if (parts.length < 5 || parts.length > 6) {
      return { valid: false, error: 'Topic must have 5 or 6 segments' };
    }

    const [, environment, siteId, deviceId, categoryStr, subtype] = parts;

    if (!ALLOWED_ENVIRONMENTS.has(environment)) {
      return {
        valid: false,
        error: `Invalid environment "${environment}". Must be one of: development, staging, production`,
      };
    }

    if (expectedEnv && environment !== expectedEnv) {
      return {
        valid: false,
        error: `Environment mismatch: topic env "${environment}" does not match configured env "${expectedEnv}"`,
      };
    }

    if (!VALID_SLUG_REGEX.test(siteId)) {
      return { valid: false, error: `Invalid siteId "${siteId}"` };
    }

    if (!VALID_SLUG_REGEX.test(deviceId)) {
      return { valid: false, error: `Invalid deviceId "${deviceId}"` };
    }

    if (!(categoryStr in CATEGORY_SUBTYPE_MAP)) {
      return { valid: false, error: `Invalid topic category "${categoryStr}"` };
    }

    const category = categoryStr as TopicCategory;
    const allowedSubtypes = CATEGORY_SUBTYPE_MAP[category];

    if (allowedSubtypes === null) {
      if (subtype !== undefined || parts.length !== 5) {
        return { valid: false, error: `Category "${category}" does not support sub-types` };
      }
    } else {
      if (!subtype || parts.length !== 6) {
        return { valid: false, error: `Category "${category}" requires a valid sub-type` };
      }
      if (!allowedSubtypes.has(subtype)) {
        return {
          valid: false,
          error: `Invalid sub-type "${subtype}" for category "${category}". Allowed: ${Array.from(
            allowedSubtypes
          ).join(', ')}`,
        };
      }
    }

    return {
      valid: true,
      parsed: {
        environment: environment as AllowedEnvironment,
        siteId,
        deviceId,
        category,
        subtype,
      },
    };
  }

  /**
   * Checks if topic parsed deviceId matches expected deviceId.
   */
  public matchesDevice(topic: string, expectedDeviceId: string, expectedEnv?: string): boolean {
    const parsed = this.parseTopic(topic, expectedEnv);
    return parsed !== null && parsed.deviceId === expectedDeviceId;
  }

  /**
   * Validates that topic device ID matches payload device ID and environment matches expectedEnv.
   */
  public isTopicPayloadMatch(
    topic: string,
    payloadDeviceId: string,
    expectedEnv?: string
  ): boolean {
    if (!payloadDeviceId || typeof payloadDeviceId !== 'string') {
      return false;
    }
    const parsed = this.parseTopic(topic, expectedEnv);
    if (!parsed) return false;
    return parsed.deviceId === payloadDeviceId.trim();
  }

  /**
   * Checks if topic environment matches expected environment.
   */
  public matchesEnvironment(topic: string, expectedEnv: string): boolean {
    const parsed = this.parseTopic(topic);
    return parsed !== null && parsed.environment === expectedEnv;
  }

  /**
   * Generates wildcard subscription pattern for broker subscriptions.
   * e.g. agriculture/development/+/+/# or agriculture/development/site-01/device-01/#
   */
  public getSubscriptionPattern(
    environment: AllowedEnvironment | string,
    siteId?: string,
    deviceId?: string
  ): string {
    const env = environment || '+';
    const site = siteId || '+';
    const device = deviceId || '+';
    return `agriculture/${env}/${site}/${device}/#`;
  }

  /**
   * Generates subscription pattern targeting specific category/subtype.
   */
  public getCategorySubscriptionPattern(
    environment: AllowedEnvironment | string,
    category: TopicCategory,
    subtype?: string
  ): string {
    const env = environment || '+';
    if (subtype) {
      return `agriculture/${env}/+/+/${category}/${subtype}`;
    }
    return `agriculture/${env}/+/+/${category}`;
  }

  /**
   * Canonical helper to construct valid topic strings. Throws Error if result is invalid.
   */
  public buildTopic(
    environment: AllowedEnvironment,
    siteId: string,
    deviceId: string,
    category: TopicCategory,
    subtype?: string
  ): string {
    const topic = subtype
      ? `agriculture/${environment}/${siteId}/${deviceId}/${category}/${subtype}`
      : `agriculture/${environment}/${siteId}/${deviceId}/${category}`;

    const validation = this.validateTopic(topic);
    if (!validation.valid) {
      throw new Error(`Failed to build valid topic: ${validation.error}`);
    }

    return topic;
  }
}

export const mqttTopicRouter = new MqttTopicRouter();
