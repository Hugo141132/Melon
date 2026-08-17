import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma, validateSession, SESSION_COOKIE_NAME } from '@kebun-melon/database';
import { AccountStatus } from '@kebun-melon/contracts';

/**
 * Server-side guard for guest-only authentication routes
 * (/login, /register, /forgot-password, /reset-password).
 *
 * Validates the session token against PostgreSQL via validateSession.
 * - If a genuinely valid session exists AND the user account is ACTIVE:
 *   Immediately redirects server-side to the authorized dashboard (default: '/').
 * - For invalid, expired, revoked, malformed, or absent session tokens:
 *   Returns normally, allowing the auth page to render.
 *
 * Guarantees zero auth-page flash and zero client-side redirect delay.
 */
export async function requireGuestSession(redirectTo = '/') {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) {
      return;
    }

    const sessionInfo = await validateSession(prisma, token);
    if (sessionInfo && sessionInfo.user?.accountStatus === AccountStatus.ACTIVE) {
      redirect(redirectTo);
    }
  } catch (error: any) {
    // If Next.js redirect was thrown, rethrow it so Next.js performs the HTTP redirect
    if (error?.digest?.startsWith('NEXT_REDIRECT') || error?.message === 'NEXT_REDIRECT') {
      throw error;
    }
    // On unexpected database or network errors, fail open to allow rendering
  }
}
