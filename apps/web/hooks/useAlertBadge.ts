'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AlertStatus } from '@kebun-melon/contracts';

export const ALERT_UPDATED_EVENT = 'melon:alert-updated';

// Module-level shared state across all hook instances (e.g. TopAppBar, Sidebar)
let sharedCount: number = 0;
let sharedIsLoading: boolean = false;
let lastFetchTimestamp: number = 0;
let inFlightPromise: Promise<number> | null = null;
let rateLimitBlockedUntil: number = 0;
const subscribers = new Set<(count: number, isLoading: boolean) => void>();

function notifySubscribers() {
  subscribers.forEach((callback) => {
    try {
      callback(sharedCount, sharedIsLoading);
    } catch {
      // Ignore subscriber error
    }
  });
}

export function setSharedAlertCount(newCount: number) {
  sharedCount = Math.max(0, newCount);
  lastFetchTimestamp = Date.now();
  notifySubscribers();
}

export function resetAlertBadgeState() {
  sharedCount = 0;
  sharedIsLoading = false;
  lastFetchTimestamp = 0;
  inFlightPromise = null;
  rateLimitBlockedUntil = 0;
  notifySubscribers();
}

function isNotificationsPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return (
    pathname === '/notifications' ||
    pathname.startsWith('/notifications/') ||
    pathname === '/notifikasi' ||
    pathname.startsWith('/notifikasi/')
  );
}

export function useAlertBadge() {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  const [count, setCount] = useState<number>(sharedCount);
  const [isLoading, setIsLoading] = useState<boolean>(sharedIsLoading);

  // Subscribe to module-level shared count & loading state
  useEffect(() => {
    const handleUpdate = (newCount: number, newLoading: boolean) => {
      setCount(newCount);
      setIsLoading(newLoading);
    };

    subscribers.add(handleUpdate);
    setCount(sharedCount);
    setIsLoading(sharedIsLoading);

    return () => {
      subscribers.delete(handleUpdate);
    };
  }, []);

  const fetchBadgeCount = useCallback(
    async (force = false): Promise<number> => {
      if (!isAuthenticated) {
        setSharedAlertCount(0);
        return 0;
      }

      // If user is currently on /notifications, the notifications page manages alert state directly.
      // Do not duplicate requests to /api/v1/alerts unless forced by an explicit trigger.
      if (isNotificationsPath(pathname) && !force) {
        return sharedCount;
      }

      // Rate limit backoff protection: respect HTTP 429 block window
      const now = Date.now();
      if (now < rateLimitBlockedUntil) {
        return sharedCount;
      }

      // TTL Cache: Reuse cached count if fetched within 10 seconds unless force requested
      if (!force && now - lastFetchTimestamp < 10000) {
        return sharedCount;
      }

      // Deduplicate concurrent in-flight requests across all hook instances
      if (inFlightPromise) {
        return inFlightPromise;
      }

      sharedIsLoading = true;
      notifySubscribers();

      inFlightPromise = (async () => {
        try {
          // Query canonical unacknowledged OPEN alerts
          const res = await fetch(`/api/v1/alerts?status=${AlertStatus.OPEN}&pageSize=100`, {
            cache: 'no-store',
          });

          // Handle rate limit (HTTP 429) gracefully with cooldown backoff
          if (res.status === 429) {
            const retryHeader = res.headers.get('Retry-After');
            const retrySec = retryHeader ? parseInt(retryHeader, 10) : 30;
            rateLimitBlockedUntil =
              Date.now() + (isNaN(retrySec) ? 30 : Math.max(5, retrySec)) * 1000;
            return sharedCount;
          }

          if (!res.ok) {
            return sharedCount;
          }

          const json = await res.json();
          if (json.success) {
            const total = json.meta?.pagination?.totalItems;
            let resultCount = 0;
            if (typeof total === 'number') {
              resultCount = total;
            } else {
              const items = Array.isArray(json.data)
                ? json.data
                : Array.isArray(json.data?.items)
                  ? json.data.items
                  : [];
              resultCount = items.length;
            }

            sharedCount = resultCount;
            lastFetchTimestamp = Date.now();
            return sharedCount;
          }
          return sharedCount;
        } catch {
          // Graceful fallback on network or transient error; preserve existing count
          return sharedCount;
        } finally {
          inFlightPromise = null;
          sharedIsLoading = false;
          notifySubscribers();
        }
      })();

      return inFlightPromise;
    },
    [isAuthenticated, pathname]
  );

  // Single unified effect for initial mount and route changes (eliminates duplicate mount effect)
  useEffect(() => {
    if (isAuthenticated && !isNotificationsPath(pathname)) {
      fetchBadgeCount();
    }
  }, [pathname, isAuthenticated, fetchBadgeCount]);

  // Periodic polling (30s) and window focus/visibility synchronization with debounce & cooldown
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Periodic poll every 30 seconds (only when document is visible and not on /notifications)
    const pollInterval = setInterval(() => {
      if (
        document.visibilityState === 'visible' &&
        isAuthenticated &&
        !isNotificationsPath(pathname) &&
        Date.now() - lastFetchTimestamp >= 25000 &&
        Date.now() >= rateLimitBlockedUntil
      ) {
        fetchBadgeCount();
      }
    }, 30000);

    // Coalesce focus and visibility change events with a 15-second cooldown
    const handleFocusOrVisible = () => {
      if (
        document.visibilityState === 'visible' &&
        isAuthenticated &&
        !isNotificationsPath(pathname) &&
        Date.now() - lastFetchTimestamp >= 15000 &&
        Date.now() >= rateLimitBlockedUntil
      ) {
        fetchBadgeCount();
      }
    };

    const handleAlertUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ count?: number }>;
      if (typeof customEvent.detail?.count === 'number') {
        // Direct synchronization without network fetch
        setSharedAlertCount(customEvent.detail.count);
      } else if (!isNotificationsPath(pathname)) {
        fetchBadgeCount(true);
      }
    };

    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);
    window.addEventListener(ALERT_UPDATED_EVENT, handleAlertUpdated);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
      window.removeEventListener(ALERT_UPDATED_EVENT, handleAlertUpdated);
    };
  }, [isAuthenticated, pathname, fetchBadgeCount]);

  return {
    count,
    isLoading,
    refetch: (force?: boolean) => fetchBadgeCount(force ?? true),
  };
}
