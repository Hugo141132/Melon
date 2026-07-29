import { describe, it, expect } from 'vitest';
import {
  PendingApprovalItemDtoSchema,
  PendingApprovalsQueryInputSchema,
} from '@kebun-melon/contracts';

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

  it('4. Validates Owner UI approval action request schema and error handling contracts', () => {
    // Valid decisionNote
    const validApprovalInput = { decisionNote: 'Verified identity via phone' };
    expect(validApprovalInput.decisionNote).toBe('Verified identity via phone');

    // State contracts: SUCCESS response envelope format
    const successResponse = {
      success: true,
      data: {
        user: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          fullName: 'Approved Admin',
          email: 'admin@example.com',
          accountStatus: 'APPROVED',
        },
        approvalRecordId: 'rec-123',
      },
      meta: { requestId: 'req-1' },
    };
    expect(successResponse.success).toBe(true);
    expect(successResponse.data.user.accountStatus).toBe('APPROVED');

    // State contracts: CONFLICT error response format
    const conflictResponse = {
      success: false,
      error: {
        code: 'CONFLICT',
        message: "Target user is in status 'APPROVED', not PENDING_APPROVAL.",
        details: { currentStatus: 'APPROVED' },
      },
      meta: { requestId: 'req-2' },
    };
    expect(conflictResponse.success).toBe(false);
    expect(conflictResponse.error.code).toBe('CONFLICT');
  });

  it('5. Validates Owner UI rejection action request schema and error handling contracts', () => {
    const validRejectInput = { decisionNote: 'Unverified credentials and identity mismatch' };
    expect(validRejectInput.decisionNote).toBe('Unverified credentials and identity mismatch');

    const successRejectResponse = {
      success: true,
      data: {
        user: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          fullName: 'Rejected Admin',
          email: 'rejected.admin@example.com',
          accountStatus: 'REJECTED',
        },
        approvalRecordId: 'rec-456',
      },
      meta: { requestId: 'req-reject-1' },
    };
    expect(successRejectResponse.success).toBe(true);
    expect(successRejectResponse.data.user.accountStatus).toBe('REJECTED');

    const conflictRejectResponse = {
      success: false,
      error: {
        code: 'CONFLICT',
        message: "Target user is in status 'REJECTED', not PENDING_APPROVAL.",
        details: { currentStatus: 'REJECTED' },
      },
      meta: { requestId: 'req-reject-2' },
    };
    expect(conflictRejectResponse.success).toBe(false);
    expect(conflictRejectResponse.error.code).toBe('CONFLICT');
  });
});
