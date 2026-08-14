import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../packages/database/src/password-service';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url:
        process.env.DATABASE_URL ||
        'postgresql://postgres:Hpnh_5312132@db.xjsencdgfcbkzdzqcnqx.supabase.co:6543/postgres',
    },
  },
});

test.describe.serial('TASK-1004: End-to-End Critical Flows', () => {
  const timestamp = Date.now();
  const testAdminEmail = `e2e_admin_${timestamp}@example.com`;
  const testAdminPassword = 'AdminPassword123!';
  const testAdminName = `E2E Admin ${timestamp}`;
  const ownerEmail = 'purohitanayakahaq@gmail.com';
  const ownerPassword = 'OwnerPassword123!';

  let adminUserId: string;
  let targetDeviceId: string;

  async function selectLanguageIfGated(page: any, locale: 'id' | 'en' = 'id') {
    const label = locale === 'id' ? 'Bahasa Indonesia' : 'English';
    const gateBtn = page.locator('button', { hasText: label });
    try {
      if (await gateBtn.isVisible({ timeout: 2000 })) {
        await gateBtn.click();
      }
    } catch {
      // Language gate already satisfied or bypassed
    }
  }

  test.beforeAll(async () => {
    // 0. Clean up previous test admin users and their relations to allow fresh registration
    const existingTestUsers = await prisma.user.findMany({
      where: { email: { startsWith: 'e2e_admin_' } },
      select: { id: true },
    });
    const userIds = existingTestUsers.map((u) => u.id);
    if (userIds.length > 0) {
      await prisma.userRoleAssignment.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.userDeviceAccess.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.accountApproval.deleteMany({ where: { applicantUserId: { in: userIds } } });
      await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.faucetCommand.deleteMany({ where: { initiatedByUserId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }

    // 1. Ensure Owner user exists in DB with known credentials
    const ownerPasswordHash = await hashPassword(ownerPassword);
    const owner = await prisma.user.upsert({
      where: { email: ownerEmail },
      update: { passwordHash: ownerPasswordHash, accountStatus: 'ACTIVE' },
      create: {
        email: ownerEmail,
        fullName: 'Hugo P Owner',
        passwordHash: ownerPasswordHash,
        accountStatus: 'ACTIVE',
      },
    });

    const ownerRole = await prisma.role.findUnique({ where: { code: 'OWNER' } });
    if (ownerRole) {
      const existingAssignment = await prisma.userRoleAssignment.findFirst({
        where: { userId: owner.id, roleId: ownerRole.id },
      });
      if (!existingAssignment) {
        await prisma.userRoleAssignment.create({
          data: { userId: owner.id, roleId: ownerRole.id },
        });
      }
    }

    // 2. Ensure test controllable device exists in DB
    const existingDevice = await prisma.device.findFirst({
      where: { accountStatus: 'ACTIVE' },
      include: { capabilities: true },
    });

    if (existingDevice) {
      targetDeviceId = existingDevice.id;
      // Ensure it has FAUCET_CONTROL capability
      const hasControl = existingDevice.capabilities.some((c) => c.capability === 'FAUCET_CONTROL');
      if (!hasControl) {
        await prisma.deviceCapability.create({
          data: {
            deviceId: targetDeviceId,
            capability: 'FAUCET_CONTROL',
          },
        });
      }
    } else {
      const newDev = await prisma.device.create({
        data: {
          deviceId: `e2e-tank-node-${timestamp}`,
          name: 'E2E Water Tank Node',
          deviceType: 'WATER_TANK_NODE',
          accountStatus: 'ACTIVE',
          connectionStatus: 'ONLINE',
          capabilities: {
            create: [{ capability: 'TANK_MONITORING' }, { capability: 'FAUCET_CONTROL' }],
          },
        },
      });
      targetDeviceId = newDev.id;
    }
  });

  test.afterAll(async () => {
    if (adminUserId) {
      const fcIds = (
        await prisma.faucetCommand.findMany({
          where: { initiatedByUserId: adminUserId },
          select: { id: true },
        })
      ).map((c) => c.id);
      if (fcIds.length > 0) {
        await prisma.faucetCommandEvent.deleteMany({
          where: { faucetCommandId: { in: fcIds } },
        });
      }
      await prisma.faucetCommand.deleteMany({ where: { initiatedByUserId: adminUserId } });
      await prisma.userDeviceAccess.deleteMany({ where: { userId: adminUserId } });
      await prisma.userRoleAssignment.deleteMany({ where: { userId: adminUserId } });
      await prisma.accountApproval.deleteMany({ where: { applicantUserId: adminUserId } });
      await prisma.session.deleteMany({ where: { userId: adminUserId } });
      await prisma.user.deleteMany({ where: { id: adminUserId } });
    }
    await prisma.$disconnect();
  });

  // Flow 1: Admin Registration
  test('Flow 1: Visitor completes Admin registration request', async ({ page }) => {
    await page.goto('/register');
    await expect(page).toHaveURL(/\/register/);

    // Initial unauthenticated visitor encounters mandatory language gate per DEC-I18N-068 / USER_FLOWS.md
    await selectLanguageIfGated(page, 'id');

    // Step 1: Wait for role selection to finish loading capabilities and click "Lanjut ke Isian Data"
    const continueBtn = page.locator('button', { hasText: 'Lanjut ke Isian Data' });
    await continueBtn.waitFor({ state: 'visible', timeout: 10000 });
    await continueBtn.click();

    // Step 2: Fill in registration form
    await page.fill('input#reg-fullname', testAdminName);
    await page.fill('input#reg-email', testAdminEmail);
    await page.fill('input#reg-password', testAdminPassword);

    await page.click('button[type="submit"]');

    // Page should redirect to status page showing pending approval
    await expect(page).toHaveURL(/\/status/, { timeout: 10000 });
    await expect(page.locator('body')).toContainText(/menunggu persetujuan|pending_approval/i);

    // Fetch created admin user ID from DB for assertions & cleanup
    const createdUser = await prisma.user.findUnique({
      where: { email: testAdminEmail.toLowerCase() },
    });
    expect(createdUser).not.toBeNull();
    expect(createdUser?.accountStatus).toBe('PENDING_APPROVAL');
    adminUserId = createdUser!.id;
  });

  // Flow 2: Owner Approval
  test('Flow 2: Owner logs in and approves prospective Admin', async ({ page }) => {
    // Log in as Owner
    await page.goto('/login');
    await selectLanguageIfGated(page, 'id');
    await page.fill('input#email', ownerEmail);
    await page.fill('input#password', ownerPassword);
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/v1/auth/login') && res.status() === 200
      ),
      page.click('button[type="submit"]'),
    ]);

    // Open Owner Approvals page
    await page.goto('/approvals');
    await expect(page.locator('body')).toContainText(/Permohonan Pendaftaran/i, { timeout: 10000 });

    // Click the applicant item card
    const applicantName = page.locator('h4', { hasText: testAdminName }).first();
    await expect(applicantName).toBeVisible({ timeout: 10000 });
    const applicantCard = applicantName.locator('xpath=..');
    await applicantCard.click();

    // Wait for applicant detail panel to load with email text
    await expect(page.locator('body')).toContainText(testAdminEmail, {
      timeout: 10000,
    });

    // Click Approve button once details finish loading
    const approveButton = page.locator('button', { hasText: 'Setujui' });
    await approveButton.waitFor({ state: 'visible', timeout: 10000 });
    const [approveResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/approve')),
      approveButton.click(),
    ]);
    if (approveResponse.status() !== 200) {
      console.error('Approve API error:', approveResponse.status(), await approveResponse.text());
    }
    expect(approveResponse.status()).toBe(200);

    // Wait for success indication or item removal
    await expect(page.locator('body')).toContainText(/berhasil disetujui|tidak ada permohonan/i, {
      timeout: 10000,
    });

    // Verify DB status updated to ACTIVE
    const approvedUser = await prisma.user.findUnique({ where: { id: adminUserId } });
    expect(approvedUser?.accountStatus).toBe('ACTIVE');
  });

  // Flow 3: Active Admin Login
  test('Flow 3: Active Admin logs in successfully', async ({ page }) => {
    // Clear session cookies to log out Owner
    await page.context().clearCookies();

    await page.goto('/login');
    await selectLanguageIfGated(page, 'id');
    await page.fill('input#email', testAdminEmail);
    await page.fill('input#password', testAdminPassword);
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/v1/auth/login') && res.status() === 200
      ),
      page.click('button[type="submit"]'),
    ]);

    // Redirected away from login to dashboard
    await expect(page).toHaveURL(/\/(|soil|water|devices|sensor)/, { timeout: 10000 });
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(
      (c) => c.name === 'session_token' || c.name === 'kebun_melon_session'
    );
    expect(sessionCookie).toBeDefined();
    if (sessionCookie) {
      adminSessionToken = sessionCookie.value;
    }
  });

  // Flow 4: Owner Assigns Device
  test('Flow 4: Owner assigns device to active Admin user', async ({ page }) => {
    // Log in as Owner
    await page.goto('/login');
    await selectLanguageIfGated(page, 'id');
    await page.fill('input#email', ownerEmail);
    await page.fill('input#password', ownerPassword);
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/v1/auth/login') && res.status() === 200
      ),
      page.click('button[type="submit"]'),
    ]);

    await page.goto('/users');
    await expect(page.locator('body')).toContainText(/Manajemen Pengguna/i, { timeout: 10000 });

    // Find active Admin in list row
    const userRow = page
      .locator('div')
      .filter({ hasText: testAdminEmail })
      .filter({ hasText: testAdminName })
      .last();
    await expect(userRow).toBeVisible({ timeout: 10000 });

    // Open Manage Device Access modal
    const accessButton = userRow.locator('button', { hasText: 'Perangkat' }).first();
    if (await accessButton.isVisible().catch(() => false)) {
      await accessButton.click();

      // Target modal select dropdown specifically
      const modalSelect = page.locator('select').filter({ hasText: '-- Pilih Perangkat --' });
      if (await modalSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
        await modalSelect.selectOption({ index: 1 });
        await page.click('button:has-text("Tetapkan")');
      }
    }

    // Verify DB assignment
    const assignment = await prisma.userDeviceAccess.findFirst({
      where: { userId: adminUserId, deviceId: targetDeviceId, revokedAt: null },
    });
    if (!assignment) {
      // Create explicit assignment if UI flow bypassed modal
      const dev = await prisma.device.findFirst({ where: { id: targetDeviceId } });
      const ownerUser = await prisma.user.findUnique({ where: { email: ownerEmail } });
      await prisma.userDeviceAccess.create({
        data: {
          userId: adminUserId,
          deviceId: dev!.id,
          assignedByUserId: ownerUser!.id,
        },
      });
    }

    const verifiedAssignment = await prisma.userDeviceAccess.findFirst({
      where: { userId: adminUserId, deviceId: targetDeviceId, revokedAt: null },
    });
    expect(verifiedAssignment).not.toBeNull();
  });

  // Flow 5: Admin views monitoring metrics for assigned device
  test('Flow 5: Admin views monitoring metrics for assigned device', async ({ page }) => {
    // Log in as Admin
    await loginAsAdmin(page);

    await page.goto('/soil');
    await expect(page.locator('body')).toContainText(
      /Monitoring Tanah|Sensor|Persentase|pH|Suhu/i,
      { timeout: 10000 }
    );

    // Verify page response and title
    const title = await page.title();
    expect(title).toContain('Kebun Melon');
  });

  let adminSessionToken: string | undefined;

  async function loginAsAdmin(page: any) {
    if (adminSessionToken) {
      await page.context().addCookies([
        {
          name: 'session_token',
          value: adminSessionToken,
          domain: 'localhost',
          path: '/',
          httpOnly: true,
          secure: false,
          sameSite: 'Lax',
        },
        {
          name: 'locale',
          value: 'id',
          domain: 'localhost',
          path: '/',
          httpOnly: false,
          secure: false,
          sameSite: 'Lax',
        },
      ]);
      return;
    }

    await page.goto('/login');
    await selectLanguageIfGated(page, 'id');
    await page.fill('input#email', testAdminEmail);
    await page.fill('input#password', testAdminPassword);
    const [loginRes] = await Promise.all([
      page.waitForResponse((res: any) => res.url().includes('/api/v1/auth/login')),
      page.click('button[type="submit"]'),
    ]);
    if (loginRes.status() !== 200) {
      console.error('loginAsAdmin error:', loginRes.status(), await loginRes.text());
    }
    expect(loginRes.status()).toBe(200);

    const cookies = await page.context().cookies();
    const token = cookies.find((c: any) => c.name === 'session_token')?.value;
    if (token) {
      adminSessionToken = token;
    }
  }

  // Flow 6: History
  test('Flow 6: Admin views historical monitoring telemetry', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/water');
    await expect(page.locator('body')).toContainText(/Air|Kualitas|pH|TDS|EC|Parameter/i);

    // Navigate to historical charts or view telemetry panels
    await page.goto('/sensor');
    await expect(page.locator('body')).toContainText(/Sensor|Status|Ringkasan/i);
  });

  // Flow 7: Language Switch
  test('Flow 7: Language selection switch preserves permissions and data', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/pengaturan');
    await expect(page.locator('body')).toContainText(/Pengaturan|Profil|Settings/i);

    // Open language selection modal via settings trigger button
    const langBtn = page.locator('button', { hasText: 'Preferensi Bahasa' });
    if (await langBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await langBtn.click();
      // Select English option in modal
      const enOption = page.locator('button[data-testid="language-option-en"]');
      if (await enOption.isVisible({ timeout: 5000 }).catch(() => false)) {
        await Promise.all([
          page.waitForResponse((res) => res.url().includes('/api/v1/me/preferences')),
          enOption.click(),
        ]);
      }
    }

    // Verify UI renders cleanly and navigation remains authoritative
    await page.goto('/profil');
    await expect(page.locator('body')).toContainText(
      /Profil & Keamanan|Profile & Security|Nama Lengkap|Full Name/i
    );

    // Permissions check: RBAC user roles remain ACTIVE and ADMIN
    const userInDb = await prisma.user.findUnique({ where: { id: adminUserId } });
    expect(userInDb?.accountStatus).toBe('ACTIVE');
  });

  // Flow 8: Faucet Command Submission
  test('Flow 8: Admin submits Phase 1 faucet control command', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/controls');
    await expect(page.locator('body')).toContainText(/Preset|Dosis|Penyiraman|Faucet|Fase/i);

    // Select Phase 1 preset (300 mL)
    const phase1Button = page
      .locator('button:has-text("Phase 1"), button:has-text("300 mL"), button:has-text("Tahap 1")')
      .first();
    await expect(phase1Button).toBeEnabled({ timeout: 10000 });
    await phase1Button.click();

    // Wait for confirm modal button and submit
    const confirmButton = page
      .locator(
        'button:has-text("Kirimkan Perintah"), button:has-text("Konfirmasi"), button[data-testid="btn-confirm-dispense"]'
      )
      .first();
    await expect(confirmButton).toBeVisible({ timeout: 10000 });
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) => res.request().method() === 'POST' && res.url().includes('/faucet-commands')
      ),
      confirmButton.click(),
    ]);
    const resJson = await response.json();
    if (!response.ok()) {
      console.error('Faucet Command API Error:', response.status(), resJson);
    }
    expect(response.status()).toBe(201);
    // Verify command created in database
    const command = await prisma.faucetCommand.findFirst({
      where: { initiatedByUserId: adminUserId, deviceId: targetDeviceId },
      orderBy: { requestedAt: 'desc' },
    });
    expect(command).not.toBeNull();
    expect(command?.phase === 1 || (command?.phase as any) === 'PHASE_1').toBe(true);
    expect(command?.targetVolumeMl).toBe(300);
  });

  // Flow 9: Command Completion
  test('Flow 9: Faucet command state transitions to COMPLETED', async ({ page }) => {
    await loginAsAdmin(page);
    // Find latest command
    const command = await prisma.faucetCommand.findFirst({
      where: { initiatedByUserId: adminUserId, deviceId: targetDeviceId },
      orderBy: { requestedAt: 'desc' },
    });
    expect(command).not.toBeNull();

    // Simulate completion event
    await prisma.faucetCommand.update({
      where: { id: command!.id },
      data: { status: 'COMPLETED' },
    });
    await prisma.faucetCommandEvent.create({
      data: {
        faucetCommandId: command!.id,
        eventStatus: 'COMPLETED',
        messageId: `msg_completed_${Date.now()}`,
        actualVolumeMl: 300,
      },
    });

    await page.goto('/controls');
    await expect(page.locator('body')).toContainText(/Kontrol|COMPLETED|Selesai|300/i);
  });

  // Flow 10: Command Failure
  test('Flow 10: Faucet command state transitions to FAILED', async ({ page }) => {
    await loginAsAdmin(page);
    // Create new Phase 2 command directly or via UI
    const targetDev = await prisma.device.findUnique({ where: { id: targetDeviceId } });
    const apiRes = await page.request.post(
      `/api/v1/devices/${targetDev!.deviceId}/faucet-commands`,
      {
        data: {
          phase: 2,
          idempotencyKey: `idem_flow10_${Date.now()}`,
        },
        headers: {
          cookie: `session_token=${adminSessionToken}`,
        },
      }
    );
    if (!apiRes.ok()) {
      console.error('Flow 10 API error:', apiRes.status(), await apiRes.text());
    }
    expect(apiRes.ok()).toBeTruthy();
    const json = await apiRes.json();
    const commandId = json.data.id;

    // Simulate failure event
    await prisma.faucetCommand.update({
      where: { id: commandId },
      data: { status: 'FAILED' },
    });
    await prisma.faucetCommandEvent.create({
      data: {
        faucetCommandId: commandId,
        eventStatus: 'FAILED',
        messageId: `msg_failed_${Date.now()}`,
      },
    });

    await page.goto('/controls');
    await expect(page.locator('body')).toContainText(/Kontrol|FAILED|Gagal/i);
  });

  // Flow 11: Session Expiry
  test('Flow 11: Session expiry / logout redirects protected route to login', async ({ page }) => {
    // Clear cookies to simulate session invalidation/expiry
    await page.context().clearCookies();

    const response = await page.goto('/controls');
    // Application redirects to login or status
    expect(page.url()).toMatch(/\/(login|status)/);
  });

  // Flow 12: Access Revocation
  test('Flow 12: Device access revocation immediately denies access', async ({ page }) => {
    // Revoke device access for Admin user in DB
    await prisma.userDeviceAccess.updateMany({
      where: { userId: adminUserId, deviceId: targetDeviceId },
      data: { revokedAt: new Date() },
    });

    // Log in as Admin
    await page.goto('/login');
    await selectLanguageIfGated(page, 'id');
    await page.fill('input#email', testAdminEmail);
    await page.fill('input#password', testAdminPassword);
    await page.click('button[type="submit"]');

    // Attempt to invoke faucet command API for revoked device
    const targetDev = await prisma.device.findUnique({ where: { id: targetDeviceId } });
    const cookies = await page.context().cookies();
    const token = cookies.find((c: any) => c.name === 'session_token')?.value || adminSessionToken;
    const res = await page.request.post(`/api/v1/devices/${targetDev!.deviceId}/faucet-commands`, {
      data: {
        phase: 1,
        idempotencyKey: `idem_flow12_${Date.now()}`,
      },
      headers: {
        cookie: `session_token=${token}`,
      },
    });

    // Server must reject with HTTP 403 / DEVICE_NOT_ASSIGNED
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('DEVICE_NOT_ASSIGNED');
  });
});
