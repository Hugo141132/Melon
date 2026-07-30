import { describe, it, expect, vi } from 'vitest';
import { GET } from '../route';
import * as dbModule from '@kebun-melon/database';

describe('GET /api/v1/auth/register/capabilities Route Handler Unit Tests', () => {
  it('Returns ownerRegistrationAvailable: true when no owner exists', async () => {
    vi.spyOn(dbModule, 'isOwnerRegistrationAvailable').mockResolvedValueOnce(true);

    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.ownerRegistrationAvailable).toBe(true);
  });

  it('Returns ownerRegistrationAvailable: false when an owner exists', async () => {
    vi.spyOn(dbModule, 'isOwnerRegistrationAvailable').mockResolvedValueOnce(false);

    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.ownerRegistrationAvailable).toBe(false);
  });
});
