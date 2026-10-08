'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, MapPin, Pencil, RefreshCw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

/**
 * Shared measurement-history table used by both the soil and water-quality
 * domains.
 *
 * Behavioural contract:
 * - Exactly 5 rows per page, fetched server-side. Unnamed readings are rendered
 *   like any other row, never hidden.
 * - The "Measured at" column shows the reading's own timestamp. "Received at"
 *   is rendered separately and is explicitly labelled as ingestion time, so a
 *   quiet device is not confused with an offline one.
 * - The location cell is editable inline and writes to ONE immutable reading id.
 *   The device's current location is irrelevant here, because the device moves.
 * - Nothing re-renders on a timer. A save invalidates exactly one reading, so
 *   the table refetches the current page once and the chart refetches only if the
 *   edited reading's location feeds the selected chart location.
 */

export interface HistoryReadingRow {
  readingId: string;
  recordedAt: string;
  receivedAt: string | null;
  locationName: string | null;
  locationKey: string | null;
  namedByFullName: string | null;
  annotatedAt: string | null;
  /** Metric values exactly as stored; null means "not measured", not zero. */
  metrics: Record<string, number | null>;
}

export interface HistoryMetricColumn {
  key: string;
  label: string;
  unit?: string;
  precision?: number;
}

export interface ReadingHistoryTableProps {
  readings: HistoryReadingRow[];
  columns: HistoryMetricColumn[];
  loading: boolean;
  error: string | null;
  isEmpty: boolean;
  page: number;
  totalPages: number;
  totalItems: number;
  onNextPage: () => void;
  onPreviousPage: () => void;
  onRefresh: () => void;
  /** Resolves the promise when the annotation has been persisted. */
  onSaveLocation: (readingId: string, locationName: string | null) => Promise<void>;
}

type EditingState = { readingId: string; value: string } | null;

