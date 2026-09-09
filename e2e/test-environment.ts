import { execSync } from 'child_process';
import crypto from 'crypto';
import path from 'path';
import { validateTestDatabaseUrl } from '../packages/database/src/owner-provisioning';

let activeContainerName: string | null = null;
let isCleanedUp = false;

function getAvailablePortSync(): number {
  try {
    const output = execSync(
      'node -e "const s = require(\'net\').createServer(); s.listen(0, () => { console.log(s.address().port); s.close(); });"',
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const port = parseInt(output.trim(), 10);
    if (!isNaN(port) && port > 0) return port;
  } catch {
    // Fallback to random unprivileged port
  }
  return 55000 + Math.floor(Math.random() * 5000);
}

function getExistingTestDbUrl(): string | undefined {
  const explicitUrl = process.env.E2E_DATABASE_URL || process.env.TEST_DATABASE_URL;
  if (explicitUrl) {
    return validateTestDatabaseUrl(explicitUrl);
  }

  const ambientUrl = process.env.DATABASE_URL;
  if (ambientUrl) {
    try {
      return validateTestDatabaseUrl(ambientUrl);
    } catch {
      // Ambient URL targets remote or non-test database; do not use it for test execution
      return undefined;
    }
  }

  return undefined;
}

export function teardownTestDatabase(): void {
  if (isCleanedUp || !activeContainerName) return;
  isCleanedUp = true;
  const name = activeContainerName;
  activeContainerName = null;
  try {
    execSync(`docker stop ${name}`, { stdio: 'pipe' });
    execSync(`docker rm ${name}`, { stdio: 'pipe' });
  } catch {
    // Container might already be stopped or removed
  }
}

/**
 * Idempotently applies Prisma migrations and canonical RBAC / device seed data
 * to the target test database. Strictly enforces test database safety validation
 * and scopes subprocess environments to the target database.
 */
export function initializeTestDatabase(dbUrl: string): void {
  const validated = validateTestDatabaseUrl(dbUrl);
  const schemaPath = path.resolve(__dirname, '../packages/database/prisma/schema.prisma');
  const seedPath = path.resolve(__dirname, '../packages/database/prisma/seed.ts');

  const scopedEnv = {
    ...process.env,
    DATABASE_URL: validated,
    TEST_DATABASE_URL: validated,
    E2E_DATABASE_URL: validated,
  };

  // 1. Run migrations idempotently
  execSync(`npx prisma migrate deploy --schema="${schemaPath}"`, {
    stdio: 'pipe',
    env: scopedEnv,
  });

  // 2. Seed deterministic, idempotent canonical RBAC fixtures & devices
  execSync(`npx tsx "${seedPath}"`, {
    stdio: 'pipe',
    env: scopedEnv,
  });
}

export function ensureTestDatabase(): string | undefined {
  const existing = getExistingTestDbUrl();
  if (existing) {
    console.log('[E2E DB] Using supplied test database:', existing.replace(/:[^:@]+@/, ':***@'));
    try {
      initializeTestDatabase(existing);
      process.env.DATABASE_URL = existing;
      process.env.E2E_DATABASE_URL = existing;
      process.env.TEST_DATABASE_URL = existing;
      return existing;
    } catch (err: any) {
      console.error('[E2E DB] Failed to initialize supplied test database:', err.message);
      throw err;
    }
  }

  // Check if Docker daemon is available and responsive locally
  try {
    execSync('docker info', { stdio: 'pipe', timeout: 5000 });
  } catch {
    console.warn(
      '[E2E DB] Docker daemon is not running or unreachable, and no TEST_DATABASE_URL was provided.\n' +
        '[E2E DB] To execute the 12 end-to-end critical flows, please start Docker Desktop or supply a validated TEST_DATABASE_URL.'
    );
    return undefined;
  }

  const nonce = crypto.randomBytes(4).toString('hex');
  const port = getAvailablePortSync();
  const dbUser = 'test_user_' + nonce;
  const dbPass = 'test_pass_' + crypto.randomBytes(8).toString('hex');
  const dbName = 'kebun_melon_disposable_test_' + nonce;
  const containerName = 'kebun_melon_e2e_pg_' + nonce;
  const testDbUrl = `postgresql://${dbUser}:${dbPass}@127.0.0.1:${port}/${dbName}?schema=public`;

  try {
    execSync(
      `docker run -d --name ${containerName} -e POSTGRES_DB=${dbName} -e POSTGRES_USER=${dbUser} -e POSTGRES_PASSWORD=${dbPass} -p ${port}:5432 postgres:15-alpine`,
      { stdio: 'pipe' }
    );

    activeContainerName = containerName;

    // Register process exit hooks to guarantee container cleanup
    process.once('exit', teardownTestDatabase);
    process.once('SIGINT', () => {
      teardownTestDatabase();
      process.exit(1);
    });
    process.once('SIGTERM', () => {
      teardownTestDatabase();
      process.exit(1);
    });

    // Wait for postgres readiness
    let ready = false;
    for (let i = 0; i < 30; i++) {
      try {
        execSync(`docker exec ${containerName} pg_isready -U ${dbUser}`, { stdio: 'pipe' });
        ready = true;
        break;
      } catch {
        execSync('node -e "setTimeout(() => {}, 200)"');
      }
    }

    if (!ready) {
      throw new Error('Disposable PostgreSQL container failed to become ready in time.');
    }

    initializeTestDatabase(testDbUrl);

    process.env.DATABASE_URL = testDbUrl;
    process.env.E2E_DATABASE_URL = testDbUrl;
    process.env.TEST_DATABASE_URL = testDbUrl;
    return testDbUrl;
  } catch (err: any) {
    console.error('[E2E DB] Failed to provision disposable test database:', err.message);
    teardownTestDatabase();
    return undefined;
  }
}
