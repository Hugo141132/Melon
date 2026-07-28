import { z } from 'zod';

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().optional(),
  AUTH_SECRET: z.string().optional(),
  DEFAULT_LOCALE: z.enum(['en', 'id']).optional(),
  FALLBACK_LOCALE: z.enum(['en', 'id']).optional(),
  REALTIME_TRANSPORT: z.string().optional(),
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

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function validateServerEnv(
  env: Record<string, string | undefined> = process.env
): ServerEnv {
  const isProd = env.NODE_ENV === 'production' || env.APP_ENV === 'production';
  const isFaucetTrue = env.ENABLE_FAUCET_CONTROL === 'true' || env.ENABLE_FAUCET_CONTROL === '1';

  if (isProd && isFaucetTrue) {
    throw new Error(
      'Production enablement error: ENABLE_FAUCET_CONTROL=true is rejected in production until formal written sign-off activation gate is implemented.'
    );
  }

  const result = serverEnvSchema.safeParse(env);
  if (!result.success) {
    const issueMsgs = result.error.issues
      .map((i) => i.path.join('.') + ': ' + i.message)
      .join('; ');
    throw new Error('Environment validation failed: ' + issueMsgs);
  }
  return result.data;
}