export function ReadingHistoryTable({
  readings,
  columns,
  loading,
  error,
  isEmpty,
  page,
  totalPages,
  totalItems,
  onNextPage,
  onPreviousPage,
  onRefresh,
  onSaveLocation,
}: ReadingHistoryTableProps) {
  const tHistory = useTranslations('history');
  const tCommon = useTranslations('common');

  const [editing, setEditing] = useState<EditingState>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const startEditing = useCallback((reading: HistoryReadingRow) => {
    setActionError(null);
    setNotice(null);
    setEditing({ readingId: reading.readingId, value: reading.locationName ?? '' });
  }, []);

  const cancelEditing = useCallback(() => {
    setEditing(null);
    setActionError(null);
  }, []);

  const commit = useCallback(
    async (readingId: string, nextValue: string | null) => {
      setSavingId(readingId);
      setActionError(null);
      setNotice(null);
      try {
        await onSaveLocation(readingId, nextValue);
        setEditing(null);
        setNotice(nextValue === null ? tHistory('locationCleared') : tHistory('locationSaved'));
      } catch (error) {
        setActionError(tHistory('locationSaveFailed'));
      } finally {
        setSavingId(null);
      }
    },
    [onSaveLocation, tHistory]
  );

  const handleSave = useCallback(() => {
    if (!editing) return;
    const trimmed = editing.value.trim();
    if (trimmed.length === 0) {
      setActionError(tHistory('locationRequired'));
      return;
    }
    void commit(editing.readingId, trimmed);
  }, [commit, editing, tHistory]);

  const handleClear = useCallback(() => {
    if (!editing) return;
    void commit(editing.readingId, null);
  }, [commit, editing]);

  const visibleRows = useMemo(() => readings, [readings]);

  const renderMetricValue = useCallback(
    (row: HistoryReadingRow, column: HistoryMetricColumn) => {
      const value = row.metrics[column.key];
      // A null measurement is rendered as an explicit dash. Converting it to 0
      // would invent a reading that the device never produced.
      if (value === null || value === undefined) {
        return <span className="text-app-outline-variant">{tHistory('noValue')}</span>;
      }
      const precision = column.precision ?? 2;
      return (
        <span>
          {value.toFixed(precision)}
          {column.unit ? (
            <span className="ml-0.5 text-[10px] text-app-on-surface-variant">{column.unit}</span>
          ) : null}
        </span>
      );
    },
    [tHistory]
  );

  return (
    <div
      className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest shadow-[0_4px_24px_rgba(0,0,0,0.06)]"
      id="reading-history-panel"
    >
      <div className="flex flex-col gap-1 border-b border-outline-variant/40 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-app-on-surface">
            {tHistory('readingsTitle')}
          </h2>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            aria-label={tCommon('refresh')}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-app-on-surface-variant transition-colors hover:bg-surface-container hover:text-app-on-surface disabled:opacity-40"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>
        <p className="text-xs text-app-on-surface-variant">{tHistory('readingsSubtitle')}</p>
      </div>

      {notice ? (
        <p className="border-b border-outline-variant/40 px-4 py-2 text-xs text-app-primary">
          {notice}
        </p>
      ) : null}
      {actionError ? (
        <p className="border-b border-outline-variant/40 px-4 py-2 text-xs text-app-error">
          {actionError}
        </p>
      ) : null}

      {/* Horizontal scroll keeps every column reachable on narrow screens
          without collapsing values into unreadable abbreviations. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-outline-variant/40 text-left text-[11px] uppercase tracking-wide text-app-on-surface-variant">
              <th scope="col" className="p-3 font-medium">
                {tHistory('recordedAt')}
              </th>
              {columns.map((column) => (
                <th key={column.key} scope="col" className="p-3 text-right font-medium">
                  {column.label}
                </th>
              ))}
              <th scope="col" className="p-3 font-medium">
                {tHistory('chartLocationLabel')}
              </th>
              <th scope="col" className="p-3 font-medium">
                {tHistory('namedBy')}
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const isEditingThis = editing?.readingId === row.readingId;
              const isSavingThis = savingId === row.readingId;

              return (
                <tr
                  key={row.readingId}
                  className="border-b border-outline-variant/25 last:border-0 align-top"
                >
                  <td className="p-3">
                    <div className="font-mono text-[11px] text-app-on-surface">
                      {new Date(row.recordedAt).toLocaleString(undefined, {
                        dateStyle: 'short',
                        timeStyle: 'medium',
                      })}
                    </div>
                    {row.receivedAt ? (
                      <div className="mt-0.5 text-[10px] text-app-on-surface-variant">
                        {tHistory('receivedAt')}:{' '}
                        {new Date(row.receivedAt).toLocaleString(undefined, {
                          dateStyle: 'short',
                          timeStyle: 'medium',
                        })}
                      </div>
                    ) : null}
                  </td>

                  {columns.map((column) => (
                    <td key={column.key} className="p-3 text-right font-mono text-[12px]">
                      {renderMetricValue(row, column)}
                    </td>
                  ))}

                  <td className="p-3">
                    {isEditingThis ? (
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          value={editing.value}
                          onChange={(event) =>
                            setEditing({ readingId: row.readingId, value: event.target.value })
                          }
                          placeholder={tHistory('locationPlaceholder')}
                          aria-label={tHistory('setLocation')}
                          className="w-40 rounded-lg border border-outline bg-surface-container px-2 py-1 text-xs text-app-on-surface outline-none focus:border-primary"
                          autoFocus
                        />
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSavingThis}
                            className="rounded-lg bg-primary px-2 py-1 text-[11px] font-medium text-on-primary disabled:opacity-50"
                          >
                            {tHistory('saveLocation')}
                          </button>
                          <button
                            type="button"
                            onClick={handleClear}
                            disabled={isSavingThis}
                            className="rounded-lg border border-outline-variant px-2 py-1 text-[11px] font-medium text-app-on-surface disabled:opacity-50"
                          >
                            {tHistory('clearLocation')}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditing}
                            disabled={isSavingThis}
                            aria-label={tHistory('cancelLocation')}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-app-on-surface-variant hover:bg-surface-container"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 text-xs',
                            row.locationName ? 'text-app-on-surface' : 'text-app-outline-variant'
                          )}
                        >
                          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                          {row.locationName ?? tHistory('unnamed')}
                        </span>
                        <button
                          type="button"
                          onClick={() => startEditing(row)}
                          aria-label={
                            row.locationName ? tHistory('renameLocation') : tHistory('setLocation')
                          }
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-app-on-surface-variant transition-colors hover:bg-surface-container hover:text-app-on-surface"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    {row.annotatedAt && !isEditingThis ? (
                      <div className="mt-0.5 text-[10px] text-app-on-surface-variant">
                        {tHistory('annotatedAt')}: {new Date(row.annotatedAt).toLocaleString()}
                      </div>
                    ) : null}
                  </td>

                  <td className="p-3 text-xs text-app-on-surface-variant">
                    {row.namedByFullName ?? tHistory('noValue')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {loading ? (
        <p className="px-4 py-6 text-center text-xs text-app-on-surface-variant">
          {tHistory('loadingHistory')}
        </p>
      ) : error ? (
        <p className="px-4 py-6 text-center text-xs text-app-error">{error}</p>
      ) : isEmpty ? (
        <p className="px-4 py-6 text-center text-xs text-app-on-surface-variant">
          {tHistory('noData')}
        </p>
      ) : null}

      <div className="flex flex-col items-center justify-between gap-2 border-t border-outline-variant/40 px-4 py-3 text-xs text-app-on-surface-variant sm:flex-row">
        <span>
          {tHistory('pageOf', { page, total: Math.max(totalPages, 1) })} · {tHistory('rowsPerPage')}{' '}
          · {totalItems}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPreviousPage}
            disabled={page <= 1 || loading}
            aria-label="Previous page"
            className="inline-flex h-8 items-center gap-1 rounded-full border border-outline-variant px-3 font-medium transition-colors hover:bg-surface-container disabled:opacity-40"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onNextPage}
            disabled={page >= totalPages || loading}
            aria-label="Next page"
            className="inline-flex h-8 items-center gap-1 rounded-full border border-outline-variant px-3 font-medium transition-colors hover:bg-surface-container disabled:opacity-40"
          >
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
