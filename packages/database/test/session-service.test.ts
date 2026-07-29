import { describe, it, expect } from 'vitest';
import {
  hashSessionToken,
  InvalidCredentialsError,
  AccountStatusForbiddenError,
  SESSION_COOKIE_NAME,
  SESSION_IDLE_TIMEOUT_MS,
  SESSION_ABSOLUTE_LIFETIME_MS,
} from '../src/session-service';
import { AccountStatus } from '@kebun-melon/contracts';

describe('Session Service Unit Tests', () => {
  it('1. Token hashing produces a 64-character SHA-256 hex digest', () => {
    const rawToken = '0123456789abcdef0123456789abcdef';
    const hash1 = hashSessionToken(rawToken);
    const hash2 = hashSessionToken(rawToken);

    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(rawToken);
  });

  it('2. Constants match security specifications', () => {
    expect(SESSION_COOKIE_NAME).toBe('session_token');
    expect(SESSION_IDLE_TIMEOUT_MS).toBe(30 * 60 * 1000); // 30 mins
    expect(SESSION_ABSOLUTE_LIFETIME_MS).toBe(12 * 60 * 60 * 1000); // 12 hours
  });

  it('3. Error classes instantiate with expected messages and codes', () => {
    const credErr = new InvalidCredentialsError();
    expect(credErr.message).toBe('Invalid email or password.');
    expect(credErr.name).toBe('InvalidCredentialsError');

    const pendingErr = new AccountStatusForbiddenError(AccountStatus.PENDING_APPROVAL);
    expect(pendingErr.status).toBe(AccountStatus.PENDING_APPROVAL);
    expect(pendingErr.message).toContain('PENDING_APPROVAL');

    const suspendedErr = new AccountStatusForbiddenError(AccountStatus.SUSPENDED);
    expect(suspendedErr.status).toBe(AccountStatus.SUSPENDED);
    expect(suspendedErr.message).toContain('SUSPENDED');
  });
});
