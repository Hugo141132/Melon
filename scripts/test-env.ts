import { validateServerEnv } from '../apps/web/lib/env/server';
import { validateClientEnv } from '../apps/web/lib/env/client';
import { validateGatewayEnv } from '../apps/iot-gateway/src/config/env';

console.log('--- Running Permanent Environment Unit Tests ---');
let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(' ✓ PASSED: ' + msg);
    passed++;
  } else {
    console.error(' ✗ FAILED: ' + msg);
    failed++;
  }
}

// 1. Missing flag defaults to false
try {
  const env = validateServerEnv({});
  assert(env.ENABLE_FAUCET_CONTROL === false, 'ENABLE_FAUCET_CONTROL defaults to false');
} catch (e: any) {
  assert(false, 'ENABLE_FAUCET_CONTROL default failed: ' + e.message);
}

// 2. false and 0 parse as false
try {
  const env1 = validateServerEnv({ ENABLE_FAUCET_CONTROL: 'false' });
  const env2 = validateServerEnv({ ENABLE_FAUCET_CONTROL: '0' });
  assert(
    env1.ENABLE_FAUCET_CONTROL === false && env2.ENABLE_FAUCET_CONTROL === false,
    'false and 0 parse as false'
  );
} catch (e: any) {
  assert(false, 'false/0 boolean parsing failed: ' + e.message);
}

// 3. true and 1 parse as true in development
try {
  const env1 = validateServerEnv({ ENABLE_FAUCET_CONTROL: 'true' });
  const env2 = validateServerEnv({ ENABLE_FAUCET_CONTROL: '1' });
  assert(
    env1.ENABLE_FAUCET_CONTROL === true && env2.ENABLE_FAUCET_CONTROL === true,
    'true and 1 parse as true in development'
  );
} catch (e: any) {
  assert(false, 'true/1 boolean parsing failed: ' + e.message);
}

// 4. Invalid boolean values fail
try {
  validateServerEnv({ ENABLE_FAUCET_CONTROL: 'invalid_val' });
  assert(false, 'Invalid boolean should fail validation');
} catch (e: any) {
  assert(e.message.includes('ENABLE_FAUCET_CONTROL'), 'Invalid boolean correctly fails validation');
}

// 5. Production ENABLE_FAUCET_CONTROL=true fails
try {
  validateServerEnv({
    NODE_ENV: 'production',
    APP_ENV: 'production',
    ENABLE_FAUCET_CONTROL: 'true',
  });
  assert(false, 'Production ENABLE_FAUCET_CONTROL=true must fail');
} catch (e: any) {
  assert(
    e.message.includes('ENABLE_FAUCET_CONTROL=true is rejected in production'),
    'Production ENABLE_FAUCET_CONTROL=true correctly rejected'
  );
}

// 6. Error messages do not contain secret values
try {
  const secretValue = 'SECRET_TOKEN_VALUE_99999';
  validateServerEnv({
    NODE_ENV: 'production',
    APP_ENV: 'production',
    ENABLE_FAUCET_CONTROL: 'true',
    MY_SECRET: secretValue,
  });
  assert(false, 'Production error trigger');
} catch (e: any) {
  assert(
    !e.message.includes('SECRET_TOKEN_VALUE_99999'),
    'Error messages do not contain secret values'
  );
}

// 7. Invalid locale values fail
try {
  validateServerEnv({ DEFAULT_LOCALE: 'fr' as any });
  assert(false, 'Invalid locale should fail validation');
} catch (e: any) {
  assert(e.message.includes('DEFAULT_LOCALE'), 'Invalid locale correctly rejected');
}

// 8. Unresolved locale values may be omitted
try {
  const env = validateServerEnv({});
  assert(env.DEFAULT_LOCALE === undefined, 'Unresolved DEFAULT_LOCALE may be omitted');
} catch (e: any) {
  assert(false, 'Omitted locale test failed: ' + e.message);
}

// 9. Client output contains only approved public keys
try {
  const clientEnv = validateClientEnv({
    DATABASE_URL: 'postgres://secret',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  });
  const keys = Object.keys(clientEnv);
  assert(
    keys.every((k) => k.startsWith('NEXT_PUBLIC_')),
    'Client output contains only approved NEXT_PUBLIC_ keys'
  );
} catch (e: any) {
  assert(false, 'Client schema key test failed: ' + e.message);
}

