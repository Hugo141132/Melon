import { PrismaClient, UserRole } from '@prisma/client';

export interface SeedPermissionDef {
  code: string;
  description: string;
  ownerAccess: boolean;
  adminAccess: boolean;
}

export const CANONICAL_PERMISSIONS: SeedPermissionDef[] = [
  // 9.1 Authentication and Account Permissions
  {
    code: 'account.register',
    description: 'Register new Admin request',
    ownerAccess: false,
    adminAccess: true,
  },
  {
    code: 'account.status.read.self',
    description: 'View own account status',
    ownerAccess: true,
    adminAccess: true,
  },
  {
    code: 'account.approve',
    description: 'Approve pending Admin account',
    ownerAccess: true,
    adminAccess: false,
  },
  {
    code: 'account.reject',
    description: 'Reject pending Admin account',
    ownerAccess: true,
    adminAccess: false,
  },
  {
    code: 'account.activate',
    description: 'Activate user account',
    ownerAccess: true,
    adminAccess: false,
  },
  {
    code: 'account.suspend',
    description: 'Suspend user account',
    ownerAccess: true,
    adminAccess: false,
  },
  {
    code: 'account.deactivate',
    description: 'Deactivate user account',
    ownerAccess: true,
    adminAccess: false,
  },
  {
    code: 'account.role.update',
    description: 'Update user role',
    ownerAccess: true,
    adminAccess: false,
  },

  // 9.2 Profile Permissions
  {
    code: 'profile.self.read',
    description: 'View own profile',
    ownerAccess: true,
    adminAccess: true,
  },
  {
    code: 'profile.self.update',
    description: 'Update own profile',
    ownerAccess: true,
    adminAccess: true,
  },
  {
    code: 'profile.other.read',
    description: 'View other user profiles',
    ownerAccess: true,
    adminAccess: false,
  },
  {
    code: 'profile.other.update',
    description: 'Update other user profiles',
    ownerAccess: true,
    adminAccess: false,
  },
  {
    code: 'profile.password.update.self',
    description: 'Change own password',
    ownerAccess: true,
    adminAccess: true,
  },
  {
    code: 'profile.password.reset.other',
    description: 'Trigger password reset for others',
    ownerAccess: true,
    adminAccess: false,
  },

  // 9.3 Device Permissions
  { code: 'device.read', description: 'View devices', ownerAccess: true, adminAccess: true },
  {
    code: 'device.create',
    description: 'Register new device',
    ownerAccess: true,
    adminAccess: false,
  },
  {
    code: 'device.update',
    description: 'Update device metadata',
    ownerAccess: true,
    adminAccess: false,
  },
  {
    code: 'device.deactivate',
    description: 'Deactivate device',
    ownerAccess: true,
    adminAccess: false,
  },
  {
    code: 'device.delete',
    description: 'Permanently delete device',
    ownerAccess: true,
    adminAccess: false,
  },
  {
    code: 'device.assign',
    description: 'Assign device to user',
    ownerAccess: true,
    adminAccess: false,
  },
  {
    code: 'device.unassign',
    description: 'Remove device assignment',
    ownerAccess: true,
    adminAccess: false,
  },

  // 9.4 Monitoring Permissions
  {
    code: 'monitoring.current.read',
    description: 'Read live telemetry',
    ownerAccess: true,
    adminAccess: true,
  },
  {
    code: 'monitoring.history.read',
    description: 'Read historical telemetry',
    ownerAccess: true,
    adminAccess: true,
  },
  {
    code: 'monitoring.location.read',
    description: 'Read water device GPS location',
    ownerAccess: true,
    adminAccess: true,
  },
  {
    code: 'monitoring.export',
    description: 'Export monitoring telemetry',
    ownerAccess: true,
    adminAccess: true,
  },

  // 9.5 Faucet-Control Permissions
  {
    code: 'device.control.dispense',
    description: 'Send faucet dispense command',
    ownerAccess: true,
    adminAccess: true,
  },
  {
    code: 'device.control.cancel',
    description: 'Cancel active faucet command',
    ownerAccess: true,
    adminAccess: true,
  },
  {
    code: 'device.control.stop',
    description: 'Emergency stop faucet command',
    ownerAccess: true,
    adminAccess: true,
  },
  {
    code: 'device.control.history.read',
    description: 'Read faucet command history',
    ownerAccess: true,
    adminAccess: true,
  },

  // 9.6 Alert Permissions
  { code: 'alert.read', description: 'View alerts', ownerAccess: true, adminAccess: true },
  {
    code: 'alert.acknowledge',
    description: 'Acknowledge alert',
    ownerAccess: true,
    adminAccess: true,
  },
  {
    code: 'alert.configure',
    description: 'Configure system alert thresholds',
    ownerAccess: true,
    adminAccess: false,
  },

  // 9.7 Audit Permissions
  {
    code: 'audit.read',
    description: 'View system audit logs',
    ownerAccess: true,
    adminAccess: false,
  },
  { code: 'audit.export', description: 'Export audit logs', ownerAccess: true, adminAccess: false },

  // 9.8 Settings and Language Permissions
  {
    code: 'settings.self.read',
    description: 'View own settings',
    ownerAccess: true,
    adminAccess: true,
  },
  {
    code: 'settings.self.update',
    description: 'Update own settings',
    ownerAccess: true,
    adminAccess: true,
  },
  {
    code: 'settings.system.read',
    description: 'View system settings',
    ownerAccess: true,
    adminAccess: false,
  },
  {
    code: 'settings.system.update',
    description: 'Update system settings',
    ownerAccess: true,
    adminAccess: false,
  },
  {
    code: 'language.self.update',
    description: 'Change UI preferred language',
    ownerAccess: true,
    adminAccess: true,
  },
];

