import { execSync } from 'child_process';
import crypto from 'crypto';
import net from 'net';

/**
 * Finds an available random TCP port on localhost to avoid port collisions during concurrent test runs.
 */
async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close(() => resolve(port));
    });
  });
}

function run(cmd: string, env: Record<string, string> = {}) {
  execSync(cmd, {
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
}

async function main() {
  const nonce = crypto.randomBytes(6).toString('hex');
  const dbUser = 'test_user_' + nonce;
  const dbPass = 'test_pass_' + crypto.randomBytes(12).toString('hex');
  const dbName = 'test_db_' + nonce;
  const containerName = 'kebun_melon_test_pg_' + nonce;

  const port = await getAvailablePort();
  const testDbUrl = `postgresql://${dbUser}:${dbPass}@127.0.0.1:${port}/${dbName}`;

  console.log('--- STARTING REPRODUCIBLE DOCKER INTEGRATION TEST WORKFLOW ---');
  console.log(`[INIT] Nonce: ${nonce} | Port: ${port} | Container: ${containerName}`);

  try {
    // 1. Start fresh disposable PostgreSQL 15 container with process-isolated credentials and port
    console.log('[1/5] Starting disposable PostgreSQL 15 container...');
    run(
      `docker run -d --name ${containerName} -e POSTGRES_DB=${dbName} -e POSTGRES_USER=${dbUser} -e POSTGRES_PASSWORD=${dbPass} -p ${port}:5432 postgres:15-alpine`
    );

    // 2. Wait for PostgreSQL readiness
    console.log('[2/5] Waiting for PostgreSQL readiness...');
    let ready = false;
    for (let i = 0; i < 30; i++) {
      try {
        execSync(`docker exec ${containerName} pg_isready -U ${dbUser}`, { stdio: 'pipe' });
        ready = true;
        break;
      } catch {
        execSync('node -e "setTimeout(() => {}, 500)"');
      }
    }

    if (!ready) {
      throw new Error('PostgreSQL container failed to become ready in time.');
    }

    // 3. Apply migrations using the dynamically constructed database URL
    console.log('[3/5] Applying Prisma migrations...');
    run(`npx prisma migrate deploy --schema=prisma/schema.prisma`, { DATABASE_URL: testDbUrl });

    // 4. Run RBAC seed
    console.log('[4/5] Running RBAC seed...');
    run(`npx tsx prisma/seed.ts`, { DATABASE_URL: testDbUrl });

    // 5. Execute integration tests with process-isolated TEST_DATABASE_URL
    console.log('[5/5] Executing admin registration integration test suite...');
    run(`npx vitest run test/admin-registration.integration.test.ts`, {
      TEST_DATABASE_URL: testDbUrl,
    });

    console.log('--- REPRODUCIBLE DOCKER INTEGRATION TEST SUCCEEDED ---');
  } finally {
    // Always remove the exact container created by this process
    console.log('[CLEANUP] Stopping and removing disposable container...');
    try {
      execSync(`docker stop ${containerName}`, { stdio: 'pipe' });
      execSync(`docker rm ${containerName}`, { stdio: 'pipe' });
      console.log(`[CLEANUP] Container '${containerName}' removed successfully.`);
    } catch (err: any) {
      console.warn('[CLEANUP WARNING] Failed to remove container:', err.message);
    }
  }
}

main().catch((err) => {
  console.error('INTEGRATION WORKFLOW ERROR:', err);
  process.exit(1);
});
