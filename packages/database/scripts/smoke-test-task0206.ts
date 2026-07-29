import { execSync } from 'child_process';
import crypto from 'crypto';
import net from 'net';
import http from 'http';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/password-service';
import { AccountStatus, UserRole } from '@kebun-melon/contracts';

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

async function makeRequest(
  url: string,
  options: http.RequestOptions = {},
  postData?: any
): Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = data;
        try {
          parsed = JSON.parse(data);
        } catch {}
        resolve({ status: res.statusCode || 0, body: parsed, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function main() {
  const nonce = crypto.randomBytes(6).toString('hex');
  const dbUser = 'test_user_' + nonce;
  const dbPass = 'test_pass_' + crypto.randomBytes(12).toString('hex');
  const dbName = 'test_db_' + nonce;
  const containerName = 'kebun_melon_smoke_task0206_' + nonce;

  const dbPort = await getAvailablePort();
  const webPort = await getAvailablePort();
  const testDbUrl = `postgresql://${dbUser}:${dbPass}@127.0.0.1:${dbPort}/${dbName}`;

  console.log('--- STARTING LIVE HTTP SMOKE TEST FOR TASK-0206 ---');
  console.log(`[INIT] Container: ${containerName} | DB Port: ${dbPort} | Web Port: ${webPort}`);

  let webProcess: any = null;

  try {
    // 1. Start fresh disposable PostgreSQL 15 container
    console.log('[1/7] Starting disposable PostgreSQL container...');
    run(
      `docker run -d --name ${containerName} -e POSTGRES_DB=${dbName} -e POSTGRES_USER=${dbUser} -e POSTGRES_PASSWORD=${dbPass} -p ${dbPort}:5432 postgres:15-alpine`
    );

    // 2. Wait for PostgreSQL readiness
    console.log('[2/7] Waiting for PostgreSQL readiness...');
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
    if (!ready) throw new Error('PostgreSQL container failed to become ready in time.');

    // 3. Apply migrations & seed DB
    console.log('[3/7] Applying Prisma migrations & seed...');
    run(`npx prisma migrate deploy --schema=prisma/schema.prisma`, { DATABASE_URL: testDbUrl });
    run(`npx tsx prisma/seed.ts`, { DATABASE_URL: testDbUrl });

    // Seed test users using Prisma directly in Node
    console.log('[4/7] Direct Prisma seeding test accounts for live HTTP smoke test...');
    const prisma = new PrismaClient({ datasources: { db: { url: testDbUrl } } });
    const hash = await hashPassword('Password123!');
    const ownerRole = await prisma.role.findUnique({ where: { code: UserRole.OWNER } });
    const adminRole = await prisma.role.findUnique({ where: { code: UserRole.ADMIN } });

    // Active Owner
    const owner = await prisma.user.create({
      data: {
        fullName: 'Smoke Owner',
        email: 'owner@example.com',
        passwordHash: hash,
        accountStatus: AccountStatus.ACTIVE,
        userRoles: { create: { roleId: ownerRole!.id } },
      },
    });

    // Active Admin
    const admin = await prisma.user.create({
      data: {
        fullName: 'Smoke Admin',
        email: 'admin@example.com',
        passwordHash: hash,
        accountStatus: AccountStatus.ACTIVE,
        userRoles: { create: { roleId: adminRole!.id } },
      },
    });

    // Pending Admin
    const pending = await prisma.user.create({
      data: {
        fullName: 'Pending Applicant Alpha',
        email: 'pending.alpha@example.com',
        passwordHash: hash,
        accountStatus: AccountStatus.PENDING_APPROVAL,
        userRoles: { create: { roleId: adminRole!.id } },
      },
    });

    // Inactive / Suspended Owner
    const suspendedOwner = await prisma.user.create({
      data: {
        fullName: 'Suspended Owner',
        email: 'suspended.owner@example.com',
        passwordHash: hash,
        accountStatus: AccountStatus.SUSPENDED,
        userRoles: { create: { roleId: ownerRole!.id } },
      },
    });

    await prisma.$disconnect();
    console.log('[4/7] Seeding complete:', { ownerId: owner.id, adminId: admin.id, pendingId: pending.id, suspendedOwnerId: suspendedOwner.id });

    // 5. Start web server in background pointing to testDbUrl
    console.log('[5/7] Starting local Next.js web server...');
    const { spawn } = await import('child_process');
    webProcess = spawn('npx', ['next', 'start', '-p', webPort.toString()], {
      cwd: process.cwd() + '/../../apps/web',
      env: {
        ...process.env,
        DATABASE_URL: testDbUrl,
        NODE_ENV: 'production',
      },
      shell: true,
      stdio: 'pipe',
    });

    // Wait for HTTP server readiness
    const baseUrl = `http://127.0.0.1:${webPort}`;
    let serverReady = false;
    for (let i = 0; i < 40; i++) {
      try {
        await makeRequest(`${baseUrl}/api/v1/auth/session`);
        serverReady = true;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    if (!serverReady) throw new Error('Local Next.js web server failed to start in time.');
    console.log(`[5/7] Web server ready at ${baseUrl}`);

    // 6. Execute Live HTTP Smoke Checks
    console.log('[6/7] Running live HTTP assertions...');

    // Test A: Unauthenticated request -> 401
    const resUnauth = await makeRequest(`${baseUrl}/api/v1/approvals/pending`);
    console.log('--> Check A (Unauthenticated list):', resUnauth.status, resUnauth.body.error?.code);
    if (resUnauth.status !== 401 || resUnauth.body.error?.code !== 'UNAUTHENTICATED') {
      throw new Error(`Check A failed: expected 401 UNAUTHENTICATED, got ${resUnauth.status}`);
    }

    // Login as Admin to get cookie
    const loginAdminRes = await makeRequest(
      `${baseUrl}/api/v1/auth/login`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      { email: 'admin@example.com', password: 'Password123!' }
    );
    const adminCookie = loginAdminRes.headers['set-cookie']?.[0]?.split(';')[0];
    if (!adminCookie) throw new Error('Failed to obtain Admin session cookie');

    // Test B: Active ADMIN request -> 403
    const resAdminList = await makeRequest(`${baseUrl}/api/v1/approvals/pending`, {
      headers: { Cookie: adminCookie },
    });
    console.log('--> Check B (Active ADMIN list):', resAdminList.status, resAdminList.body.error?.code);
    if (resAdminList.status !== 403 || resAdminList.body.error?.code !== 'FORBIDDEN') {
      throw new Error(`Check B failed: expected 403 FORBIDDEN, got ${resAdminList.status}`);
    }

    // Login as OWNER to get cookie
    const loginOwnerRes = await makeRequest(
      `${baseUrl}/api/v1/auth/login`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      { email: 'owner@example.com', password: 'Password123!' }
    );
    const ownerCookie = loginOwnerRes.headers['set-cookie']?.[0]?.split(';')[0];
    if (!ownerCookie) throw new Error('Failed to obtain OWNER session cookie');

    // Test C: Active OWNER list -> 200 with bounded pagination & no sensitive fields
    const resOwnerList = await makeRequest(`${baseUrl}/api/v1/approvals/pending?page=1&pageSize=10`, {
      headers: { Cookie: ownerCookie },
    });
    console.log('--> Check C (Active OWNER list):', resOwnerList.status, 'Items:', resOwnerList.body.data?.length);
    if (resOwnerList.status !== 200 || !resOwnerList.body.success || resOwnerList.body.data.length < 1) {
      throw new Error(`Check C failed: expected 200 OK with items, got ${resOwnerList.status}`);
    }
    const sampleItem = resOwnerList.body.data[0];
    if (sampleItem.passwordHash || sampleItem.sessionTokenHash) {
      throw new Error('Check C secrecy failure: sensitive password or session token exposed!');
    }
    const pendingUserId = sampleItem.userId;

    // Test D: Active OWNER detail -> 200
    const resOwnerDetail = await makeRequest(`${baseUrl}/api/v1/approvals/${pendingUserId}`, {
      headers: { Cookie: ownerCookie },
    });
    console.log('--> Check D (Active OWNER detail):', resOwnerDetail.status, resOwnerDetail.body.data?.fullName);
    if (resOwnerDetail.status !== 200 || resOwnerDetail.body.data?.userId !== pendingUserId) {
      throw new Error(`Check D failed: expected 200 OK with detail data`);
    }

    // Test E: Missing or Non-Pending User -> 404
    const resMissing = await makeRequest(`${baseUrl}/api/v1/approvals/00000000-0000-0000-0000-000000000000`, {
      headers: { Cookie: ownerCookie },
    });
    console.log('--> Check E (Missing user detail):', resMissing.status, resMissing.body.error?.code);
    if (resMissing.status !== 404 || resMissing.body.error?.code !== 'USER_NOT_FOUND') {
      throw new Error(`Check E failed: expected 404 USER_NOT_FOUND, got ${resMissing.status}`);
    }

    console.log('[7/7] ALL LIVE HTTP SMOKE TEST CHECKS PASSED SUCCESSFULLY!');
  } finally {
    // Guaranteed Cleanup of web server process & docker container
    console.log('[CLEANUP] Stopping web server and removing Docker container...');
    if (webProcess) {
      try {
        webProcess.kill('SIGTERM');
        console.log('[CLEANUP] Local web server process terminated.');
      } catch {}
    }
    try {
      execSync(`docker stop ${containerName}`, { stdio: 'pipe' });
      execSync(`docker rm ${containerName}`, { stdio: 'pipe' });
      console.log(`[CLEANUP] Disposable container '${containerName}' removed successfully.`);
    } catch (err: any) {
      console.warn('[CLEANUP WARNING]:', err.message);
    }
  }
}

main().catch((err) => {
  console.error('LIVE SMOKE TEST FAILED:', err);
  process.exit(1);
});
