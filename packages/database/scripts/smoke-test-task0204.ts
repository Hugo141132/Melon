import { execSync } from 'child_process';
import crypto from 'crypto';
import http from 'http';
import net from 'net';

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
  const dbUser = 'smoke_user_' + nonce;
  const dbPass = 'smoke_pass_' + crypto.randomBytes(12).toString('hex');
  const dbName = 'smoke_db_' + nonce;
  const containerName = 'kebun_melon_smoke_pg_' + nonce;

  const dbPort = await getAvailablePort();
  const webPort = await getAvailablePort();

  const testDbUrl = `postgresql://${dbUser}:${dbPass}@127.0.0.1:${dbPort}/${dbName}`;
  process.env.DATABASE_URL = testDbUrl;

  console.log('--- STARTING LIVE HTTP SMOKE TEST FOR TASK-0204 ---');
  console.log(`[INIT] Nonce: ${nonce} | DB Port: ${dbPort} | Web Port: ${webPort}`);

  let httpServer: http.Server | null = null;
  let prisma: any = null;

  try {
    // 1. Start fresh disposable PostgreSQL container
    console.log('[1/6] Starting disposable PostgreSQL 15 container...');
    run(
      `docker run -d --name ${containerName} -e POSTGRES_DB=${dbName} -e POSTGRES_USER=${dbUser} -e POSTGRES_PASSWORD=${dbPass} -p ${dbPort}:5432 postgres:15-alpine`
    );

    // 2. Wait for PostgreSQL readiness
    console.log('[2/6] Waiting for PostgreSQL readiness...');
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
      throw new Error('PostgreSQL container failed to become ready.');
    }

    // 3. Migrate & seed RBAC & seed test users
    console.log('[3/6] Deploying database schema and seeding test users...');
    run(`npx prisma migrate deploy --schema=prisma/schema.prisma`, { DATABASE_URL: testDbUrl });
    run(`npx tsx prisma/seed.ts`, { DATABASE_URL: testDbUrl });

    // Dynamic import after DATABASE_URL is set in process.env
    const { PrismaClient, AccountStatus, UserRole } = await import('@prisma/client');
    const { hashPassword } = await import('../src/password-service');
    const { hashSessionToken } = await import('../src/session-service');
    const loginModule = await import('../../../apps/web/app/api/v1/auth/login/route');
    const logoutModule = await import('../../../apps/web/app/api/v1/auth/logout/route');
    const sessionModule = await import('../../../apps/web/app/api/v1/auth/session/route');

    const loginPost = loginModule.POST;
    const logoutPost = logoutModule.POST;
    const sessionGet = sessionModule.GET;

    prisma = new PrismaClient({ datasources: { db: { url: testDbUrl } } });
    await prisma.$connect();

    const activePassHash = await hashPassword('ActivePassword123!');
    const activeUser = await prisma.user.create({
      data: {
        fullName: 'Smoke Active Admin',
        email: 'smoke.active@example.com',
        passwordHash: activePassHash,
        accountStatus: AccountStatus.ACTIVE,
      },
    });

    const adminRole = await prisma.role.findUnique({ where: { code: UserRole.ADMIN } });
    if (adminRole) {
      await prisma.userRoleAssignment.create({
        data: { userId: activeUser.id, roleId: adminRole.id },
      });
    }

    const pendingPassHash = await hashPassword('PendingPassword123!');
    await prisma.user.create({
      data: {
        fullName: 'Smoke Pending Admin',
        email: 'smoke.pending@example.com',
        passwordHash: pendingPassHash,
        accountStatus: AccountStatus.PENDING_APPROVAL,
      },
    });

    // 4. Start native HTTP server hosting the App Router route handlers
    console.log(`[4/6] Starting live HTTP server hosting API route handlers on port ${webPort}...`);
    httpServer = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url!, `http://${req.headers.host || '127.0.0.1'}`);
        const method = req.method!;

        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        const bodyBuffer = Buffer.concat(chunks);

        const webReq = new Request(url.toString(), {
          method,
          headers: req.headers as any,
          body: ['POST', 'PUT', 'PATCH'].includes(method) ? bodyBuffer : undefined,
        });

        let webRes: Response;
        if (url.pathname === '/api/v1/auth/login' && method === 'POST') {
          webRes = await loginPost(webReq);
        } else if (url.pathname === '/api/v1/auth/logout' && method === 'POST') {
          webRes = await logoutPost(webReq);
        } else if (url.pathname === '/api/v1/auth/session' && method === 'GET') {
          webRes = await sessionGet(webReq);
        } else {
          webRes = new Response('Not Found', { status: 404 });
        }

        res.statusCode = webRes.status;

        webRes.headers.forEach((val, key) => {
          if (key.toLowerCase() === 'set-cookie') {
            const existing = res.getHeader('set-cookie');
            if (!existing) {
              res.setHeader('set-cookie', [val]);
            } else if (Array.isArray(existing)) {
              res.setHeader('set-cookie', [...existing, val]);
            } else {
              res.setHeader('set-cookie', [existing as string, val]);
            }
          } else {
            res.setHeader(key, val);
          }
        });

        const arrayBuffer = await webRes.arrayBuffer();
        res.end(Buffer.from(arrayBuffer));
      } catch (err: any) {
        res.statusCode = 500;
        res.end(err.stack || err.message);
      }
    });

    await new Promise<void>((resolve) => httpServer!.listen(webPort, '127.0.0.1', resolve));

    console.log('[5/6] Executing live HTTP requests over network socket...');

    // Test A: Valid ACTIVE login
    console.log(' -> Test A: Valid ACTIVE login (POST /api/v1/auth/login)');
    const loginRes = await fetch(`http://127.0.0.1:${webPort}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'smoke.active@example.com',
        password: 'ActivePassword123!',
      }),
    });

    if (loginRes.status !== 200) {
      throw new Error(`Login failed with HTTP status ${loginRes.status}`);
    }

    const loginJson = await loginRes.json();
    if (!loginJson.success || loginJson.data.user.email !== 'smoke.active@example.com') {
      throw new Error(`Unexpected login JSON response: ${JSON.stringify(loginJson)}`);
    }

    const setCookieHeader = loginRes.headers.get('set-cookie');
    if (!setCookieHeader || !setCookieHeader.includes('session_token=')) {
      throw new Error('Set-Cookie header missing or invalid for session_token');
    }

    const match = setCookieHeader.match(/session_token=([^;]+)/);
    if (!match || !match[1]) {
      throw new Error('Failed to extract raw token from Set-Cookie header');
    }
    const rawToken = match[1];

    // Test B: Database hashing verification
    console.log(' -> Test B: Database token secrecy (PostgreSQL query)');
    const expectedHash = hashSessionToken(rawToken);
    const dbSession = await prisma.session.findUnique({
      where: { sessionTokenHash: expectedHash },
    });

    if (!dbSession) {
      throw new Error('Session record not found by token hash in PostgreSQL');
    }

    const allSessions = await prisma.session.findMany();
    for (const s of allSessions) {
      if (s.sessionTokenHash === rawToken) {
        throw new Error('CRITICAL SECURITY FAILURE: Raw session token stored in PostgreSQL!');
      }
    }

    // Test C: Invalid credentials (wrong password & non-existent email)
    console.log(' -> Test C: Invalid credentials return generic 401 INVALID_CREDENTIALS');
    const wrongPassRes = await fetch(`http://127.0.0.1:${webPort}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'smoke.active@example.com',
        password: 'WrongPassword!',
      }),
    });
    if (wrongPassRes.status !== 401) {
      throw new Error(`Wrong password returned HTTP ${wrongPassRes.status}, expected 401`);
    }
    const wrongPassJson = await wrongPassRes.json();
    if (wrongPassJson.error.code !== 'INVALID_CREDENTIALS') {
      throw new Error(`Expected INVALID_CREDENTIALS, got ${wrongPassJson.error.code}`);
    }

    const nonExistentRes = await fetch(`http://127.0.0.1:${webPort}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nonexistent@example.com',
        password: 'ActivePassword123!',
      }),
    });
    if (nonExistentRes.status !== 401) {
      throw new Error(`Non-existent email returned HTTP ${nonExistentRes.status}, expected 401`);
    }
    const nonExistentJson = await nonExistentRes.json();
    if (nonExistentJson.error.code !== 'INVALID_CREDENTIALS') {
      throw new Error(`Expected INVALID_CREDENTIALS, got ${nonExistentJson.error.code}`);
    }

    // Test D: Non-ACTIVE account blocked
    console.log(' -> Test D: Non-ACTIVE account blocked (POST /api/v1/auth/login)');
    const pendingRes = await fetch(`http://127.0.0.1:${webPort}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'smoke.pending@example.com',
        password: 'PendingPassword123!',
      }),
    });
    if (pendingRes.status !== 403) {
      throw new Error(`Pending account returned HTTP ${pendingRes.status}, expected 403`);
    }
    const pendingJson = await pendingRes.json();
    if (pendingJson.error.code !== 'ACCOUNT_PENDING_APPROVAL') {
      throw new Error(`Expected ACCOUNT_PENDING_APPROVAL, got ${pendingJson.error.code}`);
    }

    // Test E: GET Session with valid cookie
    console.log(' -> Test E: Valid session lookup (GET /api/v1/auth/session)');
    const sessionRes = await fetch(`http://127.0.0.1:${webPort}/api/v1/auth/session`, {
      method: 'GET',
      headers: { Cookie: `session_token=${rawToken}` },
    });
    if (sessionRes.status !== 200) {
      throw new Error(`Session lookup failed with HTTP ${sessionRes.status}`);
    }
    const sessionJson = await sessionRes.json();
    if (
      !sessionJson.data.authenticated ||
      sessionJson.data.user.email !== 'smoke.active@example.com'
    ) {
      throw new Error(`Session lookup unexpected JSON: ${JSON.stringify(sessionJson)}`);
    }

    // Test F: POST Logout with valid cookie
    console.log(' -> Test F: Logout (POST /api/v1/auth/logout)');
    const logoutRes = await fetch(`http://127.0.0.1:${webPort}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { Cookie: `session_token=${rawToken}` },
    });
    if (logoutRes.status !== 204) {
      throw new Error(`Logout failed with HTTP status ${logoutRes.status}, expected 204`);
    }
    const logoutBody = await logoutRes.text();
    if (logoutBody !== '') {
      throw new Error(`Logout body was not empty: '${logoutBody}'`);
    }
    const logoutCookieHeader = logoutRes.headers.get('set-cookie');
    if (!logoutCookieHeader || !logoutCookieHeader.includes('Max-Age=0')) {
      throw new Error('Logout cookie header did not clear session_token');
    }

    // Test G: GET Session after logout
    console.log(' -> Test G: Session lookup after logout (GET /api/v1/auth/session)');
    const postLogoutSessionRes = await fetch(`http://127.0.0.1:${webPort}/api/v1/auth/session`, {
      method: 'GET',
      headers: { Cookie: `session_token=${rawToken}` },
    });
    if (postLogoutSessionRes.status !== 200) {
      throw new Error(`Post-logout session lookup failed with HTTP ${postLogoutSessionRes.status}`);
    }
    const postLogoutSessionJson = await postLogoutSessionRes.json();
    if (
      postLogoutSessionJson.data.authenticated !== false ||
      postLogoutSessionJson.data.user !== null
    ) {
      throw new Error(
        `Post-logout session lookup expected unauthenticated, got: ${JSON.stringify(postLogoutSessionJson)}`
      );
    }

    console.log('--- ALL LIVE HTTP SMOKE TESTS PASSED SUCCESSFULLY! ---');
  } finally {
    console.log('[6/6] Cleaning up test resources...');

    if (httpServer) {
      try {
        httpServer.close();
      } catch {}
    }

    if (prisma) {
      try {
        await prisma.$disconnect();
      } catch {}
    }

    try {
      console.log(`[CLEANUP] Stopping and removing container '${containerName}'...`);
      execSync(`docker stop ${containerName}`, { stdio: 'pipe' });
      execSync(`docker rm ${containerName}`, { stdio: 'pipe' });
      console.log(`[CLEANUP] Container '${containerName}' removed successfully.`);
    } catch (err: any) {
      console.warn('[CLEANUP WARNING] Container cleanup warning:', err.message);
    }
  }
}

main().catch((err) => {
  console.error('LIVE HTTP SMOKE TEST FAILED:', err);
  process.exit(1);
});
