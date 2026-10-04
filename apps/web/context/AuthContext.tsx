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
import { usePathname, useRouter } from 'next/navigation';

export const AUTH_UNAUTHORIZED_EVENT = 'melon:unauthenticated';
export const AUTH_OUTAGE_EVENT = 'melon:backend-outage';

export function dispatchUnauthenticatedEvent() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT));
  }
}

export function dispatchOutageEvent() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_OUTAGE_EVENT));
  }
}

export const OUTAGE_CONSECUTIVE_FAILURE_LIMIT = 3;
export const OUTAGE_REQUEST_TIMEOUT_MS = 3500;
export const OUTAGE_HEARTBEAT_INTERVAL_MS = 25000;
export const OUTAGE_PROBE_INTERVAL_MS = 2000;

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
  isOutage: boolean;
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
  const [isOutage, setIsOutage] = useState<boolean>(false);
  const prevInitialSessionRef = useRef<AuthenticatedUserSession | null>(initialSession);
  const lastCheckedRef = useRef<number>(0);
  const consecutiveFailuresRef = useRef<number>(0);
  const activeEpochRef = useRef<number>(0);
  const probeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  const navigateToLogin = useCallback((targetUrl: string) => {
    if (typeof window !== 'undefined') {
      try {
        window.location.href = targetUrl;
      } catch {
        // jsdom navigation fallback in test environments
      }
    }
  }, []);

  const handleOutageDetected = useCallback(() => {
    activeEpochRef.current += 1;
    setIsOutage(true);
    setSession(null);
    if (probeTimerRef.current) {
      clearTimeout(probeTimerRef.current);
      probeTimerRef.current = null;
    }
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('kebun_melon_device_cache');
      } catch {
        // ignore
      }
    }
    dispatchOutageEvent();
    dispatchUnauthenticatedEvent();

    const currentPath = typeof window !== 'undefined' ? window.location.pathname : pathname || '/';
    const isPublic = PUBLIC_PATH_PREFIXES.some(
      (p) => currentPath === p || currentPath.startsWith(p)
    );
    if (!isPublic) {
      try {
        router.replace('/login?reason=outage');
      } catch {
        if (typeof window !== 'undefined') {
          try {
            window.location.href = '/login?reason=outage';
          } catch {
            // jsdom fallback
          }
        }
      }
    }
  }, [pathname, router]);

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

    const handleOutage = () => {
      setSession(null);
    };

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    window.addEventListener(AUTH_OUTAGE_EVENT, handleOutage);
    return () => {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
      window.removeEventListener(AUTH_OUTAGE_EVENT, handleOutage);
    };
  }, []);

  // Lightweight active session validation (non-blocking) with bounded timeout and outage detection
  const validateSession = useCallback(
    async (force = false) => {
      if (typeof window === 'undefined') return;
      if (!session) return;

      const epoch = activeEpochRef.current;
      // Minimum 2-second debounce between checks to avoid redundant network requests unless forced
      const now = Date.now();
      if (!force && consecutiveFailuresRef.current === 0 && now - lastCheckedRef.current < 2000)
        return;
      lastCheckedRef.current = now;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), OUTAGE_REQUEST_TIMEOUT_MS);

      try {
        const res = await fetch('/api/v1/auth/session', {
          method: 'GET',
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        if (epoch !== activeEpochRef.current) return;

        if (!res.ok) {
          // HTTP 401/403: Server is alive and explicitly rejected authentication
          if (res.status === 401 || res.status === 403) {
            consecutiveFailuresRef.current = 0;
            if (probeTimerRef.current) {
              clearTimeout(probeTimerRef.current);
              probeTimerRef.current = null;
            }
            setSession(null);
            dispatchUnauthenticatedEvent();
            const currentPath = window.location.pathname;
            const isPublic = PUBLIC_PATH_PREFIXES.some(
              (p) => currentPath === p || currentPath.startsWith(p)
            );
            if (!isPublic) {
              navigateToLogin(`/login?redirect=${encodeURIComponent(currentPath)}`);
            }
            return;
          }

          // HTTP 502/503/504: Gateway/Server outage
          if (res.status >= 500) {
            consecutiveFailuresRef.current += 1;
            if (consecutiveFailuresRef.current >= OUTAGE_CONSECUTIVE_FAILURE_LIMIT) {
              handleOutageDetected();
            } else {
              if (probeTimerRef.current) clearTimeout(probeTimerRef.current);
              probeTimerRef.current = setTimeout(() => {
                validateSession(true);
              }, OUTAGE_PROBE_INTERVAL_MS);
            }
            return;
          }

          return;
        }

        const json = await res.json();
        if (epoch !== activeEpochRef.current) return;

        if (
          json &&
          typeof json === 'object' &&
          'data' in json &&
          json.data &&
          typeof (json.data as Record<string, unknown>).authenticated === 'boolean'
        ) {
          if (!json.success || !(json.data as Record<string, unknown>).authenticated) {
            // Explicit invalidation response from alive backend
            consecutiveFailuresRef.current = 0;
            if (probeTimerRef.current) {
              clearTimeout(probeTimerRef.current);
              probeTimerRef.current = null;
            }
            setSession(null);
            dispatchUnauthenticatedEvent();
            const currentPath = window.location.pathname;
            const isPublic = PUBLIC_PATH_PREFIXES.some(
              (p) => currentPath === p || currentPath.startsWith(p)
            );
            if (!isPublic) {
              navigateToLogin(`/login?redirect=${encodeURIComponent(currentPath)}`);
            }
            return;
          }
        }

        // Successful validation response from alive backend: reset failures and probes
        consecutiveFailuresRef.current = 0;
        if (probeTimerRef.current) {
          clearTimeout(probeTimerRef.current);
          probeTimerRef.current = null;
        }
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        if (epoch !== activeEpochRef.current) return;

        // Network timeout (AbortError), connection refused, or DNS resolution failure
        consecutiveFailuresRef.current += 1;
        if (consecutiveFailuresRef.current >= OUTAGE_CONSECUTIVE_FAILURE_LIMIT) {
          handleOutageDetected();
        } else {
          if (probeTimerRef.current) clearTimeout(probeTimerRef.current);
          probeTimerRef.current = setTimeout(() => {
            validateSession(true);
          }, OUTAGE_PROBE_INTERVAL_MS);
        }
      }
    },
    [handleOutageDetected, navigateToLogin, session]
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

  // Periodic background heartbeat to detect backend outages while session is active
  useEffect(() => {
    if (typeof window === 'undefined' || !session) return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        validateSession();
      }
    }, OUTAGE_HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [session, validateSession]);

  // Revalidate session when route changes on non-public paths
  useEffect(() => {
    if (!session || !pathname) return;
    const isPublic = PUBLIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
    if (!isPublic) {
      validateSession();
    }
  }, [pathname, session, validateSession]);

  // Clean up probe timer on unmount
  useEffect(() => {
    return () => {
      if (probeTimerRef.current) {
        clearTimeout(probeTimerRef.current);
        probeTimerRef.current = null;
      }
    };
  }, []);

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
    isOutage,
    user: session,
    role: session?.activeRoles?.[0] ?? null,
    setUser,
    updateUser,
    invalidateSession,
    revalidateSession: () => validateSession(true),
  };

  const currentPath = typeof window !== 'undefined' ? window.location.pathname : pathname || '/';
  const isPublic = PUBLIC_PATH_PREFIXES.some((p) => currentPath === p || currentPath.startsWith(p));

  return (
    <AuthContext.Provider value={value}>
      {isOutage && !isPublic ? (
        <div className="bg-app-surface text-app-on-surface min-h-dvh flex flex-col justify-center items-center p-6">
          <div className="w-full max-w-md bg-app-surface-container-lowest p-8 border border-amber-500/30 rounded-2xl soft-elevation-lg text-center space-y-4 animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h2 className="text-[20px] font-bold text-app-on-surface" data-testid="outage-title">
              Koneksi Server Terputus
            </h2>
            <p className="text-[14px] text-app-on-surface-variant leading-relaxed">
              Tidak dapat terhubung ke server backend. Seluruh data dan sesi terlindungi telah
              dibersihkan demi keamanan data.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.location.href = '/login?reason=outage';
                  }
                }}
                className="w-full py-2.5 px-4 bg-app-primary text-app-on-primary text-[14px] font-semibold rounded-xl hover:opacity-90 transition-opacity cursor-pointer"
              >
                Buka Halaman Masuk
              </button>
            </div>
          </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
