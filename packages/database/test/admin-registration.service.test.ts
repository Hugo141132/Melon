import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountStatus, UserRole } from '@prisma/client';
import {
  registerAdminUser,
  DuplicateEmailError,
  MissingRoleError,
  PasswordPolicyError,
} from '../src/admin-registration';
import { UserRole as ContractUserRole } from '@kebun-melon/contracts';
import { verifyPassword } from '../src/password-service';

describe('Admin Registration Service & Transaction Unit Tests', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      $transaction: vi.fn(async (cb: any) => {
        const txMock = {
          user: {
            findUnique: vi.fn(),
            create: vi.fn(),
            findUniqueOrThrow: vi.fn(),
          },
          role: {
            findUnique: vi.fn(),
          },
          userRoleAssignment: {
            create: vi.fn(),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return await cb(txMock);
      }),
    };
  });

  it('atomically registers an Admin user in PENDING_APPROVAL status with ADMIN role', async () => {
    const input = {
      fullName: 'New Admin',
      email: 'Admin.New@Example.COM',
      password: 'StrongPassword123!',
    };

    const mockAdminRole = { id: '00000000-0000-0000-0000-000000000001', code: UserRole.ADMIN };
    const mockCreatedUser = {
      id: '00000000-0000-0000-0000-000000000002',
      fullName: 'New Admin',
      email: 'admin.new@example.com',
      passwordHash: 'hashed_password',
      accountStatus: AccountStatus.PENDING_APPROVAL,
    };
    const mockFullUser = {
      ...mockCreatedUser,
      username: null,
      emailVerifiedAt: null,
      lastLoginAt: null,
      suspendedAt: null,
      deactivatedAt: null,
      createdAt: new Date('2026-07-29T00:00:00Z'),
      updatedAt: new Date('2026-07-29T00:00:00Z'),
      userRoles: [
        {
          id: '00000000-0000-0000-0000-000000000003',
          userId: '00000000-0000-0000-0000-000000000002',
          roleId: '00000000-0000-0000-0000-000000000001',
          assignedByUserId: null,
          assignedAt: new Date(),
          revokedAt: null,
          role: { code: ContractUserRole.ADMIN },
        },
      ],
    };

    mockPrisma = {
      $transaction: vi.fn(async (cb: any) => {
        const txMock = {
          user: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockCreatedUser),
            findUniqueOrThrow: vi.fn().mockResolvedValue(mockFullUser),
          },
          role: {
            findUnique: vi.fn().mockResolvedValue(mockAdminRole),
          },
          userRoleAssignment: {
            create: vi.fn().mockResolvedValue({ id: 'ura-1' }),
          },
          auditLog: {
            create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
          },
        };
        return await cb(txMock);
      }),
    };

    const result = await registerAdminUser(mockPrisma, input);

    expect(result.user).toBeDefined();
    expect(result.user.fullName).toBe('New Admin');
    expect(result.user.email).toBe('admin.new@example.com');
    expect(result.user.accountStatus).toBe(AccountStatus.PENDING_APPROVAL);
    expect(result.user.activeRoles).toEqual([ContractUserRole.ADMIN]);
  });

  it('rejects registration when email already exists', async () => {
    const input = {
      fullName: 'Existing Admin',
      email: 'existing@example.com',
      password: 'StrongPassword123!',
    };

    mockPrisma = {
      $transaction: vi.fn(async (cb: any) => {
        const txMock = {
          user: {
            findUnique: vi.fn().mockResolvedValue({ id: 'existing-id' }),
          },
        };
        return await cb(txMock);
      }),
    };

    await expect(registerAdminUser(mockPrisma, input)).rejects.toThrow(DuplicateEmailError);
  });

  it('rejects registration when canonical ADMIN role is missing from DB', async () => {
    const input = {
      fullName: 'New Admin',
      email: 'admin@example.com',
      password: 'StrongPassword123!',
    };

    mockPrisma = {
      $transaction: vi.fn(async (cb: any) => {
        const txMock = {
          user: {
            findUnique: vi.fn().mockResolvedValue(null),
          },
          role: {
            findUnique: vi.fn().mockResolvedValue(null),
          },
        };
        return await cb(txMock);
      }),
    };

    await expect(registerAdminUser(mockPrisma, input)).rejects.toThrow(MissingRoleError);
  });

  it('rejects registration if password fails password policy', async () => {
    const weakInput = {
      fullName: 'Weak Password Admin',
      email: 'admin@example.com',
      password: 'weakpassword',
    };

    await expect(registerAdminUser(mockPrisma, weakInput)).rejects.toThrow(PasswordPolicyError);
  });
});
