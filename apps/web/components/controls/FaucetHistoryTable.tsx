'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { History, RefreshCw, ChevronLeft, ChevronRight, Droplets } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FaucetHistoryItem {
  id: string;
  commandId: string;
  deviceId: string;
  phase: number;
  targetVolumeMl: number;
  actualVolumeMl?: number | null;
  status: string;
  reasonCode?: string | null;
  requestedAt: string;
  completedAt?: string | null;
  initiatedByUserId?: string | null;
  initiatedByRole?: string | null;
}

export interface FaucetHistoryTableProps {
  deviceId: string;
  className?: string;
}

export default function FaucetHistoryTable({ deviceId, className }: FaucetHistoryTableProps) {
  const [history, setHistory] = useState<FaucetHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 1,
  });

  const fetchHistory = useCallback(
    async (pageToFetch = 1) => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const queryParams = new URLSearchParams();
        queryParams.set('page', pageToFetch.toString());
        queryParams.set('pageSize', '10');
        if (statusFilter !== 'ALL') {
          queryParams.set('status', statusFilter);
        }

        const res = await fetch(
          `/api/v1/devices/${deviceId}/faucet-commands?${queryParams.toString()}`
        );
        const json = await res.json();

        if (json.success) {
          setHistory(json.data.items || []);
          if (json.data.meta?.pagination) {
            setPagination(json.data.meta.pagination);
          }
        } else {
          setErrorMsg(json.error?.message || 'Gagal memuat riwayat kran.');
        }
      } catch {
        setErrorMsg('Kesalahan jaringan saat memuat riwayat.');
      } finally {
        setLoading(false);
      }
    },
    [deviceId, statusFilter]
  );

  useEffect(() => {
    if (deviceId) {
      fetchHistory(1);
    }
  }, [deviceId, statusFilter, fetchHistory]);

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
            <h3 className="text-[16px] font-bold text-app-on-surface">
              Riwayat Perintah Penyiraman
            </h3>
            <p className="text-[12px] text-app-on-surface-variant">
              Log eksekusi kran otomatis perangkat
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-app-surface border border-app-outline-variant/40 rounded-xl text-xs font-semibold text-app-on-surface focus:outline-none focus:border-app-primary"
            data-testid="history-status-filter"
          >
            <option value="ALL">Semua Status</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="FAILED">FAILED</option>
            <option value="TIMEOUT">TIMEOUT</option>
            <option value="QUEUED">QUEUED</option>
            <option value="SENT">SENT</option>
            <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
          </select>

          <button
            onClick={() => fetchHistory(pagination.page)}
            className="p-2 rounded-xl border border-app-outline-variant/30 bg-app-surface hover:bg-app-surface-container text-app-on-surface transition-colors cursor-pointer"
            title="Muat ulang riwayat"
            data-testid="btn-refresh-history"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Error message */}
      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => fetchHistory(pagination.page)} className="font-bold underline">
            Coba lagi
          </button>
        </div>
      )}

      {/* Table Container */}
      <div className="overflow-x-auto rounded-xl border border-app-outline-variant/20">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-app-surface-container-low/60 border-b border-app-outline-variant/20 text-app-on-surface-variant">
              <th className="p-3 font-semibold">Fase / Target</th>
              <th className="p-3 font-semibold">Volume Aktual</th>
              <th className="p-3 font-semibold">Status</th>
              <th className="p-3 font-semibold">Waktu Minta</th>
              <th className="p-3 font-semibold">Aktor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-app-outline-variant/10">
            {loading ? (
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
                  <p className="font-semibold text-[13px]">Belum ada riwayat perintah faucet</p>
                  <p className="text-[11px] opacity-80">
                    Perintah penyiraman yang dikirimkan akan muncul di tabel ini.
                  </p>
                </td>
              </tr>
            ) : (
              history.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-app-surface-container-low/30 transition-colors"
                >
                  <td className="p-3">
                    <span className="font-bold text-app-on-surface">
                      {item.targetVolumeMl.toLocaleString('id-ID')} mL
                    </span>
                    <span className="text-[10px] text-app-on-surface-variant block font-mono">
                      (Fase {item.phase})
                    </span>
                  </td>

                  <td className="p-3 font-semibold">
                    {item.actualVolumeMl !== null && item.actualVolumeMl !== undefined
                      ? `${item.actualVolumeMl.toLocaleString('id-ID')} mL`
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

                  <td className="p-3 font-medium">{item.initiatedByRole || 'User'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 text-xs text-app-on-surface-variant">
          <span>
            Halaman {pagination.page} dari {pagination.totalPages} ({pagination.totalItems} riwayat)
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={pagination.page <= 1 || loading}
              onClick={() => fetchHistory(pagination.page - 1)}
              className="p-1.5 rounded-lg border border-app-outline-variant/30 hover:bg-app-surface-container disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => fetchHistory(pagination.page + 1)}
              className="p-1.5 rounded-lg border border-app-outline-variant/30 hover:bg-app-surface-container disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
