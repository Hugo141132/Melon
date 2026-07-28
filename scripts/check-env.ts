import { validateServerEnv } from '../apps/web/lib/env/server';
import { validateClientEnv } from '../apps/web/lib/env/client';
import { validateGatewayEnv } from '../apps/iot-gateway/src/config/env';

const target = process.argv[2] || 'all';

console.log('[env-check] Validating environment target: ' + target);

try {
  if (target === 'all' || target === 'web') {
    validateServerEnv();
    validateClientEnv();
    console.log('[env-check] Web environment validation PASSED.');
  }
  if (target === 'all' || target === 'gateway') {
    validateGatewayEnv();
    console.log('[env-check] Gateway environment validation PASSED.');
  }
} catch (err: any) {
  console.error('[env-check] FAILED: ' + err.message);
  process.exit(1);
}