// 10. Gateway development config may omit future MQTT values
try {
  const gEnv = validateGatewayEnv({});
  assert(gEnv.MQTT_BROKER_URL === undefined, 'Gateway dev config may omit future MQTT values');
} catch (e: any) {
  assert(false, 'Gateway dev config test failed: ' + e.message);
}

// 11. Production gateway requires secure broker URL, client ID, username, and password
try {
  validateGatewayEnv({ NODE_ENV: 'production', APP_ENV: 'production' });
  assert(false, 'Production gateway without MQTT credentials must fail');
} catch (e: any) {
  assert(
    e.message.includes('MQTT_BROKER_URL'),
    'Production gateway missing credentials correctly rejected'
  );
}

// 12. Insecure mqtt:// production broker URL fails
try {
  validateGatewayEnv({
    NODE_ENV: 'production',
    APP_ENV: 'production',
    MQTT_BROKER_URL: 'mqtt://insecure.example.com',
    MQTT_GATEWAY_CLIENT_ID: 'g1',
    MQTT_GATEWAY_USERNAME: 'u1',
    MQTT_GATEWAY_PASSWORD: 'p1',
  });
  assert(false, 'Insecure mqtt:// broker URL must fail in production');
} catch (e: any) {
  assert(
    e.message.includes('secure scheme'),
    'Insecure mqtt:// broker URL correctly rejected in production'
  );
}

// 13. Rate limit environment variables default properly
try {
  const sEnv = validateServerEnv({});
  const gEnv = validateGatewayEnv({});
  assert(
    sEnv.RATE_LIMIT_LOGIN_MAX === 5 &&
      sEnv.RATE_LIMIT_REGISTER_MAX === 3 &&
      sEnv.RATE_LIMIT_APPROVAL_MAX === 10 &&
      sEnv.RATE_LIMIT_FAUCET_MAX === 5 &&
      sEnv.RATE_LIMIT_HISTORY_MAX === 30 &&
      sEnv.RATE_LIMIT_WINDOW_MS === 60000 &&
      gEnv.RATE_LIMIT_GATEWAY_MAX === 60 &&
      gEnv.RATE_LIMIT_WINDOW_MS === 60000,
    'Rate limit environment variables default properly'
  );
} catch (e: any) {
  assert(false, 'Rate limit env defaults test failed: ' + e.message);
}

// 14. Custom rate limit environment values parse correctly
try {
  const sEnv = validateServerEnv({
    RATE_LIMIT_LOGIN_MAX: '10',
    RATE_LIMIT_FAUCET_MAX: '2',
    RATE_LIMIT_WINDOW_MS: '30000',
  });
  assert(
    sEnv.RATE_LIMIT_LOGIN_MAX === 10 &&
      sEnv.RATE_LIMIT_FAUCET_MAX === 2 &&
      sEnv.RATE_LIMIT_WINDOW_MS === 30000,
    'Custom rate limit environment values parse correctly'
  );
} catch (e: any) {
  assert(false, 'Custom rate limit env test failed: ' + e.message);
}

// 15. Production gateway requires INTERNAL_SERVICE_TOKEN
try {
  validateGatewayEnv({
    NODE_ENV: 'production',
    APP_ENV: 'production',
    MQTT_BROKER_URL: 'mqtts://secure.example.com',
    MQTT_GATEWAY_CLIENT_ID: 'g1',
    MQTT_GATEWAY_USERNAME: 'u1',
    MQTT_GATEWAY_PASSWORD: 'p1',
  });
  assert(false, 'Production gateway without INTERNAL_SERVICE_TOKEN must fail');
} catch (e: any) {
  assert(
    e.message.includes('INTERNAL_SERVICE_TOKEN is required in production'),
    'Production gateway missing INTERNAL_SERVICE_TOKEN correctly rejected'
  );
}

// 16. Production web requires INTERNAL_GATEWAY_URL and INTERNAL_SERVICE_TOKEN
try {
  validateServerEnv({
    NODE_ENV: 'production',
    APP_ENV: 'production',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    NEXTAUTH_SECRET: 'supersecret_value_at_least_32_chars_long_12345',
  });
  assert(false, 'Production web without internal gateway config must fail');
} catch (e: any) {
  assert(
    e.message.includes('INTERNAL_GATEWAY_URL') || e.message.includes('INTERNAL_SERVICE_TOKEN'),
    'Production web missing internal gateway configuration correctly rejected'
  );
}

console.log('\nSummary: ' + passed + ' passed, ' + failed + ' failed.');
if (failed > 0) process.exit(1);
