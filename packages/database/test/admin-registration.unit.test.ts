import { describe, it, expect } from 'vitest';
import { AdminRegistrationInputSchema, UserRole, AccountStatus } from '@kebun-melon/contracts';
import { PasswordPolicyError } from '../src/admin-registration';
import { validatePasswordPolicy } from '../src/password-service';

describe('Admin Registration Input & Security Unit Tests', () => {
  it('validates correct registration payload', () => {
    const validPayload = {
      fullName: 'Test Admin',
      email: 'ADMIN@Example.COM',
      password: 'StrongPassword123!',
    };

    const parsed = AdminRegistrationInputSchema.parse(validPayload);
    expect(parsed.fullName).toBe('Test Admin');
    expect(parsed.email).toBe('ADMIN@Example.COM');
    expect(parsed.password).toBe('StrongPassword123!');
  });

  it('strictly rejects role injection in registration payload', () => {
    const injectedPayload = {
      fullName: 'Attacker Admin',
      email: 'attacker@example.com',
      password: 'StrongPassword123!',
      role: 'OWNER',
    };

    expect(() => AdminRegistrationInputSchema.parse(injectedPayload)).toThrow();
  });

  it('strictly rejects accountStatus injection in registration payload', () => {
    const injectedPayload = {
      fullName: 'Attacker Admin',
      email: 'attacker@example.com',
      password: 'StrongPassword123!',
      accountStatus: 'ACTIVE',
    };

    expect(() => AdminRegistrationInputSchema.parse(injectedPayload)).toThrow();
  });

  it('strictly rejects permissions and privilege injection', () => {
    const injectedPayload = {
      fullName: 'Attacker Admin',
      email: 'attacker@example.com',
      password: 'StrongPassword123!',
      permissions: ['ALL'],
      assignedDevices: ['device-1'],
    };

    expect(() => AdminRegistrationInputSchema.parse(injectedPayload)).toThrow();
  });

  it('rejects invalid email formats', () => {
    const invalidEmailPayload = {
      fullName: 'Test Admin',
      email: 'not-an-email',
      password: 'StrongPassword123!',
    };

    expect(() => AdminRegistrationInputSchema.parse(invalidEmailPayload)).toThrow();
  });

  it('rejects weak passwords failing password policy', () => {
    const weakPasswords = [
      'short', // < 12 chars
      'lowercaseonly123!', // no uppercase
      'UPPERCASEONLY123!', // no lowercase
      'NoDigitsHere!!!', // no digits
      'NoSpecialChars123', // no special chars
    ];

    for (const pwd of weakPasswords) {
      const res = validatePasswordPolicy(pwd);
      expect(res.valid).toBe(false);
    }
  });
});
