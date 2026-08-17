'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Hook to guard guest-only routes (/login, /register, /forgot-password).
 * Ensures that ONLY users with a genuinely valid, active authenticated session
 * are redirected to the authorized dashboard (/).
 *
 * For invalid, expired, revoked, or malformed session tokens, the user is NOT redirected,
 * and the stale session cookie is cleared by the session endpoint.
 */
export function useGuestGuard(redirectTo = '/') {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function checkSessionValidity() {
      try {
        const res = await fetch('/api/v1/auth/session');
        if (res.ok) {
          const json = await res.json();
          if (
            isMounted &&
            json.success &&
            json.data?.authenticated === true &&
            json.data?.user?.accountStatus === 'ACTIVE'
          ) {
            router.replace(redirectTo);
            return;
          }
        }
      } catch {
        // On network error or server failure, allow guest view to load
      } finally {
        if (isMounted) {
          setIsChecking(false);
        }
      }
    }

    checkSessionValidity();

    return () => {
      isMounted = false;
    };
  }, [router, redirectTo]);

  return { isChecking };
}
