'use client';

import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import type { AuthenticatedUserSession } from '@/lib/auth/rbac';
import { UserRole } from '@kebun-melon/contracts';
import { usePathname } from 'next/navigation';

export const AUTH_UNAUTHORIZED_EVENT = 'melon:unauthenticated';

export function dispatchUnauthenticatedEvent() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT));
  }
}

const PUBLIC_PATH_PREFIXES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/status',
  '/health',
  '/ready',
];

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthenticatedUserSession | null;
  role: UserRole | null;
  setUser?: (user: AuthenticatedUserSession | null) => void;
  updateUser?: (fields: Partial<AuthenticatedUserSession>) => void;
  invalidateSession?: () => void;
  revalidateSession?: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({
  children,
  initialSession,
}: {
  children: ReactNode;
  initialSession: AuthenticatedUserSession | null;
}) {
  const [session, setSession] = useState<AuthenticatedUserSession | null>(initialSession);
  const prevInitialSessionRef = useRef<AuthenticatedUserSession | null>(initialSession);
  const lastCheckedRef = useRef<number>(0);
  const pathname = usePathname();

  useEffect(() => {
    // If initialSession transitions from non-null to null (server indicates session expired/lost),
    // or if initialSession transitions to a new non-null session, update client session state.
    // Stale initialSession=null from the initial unauthenticated pass does not clobber client login.
    if (initialSession !== null) {
      setSession(initialSession);
    } else if (prevInitialSessionRef.current !== null) {
      setSession(null);
    }
    prevInitialSessionRef.current = initialSession;
  }, [initialSession]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleUnauthorized = () => {
      setSession(null);
    };

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, []);

  // Lightweight active session validation (non-blocking)
  const validateSession = useCallback(
    async (force = false) => {
      if (typeof window === 'undefined') return;
      if (!session) return;

      // Minimum 2-second debounce between checks to avoid redundant network requests unless forced
      const now = Date.now();
      if (!force && now - lastCheckedRef.current < 2000) return;
      lastCheckedRef.current = now;

      try {
        const res = await fetch('/api/v1/auth/session', {
          method: 'GET',
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
        });

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            setSession(null);
            dispatchUnauthenticatedEvent();
            const currentPath = window.location.pathname;
            const isPublic = PUBLIC_PATH_PREFIXES.some(
              (p) => currentPath === p || currentPath.startsWith(p)
            );
            if (!isPublic) {
              try {
                window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
              } catch {
                // jsdom navigation fallback in test environments
              }
            }
          }
          return;
        }

        const json = await res.json();
        if (!json.success || !json.data?.authenticated) {
          setSession(null);
          dispatchUnauthenticatedEvent();
          const currentPath = window.location.pathname;
          const isPublic = PUBLIC_PATH_PREFIXES.some(
            (p) => currentPath === p || currentPath.startsWith(p)
          );
          if (!isPublic) {
            try {
              window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
            } catch {
              // jsdom navigation fallback in test environments
            }
          }
        }
      } catch {
        // Ignore network errors to avoid false logouts during temporary offline states
      }
    },
    [session]
  );

  // Revalidate session when window gains focus or document visibility changes
  useEffect(() => {
    if (typeof window === 'undefined' || !session) return;

    const onFocus = () => {
      validateSession();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        validateSession();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [session, validateSession]);

  // Revalidate session when route changes on non-public paths
  useEffect(() => {
    if (!session || !pathname) return;
    const isPublic = PUBLIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
    if (!isPublic) {
      validateSession();
    }
  }, [pathname, session, validateSession]);

  const setUser = (newUser: AuthenticatedUserSession | null) => {
    setSession(newUser);
  };

  const updateUser = (fields: Partial<AuthenticatedUserSession>) => {
    setSession((prev) => (prev ? { ...prev, ...fields } : null));
  };

  const invalidateSession = () => {
    setSession(null);
    dispatchUnauthenticatedEvent();
  };

  const value: AuthState = {
    isAuthenticated: !!session,
    user: session,
    role: session?.activeRoles?.[0] ?? null,
    setUser,
    updateUser,
    invalidateSession,
    revalidateSession: () => validateSession(true),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
