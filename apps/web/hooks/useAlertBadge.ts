'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AlertStatus } from '@kebun-melon/contracts';

export const ALERT_UPDATED_EVENT = 'melon:alert-updated';

export function useAlertBadge() {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  const [count, setCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const isFetchingRef = useRef<boolean>(false);

  const fetchBadgeCount = useCallback(async () => {
    if (!isAuthenticated) {
      setCount(0);
      setIsLoading(false);
      return;
    }

    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsLoading(true);

    try {
      // Query canonical unacknowledged OPEN alerts (including warnings and critical alerts)
      const res = await fetch(`/api/v1/alerts?status=${AlertStatus.OPEN}&pageSize=100`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        setCount(0);
        return;
      }

      const json = await res.json();
      if (json.success) {
        const total = json.meta?.pagination?.totalItems;
        if (typeof total === 'number') {
          setCount(total);
        } else {
          const items = Array.isArray(json.data)
            ? json.data
            : Array.isArray(json.data?.items)
              ? json.data.items
              : [];
          setCount(items.length);
        }
      }
    } catch {
      // Graceful fallback on network or transient error
      setCount(0);
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Initial and authentication-triggered fetch
  useEffect(() => {
    fetchBadgeCount();
  }, [fetchBadgeCount]);

  // Route transition triggered fetch
  useEffect(() => {
    if (isAuthenticated) {
      fetchBadgeCount();
    }
  }, [pathname, isAuthenticated, fetchBadgeCount]);

  // Active polling (every 15s) and window focus/visibility synchronization
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Periodic poll every 15 seconds to catch asynchronous alerts (e.g. command timeouts)
    const pollInterval = setInterval(() => {
      if (isAuthenticated) {
        fetchBadgeCount();
      }
    }, 15000);

    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'visible' && isAuthenticated) {
        fetchBadgeCount();
      }
    };

    const handleAlertUpdated = () => {
      fetchBadgeCount();
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
  }, [isAuthenticated, fetchBadgeCount]);

  return {
    count,
    isLoading,
    refetch: fetchBadgeCount,
  };
}
