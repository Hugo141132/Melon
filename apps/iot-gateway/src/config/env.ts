import { z } from 'zod';

export const gatewayEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().optional(),
  MQTT_BROKER_URL: z.string().optional(),
  MQTT_GATEWAY_CLIENT_ID: z.string().optional(),
  MQTT_GATEWAY_USERNAME: z.string().optional(),
  MQTT_GATEWAY_PASSWORD: z.string().optional(),
  MQTT_CA_CERT_PATH: z.string().optional(),
  MQTT_CLIENT_CERT_PATH: z.string().optional(),
  MQTT_CLIENT_KEY_PATH: z.string().optional(),
  HOST: z.string().default('0.0.0.0'),
  PORT: z
    .preprocess(
      (val) => (val ? parseInt(String(val), 10) : 3001),
      z.number().int().min(1).max(65535)
    )
    .default(3001),
  ENABLE_FAUCET_CONTROL: z
    .preprocess(
      (val) => {
        if (val === undefined || val === null || val === '') return false;
        if (val === 'true' || val === '1') return true;
        if (val === 'false' || val === '0') return false;
        return val;
      },
      z.boolean({ invalid_type_error: 'ENABLE_FAUCET_CONTROL must be boolean (true/false)' })
    )
    .default(false),
});

export type GatewayEnv = z.infer<typeof gatewayEnvSchema>;

export function validateGatewayEnv(
  env: Record<string, string | undefined> = process.env
): GatewayEnv {
  const isProd = env.NODE_ENV === 'production' || env.APP_ENV === 'production';
  const isFaucetTrue = env.ENABLE_FAUCET_CONTROL === 'true' || env.ENABLE_FAUCET_CONTROL === '1';

  if (isProd) {
    if (
      !env.MQTT_BROKER_URL ||
      !env.MQTT_GATEWAY_CLIENT_ID ||
      !env.MQTT_GATEWAY_USERNAME ||
      !env.MQTT_GATEWAY_PASSWORD
    ) {
      throw new Error(
        'Production gateway requirement failed: MQTT_BROKER_URL, MQTT_GATEWAY_CLIENT_ID, MQTT_GATEWAY_USERNAME, and MQTT_GATEWAY_PASSWORD are required in production.'
      );
    }
    if (
      !env.MQTT_BROKER_URL.startsWith('mqtts://') &&
      !env.MQTT_BROKER_URL.startsWith('ssl://') &&
      !env.MQTT_BROKER_URL.startsWith('wss://')
    ) {
      throw new Error(
        'Production gateway requirement failed: MQTT_BROKER_URL must use a secure scheme (mqtts://, ssl://, or wss://).'
      );
    }
    if (isFaucetTrue) {
      throw new Error(
        'Production enablement error: ENABLE_FAUCET_CONTROL=true is rejected in production until formal written sign-off activation gate is implemented.'
      );
    }
  }

  const result = gatewayEnvSchema.safeParse(env);
  if (!result.success) {
    const issueMsgs = result.error.issues
      .map((i) => i.path.join('.') + ': ' + i.message)
      .join('; ');
    throw new Error('Gateway environment validation failed: ' + issueMsgs);
  }
  return result.data;
}

export function redactString(val: string): string {
  let result = val;
  // Mask DB connection string passwords: postgresql://user:pass@host -> postgresql://user:***@host
  result = result.replace(/(:\/\/[^:@]+:)(?:[^:@/]+)(@)/g, '$1***$2');
  // Mask inline password/secret values: password secretpass -> password=[REDACTED]
  result = result.replace(/(password|pass|secret|token|key)[:=\s]+([^\s;,]+)/gi, '$1=[REDACTED]');
  return result;
}

export function redactSecrets<T extends Record<string, any>>(obj: T): T {
  const sensitiveKeys = [
    'password',
    'pass',
    'secret',
    'token',
    'key',
    'mqtt_gateway_password',
    'database_url',
  ];

  const redacted = { ...obj };
  for (const [k, v] of Object.entries(redacted)) {
    if (typeof v === 'string') {
      const lowerKey = k.toLowerCase();
      if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
        if (lowerKey.includes('database_url') || lowerKey.includes('url')) {
          redacted[k as keyof T] = redactString(v) as unknown as T[keyof T];
        } else {
          redacted[k as keyof T] = '[REDACTED]' as unknown as T[keyof T];
        }
      } else {
        redacted[k as keyof T] = redactString(v) as unknown as T[keyof T];
      }
    }
  }
  return redacted;
}
