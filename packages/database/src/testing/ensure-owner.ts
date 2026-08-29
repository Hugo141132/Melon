import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../password-service';
import { validateTestDatabaseUrl } from '../owner-provisioning';

async function ensureOwner() {
  const rawDbUrl =
    process.env.TEST_DATABASE_URL || process.env.E2E_DATABASE_URL || process.env.DATABASE_URL;
  const dbUrl = validateTestDatabaseUrl(rawDbUrl);
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

  const ownerEmail = process.env.TEST_OWNER_EMAIL || 'test_owner@example.com';
  const ownerPassword = process.env.TEST_OWNER_PASSWORD || 'TestOwnerPassword123!';
  const ownerName = process.env.TEST_OWNER_NAME || 'Test Owner';

  try {
    const passwordHash = await hashPassword(ownerPassword);
    const owner = await prisma.user.upsert({
      where: { email: ownerEmail },
      update: { passwordHash, accountStatus: 'ACTIVE' },
      create: {
        email: ownerEmail,
        fullName: ownerName,
        passwordHash,
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
          data: {
            userId: owner.id,
            roleId: ownerRole.id,
          },
        });
      }
    }

    console.log(`SUCCESS: Ensured Owner account with email: ${ownerEmail}`);
  } finally {
    await prisma.$disconnect();
  }
}

ensureOwner();
