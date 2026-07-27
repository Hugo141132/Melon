import type { Metadata } from 'next';
import TopAppBar from '@/components/navigation/TopAppBar';
import BottomNav from '@/components/navigation/BottomNav';
import { ALERTS, type Alert, type AlertSeverity } from '@/lib/constants';
import {
  LucideIcon,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronRight,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Notifikasi - Kebun Melon',
  description: 'Peringatan dan notifikasi kondisi lahan melon Anda.',
};

const severityConfig: Record<
  AlertSeverity,
  {
    icon: LucideIcon;
    label: string;
    bgColor: string;
    borderColor: string;
    iconColor: string;
    chipBg: string;
    chipText: string;
  }
> = {
  error: {
    icon: AlertCircle,
    label: 'Kritis',
    bgColor: 'bg-app-error/5',
    borderColor: 'border-app-error/30',
    iconColor: 'text-app-error',
    chipBg: 'bg-app-error/10',
    chipText: 'text-app-error',
  },
  warning: {
    icon: AlertTriangle,
    label: 'Peringatan',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-300/50',
    iconColor: 'text-yellow-600',
    chipBg: 'bg-yellow-100',
    chipText: 'text-yellow-700',
  },
  info: {
    icon: Info,
    label: 'Info',
    bgColor: 'bg-app-primary/5',
    borderColor: 'border-app-primary/20',
    iconColor: 'text-app-primary',
    chipBg: 'bg-app-primary/10',
    chipText: 'text-app-primary',
  },
};

function AlertCard({ alert }: { alert: Alert }) {
  const cfg = severityConfig[alert.severity];
  const Icon = cfg.icon;

  return (
    <div
      className={cn(
        'rounded-xl p-4 border flex items-start gap-3 soft-elevation animate-fade-in',
        cfg.bgColor,
        cfg.borderColor
      )}
    >
      {/* Icon column */}
      <div
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
          alert.severity === 'error'
            ? 'bg-app-error/15'
            : alert.severity === 'warning'
              ? 'bg-yellow-100'
              : 'bg-app-primary/10'
        )}
      >
        <Icon size={20} className={cfg.iconColor} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Chip */}
        <div
          className={cn(
            'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold mb-2',
            cfg.chipBg,
            cfg.chipText
          )}
        >
          {cfg.label.toUpperCase()}
        </div>

        {/* Title */}
        <h3 className="text-[14px] leading-5 font-bold text-app-on-surface mb-2">{alert.title}</h3>

        {/* Values comparison */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[11px] text-app-on-surface-variant uppercase tracking-wide">
              Saat Ini
            </p>
            <p className={cn('text-[18px] font-bold', cfg.iconColor)}>{alert.current}</p>
          </div>
          <div>
            <p className="text-[11px] text-app-on-surface-variant uppercase tracking-wide">
              Range Optimal
            </p>
            <p className="text-[18px] font-bold text-app-primary">{alert.optimal}</p>
          </div>
        </div>
      </div>

      <ChevronRight size={18} className="text-app-on-surface-variant flex-shrink-0 mt-1" />
    </div>
  );
}

export default function NotifikasiPage() {
  const errorCount = ALERTS.filter((a) => a.severity === 'error').length;
  const warningCount = ALERTS.filter((a) => a.severity === 'warning').length;

  return (
    <div className="bg-app-surface text-app-on-surface min-h-dvh pb-24">
      <TopAppBar showNotification notificationCount={errorCount} />

      <main className="pt-20 px-[1rem] space-y-5">
        {/* Header Summary */}
        <section className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-[24px] leading-8 font-bold text-app-on-surface">Notifikasi</h1>
            <p className="text-[14px] text-app-on-surface-variant">
              {errorCount} kritis · {warningCount} peringatan
            </p>
          </div>
          <button className="text-[12px] font-semibold text-app-primary border border-app-primary/30 px-3 py-1.5 rounded-full hover:bg-app-primary/5 transition-colors cursor-pointer">
            Tandai Semua Dibaca
          </button>
        </section>

        {/* Summary chips */}
        <div className="flex gap-2 flex-wrap animate-fade-in">
          <div className="flex items-center gap-1.5 bg-app-error/10 px-3 py-1.5 rounded-full">
            <AlertCircle size={14} className="text-app-error" />
            <span className="text-[12px] font-semibold text-app-error">{errorCount} Kritis</span>
          </div>
          <div className="flex items-center gap-1.5 bg-yellow-100 px-3 py-1.5 rounded-full">
            <AlertTriangle size={14} className="text-yellow-600" />
            <span className="text-[12px] font-semibold text-yellow-700">
              {warningCount} Peringatan
            </span>
          </div>
        </div>

        {/* Critical alerts first, then warnings */}
        <div className="space-y-3">
          {[...ALERTS]
            .sort((a, b) => (a.severity === 'error' ? -1 : 1))
            .map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
        </div>

        {/* Resolved / Historical */}
        <section className="bg-app-surface-container-lowest rounded-xl p-5 soft-elevation border border-app-outline-variant/20 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-app-primary/10 flex items-center justify-center">
              <CheckCircle size={20} className="text-app-primary" />
            </div>
            <div>
              <p className="text-[14px] font-bold text-app-on-surface">
                3 Peringatan Terselesaikan
              </p>
              <p className="text-[12px] text-app-on-surface-variant">Dalam 24 jam terakhir</p>
            </div>
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
