import { describe, expect, it } from 'vitest';
import { validatePasswordPolicy, hashPassword, verifyPassword } from '../src/password-service';

describe('Password Service Pure Unit Tests (TASK-0202)', () => {
  describe('Password Policy Validation', () => {
    it('accepts valid password meeting all 5 criteria', () => {
      const result = validatePasswordPolicy('ValidPassword123!');
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('rejects too-short password (<12 characters)', () => {
      const result = validatePasswordPolicy('Short1!');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('at least 12 characters');
    });

    it('rejects missing uppercase letter', () => {
      const result = validatePasswordPolicy('lowercase123!');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('uppercase letter');
    });

    it('rejects missing lowercase letter', () => {
      const result = validatePasswordPolicy('LOWERCASE123!');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('lowercase letter');
    });

    it('rejects missing digit', () => {
      const result = validatePasswordPolicy('NoDigitHere!@#');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('digit');
    });

    it('rejects missing special character', () => {
      const result = validatePasswordPolicy('NoSpecialChar123');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('special character');
    });

    it('handles non-string input safely', () => {
      // @ts-expect-error testing runtime safe handling
      const result = validatePasswordPolicy(null);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('must be a string');
    });
  });

  describe('Argon2id Hashing & Verification', () => {
    it('produces an Argon2id hash different from the plaintext password', async () => {
      const plain = 'ValidPassword123!';
      const hashed = await hashPassword(plain);

      expect(hashed).not.toBe(plain);
      expect(hashed).toMatch(/^\$argon2id\$/);
    });

    it('generates distinct salt and hash for two identical passwords', async () => {
      const plain = 'ValidPassword123!';
      const hash1 = await hashPassword(plain);
      const hash2 = await hashPassword(plain);

      expect(hash1).not.toBe(hash2);
      expect(await verifyPassword(hash1, plain)).toBe(true);
      expect(await verifyPassword(hash2, plain)).toBe(true);
    });

    it('verifies correct password successfully', async () => {
      const plain = 'ValidPassword123!';
      const hashed = await hashPassword(plain);

      const isValid = await verifyPassword(hashed, plain);
      expect(isValid).toBe(true);
    });

    it('returns false for incorrect password', async () => {
      const plain = 'ValidPassword123!';
      const hashed = await hashPassword(plain);

      const isValid = await verifyPassword(hashed, 'WrongPassword123!');
      expect(isValid).toBe(false);
    });

    it('handles malformed or unsupported hash gracefully without throwing', async () => {
      expect(await verifyPassword('not-a-valid-hash', 'ValidPassword123!')).toBe(false);
      expect(
        await verifyPassword(
          '$argon2id$v=19$m=65536,t=3,p=1$invalidbase64$invalid',
          'ValidPassword123!'
        )
      ).toBe(false);
      expect(await verifyPassword('', 'ValidPassword123!')).toBe(false);
    });

    it('never leaks plaintext password in thrown errors when hash input is invalid', async () => {
      const sensitivePassword = 'SECRET_PASSWORD_DO_NOT_LEAK_123!';

      await expect(
        // @ts-expect-error testing invalid argument type
        hashPassword(null)
      ).rejects.toThrowError(/Password must be a non-empty string/);

      try {
        // @ts-expect-error testing invalid argument type
        await hashPassword(null);
      } catch (err: any) {
        expect(err.message).not.toContain(sensitivePassword);
      }
    });

    it('does not mutate input strings', async () => {
      const plain = 'ValidPassword123!';
      const plainCopy = 'ValidPassword123!';
      const hashed = await hashPassword(plain);

      expect(plain).toBe(plainCopy);
      await verifyPassword(hashed, plain);
      expect(plain).toBe(plainCopy);
    });
  });
});
