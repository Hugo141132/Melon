import { describe, it, expect } from 'vitest';
import { generateTestIsolationPrefix } from '../src/testing/db-test-helper';

describe('PostgreSQL DB Test Helper', () => {
  it('generates unique non-colliding test isolation prefixes', () => {
    const prefix1 = generateTestIsolationPrefix('user');
    const prefix2 = generateTestIsolationPrefix('user');

    expect(prefix1).toMatch(/^user_\d+_[a-z0-9]+$/);
    expect(prefix2).toMatch(/^user_\d+_[a-z0-9]+$/);
    expect(prefix1).not.toBe(prefix2);
  });
});
