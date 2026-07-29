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

import type { LucideIcon } from 'lucide-react';

interface AccountStatusConfig {
  icon: LucideIcon;
  iconColor: string;
  badgeBg: string;
  badgeText: string;
  titleKey: string;
  titleDefault: string;
  descriptionKey: string;
  descriptionDefault: string;
  actionType: 'login' | 'logout' | 'support';
}

const STATUS_CONFIGS: Record<string, AccountStatusConfig> = {
  PENDING_APPROVAL: {
    icon: Clock,
    iconColor: 'text-amber-600',
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
    badgeText: 'Menunggu Persetujuan',
    titleKey: 'status.pending.title',
    titleDefault: 'Akun Menunggu Persetujuan Owner',
    descriptionKey: 'status.pending.description',
    descriptionDefault:
      'Pendaftaran akun Admin Anda telah berhasil dikirim. Mohon tunggu hingga Owner menyetujui akun Anda sebelum dapat mengakses sistem.',
    actionType: 'logout',
  },
  APPROVED: {
    icon: CheckCircle2,
    iconColor: 'text-emerald-600',
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    badgeText: 'Disetujui',
    titleKey: 'status.approved.title',
    titleDefault: 'Akun Disetujui (Belum Aktif)',
    descriptionKey: 'status.approved.description',
    descriptionDefault:
      'Akun Anda telah disetujui tetapi membutuhkan aktivasi lebih lanjut. Silakan hubungi Administrator atau Owner.',
    actionType: 'support',
  },
  REJECTED: {
    icon: XCircle,
    iconColor: 'text-rose-600',
    badgeBg: 'bg-rose-100 text-rose-800 border-rose-200',
    badgeText: 'Pendaftaran Ditolak',
    titleKey: 'status.rejected.title',
    titleDefault: 'Pendaftaran Akun Ditolak',
    descriptionKey: 'status.rejected.description',
    descriptionDefault:
      'Permohonan pendaftaran akun Anda tidak disetujui oleh Owner. Silakan hubungi Owner jika ada pertanyaan.',
    actionType: 'support',
  },
  SUSPENDED: {
    icon: AlertOctagon,
    iconColor: 'text-orange-600',
    badgeBg: 'bg-orange-100 text-orange-800 border-orange-200',
    badgeText: 'Akun Ditangguhkan',
    titleKey: 'status.suspended.title',
    titleDefault: 'Akses Akun Ditangguhkan',
    descriptionKey: 'status.suspended.description',
    descriptionDefault:
      'Akses akun Anda telah ditangguhkan sementara oleh Owner. Silakan hubungi dukungan atau Owner untuk pemulihan.',
    actionType: 'support',
  },
  DEACTIVATED: {
    icon: UserX,
    iconColor: 'text-slate-600',
    badgeBg: 'bg-slate-100 text-slate-800 border-slate-200',
    badgeText: 'Akun Dinonaktifkan',
    titleKey: 'status.deactivated.title',
    titleDefault: 'Akun Nonaktif',
    descriptionKey: 'status.deactivated.description',
    descriptionDefault:
      'Akun ini telah dinonaktifkan secara permanen. Anda tidak lagi dapat mengakses fitur sistem.',
    actionType: 'support',
  },
  EXPIRED: {
    icon: Clock3,
    iconColor: 'text-blue-600',
    badgeBg: 'bg-blue-100 text-blue-800 border-blue-200',
    badgeText: 'Sesi Berakhir',
    titleKey: 'status.expired.title',
    titleDefault: 'Sesi Selesai / Kadaluwarsa',
    descriptionKey: 'status.expired.description',
    descriptionDefault:
      'Sesi masuk Anda telah berakhir demi alasan keamanan. Silakan masuk kembali untuk melanjutkan.',
    actionType: 'login',
  },
};

function StatusContent() {
  const searchParams = useSearchParams();
  const rawReason = searchParams.get('reason') || searchParams.get('status') || 'PENDING_APPROVAL';

  const normalizedReason = rawReason.toUpperCase();
  const config = STATUS_CONFIGS[normalizedReason] || STATUS_CONFIGS['PENDING_APPROVAL'];

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
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network error during logout cleanup
    } finally {
      window.location.href = '/login';
    }
  };

  const IconComponent = config.icon;

  return (
    <div className="bg-surface text-on-surface min-h-dvh flex flex-col justify-center items-center p-[24px]">
      <main className="w-full max-w-md bg-surface-container-lowest bento-shape p-[32px] shadow-sm border border-outline-variant text-center">
        {/* Status Badge */}
        <div className="inline-flex items-center justify-center mb-6">
          <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${config.badgeBg}`}>
            {config.badgeText}
          </span>
        </div>

        {/* Status Icon */}
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-surface rounded-2xl border border-outline-variant">
            <IconComponent size={48} className={config.iconColor} />
          </div>
        </div>

        {/* Title & Description */}
        <h1 className="text-[24px] leading-[32px] font-bold text-primary mb-3">
          {config.titleDefault}
        </h1>
        <p className="text-[16px] leading-[24px] text-on-surface-variant mb-8">
          {config.descriptionDefault}
        </p>

        {/* Re-check status info if active session detected */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 text-sm text-outline mb-6">
            <Loader2 size={16} className="animate-spin" />
            <span>Memeriksa status akun terbaru...</span>
          </div>
        ) : currentStatus && currentStatus !== normalizedReason ? (
          <div className="mb-6 p-3 bg-surface rounded-xl border border-outline-variant text-sm text-on-surface-variant flex items-center justify-between">
            <span>
              Status akun di server: <strong>{currentStatus}</strong>
            </span>
            <button
              onClick={fetchSessionStatus}
              className="p-1 text-secondary hover:text-primary transition-colors cursor-pointer"
              title="Perbarui"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        ) : null}

        {/* Action Buttons */}
        <div className="space-y-3">
          {config.actionType === 'login' && (
            <Link
              href="/login"
              className="w-full h-[48px] bg-primary text-on-primary rounded-xl text-[16px] font-semibold hover:bg-primary-container hover:text-on-primary-container transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              Masuk Kembali
            </Link>
          )}

          {config.actionType === 'logout' && (
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full h-[48px] bg-outline-variant/30 text-on-surface hover:bg-outline-variant/50 rounded-xl text-[16px] font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {loggingOut ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Keluar...</span>
                </>
              ) : (
                <>
                  <LogOut size={18} />
                  <span>Keluar dari Akun</span>
                </>
              )}
            </button>
          )}

          {config.actionType === 'support' && (
            <div className="space-y-3">
              <a
                href="mailto:support@kebunmelon.com"
                className="w-full h-[48px] bg-primary text-on-primary rounded-xl text-[16px] font-semibold hover:bg-primary-container hover:text-on-primary-container transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <HelpCircle size={18} />
                <span>Hubungi Bantuan / Owner</span>
              </a>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full h-[48px] bg-surface text-on-surface-variant hover:bg-outline-variant/30 rounded-xl text-[14px] font-medium transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut size={16} />
                <span>Kembali ke Halaman Masuk</span>
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
