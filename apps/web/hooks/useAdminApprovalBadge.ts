'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export const APPROVALS_UPDATED_EVENT = 'melon:approvals-updated';

export function useAdminApprovalBadge() {
  const { isAuthenticated, role } = useAuth();
  const pathname = usePathname();
  const [count, setCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const isFetchingRef = useRef<boolean>(false);

  const isOwner = role === 'OWNER';

  const fetchBadgeCount = useCallback(async () => {
    if (!isAuthenticated || !isOwner) {
      setCount(0);
      setIsLoading(false);
      return;
    }

    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsLoading(true);

    try {
      // Query pending approvals count using pageSize=1
      const res = await fetch('/api/v1/approvals/pending?pageSize=1', {
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
          const items = Array.isArray(json.data) ? json.data : [];
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
  }, [isAuthenticated, isOwner]);

  // Initial and authentication-triggered fetch
  useEffect(() => {
    fetchBadgeCount();
  }, [fetchBadgeCount]);

  // Route transition triggered fetch
  useEffect(() => {
    if (isAuthenticated && isOwner) {
      fetchBadgeCount();
    }
  }, [pathname, isAuthenticated, isOwner, fetchBadgeCount]);

  // Periodic poll and event listeners for real-time synchronization
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const pollInterval = setInterval(() => {
      if (isAuthenticated && isOwner) {
        fetchBadgeCount();
      }
    }, 30000);

    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'visible' && isAuthenticated && isOwner) {
        fetchBadgeCount();
      }
    };

    const handleApprovalsUpdated = () => {
      fetchBadgeCount();
    };

    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);
    window.addEventListener(APPROVALS_UPDATED_EVENT, handleApprovalsUpdated);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
      window.removeEventListener(APPROVALS_UPDATED_EVENT, handleApprovalsUpdated);
    };
  }, [isAuthenticated, isOwner, fetchBadgeCount]);

  return {
    count,
    isLoading,
    refetch: fetchBadgeCount,
  };
}
