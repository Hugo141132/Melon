import { z } from 'zod';

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DATABASE_URL: z.string().optional(),
  AUTH_SECRET: z.string().optional(),
  DEFAULT_LOCALE: z.enum(['en', 'id']).optional(),
  FALLBACK_LOCALE: z.enum(['en', 'id']).optional(),
  REALTIME_TRANSPORT: z.string().optional(),
  INTERNAL_GATEWAY_URL: z.string().url().optional(),
  INTERNAL_SERVICE_TOKEN: z.string().min(16).optional(),
  INTERNAL_GATEWAY_TIMEOUT_MS: z
    .preprocess((val) => (val ? parseInt(String(val), 10) : 2000), z.number().int().min(100))
    .default(2000),
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
  RATE_LIMIT_LOGIN_MAX: z
    .preprocess((val) => (val ? parseInt(String(val), 10) : 5), z.number().int().min(1))
    .default(5),
  RATE_LIMIT_REGISTER_MAX: z
    .preprocess((val) => (val ? parseInt(String(val), 10) : 3), z.number().int().min(1))
    .default(3),
  RATE_LIMIT_APPROVAL_MAX: z
    .preprocess((val) => (val ? parseInt(String(val), 10) : 10), z.number().int().min(1))
    .default(10),
  RATE_LIMIT_FAUCET_MAX: z
    .preprocess((val) => (val ? parseInt(String(val), 10) : 5), z.number().int().min(1))
    .default(5),
  RATE_LIMIT_HISTORY_MAX: z
    .preprocess((val) => (val ? parseInt(String(val), 10) : 30), z.number().int().min(1))
    .default(30),
  RATE_LIMIT_WINDOW_MS: z
    .preprocess((val) => (val ? parseInt(String(val), 10) : 60000), z.number().int().min(1000))
    .default(60000),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function validateServerEnv(
  env: Record<string, string | undefined> = process.env
): ServerEnv {
  const isStrictProd =
    env.APP_ENV === 'production' || (env.NODE_ENV === 'production' && env.APP_ENV !== 'staging');
  const isTest =
    env.NODE_ENV === 'test' || env.APP_ENV === 'test' || process.env.NODE_ENV === 'test';
  const isFaucetTrue = env.ENABLE_FAUCET_CONTROL === 'true' || env.ENABLE_FAUCET_CONTROL === '1';

  if (isStrictProd && isFaucetTrue) {
    throw new Error(
      'Production enablement error: ENABLE_FAUCET_CONTROL=true is rejected in production until formal written sign-off activation gate is implemented.'
    );
  }

  if (isStrictProd) {
    if (!env.INTERNAL_GATEWAY_URL) {
      throw new Error(
        'Production gateway requirement failed: INTERNAL_GATEWAY_URL is required in production.'
      );
    }
    if (
      env.INTERNAL_GATEWAY_URL.includes('localhost') ||
      env.INTERNAL_GATEWAY_URL.includes('127.0.0.1')
    ) {
      throw new Error(
        'Production gateway requirement failed: INTERNAL_GATEWAY_URL cannot use localhost/127.0.0.1 in production.'
      );
    }
    if (!env.INTERNAL_SERVICE_TOKEN) {
      throw new Error(
        'Production gateway requirement failed: INTERNAL_SERVICE_TOKEN is required in production.'
      );
    }
  }

  const dynamicSchema = serverEnvSchema.extend({
    INTERNAL_GATEWAY_URL: z
      .string()
      .url()
      .optional()
      .default(
        isTest ? 'http://127.0.0.1:3001' : env.INTERNAL_GATEWAY_URL || 'http://127.0.0.1:3001'
      ),
    INTERNAL_GATEWAY_TIMEOUT_MS: z
      .preprocess((val) => (val ? parseInt(String(val), 10) : 2000), z.number().int().min(100))
      .default(2000),
    RATE_LIMIT_LOGIN_MAX: z
      .preprocess(
        (val) => (val ? parseInt(String(val), 10) : isTest ? 1000 : 5),
        z.number().int().min(1)
      )
      .default(isTest ? 1000 : 5),
    RATE_LIMIT_REGISTER_MAX: z
      .preprocess(
        (val) => (val ? parseInt(String(val), 10) : isTest ? 1000 : 3),
        z.number().int().min(1)
      )
      .default(isTest ? 1000 : 3),
    RATE_LIMIT_APPROVAL_MAX: z
      .preprocess(
        (val) => (val ? parseInt(String(val), 10) : isTest ? 1000 : 10),
        z.number().int().min(1)
      )
      .default(isTest ? 1000 : 10),
    RATE_LIMIT_FAUCET_MAX: z
      .preprocess(
        (val) => (val ? parseInt(String(val), 10) : isTest ? 1000 : 5),
        z.number().int().min(1)
      )
      .default(isTest ? 1000 : 5),
    RATE_LIMIT_HISTORY_MAX: z
      .preprocess(
        (val) => (val ? parseInt(String(val), 10) : isTest ? 1000 : 30),
        z.number().int().min(1)
      )
      .default(isTest ? 1000 : 30),
  });

  const result = dynamicSchema.safeParse(env);
  if (!result.success) {
    const issueMsgs = result.error.issues
      .map((i) => i.path.join('.') + ': ' + i.message)
      .join('; ');
    throw new Error('Environment validation failed: ' + issueMsgs);
  }
  return result.data;
}