export async function seedRBAC(prisma: PrismaClient) {
  // 1. Seed Roles idempotently using upsert
  const ownerRole = await prisma.role.upsert({
    where: { code: UserRole.OWNER },
    update: {
      name: 'Owner',
      description: 'System owner with full administrative authority',
      isSystemRole: true,
    },
    create: {
      code: UserRole.OWNER,
      name: 'Owner',
      description: 'System owner with full administrative authority',
      isSystemRole: true,
    },
  });

  const adminRole = await prisma.role.upsert({
    where: { code: UserRole.ADMIN },
    update: {
      name: 'Admin',
      description: 'Operational administrator with assigned device management',
      isSystemRole: true,
    },
    create: {
      code: UserRole.ADMIN,
      name: 'Admin',
      description: 'Operational administrator with assigned device management',
      isSystemRole: true,
    },
  });

  // 2. Seed Permissions idempotently using upsert
  const permissionMap = new Map<string, string>(); // code -> id

  for (const pDef of CANONICAL_PERMISSIONS) {
    const permission = await prisma.permission.upsert({
      where: { code: pDef.code },
      update: {
        description: pDef.description,
      },
      create: {
        code: pDef.code,
        description: pDef.description,
      },
    });
    permissionMap.set(pDef.code, permission.id);
  }

  // 3. Seed Role-Permission Mappings idempotently
  for (const pDef of CANONICAL_PERMISSIONS) {
    const permId = permissionMap.get(pDef.code)!;

    if (pDef.ownerAccess) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: ownerRole.id,
            permissionId: permId,
          },
        },
        update: {
          roleId: ownerRole.id,
          permissionId: permId,
        },
        create: {
          roleId: ownerRole.id,
          permissionId: permId,
        },
      });
    }

    if (pDef.adminAccess) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: adminRole.id,
            permissionId: permId,
          },
        },
        update: {
          roleId: adminRole.id,
          permissionId: permId,
        },
        create: {
          roleId: adminRole.id,
          permissionId: permId,
        },
      });
    }
  }

  return {
    rolesCount: 2,
    permissionsCount: CANONICAL_PERMISSIONS.length,
    ownerRoleId: ownerRole.id,
    adminRoleId: adminRole.id,
  };
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('ERROR: DATABASE_URL environment variable is required to run the seed script.');
    process.exit(1);
  }

  const prisma = new PrismaClient({
    datasources: {
      db: { url: dbUrl },
    },
  });

  try {
    console.log('Seeding canonical RBAC roles and permissions...');
    const result = await seedRBAC(prisma);
    console.log(
      `Successfully seeded ${result.rolesCount} roles and ${result.permissionsCount} permissions.`
    );
  } catch (error) {
    console.error('Error seeding RBAC data:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
