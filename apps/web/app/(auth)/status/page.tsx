'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  UserX,
  Clock3,
  LogOut,
  HelpCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { LucideIcon } from 'lucide-react';

interface AccountStatusMeta {
  icon: LucideIcon;
  iconColor: string;
  badgeBg: string;
  badgeKey: string;
  titleKey: string;
  descriptionKey: string;
  actionType: 'login' | 'logout' | 'support';
}

const STATUS_META: Record<string, AccountStatusMeta> = {
  PENDING_APPROVAL: {
    icon: Clock,
    iconColor: 'text-amber-600',
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
    badgeKey: 'pendingApprovalBadge',
    titleKey: 'pendingTitle',
    descriptionKey: 'pendingApproval',
    actionType: 'logout',
  },
  APPROVED: {
    icon: CheckCircle2,
    iconColor: 'text-emerald-600',
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    badgeKey: 'approved',
    titleKey: 'approvedTitle',
    descriptionKey: 'approved',
    actionType: 'support',
  },
  REJECTED: {
    icon: XCircle,
    iconColor: 'text-rose-600',
    badgeBg: 'bg-rose-100 text-rose-800 border-rose-200',
    badgeKey: 'rejectedBadge',
    titleKey: 'rejectedTitle',
    descriptionKey: 'rejected',
    actionType: 'support',
  },
  SUSPENDED: {
    icon: AlertOctagon,
    iconColor: 'text-orange-600',
    badgeBg: 'bg-orange-100 text-orange-800 border-orange-200',
    badgeKey: 'suspendedBadge',
    titleKey: 'suspendedTitle',
    descriptionKey: 'suspended',
    actionType: 'support',
  },
  DEACTIVATED: {
    icon: UserX,
    iconColor: 'text-slate-600',
    badgeBg: 'bg-slate-100 text-slate-800 border-slate-200',
    badgeKey: 'deactivatedBadge',
    titleKey: 'deactivatedTitle',
    descriptionKey: 'deactivated',
    actionType: 'support',
  },
  EXPIRED: {
    icon: Clock3,
    iconColor: 'text-blue-600',
    badgeBg: 'bg-blue-100 text-blue-800 border-blue-200',
    badgeKey: 'expiredTitle',
    titleKey: 'expiredTitle',
    descriptionKey: 'expiredTitle',
    actionType: 'login',
  },
};

function StatusContent() {
  const searchParams = useSearchParams();
  const rawReason = searchParams.get('reason') || searchParams.get('status') || 'PENDING_APPROVAL';

  const tAuth = useTranslations('auth');
  const tCommon = useTranslations('common');

  const normalizedReason = rawReason.toUpperCase();
  const meta = STATUS_META[normalizedReason] || STATUS_META['PENDING_APPROVAL'];

  const [loading, setLoading] = useState(true);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const fetchSessionStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/session');
      const json = await res.json();
      if (json.success && json.data.authenticated && json.data.user) {
        setCurrentStatus(json.data.user.accountStatus);
      } else {
        setCurrentStatus(null);
      }
    } catch {
      setCurrentStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionStatus();
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } catch {
      // Ignore network error during logout cleanup
    } finally {
      window.location.href = '/login';
    }
  };

  const IconComponent = meta.icon;

  return (
    <div className="bg-surface text-on-surface min-h-dvh flex flex-col justify-center items-center p-[24px]">
      <main className="w-full max-w-md bg-surface-container-lowest bento-shape p-[32px] shadow-sm border border-outline-variant text-center">
        {/* Status Badge */}
        <div className="inline-flex items-center justify-center mb-6">
          <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${meta.badgeBg}`}>
            {tAuth(meta.badgeKey as any)}
          </span>
        </div>

        {/* Status Icon */}
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-surface rounded-2xl border border-outline-variant">
            <IconComponent size={48} className={meta.iconColor} />
          </div>
        </div>

        {/* Title & Description */}
        <h1 className="text-[24px] leading-[32px] font-bold text-primary mb-3">
          {tAuth(meta.titleKey as any)}
        </h1>
        <p className="text-[16px] leading-[24px] text-on-surface-variant mb-8">
          {tAuth(meta.descriptionKey as any)}
        </p>

        {/* Re-check status info if active session detected */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 text-sm text-outline mb-6">
            <Loader2 size={16} className="animate-spin" />
            <span>{tAuth('checkingStatus')}</span>
          </div>
        ) : currentStatus && currentStatus !== normalizedReason ? (
          <div className="mb-6 p-3 bg-surface rounded-xl border border-outline-variant text-sm text-on-surface-variant flex items-center justify-between">
            <span>
              {tAuth('serverStatus')} <strong>{currentStatus}</strong>
            </span>
            <button
              onClick={fetchSessionStatus}
              className="p-1 text-secondary hover:text-primary transition-colors cursor-pointer"
              title={tCommon('refresh')}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        ) : null}

        {/* Action Buttons */}
        <div className="space-y-3">
          {meta.actionType === 'login' && (
            <Link
              href="/login"
              className="w-full h-[48px] bg-primary text-on-primary rounded-xl text-[16px] font-semibold hover:bg-primary-container hover:text-on-primary-container transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              {tAuth('relogin')}
            </Link>
          )}

          {meta.actionType === 'logout' && (
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full h-[48px] bg-outline-variant/30 text-on-surface hover:bg-outline-variant/50 rounded-xl text-[16px] font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {loggingOut ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>{tAuth('loggingOut')}</span>
                </>
              ) : (
                <>
                  <LogOut size={18} />
                  <span>{tAuth('logout')}</span>
                </>
              )}
            </button>
          )}

          {meta.actionType === 'support' && (
            <div className="space-y-3">
              <a
                href="mailto:support@kebunmelon.com"
                className="w-full h-[48px] bg-primary text-on-primary rounded-xl text-[16px] font-semibold hover:bg-primary-container hover:text-on-primary-container transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <HelpCircle size={18} />
                <span>{tAuth('contactSupport')}</span>
              </a>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full h-[48px] bg-surface text-on-surface-variant hover:bg-outline-variant/30 rounded-xl text-[14px] font-medium transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut size={16} />
                <span>{tAuth('backToLogin')}</span>
              </button>
            </div>
          )}
        </div>
      </main>

      <footer className="mt-[32px] text-center">
        <p className="text-[14px] leading-[20px] text-outline">
          Kebun Melon System &bull; Secure Account Access Guard
        </p>
      </footer>
    </div>
  );
}

export default function AccountStatusPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-surface min-h-dvh flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
      }
    >
      <StatusContent />
    </Suspense>
  );
}
