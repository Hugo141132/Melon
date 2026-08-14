import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PATCH as patchPreferences } from '../../app/api/v1/me/preferences/route';
import * as rbacModule from '../../lib/auth/rbac';
import { UserRole, AccountStatus } from '@kebun-melon/contracts';

vi.mock('../../lib/auth/rbac', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    requireSession: vi.fn(),
    requireActiveAccount: vi.fn(),
    requirePermission: vi.fn(),
  };
});

const mockUpdateUserPreference = vi.fn();

vi.mock('@kebun-melon/database', async () => {
  const actual: any = await vi.importActual('@kebun-melon/database');
  return {
    ...actual,
    prisma: {},
    UserRepository: class {
      updateUserPreference = mockUpdateUserPreference;
    },
  };
});

describe('PATCH /api/v1/me/preferences API Route', () => {
  const mockUserSession: rbacModule.AuthenticatedUserSession = {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    fullName: 'Test User',
    email: 'user@example.com',
    accountStatus: AccountStatus.ACTIVE,
    activeRoles: [UserRole.ADMIN],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rbacModule.requireSession).mockResolvedValue(mockUserSession);
    vi.mocked(rbacModule.requireActiveAccount).mockReturnValue(mockUserSession);
    vi.mocked(rbacModule.requirePermission).mockReturnValue(mockUserSession);
  });

  it('updates preferredLocale successfully and returns HTTP 200 with data envelope', async () => {
    mockUpdateUserPreference.mockResolvedValue({
      success: true,
      preferences: {
        preferredLocale: 'en',
        timezone: 'Asia/Jakarta',
        defaultDeviceId: null,
      },
    });

    const request = new Request('http://localhost:3000/api/v1/me/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferredLocale: 'en' }),
    });

    const response = await patchPreferences(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.preferredLocale).toBe('en');
    expect(rbacModule.requirePermission).toHaveBeenCalledWith(
      mockUserSession,
      'language.self.update',
      'USER',
      mockUserSession.id,
      request
    );
  });

  it('rejects invalid JSON with HTTP 400', async () => {
    const request = new Request('http://localhost:3000/api/v1/me/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid-json',
    });

    const response = await patchPreferences(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('INVALID_REQUEST');
  });

  it('rejects unsupported locale with HTTP 422', async () => {
    const request = new Request('http://localhost:3000/api/v1/me/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferredLocale: 'fr' }),
    });

    const response = await patchPreferences(request);
    const json = await response.json();

    expect(response.status).toBe(422);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects extraneous forbidden fields with HTTP 422', async () => {
    const request = new Request('http://localhost:3000/api/v1/me/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferredLocale: 'id', role: 'OWNER' }),
    });

    const response = await patchPreferences(request);
    const json = await response.json();

    expect(response.status).toBe(422);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns HTTP 401 when session is missing', async () => {
    vi.mocked(rbacModule.requireSession).mockRejectedValue(
      new rbacModule.AuthorizationError(401, 'UNAUTHENTICATED', 'Authentication session required.')
    );

    const request = new Request('http://localhost:3000/api/v1/me/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferredLocale: 'id' }),
    });

    const response = await patchPreferences(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns HTTP 403 when account is not active', async () => {
    vi.mocked(rbacModule.requireActiveAccount).mockImplementation(() => {
      throw new rbacModule.AuthorizationError(
        403,
        'ACCOUNT_NOT_ACTIVE',
        'Account is PENDING_APPROVAL.'
      );
    });

    const request = new Request('http://localhost:3000/api/v1/me/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferredLocale: 'id' }),
    });

    const response = await patchPreferences(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('ACCOUNT_NOT_ACTIVE');
  });

  it('returns HTTP 404 when user is not found in database', async () => {
    mockUpdateUserPreference.mockResolvedValue({
      success: false,
      error: 'USER_NOT_FOUND',
      message: 'User profile could not be found.',
    });

    const request = new Request('http://localhost:3000/api/v1/me/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferredLocale: 'id' }),
    });

    const response = await patchPreferences(request);
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('USER_NOT_FOUND');
  });
});
