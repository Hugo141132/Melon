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
export const SESSION_STORAGE_SYNC_KEY = 'melon_session_sync';
export const SESSION_ACTIVITY_SYNC_KEY = 'melon_session_activity';

export function dispatchUnauthenticatedEvent(reason: string = 'unauthorized') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT, { detail: { reason } }));
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
export const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
export const DEFAULT_ABSOLUTE_LIFETIME_MS = 8 * 60 * 60 * 1000; // 8 hours

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

  // Shared session-expiry deadline tracking
  const absoluteExpiryRef = useRef<number | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const mountTimestampRef = useRef<number>(Date.now());
  const currentSessionIdRef = useRef<string | null>(null);
  const idleTimeoutMsRef = useRef<number>(DEFAULT_IDLE_TIMEOUT_MS);
  const deadlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTerminatingRef = useRef<boolean>(false);

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

  const handleSessionExpired = useCallback(
    (reason: string = 'expired') => {
      if (isTerminatingRef.current) return;
      isTerminatingRef.current = true;
      activeEpochRef.current += 1;

      // Clear any pending timers
      if (deadlineTimerRef.current) {
        clearTimeout(deadlineTimerRef.current);
        deadlineTimerRef.current = null;
      }
      if (probeTimerRef.current) {
        clearTimeout(probeTimerRef.current);
        probeTimerRef.current = null;
      }

      // Immediately clear in-memory session and cache
      setSession(null);
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem('kebun_melon_device_cache');
          // Coordinate same-session tabs via localStorage broadcast
          localStorage.setItem(
            SESSION_STORAGE_SYNC_KEY,
            JSON.stringify({ type: 'session_expired', timestamp: Date.now() })
          );
        } catch {
          // ignore
        }
      }

      dispatchUnauthenticatedEvent(reason);

      // Best-effort non-blocking server logout with 2s timeout
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        fetch('/api/v1/auth/logout', {
          method: 'POST',
          credentials: 'same-origin',
          signal: controller.signal,
        })
          .catch(() => {})
          .finally(() => clearTimeout(timeoutId));
      } catch {
        // ignore
      }

      const currentPath =
        typeof window !== 'undefined' ? window.location.pathname : pathname || '/';
      const isPublic = PUBLIC_PATH_PREFIXES.some(
        (p) => currentPath === p || currentPath.startsWith(p)
      );
      if (!isPublic) {
        navigateToLogin(`/login?redirect=${encodeURIComponent(currentPath)}`);
      }
    },
    [navigateToLogin, pathname]
  );

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
    dispatchUnauthenticatedEvent('outage');

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

  // Reschedule the single deadline timer to the earliest expiry
  const scheduleNextDeadlineCheck = useCallback(() => {
    if (typeof window === 'undefined' || !session || isTerminatingRef.current) return;

    if (deadlineTimerRef.current) {
      clearTimeout(deadlineTimerRef.current);
      deadlineTimerRef.current = null;
    }

    const now = Date.now();
    const idleDeadline = lastActivityRef.current + idleTimeoutMsRef.current;
    const absDeadline = absoluteExpiryRef.current ?? Infinity;
    const earliestDeadline = Math.min(idleDeadline, absDeadline);

    if (now >= earliestDeadline) {
      handleSessionExpired('deadline_exceeded');
      return;
    }

    const delay = Math.max(1000, earliestDeadline - now);
    deadlineTimerRef.current = setTimeout(() => {
      // Re-evaluate on trigger
      const currentNow = Date.now();
      const currentIdleDeadline = lastActivityRef.current + idleTimeoutMsRef.current;
      const currentAbsDeadline = absoluteExpiryRef.current ?? Infinity;
      if (currentNow >= Math.min(currentIdleDeadline, currentAbsDeadline)) {
        handleSessionExpired('deadline_exceeded');
      } else {
        scheduleNextDeadlineCheck();
      }
    }, delay);
  }, [handleSessionExpired, session]);

  // Lightweight active session validation (non-blocking) with bounded timeout and outage detection
  const validateSession = useCallback(
    async (force = false, isBackground = false) => {
      if (typeof window === 'undefined') return;
      if (!session || isTerminatingRef.current) return;

      const epoch = activeEpochRef.current;
      // Minimum 2-second debounce between checks to avoid redundant network requests unless forced
      const now = Date.now();
      if (!force && consecutiveFailuresRef.current === 0 && now - lastCheckedRef.current < 2000)
        return;
      lastCheckedRef.current = now;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), OUTAGE_REQUEST_TIMEOUT_MS);

      try {
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (isBackground) {
          headers['x-background-check'] = '1';
        }

        const res = await fetch('/api/v1/auth/session', {
          method: 'GET',
          headers,
          credentials: 'same-origin',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        if (epoch !== activeEpochRef.current || isTerminatingRef.current) return;

        if (!res.ok) {
          // HTTP 401/403: Server is alive and explicitly rejected authentication
          if (res.status === 401 || res.status === 403) {
            consecutiveFailuresRef.current = 0;
            handleSessionExpired('unauthorized');
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
                validateSession(true, isBackground);
              }, OUTAGE_PROBE_INTERVAL_MS);
            }
            return;
          }

          return;
        }

        const json = await res.json();
        if (epoch !== activeEpochRef.current || isTerminatingRef.current) return;

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
            handleSessionExpired('invalid_session');
            return;
          }

          // Parse server session deadlines if returned
          const sessionMeta = (json.data as any).session;
          if (sessionMeta) {
            if (sessionMeta.id && typeof sessionMeta.id === 'string') {
              currentSessionIdRef.current = sessionMeta.id;
            }
            if (sessionMeta.expiresAt) {
              const absTime = new Date(sessionMeta.expiresAt).getTime();
              if (!isNaN(absTime)) {
                absoluteExpiryRef.current = absTime;
              }
            }
            if (sessionMeta.idleTimeoutMs) {
              idleTimeoutMsRef.current = sessionMeta.idleTimeoutMs;
            }
            scheduleNextDeadlineCheck();
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
        if (epoch !== activeEpochRef.current || isTerminatingRef.current) return;

        // Network timeout (AbortError), connection refused, or DNS resolution failure
        consecutiveFailuresRef.current += 1;
        if (consecutiveFailuresRef.current >= OUTAGE_CONSECUTIVE_FAILURE_LIMIT) {
          handleOutageDetected();
        } else {
          if (probeTimerRef.current) clearTimeout(probeTimerRef.current);
          probeTimerRef.current = setTimeout(() => {
            validateSession(true, isBackground);
          }, OUTAGE_PROBE_INTERVAL_MS);
        }
      }
    },
    [handleOutageDetected, handleSessionExpired, scheduleNextDeadlineCheck, session]
  );

  // User activity tracker: throttled to 30s to avoid excessive work and bounded overhead
  useEffect(() => {
    if (typeof window === 'undefined' || !session) return;

    let lastThrottled = Date.now();
    const onUserActivity = () => {
      const now = Date.now();
      lastActivityRef.current = now;
      if (now - lastThrottled > 30000) {
        lastThrottled = now;
        scheduleNextDeadlineCheck();

        // 1. Broadcast Tab A user activity to other tabs via localStorage (non-secret session identifier and timestamp)
        if (typeof window !== 'undefined' && session && session.id) {
          try {
            const broadcastSessionId = currentSessionIdRef.current || session.id;
            localStorage.setItem(
              SESSION_ACTIVITY_SYNC_KEY,
              JSON.stringify({
                timestamp: now,
                sessionId: broadcastSessionId,
              })
            );
          } catch {
            // ignore storage quota errors
          }
        }

        // 2. Authoritative server touch (force=true, isBackground=false to touch lastSeenAt)
        void validateSession(true, false);
      }
    };

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const;
    events.forEach((evt) => window.addEventListener(evt, onUserActivity, { passive: true }));

    scheduleNextDeadlineCheck();

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, onUserActivity));
    };
  }, [scheduleNextDeadlineCheck, session, validateSession]);

  // Synchronize multi-tab session invalidation and activity reconciliation via localStorage storage event
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onStorage = (e: StorageEvent) => {
      if (e.key === SESSION_STORAGE_SYNC_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed.type === 'session_expired') {
            handleSessionExpired('multi_tab_sync');
          }
        } catch {
          // ignore
        }
      } else if (e.key === SESSION_ACTIVITY_SYNC_KEY && e.newValue) {
        try {
          // 1. Require authenticated current session with valid, non-empty, non-secret ID
          if (!session || typeof session.id !== 'string' || session.id.trim() === '') {
            return;
          }

          const parsed = JSON.parse(e.newValue);
          if (!parsed || typeof parsed !== 'object') {
            return;
          }

          // 2. Require matching, nonempty, non-secret session identifier
          if (typeof parsed.sessionId !== 'string' || parsed.sessionId.trim() === '') {
            return;
          }
          const expectedSessionId = currentSessionIdRef.current || session.id;
          if (parsed.sessionId !== expectedSessionId && parsed.sessionId !== session.id) {
            return;
          }

          // 3. Validate timestamp: must be finite, not before mount, not unreasonably in future (+60s tolerance)
          const ts = Number(parsed.timestamp);
          const now = Date.now();
          if (
            !Number.isFinite(ts) ||
            isNaN(ts) ||
            ts < mountTimestampRef.current ||
            ts > now + 60000
          ) {
            return;
          }

          // 4. Reconcile deadline: local broadcast updates activity timestamp, but must enforce absolute expiry
          const absDeadline = absoluteExpiryRef.current ?? Infinity;
          if (now >= absDeadline) {
            handleSessionExpired('deadline_exceeded');
            return;
          }

          // 5. Update local activity deadline and reschedule
          lastActivityRef.current = Math.max(lastActivityRef.current, ts);
          scheduleNextDeadlineCheck();

          // 6. Reconcile with server-confirmed activity:
          // A local broadcast must NOT override server expiry or a rejected activity request.
          // Trigger a server session check so if the server expired/rejected the session, it is invalidated immediately.
          void validateSession(false, true);
        } catch {
          // ignore malformed JSON or storage parsing errors
        }
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [handleSessionExpired, scheduleNextDeadlineCheck, session, validateSession]);

  // Revalidate session when window gains focus, document visibility changes, or pageshow (BFCache resume)
  useEffect(() => {
    if (typeof window === 'undefined' || !session) return;

    const onFocus = () => {
      scheduleNextDeadlineCheck();
      validateSession(false, true);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleNextDeadlineCheck();
        validateSession(false, true);
      }
    };

    const onPageShow = () => {
      scheduleNextDeadlineCheck();
      validateSession(true, true);
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pageshow', onPageShow);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [scheduleNextDeadlineCheck, session, validateSession]);

  // Periodic background heartbeat to detect backend outages and verify session without extending lastSeenAt
  useEffect(() => {
    if (typeof window === 'undefined' || !session) return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        validateSession(false, true);
      }
    }, OUTAGE_HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [session, validateSession]);

  // Revalidate session when route changes on non-public paths
  useEffect(() => {
    if (!session || !pathname) return;
    const isPublic = PUBLIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
    if (!isPublic) {
      validateSession(false, false);
    }
  }, [pathname, session, validateSession]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (probeTimerRef.current) {
        clearTimeout(probeTimerRef.current);
        probeTimerRef.current = null;
      }
      if (deadlineTimerRef.current) {
        clearTimeout(deadlineTimerRef.current);
        deadlineTimerRef.current = null;
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
