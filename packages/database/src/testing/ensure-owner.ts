import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../password-service';

async function ensureOwner() {
  const dbUrl =
    process.env.DATABASE_URL ||
    'postgresql://postgres:Hpnh_5312132@db.xjsencdgfcbkzdzqcnqx.supabase.co:5432/postgres';
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

  try {
    const passwordHash = await hashPassword('OwnerPassword123!');
    const owner = await prisma.user.upsert({
      where: { email: 'purohitanayakahaq@gmail.com' },
      update: { passwordHash, accountStatus: 'ACTIVE' },
      create: {
        email: 'purohitanayakahaq@gmail.com',
        fullName: 'Hugo P',
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

    console.log(
      'SUCCESS: Ensured Owner account with email: purohitanayakahaq@gmail.com and password: OwnerPassword123!'
    );
  } finally {
    await prisma.$disconnect();
  }
}

ensureOwner();
