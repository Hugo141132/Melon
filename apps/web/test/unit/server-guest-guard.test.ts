import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireGuestSession } from '@/lib/auth/server-guest-guard';
import { AccountStatus } from '@kebun-melon/contracts';

const mockRedirect = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    mockRedirect(path);
    const err = new Error('NEXT_REDIRECT');
    (err as any).digest = `NEXT_REDIRECT;replace;${path};307;;`;
    throw err;
  },
}));

let mockCookieStore: Record<string, string | undefined> = {};
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      mockCookieStore[name] ? { name, value: mockCookieStore[name] } : undefined,
  }),
}));

const mockValidateSession = vi.fn();
vi.mock('@kebun-melon/database', () => ({
  prisma: {},
  SESSION_COOKIE_NAME: 'session_token',
  validateSession: (...args: any[]) => mockValidateSession(...args),
}));

describe('TASK-0213 requireGuestSession Server Guard Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieStore = {};
  });

  it('1. Immediately throws Next.js redirect to / for a genuinely valid ACTIVE session', async () => {
    mockCookieStore['session_token'] = 'valid-active-session-token';
    mockValidateSession.mockResolvedValueOnce({
      session: { id: 'sess-1', userId: 'user-1' },
      user: {
        id: 'user-1',
        email: 'user@example.com',
        accountStatus: AccountStatus.ACTIVE,
      },
    });

    await expect(requireGuestSession('/')).rejects.toThrow('NEXT_REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/');
  });

  it('2. Does NOT redirect when no session_token cookie is present (unauthenticated)', async () => {
    mockCookieStore = {};

    await expect(requireGuestSession('/')).resolves.toBeUndefined();
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(mockValidateSession).not.toHaveBeenCalled();
  });

  it('3. Does NOT redirect when session token is expired, revoked, or fake (validateSession returns null)', async () => {
    mockCookieStore['session_token'] = 'stale-or-fake-token';
    mockValidateSession.mockResolvedValueOnce(null);

    await expect(requireGuestSession('/')).resolves.toBeUndefined();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('4. Does NOT redirect when user account status is PENDING_APPROVAL', async () => {
    mockCookieStore['session_token'] = 'pending-user-token';
    mockValidateSession.mockResolvedValueOnce({
      session: { id: 'sess-2', userId: 'user-2' },
      user: {
        id: 'user-2',
        email: 'pending@example.com',
        accountStatus: AccountStatus.PENDING_APPROVAL,
      },
    });

    await expect(requireGuestSession('/')).resolves.toBeUndefined();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('5. Fails open and allows rendering if validateSession throws a DB error', async () => {
    mockCookieStore['session_token'] = 'some-token';
    mockValidateSession.mockRejectedValueOnce(new Error('PostgreSQL connection timeout'));

    await expect(requireGuestSession('/')).resolves.toBeUndefined();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('6. VerifyEmailPage server component redirects authenticated user with active session to /', async () => {
    const VerifyEmailPage = (await import('@/app/(auth)/verify-email/page')).default;

    mockCookieStore['session_token'] = 'valid-active-session-token';
    mockValidateSession.mockResolvedValueOnce({
      session: { id: 'sess-1', userId: 'user-1' },
      user: {
        id: 'user-1',
        email: 'user@example.com',
        accountStatus: AccountStatus.ACTIVE,
      },
    });

    await expect(VerifyEmailPage()).rejects.toThrow('NEXT_REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/');
  });

  it('7. VerifyEmailPage server component renders for unauthenticated guest', async () => {
    const VerifyEmailPage = (await import('@/app/(auth)/verify-email/page')).default;

    mockCookieStore = {};

    const element = await VerifyEmailPage();
    expect(element).toBeDefined();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
