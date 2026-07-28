import { z } from 'zod';

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.enum(['en', 'id']).optional(),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

export function validateClientEnv(
  env: Record<string, string | undefined> = process.env
): ClientEnv {
  const clientVars: Record<string, string | undefined> = {};
  for (const k of Object.keys(env)) {
    if (k.startsWith('NEXT_PUBLIC_')) {
      clientVars[k] = env[k];
    }
  }

  const result = clientEnvSchema.safeParse(clientVars);
  if (!result.success) {
    const issueMsgs = result.error.issues
      .map((i) => i.path.join('.') + ': ' + i.message)
      .join('; ');
    throw new Error('Client environment validation failed: ' + issueMsgs);
  }

  // Double-check no server secret keys exist in the returned object
  const returnedKeys = Object.keys(result.data);
  for (const k of returnedKeys) {
    if (!k.startsWith('NEXT_PUBLIC_')) {
      throw new Error(
        'Security boundary error: Non NEXT_PUBLIC_ key returned in client env object.'
      );
    }
  }

  return result.data;
}
