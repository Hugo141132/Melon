import { hash, verify } from '@node-rs/argon2';

/**
 * Result of validating a password against the approved security policy.
 */
export interface PasswordPolicyResult {
  valid: boolean;
  reason?: string;
}

/**
 * Options for password hashing.
 */
export interface PasswordHashOptions {
  memoryCost?: number;
  timeCost?: number;
  parallelism?: number;
}

/**
 * Validates a password directly against the approved policy in docs/SECURITY.md §8.2:
 * - Minimum 12 characters.
 * - At least one uppercase letter.
 * - At least one lowercase letter.
 * - At least one digit.
 * - At least one special character.
 *
 * Safe: Does not leak or store password state.
 */
export function validatePasswordPolicy(password: string): PasswordPolicyResult {
  if (typeof password !== 'string') {
    return { valid: false, reason: 'Password must be a string.' };
  }
  if (password.length < 12) {
    return { valid: false, reason: 'Password must be at least 12 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one uppercase letter.' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one lowercase letter.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one digit.' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one special character.' };
  }
  return { valid: true };
}

/**
 * Hashes a plaintext password using Argon2id with N-API native implementation (@node-rs/argon2).
 * Algorithm 2 corresponds to Argon2id.
 *
 * Guarantees:
 * - Never returns or logs the plaintext password.
 * - Throws generic, non-sensitive errors if hashing fails.
 */
export async function hashPassword(
  password: string,
  options?: PasswordHashOptions
): Promise<string> {
  if (typeof password !== 'string' || !password) {
    throw new Error('Password must be a non-empty string.');
  }

  try {
    return await hash(password, {
      algorithm: 2, // Argon2id
      memoryCost: options?.memoryCost,
      timeCost: options?.timeCost,
      parallelism: options?.parallelism,
    });
  } catch (error) {
    // Prevent any internal library stack or input details from exposing sensitive content
    throw new Error('Password hashing failed due to an internal error.');
  }
}

/**
 * Verifies a candidate plaintext password against a stored Argon2id hash.
 *
 * Guarantees:
 * - Uses library verify() for constant-time cryptographic verification.
 * - Handles malformed or invalid hash formats safely by returning false without throwing sensitive exceptions.
 * - Never leaks password contents in ordinary logs or errors.
 */
export async function verifyPassword(
  storedHash: string,
  candidatePassword: string
): Promise<boolean> {
  if (typeof storedHash !== 'string' || typeof candidatePassword !== 'string') {
    return false;
  }
  if (!storedHash || !candidatePassword) {
    return false;
  }

  try {
    return await verify(storedHash, candidatePassword);
  } catch (error) {
    // Malformed, corrupted, or unsupported hash strings return false safely without throwing or exposing internals
    return false;
  }
}
