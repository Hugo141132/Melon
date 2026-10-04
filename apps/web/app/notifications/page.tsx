'use client';

import { useState, useEffect } from 'react';
import TopAppBar from '@/components/navigation/TopAppBar';
import { AlertDto, AlertSeverity, AlertStatus } from '@kebun-melon/contracts';
import { LucideIcon, AlertTriangle, AlertCircle, Info, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations, useLocale } from 'next-intl';
import { ALERT_UPDATED_EVENT } from '@/hooks/useAlertBadge';
import { formatAlertTimestamp } from '@/lib/notifications/format-alert-timestamp';

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
  userTimezone,
  onAcknowledge,
  isAcknowledging,
  isSelected,
  onToggleSelect,
}: {
  alert: AlertDto;
  userTimezone?: string;
  onAcknowledge: (alertId: string) => void;
  isAcknowledging: boolean;
  isSelected?: boolean;
  onToggleSelect?: (alertId: string) => void;
}) {
  const tAlerts = useTranslations('alerts');
  const tCommon = useTranslations('common');
  const locale = useLocale();

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
  const isAcknowledged = alert.isAcknowledged ?? statusNorm === AlertStatus.ACKNOWLEDGED;
  const isOpen = statusNorm === AlertStatus.OPEN && !isAcknowledged;

  const title = getTitle();
  const message = getMessage();

  return (
    <div
      className={cn(
        'rounded-xl p-4 border flex flex-col gap-3 soft-elevation animate-fade-in transition-colors',
        cfg.bgColor,
        cfg.borderColor,
        isSelected && 'ring-2 ring-app-primary/60 border-app-primary/40'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox column for open alerts */}
        {isOpen && onToggleSelect && (
          <div className="flex items-center h-10 flex-shrink-0">
            <input
              type="checkbox"
              checked={isSelected || false}
              onChange={() => onToggleSelect(alert.id)}
              aria-label={`Select alert ${title}`}
              data-testid={`checkbox-select-${alert.id}`}
              className="w-4 h-4 rounded border-app-outline-variant/60 text-app-primary focus:ring-app-primary/30 cursor-pointer accent-emerald-600"
            />
          </div>
        )}

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
            {formatAlertTimestamp(alert.openedAt, locale, userTimezone)}
          </div>
        </div>
      </div>

      {!isAcknowledged && isOpen && (
        <div className="flex justify-end pt-2 border-t border-app-outline-variant/10">
          <button
            onClick={() => onAcknowledge(alert.id)}
            disabled={isAcknowledging}
            className="text-[12px] font-semibold text-app-primary hover:underline cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            data-testid={`btn-acknowledge-${alert.id}`}
          >
            {isAcknowledging && <Loader2 size={13} className="animate-spin" />}
            <span>{tAlerts('acknowledgeAction')}</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  const tAlerts = useTranslations('alerts');
  const tCommon = useTranslations('common');
  const [alerts, setAlerts] = useState<AlertDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [userTimezone, setUserTimezone] = useState<string>('Asia/Jakarta');
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const [selectedAlertIds, setSelectedAlertIds] = useState<Set<string>>(new Set());
  const [isBulkAcknowledging, setIsBulkAcknowledging] = useState(false);
  const [isBulkAcknowledgingAll, setIsBulkAcknowledgingAll] = useState(false);

  useEffect(() => {
    fetchAlerts();
    fetchUserPreferences();
  }, []);

  const fetchUserPreferences = async () => {
    try {
      const res = await fetch('/api/v1/me/preferences');
      const json = await res.json();
      if (json.success && json.data?.timezone) {
        setUserTimezone(json.data.timezone);
      }
    } catch {
      // Gracefully defaults to Asia/Jakarta
    }
  };

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
        setSelectedAlertIds(new Set());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDirectAcknowledge = async (alertId: string) => {
    setAcknowledgingId(alertId);

    try {
      const res = await fetch(`/api/v1/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();

      if (json.success) {
        setAlerts((prev) =>
          prev.map((a) =>
            a.id === alertId
              ? {
                  ...a,
                  status: AlertStatus.ACKNOWLEDGED,
                  isAcknowledged: true,
                  acknowledgedAt: json.data?.acknowledgedAt || new Date().toISOString(),
                }
              : a
          )
        );
        setSelectedAlertIds((prev) => {
          const next = new Set(prev);
          next.delete(alertId);
          return next;
        });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(ALERT_UPDATED_EVENT));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAcknowledgingId(null);
    }
  };

  const toggleSelectAlert = (alertId: string) => {
    setSelectedAlertIds((prev) => {
      const next = new Set(prev);
      if (next.has(alertId)) {
        next.delete(alertId);
      } else {
        next.add(alertId);
      }
      return next;
    });
  };

  const selectableAlerts = alerts.filter(
    (a) => a.status?.toUpperCase() === AlertStatus.OPEN && !(a.isAcknowledged ?? false)
  );

  const allSelected =
    selectableAlerts.length > 0 && selectedAlertIds.size === selectableAlerts.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedAlertIds(new Set());
    } else {
      setSelectedAlertIds(new Set(selectableAlerts.map((a) => a.id)));
    }
  };

  const handleAcknowledgeSelected = async () => {
    if (selectedAlertIds.size === 0) return;
    setIsBulkAcknowledging(true);

    try {
      const ids = Array.from(selectedAlertIds);
      const res = await fetch('/api/v1/alerts/bulk-acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertIds: ids }),
      });
      const json = await res.json();

      if (json.success) {
        const ackedSet = new Set(json.data.alertIds || ids);
        setAlerts((prev) =>
          prev.map((a) =>
            ackedSet.has(a.id)
              ? {
                  ...a,
                  status: AlertStatus.ACKNOWLEDGED,
                  isAcknowledged: true,
                  acknowledgedAt: new Date().toISOString(),
                }
              : a
          )
        );
        setSelectedAlertIds(new Set());
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(ALERT_UPDATED_EVENT));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsBulkAcknowledging(false);
    }
  };

  const handleAcknowledgeAll = async () => {
    setIsBulkAcknowledgingAll(true);

    try {
      const res = await fetch('/api/v1/alerts/bulk-acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      const json = await res.json();

      if (json.success) {
        const ackedSet = new Set(json.data.alertIds || []);
        setAlerts((prev) =>
          prev.map((a) =>
            ackedSet.has(a.id) ||
            (a.status?.toUpperCase() === AlertStatus.OPEN && !a.isAcknowledged)
              ? {
                  ...a,
                  status: AlertStatus.ACKNOWLEDGED,
                  isAcknowledged: true,
                  acknowledgedAt: new Date().toISOString(),
                }
              : a
          )
        );
        setSelectedAlertIds(new Set());
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(ALERT_UPDATED_EVENT));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsBulkAcknowledgingAll(false);
    }
  };

  const errorCount = alerts.filter(
    (a) =>
      (a.severity?.toUpperCase() === AlertSeverity.CRITICAL ||
        a.severity?.toLowerCase() === 'error') &&
      a.status?.toUpperCase() === AlertStatus.OPEN &&
      !(a.isAcknowledged ?? false)
  ).length;

  const warningCount = alerts.filter(
    (a) =>
      a.severity?.toUpperCase() === AlertSeverity.WARNING &&
      a.status?.toUpperCase() === AlertStatus.OPEN &&
      !(a.isAcknowledged ?? false)
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

        {/* Bulk Acknowledgement Action Bar */}
        {selectableAlerts.length > 0 && (
          <div
            data-testid="bulk-acknowledge-toolbar"
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-app-surface-container-lowest border border-app-outline-variant/30 rounded-xl animate-fade-in"
          >
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="select-all-alerts"
                checked={allSelected}
                onChange={toggleSelectAll}
                data-testid="checkbox-select-all"
                className="w-4 h-4 rounded border-app-outline-variant/60 text-app-primary focus:ring-app-primary/30 cursor-pointer accent-emerald-600"
              />
              <label
                htmlFor="select-all-alerts"
                className="text-[13px] font-medium text-app-on-surface cursor-pointer select-none"
              >
                {tAlerts('selectAll')} ({selectableAlerts.length})
              </label>

              {selectedAlertIds.size > 0 && (
                <span className="text-[12px] text-app-primary font-semibold ml-2">
                  {tAlerts('selectedCount', { count: selectedAlertIds.size })}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {selectedAlertIds.size > 0 && (
                <button
                  onClick={handleAcknowledgeSelected}
                  disabled={isBulkAcknowledging || isBulkAcknowledgingAll}
                  data-testid="btn-acknowledge-selected"
                  className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-app-primary text-white hover:bg-app-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {isBulkAcknowledging && <Loader2 size={13} className="animate-spin" />}
                  <span>{tAlerts('acknowledgeSelected', { count: selectedAlertIds.size })}</span>
                </button>
              )}

              <button
                onClick={handleAcknowledgeAll}
                disabled={isBulkAcknowledging || isBulkAcknowledgingAll}
                data-testid="btn-acknowledge-all"
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold border border-app-outline-variant/60 text-app-on-surface hover:bg-app-surface-container/50 disabled:opacity-50 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {isBulkAcknowledgingAll && <Loader2 size={13} className="animate-spin" />}
                <span>{tAlerts('acknowledgeAll')}</span>
              </button>
            </div>
          </div>
        )}

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
                const aAck =
                  a.isAcknowledged ?? a.status?.toUpperCase() === AlertStatus.ACKNOWLEDGED;
                const bAck =
                  b.isAcknowledged ?? b.status?.toUpperCase() === AlertStatus.ACKNOWLEDGED;
                const aOpen = !aAck && a.status?.toUpperCase() === AlertStatus.OPEN;
                const bOpen = !bAck && b.status?.toUpperCase() === AlertStatus.OPEN;
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
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  userTimezone={userTimezone}
                  onAcknowledge={handleDirectAcknowledge}
                  isAcknowledging={acknowledgingId === alert.id}
                  isSelected={selectedAlertIds.has(alert.id)}
                  onToggleSelect={toggleSelectAlert}
                />
              ))
          )}
        </div>
      </main>
    </div>
  );
}
