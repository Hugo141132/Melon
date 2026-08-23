'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AlertSeverity, AlertStatus } from '@kebun-melon/contracts';

export const ALERT_UPDATED_EVENT = 'melon:alert-updated';

export function useAlertBadge() {
  const { isAuthenticated } = useAuth();
  const [count, setCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchBadgeCount = useCallback(async () => {
    if (!isAuthenticated) {
      setCount(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Query canonical OPEN + CRITICAL alerts
      const res = await fetch(
        `/api/v1/alerts?status=${AlertStatus.OPEN}&severity=${AlertSeverity.CRITICAL}&pageSize=100`
      );
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
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchBadgeCount();
  }, [fetchBadgeCount]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleAlertUpdated = () => {
      fetchBadgeCount();
    };

    window.addEventListener(ALERT_UPDATED_EVENT, handleAlertUpdated);
    return () => {
      window.removeEventListener(ALERT_UPDATED_EVENT, handleAlertUpdated);
    };
  }, [fetchBadgeCount]);

  return {
    count,
    isLoading,
    refetch: fetchBadgeCount,
  };
}
