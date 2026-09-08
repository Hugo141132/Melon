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

export function ensureTestDatabase(): string | undefined {
  const existing = getExistingTestDbUrl();
  if (existing) {
    process.env.E2E_DATABASE_URL = existing;
    return existing;
  }

  // Check if Docker is available locally
  try {
    execSync('docker --version', { stdio: 'pipe' });
  } catch {
    console.warn('[E2E DB] Docker is not available and no TEST_DATABASE_URL was provided.');
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

    const schemaPath = path.resolve(__dirname, '../packages/database/prisma/schema.prisma');
    const seedPath = path.resolve(__dirname, '../packages/database/prisma/seed.ts');

    // Run migrations
    execSync(`npx prisma migrate deploy --schema="${schemaPath}"`, {
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: testDbUrl },
    });

    // Seed RBAC
    execSync(`npx tsx "${seedPath}"`, {
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: testDbUrl },
    });

    process.env.E2E_DATABASE_URL = testDbUrl;
    return testDbUrl;
  } catch (err: any) {
    console.error('[E2E DB] Failed to provision disposable test database:', err.message);
    teardownTestDatabase();
    return undefined;
  }
}
