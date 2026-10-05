'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { UserCheck, X, ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthContext';
import { useRealtimeMonitoring } from '@/hooks/use-realtime-monitoring';
import { APPROVALS_UPDATED_EVENT } from '@/hooks/useAdminApprovalBadge';

interface ApprovalToastData {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  requestedAt: string;
}

export default function AdminApprovalToastNotifier() {
  const { role, isAuthenticated } = useAuth();
  const tNav = useTranslations('navigation');
  const tCommon = useTranslations('common');

  const [toast, setToast] = useState<ApprovalToastData | null>(null);
  const seenEventKeysRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const isOwner = isAuthenticated && role === 'OWNER';

  const clearCurrentToast = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setToast(null);
  }, []);

  const handleRealtimeEvent = useCallback(
    (name: string, data: any) => {
      if (!isOwner || !data) return;

      if (name === 'admin.approval.requested') {
        const userId = data.userId || data.id;
        const fullName = data.fullName || 'Admin Applicant';
        const email = data.email || '';
        const requestedAt = data.requestedAt || new Date().toISOString();

        if (!userId) return;

        // Deduplicate events to prevent repeated toasts for the same request
        const eventKey = `${userId}:${requestedAt.substring(0, 16)}`;
        if (seenEventKeysRef.current.has(eventKey)) {
          return;
        }
        seenEventKeysRef.current.add(eventKey);

        // Update badge count immediately
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(APPROVALS_UPDATED_EVENT));
        }

        // Set and show toast
        setToast({
          id: eventKey,
          userId,
          fullName,
          email,
          requestedAt,
        });

        // Auto-dismiss after 8 seconds
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(() => {
          setToast(null);
        }, 8000);
      } else if (name === 'admin.approval.decided') {
        // If an approval or rejection happened, sync badge count
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(APPROVALS_UPDATED_EVENT));
        }

        // Dismiss toast if target is the same user
        if (data.userId && toast?.userId === data.userId) {
          clearCurrentToast();
        }
      }
    },
    [isOwner, toast?.userId, clearCurrentToast]
  );

  useRealtimeMonitoring({
    channels: ['approvals'],
    enabled: isOwner,
    onEvent: handleRealtimeEvent,
  });

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  if (!toast || !isOwner) {
    return null;
  }

  return (
    <aside
      aria-label="Admin Approval Request Notification"
      aria-live="assertive"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[94%] sm:w-auto sm:min-w-[420px] max-w-lg animate-in fade-in slide-in-from-top-4 duration-200"
      data-testid="admin-approval-toast"
    >
      <div className="bg-app-surface-container-lowest border border-amber-500/40 rounded-2xl shadow-xl p-4 flex items-start gap-3.5 text-app-on-surface">
        <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/60 flex-shrink-0 mt-0.5">
          <UserCheck size={18} />
        </div>

        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-full border border-amber-200">
              {tNav('approvals')}
            </span>
          </div>
          <h4 className="text-xs font-bold text-app-on-surface mt-1 truncate">{toast.fullName}</h4>
          <p className="text-[11px] text-app-on-surface-variant font-mono truncate">
            {toast.email}
          </p>

          <div className="mt-2.5 flex items-center gap-2">
            <Link
              href="/approvals"
              onClick={clearCurrentToast}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-app-primary text-white rounded-lg text-xs font-semibold hover:bg-app-primary-hover transition-colors shadow-sm"
              data-testid="btn-toast-review"
            >
              <span>{tCommon('view')}</span>
              <ExternalLink size={12} />
            </Link>

            <button
              type="button"
              onClick={clearCurrentToast}
              className="px-2.5 py-1 text-app-on-surface-variant hover:text-app-on-surface text-xs rounded-lg hover:bg-app-surface-container transition-colors"
            >
              {tCommon('close')}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={clearCurrentToast}
          className="p-1 text-app-on-surface-variant hover:text-app-on-surface rounded-lg hover:bg-app-surface-container transition-colors flex-shrink-0"
          aria-label={tCommon('close')}
        >
          <X size={15} />
        </button>
      </div>
    </aside>
  );
}
