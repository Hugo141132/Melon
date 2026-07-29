import { describe, it, expect } from 'vitest';
import { PendingApprovalItemDtoSchema, PendingApprovalsQueryInputSchema } from '@kebun-melon/contracts';

describe('Owner Approvals UI Component & Schema Integration Tests (TASK-0206)', () => {
  it('1. Validates schema parsing for populated pending approval item', () => {
    const validItem = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      fullName: 'Pending Admin User',
      email: 'pending.admin@example.com',
      accountStatus: 'PENDING_APPROVAL',
      createdAt: new Date(),
    };

    const parsed = PendingApprovalItemDtoSchema.parse(validItem);
    expect(parsed.userId).toBe(validItem.userId);
    expect(parsed.fullName).toBe('Pending Admin User');
    expect(parsed.accountStatus).toBe('PENDING_APPROVAL');
  });

  it('2. Enforces strict DTO rules removing password, secret tokens, and audit internal notes', () => {
    const itemWithSecrets = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      fullName: 'Pending Admin User',
      email: 'pending.admin@example.com',
      accountStatus: 'PENDING_APPROVAL',
      createdAt: new Date(),
      passwordHash: '$argon2id$secret',
      sessionTokenHash: 'hash123',
    };

    const parsed = PendingApprovalItemDtoSchema.parse(itemWithSecrets);
    expect(parsed).not.toHaveProperty('passwordHash');
    expect(parsed).not.toHaveProperty('sessionTokenHash');
  });

  it('3. Validates default pagination, search, and sorting query input schema', () => {
    const defaultQuery = PendingApprovalsQueryInputSchema.parse({});
    expect(defaultQuery.page).toBe(1);
    expect(defaultQuery.pageSize).toBe(20);
    expect(defaultQuery.sort).toBe('createdAt:desc');

    const customQuery = PendingApprovalsQueryInputSchema.parse({
      page: 2,
      pageSize: 50,
      search: 'admin',
      sort: 'createdAt:asc',
    });
    expect(customQuery.page).toBe(2);
    expect(customQuery.pageSize).toBe(50);
    expect(customQuery.search).toBe('admin');
    expect(customQuery.sort).toBe('createdAt:asc');
  });
});
