'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { History, RefreshCw, ArrowLeft, ArrowRight, Droplets, Power, PowerOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { formatLitersDisplay } from './FaucetPresetSelector';
import { useRealtimeMonitoring } from '@/hooks/use-realtime-monitoring';

export interface FaucetHistoryItem {
  id: string;
  commandId: string;
  deviceId: string;
  action?: 'DISPENSE' | 'OPEN' | 'CLOSE' | string;
  phase?: number | null;
  plantCount?: number | null;
  targetVolumeMl?: number | null;
  actualVolumeMl?: number | null;
  status: string;
  reasonCode?: string | null;
  requestedAt: string;
  completedAt?: string | null;
  initiatedByUserId?: string | null;
  initiatedByRole?: string | null;
  initiatedByFullName?: string | null;
}

export interface FaucetHistoryTableProps {
  deviceId?: string | null;
  isLoading?: boolean;
  initialItems?: FaucetHistoryItem[];
  initialPagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  className?: string;
}

export default function FaucetHistoryTable({
  deviceId,
  isLoading = false,
  initialItems,
  initialPagination,
  className,
}: FaucetHistoryTableProps) {
  const tFaucet = useTranslations('faucet');
  const tCommon = useTranslations('common');

  const [history, setHistory] = useState<FaucetHistoryItem[]>(() => initialItems || []);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [pagination, setPagination] = useState(
    () =>
      initialPagination || {
        page: 1,
        pageSize: 10,
        totalItems: initialItems?.length || 0,
        totalPages: 1,
      }
  );

  const isTableLoading = loading || isLoading;

  const tFaucetRef = React.useRef(tFaucet);
  React.useEffect(() => {
    tFaucetRef.current = tFaucet;
  }, [tFaucet]);

  const TERMINAL_STATUSES = React.useMemo(() => ['COMPLETED', 'TIMEOUT', 'EXPIRED'], []);
  const processedTerminalTransitionsRef = React.useRef<Set<string>>(new Set());
  const prevRealtimeStatusRef = React.useRef<'CONNECTING' | 'OPEN' | 'CLOSED' | 'POLLING'>(
    'CLOSED'
  );
  const isFirstMountRef = React.useRef<boolean>(true);
  const paginationRef = React.useRef(pagination);
  React.useEffect(() => {
    paginationRef.current = pagination;
  }, [pagination]);

  const fetchSeqRef = React.useRef<number>(0);
  const lastDeviceIdRef = React.useRef<string | null | undefined>(null);
  const lastFilterRef = React.useRef<string>('ALL');

  const fetchHistory = useCallback(
    async (pageToFetch = 1) => {
      if (!deviceId) return;
      const fetchSeq = ++fetchSeqRef.current;
      setLoading(true);
      setErrorMsg(null);
      try {
        const queryParams = new URLSearchParams();
        queryParams.set('page', pageToFetch.toString());
        queryParams.set('pageSize', '10');
        if (statusFilter === 'ALL') {
          // Strictly filter the three terminal statuses at SQL level before pagination
          queryParams.set('statuses', 'COMPLETED,TIMEOUT,EXPIRED');
        } else {
          queryParams.set('status', statusFilter);
        }

        const res = await fetch(
          `/api/v1/devices/${deviceId}/faucet-commands?${queryParams.toString()}`
        );
        const json = await res.json();

        // Discard stale in-flight response
        if (fetchSeq !== fetchSeqRef.current) {
          return;
        }

        if (json.success) {
          const items: FaucetHistoryItem[] = json.data?.items || [];
          setHistory(items);
          const pageMeta =
            json.data?.pagination || json.data?.meta?.pagination || json.meta?.pagination;
          if (pageMeta) {
            setPagination({
              page: Number(pageMeta.page) || pageToFetch,
              pageSize: Number(pageMeta.pageSize) || 10,
              totalItems: Number(pageMeta.totalItems) || 0,
              totalPages: Number(pageMeta.totalPages) || 1,
            });
          }
        } else {
          setErrorMsg(json.error?.message || tFaucetRef.current('historySubtitle'));
        }
      } catch {
        if (fetchSeq === fetchSeqRef.current) {
          setErrorMsg(tFaucetRef.current('networkErrorDispense'));
        }
      } finally {
        if (fetchSeq === fetchSeqRef.current) {
          setLoading(false);
        }
      }
    },
    [deviceId, statusFilter]
  );

  // Reset to page 1 on device change or filter change
  useEffect(() => {
    if (!deviceId) {
      setHistory([]);
      setPagination({ page: 1, pageSize: 10, totalItems: 0, totalPages: 1 });
      return;
    }

    const deviceChanged = deviceId !== lastDeviceIdRef.current;
    const filterChanged = statusFilter !== lastFilterRef.current;

    lastDeviceIdRef.current = deviceId;
    lastFilterRef.current = statusFilter;

    if (deviceChanged || filterChanged || isFirstMountRef.current) {
      fetchHistory(1);
    }
  }, [deviceId, statusFilter, fetchHistory]);

  // Auto-recovery from empty page if data was purged/deleted and page > totalPages
  useEffect(() => {
    if (
      !loading &&
      history.length === 0 &&
      pagination.totalItems > 0 &&
      pagination.totalPages > 0 &&
      pagination.page > pagination.totalPages
    ) {
      fetchHistory(pagination.totalPages);
    }
  }, [
    loading,
    history.length,
    pagination.totalItems,
    pagination.totalPages,
    pagination.page,
    fetchHistory,
  ]);

  const handleRealtimeEvent = useCallback(
    (name: string, data: any) => {
      if (name !== 'faucet.command.updated' || !data) return;

      const eventData = data as any;
      const commandId = eventData.commandId;
      const status = eventData.status;
      if (!commandId || !status) return;

      // Only handle terminal transitions for the history table
      if (!TERMINAL_STATUSES.includes(status)) {
        return;
      }

      // Deduplicate terminal transitions to prevent repeated refreshes (bounded memory)
      const dedupeKey = `${commandId}:${status}`;
      if (processedTerminalTransitionsRef.current.has(dedupeKey)) {
        return;
      }
      if (processedTerminalTransitionsRef.current.size >= 1000) {
        const entries = Array.from(processedTerminalTransitionsRef.current);
        processedTerminalTransitionsRef.current = new Set(entries.slice(500));
      }
      processedTerminalTransitionsRef.current.add(dedupeKey);

      // Refresh once when command transitions to terminal status, preserving current page
      fetchHistory(paginationRef.current.page);
    },
    [TERMINAL_STATUSES, fetchHistory]
  );

  const { status: realtimeStatus } = useRealtimeMonitoring({
    channels: ['commands'],
    deviceId: deviceId || undefined,
    enabled: Boolean(deviceId),
    onEvent: handleRealtimeEvent,
  });

  // Reconcile history table upon stream reconnection
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      prevRealtimeStatusRef.current = realtimeStatus;
      return;
    }

    if (
      (prevRealtimeStatusRef.current === 'CLOSED' ||
        prevRealtimeStatusRef.current === 'CONNECTING' ||
        prevRealtimeStatusRef.current === 'POLLING') &&
      realtimeStatus === 'OPEN'
    ) {
      // Stream reconnected, reconcile history
      fetchHistory(paginationRef.current.page);
    }

    prevRealtimeStatusRef.current = realtimeStatus;
  }, [realtimeStatus, fetchHistory]);

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'FAILED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'IN_PROGRESS':
        return 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse';
      case 'ACKNOWLEDGED':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'SENT':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'QUEUED':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'TIMEOUT':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'EXPIRED':
        return 'bg-zinc-100 text-zinc-700 border-zinc-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div
      className={cn(
        'bg-app-surface-container-lowest p-5 rounded-2xl border border-app-outline-variant/30 soft-elevation-lg space-y-4 animate-fade-in',
        className
      )}
      data-testid="faucet-history-table"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History className="text-app-primary" size={20} />
          <div>
            <h3 className="text-[16px] font-bold text-app-on-surface">{tFaucet('historyTitle')}</h3>
            <p className="text-[12px] text-app-on-surface-variant">{tFaucet('historySubtitle')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-app-surface border border-app-outline-variant/40 rounded-xl text-xs font-semibold text-app-on-surface focus:outline-none focus:border-app-primary"
            data-testid="history-status-filter"
          >
            <option value="ALL">
              {tCommon('all')} {tCommon('status')}
            </option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="TIMEOUT">TIMEOUT</option>
            <option value="EXPIRED">EXPIRED</option>
          </select>

          <button
            onClick={() => fetchHistory(pagination.page)}
            className="p-2 rounded-xl border border-app-outline-variant/30 bg-app-surface hover:bg-app-surface-container text-app-on-surface transition-colors cursor-pointer"
            title={tCommon('refresh')}
            data-testid="btn-refresh-history"
          >
            <RefreshCw size={14} className={isTableLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Error message */}
      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => fetchHistory(pagination.page)} className="font-bold underline">
            {tCommon('retry')}
          </button>
        </div>
      )}

      {/* Table Container */}
      <div className="overflow-x-auto rounded-xl border border-app-outline-variant/20">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-app-surface-container-low/60 border-b border-app-outline-variant/20 text-app-on-surface-variant">
              <th className="p-3 font-semibold">
                {tFaucet('actionHeader')} / {tFaucet('phaseTargetHeader')}
              </th>
              <th className="p-3 font-semibold">{tFaucet('actualVolumeHeader')}</th>
              <th className="p-3 font-semibold">{tCommon('status')}</th>
              <th className="p-3 font-semibold">{tFaucet('requestedAtHeader')}</th>
              <th className="p-3 font-semibold">{tFaucet('actorHeader')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-app-outline-variant/10">
            {isTableLoading ? (
              [1, 2, 3].map((i) => (
                <tr key={i} className="animate-pulse">
                  <td className="p-3">
                    <div className="h-3 bg-app-surface-container rounded w-24" />
                  </td>
                  <td className="p-3">
                    <div className="h-3 bg-app-surface-container rounded w-16" />
                  </td>
                  <td className="p-3">
                    <div className="h-3 bg-app-surface-container rounded w-20" />
                  </td>
                  <td className="p-3">
                    <div className="h-3 bg-app-surface-container rounded w-24" />
                  </td>
                  <td className="p-3">
                    <div className="h-3 bg-app-surface-container rounded w-16" />
                  </td>
                </tr>
              ))
            ) : history.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-app-on-surface-variant">
                  <Droplets size={28} className="mx-auto mb-2 opacity-30 text-app-primary" />
                  <p className="font-semibold text-[13px]">{tFaucet('noHistoryTitle')}</p>
                  <p className="text-[11px] opacity-80">{tFaucet('noHistorySubtitle')}</p>
                </td>
              </tr>
            ) : (
              history.map((item) => {
                const action = item.action || 'DISPENSE';
                const isDispense = action === 'DISPENSE';
                const targetVolL = item.targetVolumeMl ? item.targetVolumeMl / 1000 : null;
                const actualVolL =
                  item.actualVolumeMl !== null && item.actualVolumeMl !== undefined
                    ? item.actualVolumeMl / 1000
                    : null;

                return (
                  <tr
                    key={item.id}
                    className="hover:bg-app-surface-container-low/30 transition-colors"
                  >
                    <td className="p-3">
                      {isDispense ? (
                        <>
                          <span className="font-bold text-app-on-surface font-mono">
                            {targetVolL !== null
                              ? `${formatLitersDisplay(targetVolL)} L`
                              : `${item.targetVolumeMl?.toLocaleString('id-ID')} mL`}
                          </span>
                          <span className="text-[10px] text-app-on-surface-variant block font-mono">
                            {item.phase
                              ? item.plantCount
                                ? `(Fase ${item.phase} × ${item.plantCount})`
                                : tFaucet('phaseBadge', { phase: item.phase })
                              : `(${tFaucet('commandActionDispense')})`}
                          </span>
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {action === 'OPEN' ? (
                            <Power size={13} className="text-emerald-600" />
                          ) : (
                            <PowerOff size={13} className="text-slate-700" />
                          )}
                          <span className="font-bold text-app-on-surface">
                            {action === 'OPEN'
                              ? tFaucet('commandActionOpen')
                              : tFaucet('commandActionClose')}
                          </span>
                        </div>
                      )}
                    </td>

                    <td className="p-3 font-semibold font-mono">
                      {isDispense && actualVolL !== null
                        ? `${formatLitersDisplay(actualVolL)} L`
                        : '—'}
                    </td>

                    <td className="p-3">
                      <span
                        className={cn(
                          'px-2.5 py-1 rounded-full text-[10px] font-bold border inline-block',
                          getStatusBadgeStyle(item.status)
                        )}
                      >
                        {item.status}
                      </span>
                    </td>

                    <td className="p-3 font-mono text-[11px] text-app-on-surface-variant">
                      {new Date(item.requestedAt).toLocaleString('id-ID')}
                    </td>

                    <td className="p-3 font-medium">
                      {item.initiatedByFullName || item.initiatedByRole || tCommon('user')}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {pagination.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 text-xs text-app-on-surface-variant">
          <span>
            {tFaucet('paginationHistory', {
              page: pagination.page,
              totalPages: pagination.totalPages,
              total: pagination.totalItems,
            })}
          </span>
          <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-center">
            <button
              type="button"
              disabled={pagination.page <= 1 || loading}
              onClick={() => fetchHistory(pagination.page - 1)}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg border border-app-outline-variant/60 bg-app-surface-container-lowest text-app-on-surface hover:bg-app-surface-container/60 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors shadow-xs"
              aria-label="Previous page"
              data-testid="btn-history-prev-page"
            >
              <ArrowLeft size={16} strokeWidth={1.75} />
            </button>

            {(() => {
              const current = pagination.page;
              const total = pagination.totalPages;
              let items: Array<number | 'dot' | 'ellipsis'> = [];
              if (total <= 7) {
                items = Array.from({ length: total }, (_, i) => i + 1);
              } else if (current <= 4) {
                items = [1, 2, 3, 4, 'dot', 5, 6, 'ellipsis', total];
              } else if (current >= total - 3) {
                items = [
                  1,
                  'ellipsis',
                  total - 5,
                  total - 4,
                  'dot',
                  total - 3,
                  total - 2,
                  total - 1,
                  total,
                ];
              } else {
                items = [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total];
              }

              return items.map((item, idx) => {
                if (item === 'dot') {
                  return (
                    <span
                      key={`dot-${idx}`}
                      className="w-2.5 text-center text-app-outline-variant select-none font-bold text-sm"
                    >
                      ·
                    </span>
                  );
                }
                if (item === 'ellipsis') {
                  return (
                    <span
                      key={`ellipsis-${idx}`}
                      className="px-1 text-center text-app-outline-variant select-none font-bold tracking-widest text-xs"
                    >
                      ···
                    </span>
                  );
                }

                const isCurrent = item === current;
                return (
                  <button
                    key={`page-${item}`}
                    type="button"
                    disabled={loading}
                    onClick={() => fetchHistory(item)}
                    className={cn(
                      'w-9 h-9 sm:w-10 sm:h-10 rounded-lg text-[13px] flex items-center justify-center transition-colors',
                      isCurrent
                        ? 'border border-app-outline-variant/80 bg-app-surface-container-lowest text-app-on-surface font-semibold shadow-xs'
                        : 'text-app-on-surface-variant hover:text-app-on-surface hover:bg-app-surface-container/60 font-medium'
                    )}
                    aria-label={`Page ${item}`}
                    aria-current={isCurrent ? 'page' : undefined}
                  >
                    {item}
                  </button>
                );
              });
            })()}

            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => fetchHistory(pagination.page + 1)}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg border border-app-outline-variant/60 bg-app-surface-container-lowest text-app-on-surface hover:bg-app-surface-container/60 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors shadow-xs"
              aria-label="Next page"
              data-testid="btn-history-next-page"
            >
              <ArrowRight size={16} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
