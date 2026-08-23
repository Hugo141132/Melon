'use client';

import { useState, useEffect } from 'react';
import TopAppBar from '@/components/navigation/TopAppBar';
import { AlertDto, AlertSeverity, AlertStatus } from '@kebun-melon/contracts';
import { LucideIcon, AlertTriangle, AlertCircle, Info, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

const severityConfig: Record<
  AlertSeverity,
  {
    icon: LucideIcon;
    labelKey: 'critical' | 'warning' | 'info';
    bgColor: string;
    borderColor: string;
    iconColor: string;
    chipBg: string;
    chipText: string;
  }
> = {
  [AlertSeverity.CRITICAL]: {
    icon: AlertCircle,
    labelKey: 'critical',
    bgColor: 'bg-app-error/5',
    borderColor: 'border-app-error/30',
    iconColor: 'text-app-error',
    chipBg: 'bg-app-error/10',
    chipText: 'text-app-error',
  },
  [AlertSeverity.WARNING]: {
    icon: AlertTriangle,
    labelKey: 'warning',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-300/50',
    iconColor: 'text-yellow-600',
    chipBg: 'bg-yellow-100',
    chipText: 'text-yellow-700',
  },
  [AlertSeverity.INFO]: {
    icon: Info,
    labelKey: 'info',
    bgColor: 'bg-app-primary/5',
    borderColor: 'border-app-primary/20',
    iconColor: 'text-app-primary',
    chipBg: 'bg-app-primary/10',
    chipText: 'text-app-primary',
  },
};

function getSeverityConfig(severity: string) {
  const norm = severity?.toUpperCase();
  if (norm === AlertSeverity.CRITICAL || norm === 'ERROR') {
    return severityConfig[AlertSeverity.CRITICAL];
  }
  if (norm === AlertSeverity.WARNING) {
    return severityConfig[AlertSeverity.WARNING];
  }
  return severityConfig[AlertSeverity.INFO];
}

function AlertCard({
  alert,
  onAcknowledge,
}: {
  alert: AlertDto;
  onAcknowledge: (alertId: string) => void;
}) {
  const tAlerts = useTranslations('alerts');
  const tCommon = useTranslations('common');

  const cfg = getSeverityConfig(alert.severity);
  const Icon = cfg.icon;
  const severityLabel = tCommon(cfg.labelKey);

  const getTitle = () => {
    if (alert.titleKey) {
      const cleanKey = alert.titleKey.startsWith('alerts.')
        ? alert.titleKey.slice('alerts.'.length)
        : alert.titleKey;
      try {
        return tAlerts(cleanKey as any);
      } catch {
        return cleanKey;
      }
    }
    return alert.alertType?.replace(/_/g, ' ') || 'Alert';
  };

  const getMessage = () => {
    if (!alert.messageKey) return null;
    const cleanKey = alert.messageKey.startsWith('alerts.')
      ? alert.messageKey.slice('alerts.'.length)
      : alert.messageKey;
    try {
      return tAlerts(cleanKey as any, (alert.messageParams as any) || {});
    } catch {
      return cleanKey;
    }
  };

  const statusNorm = alert.status?.toUpperCase();
  const isAcknowledged = statusNorm === AlertStatus.ACKNOWLEDGED;
  const isOpen = statusNorm === AlertStatus.OPEN;

  const title = getTitle();
  const message = getMessage();

  return (
    <div
      className={cn(
        'rounded-xl p-4 border flex flex-col gap-3 soft-elevation animate-fade-in',
        cfg.bgColor,
        cfg.borderColor
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon column */}
        <div
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
            alert.severity?.toUpperCase() === AlertSeverity.CRITICAL ||
              alert.severity?.toLowerCase() === 'error'
              ? 'bg-app-error/15'
              : alert.severity?.toUpperCase() === AlertSeverity.WARNING
                ? 'bg-yellow-100'
                : 'bg-app-primary/10'
          )}
        >
          <Icon size={20} className={cfg.iconColor} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start">
            <div
              className={cn(
                'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold mb-2',
                cfg.chipBg,
                cfg.chipText
              )}
            >
              {severityLabel.toUpperCase()}
            </div>
            {isAcknowledged && (
              <span className="text-[11px] font-bold text-app-primary bg-app-primary/10 px-2 py-0.5 rounded-full">
                {tAlerts('acknowledgedBy')}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-[14px] leading-5 font-bold text-app-on-surface mb-1">{title}</h3>

          {/* Message if present */}
          {message && <p className="text-[12px] text-app-on-surface-variant mb-2">{message}</p>}

          <div className="text-[11px] text-app-on-surface-variant">
            {new Date(alert.openedAt).toLocaleString()}
          </div>
        </div>
      </div>

      {!isAcknowledged && isOpen && (
        <div className="flex justify-end pt-2 border-t border-app-outline-variant/10">
          <button
            onClick={() => onAcknowledge(alert.id)}
            className="text-[12px] font-semibold text-app-primary hover:underline cursor-pointer"
          >
            {tAlerts('acknowledgeAction')}
          </button>
        </div>
      )}
    </div>
  );
}

export default function NotifikasiPage() {
  const tAlerts = useTranslations('alerts');
  const tCommon = useTranslations('common');
  const [alerts, setAlerts] = useState<AlertDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [ackModalOpen, setAckModalOpen] = useState(false);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [ackNote, setAckNote] = useState('');
  const [ackLoading, setAckLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const res = await fetch('/api/v1/alerts');
      const json = await res.json();
      if (json.success) {
        const rawItems = Array.isArray(json.data)
          ? json.data
          : Array.isArray(json.data?.items)
            ? json.data.items
            : [];
        setAlerts(rawItems);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledgeClick = (alertId: string) => {
    setSelectedAlertId(alertId);
    setAckNote('');
    setErrorMsg(null);
    setAckModalOpen(true);
  };

  const confirmAcknowledge = async () => {
    if (!selectedAlertId) return;
    setAckLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/v1/alerts/${selectedAlertId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: ackNote }),
      });
      const json = await res.json();

      if (json.success) {
        setAlerts((prev) =>
          prev.map((a) =>
            a.id === selectedAlertId ? { ...a, status: AlertStatus.ACKNOWLEDGED } : a
          )
        );
        setAckModalOpen(false);
      } else {
        setErrorMsg(json.error?.message || tAlerts('acknowledgeError'));
      }
    } catch (e) {
      setErrorMsg(tAlerts('acknowledgeError'));
    } finally {
      setAckLoading(false);
    }
  };

  const errorCount = alerts.filter(
    (a) =>
      (a.severity?.toUpperCase() === AlertSeverity.CRITICAL ||
        a.severity?.toLowerCase() === 'error') &&
      a.status?.toUpperCase() === AlertStatus.OPEN
  ).length;

  const warningCount = alerts.filter(
    (a) =>
      a.severity?.toUpperCase() === AlertSeverity.WARNING &&
      a.status?.toUpperCase() === AlertStatus.OPEN
  ).length;

  return (
    <div className="bg-app-surface text-app-on-surface min-h-dvh pb-24 relative">
      <TopAppBar />

      <main className="pt-20 px-[1rem] space-y-5">
        <section className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-[24px] leading-8 font-bold text-app-on-surface">
              {tAlerts('title')}
            </h1>
            <p className="text-[14px] text-app-on-surface-variant">
              {tAlerts('alertsSummary', { critical: errorCount, warning: warningCount })}
            </p>
          </div>
          <button
            onClick={fetchAlerts}
            className="text-[12px] font-semibold text-app-primary border border-app-primary/30 px-3 py-1.5 rounded-full hover:bg-app-primary/5 transition-colors cursor-pointer"
          >
            {tCommon('refresh')}
          </button>
        </section>

        <div className="flex gap-2 flex-wrap animate-fade-in">
          <div className="flex items-center gap-1.5 bg-app-error/10 px-3 py-1.5 rounded-full">
            <AlertCircle size={14} className="text-app-error" />
            <span className="text-[12px] font-semibold text-app-error">
              {tAlerts('criticalCount', { count: errorCount })}
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-yellow-100 px-3 py-1.5 rounded-full">
            <AlertTriangle size={14} className="text-yellow-600" />
            <span className="text-[12px] font-semibold text-yellow-700">
              {tAlerts('warningCount', { count: warningCount })}
            </span>
          </div>
        </div>

        <div className="space-y-3 min-h-[200px]">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="animate-spin text-app-primary" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center text-app-on-surface-variant py-10">
              {tAlerts('noAlerts')}
            </div>
          ) : (
            [...alerts]
              .sort((a, b) => {
                const aOpen = a.status?.toUpperCase() === AlertStatus.OPEN;
                const bOpen = b.status?.toUpperCase() === AlertStatus.OPEN;
                if (aOpen && !bOpen) return -1;
                if (!aOpen && bOpen) return 1;

                const aCrit =
                  a.severity?.toUpperCase() === AlertSeverity.CRITICAL ||
                  a.severity?.toLowerCase() === 'error';
                const bCrit =
                  b.severity?.toUpperCase() === AlertSeverity.CRITICAL ||
                  b.severity?.toLowerCase() === 'error';
                if (aCrit && !bCrit) return -1;
                if (!aCrit && bCrit) return 1;

                return new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime();
              })
              .map((alert) => (
                <AlertCard key={alert.id} alert={alert} onAcknowledge={handleAcknowledgeClick} />
              ))
          )}
        </div>
      </main>

      {/* Acknowledge Modal */}
      {ackModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
          <div className="bg-app-surface w-full max-w-sm rounded-xl p-5 soft-elevation">
            <h2 className="text-[18px] font-bold mb-2">{tAlerts('acknowledgeAction')}</h2>
            <p className="text-[14px] text-app-on-surface-variant mb-4">
              {tAlerts('acknowledgeConfirm')}
            </p>

            <div className="mb-4">
              <label className="block text-[12px] font-bold text-app-on-surface-variant mb-1">
                {tAlerts('operatorNote')}
              </label>
              <textarea
                value={ackNote}
                onChange={(e) => setAckNote(e.target.value)}
                placeholder={tAlerts('notePlaceholder')}
                className="w-full bg-app-surface-container-lowest border border-app-outline-variant/30 rounded-lg p-2.5 text-[14px] focus:outline-none focus:border-app-primary resize-none h-20"
              />
            </div>

            {errorMsg && <p className="text-[12px] text-app-error mb-4">{errorMsg}</p>}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setAckModalOpen(false)}
                className="px-4 py-2 text-[14px] font-bold text-app-on-surface-variant hover:bg-app-on-surface/5 rounded-full transition-colors"
                disabled={ackLoading}
              >
                {tCommon('cancel')}
              </button>
              <button
                onClick={confirmAcknowledge}
                className="px-4 py-2 text-[14px] font-bold bg-app-primary text-app-on-primary rounded-full hover:bg-app-primary/90 transition-colors flex items-center gap-2"
                disabled={ackLoading}
              >
                {ackLoading && <Loader2 size={16} className="animate-spin" />}
                {tCommon('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
