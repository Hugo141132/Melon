'use client';

import React, { useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  ReadingHistoryTable,
  type HistoryMetricColumn,
  type HistoryReadingRow,
} from './ReadingHistoryTable';
import { useHistoryPagination } from '@/hooks/useHistoryPagination';

/**
 * Domain-agnostic container that wires the measurement-history table to the API
 * for ONE device/domain pair.
 *
 * Caching discipline:
 * - The history page goes through `useHistoryPagination`, which drops stale
 *   responses and enforces exactly 5 rows per page.
 * - Saving, renaming or clearing an annotation invalidates the current table
 *   page and notifies the parent so the domain chart re-evaluates.
 */

export interface MeasurementHistoryPanelProps {
  deviceId: string;
  domain: 'soil' | 'water';
  /** Stable column descriptors; identity must not change per render. */
  metricColumns: HistoryMetricColumn[];
  from: Date;
  to: Date;
  onAnnotationChange?: () => void;
}

interface HistoryEnvelopeRow {
  id?: string;
  readingId?: string;
  recordedAt?: string;
  timestamp?: string;
  receivedAt?: string | null;
  locationName?: string | null;
  locationKey?: string | null;
  locationAnnotatedAt?: string | null;
  locationNamedBy?: { fullName?: string | null } | null;
  namedByFullName?: string | null;
  [key: string]: unknown;
}

export function MeasurementHistoryPanel({
  deviceId,
  domain,
  metricColumns,
  from,
  to,
  onAnnotationChange,
}: MeasurementHistoryPanelProps) {
  const tHistory = useTranslations('history');

  const basePath = `/api/v1/devices/${deviceId}/monitoring/${domain}`;

  // The window identity changes only when the date controls actually change,
  const windowKey = useMemo(
    () => `${Math.floor(from.getTime() / 60000)}|${Math.floor(to.getTime() / 60000)}`,
    [from, to]
  );

  const buildQuery = useCallback(
    (page: number, pageSize: number) => {
      const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
        page: String(page),
        pageSize: String(pageSize),
      });
      return `${basePath}/history?${params.toString()}`;
    },
    [basePath, from, to]
  );

  const selectItems = useCallback((payload: unknown) => {
    const data = (payload as { data?: Record<string, unknown> }).data ?? {};
    const rows = ((data.readings ?? data.series ?? []) as HistoryEnvelopeRow[]).map(
      (row): HistoryReadingRow => ({
        readingId: (row.readingId ?? row.id) as string,
        recordedAt: (row.recordedAt ?? row.timestamp) as string,
        receivedAt: row.receivedAt ?? null,
        locationName: row.locationName ?? null,
        locationKey: row.locationKey ?? null,
        namedByFullName: row.namedByFullName ?? row.locationNamedBy?.fullName ?? null,
        annotatedAt: row.locationAnnotatedAt ?? null,
        metrics: row as Record<string, number | null>,
      })
    );
    return rows;
  }, []);

  const selectMeta = useCallback((payload: unknown) => {
    const data = (payload as { data?: Record<string, unknown> }).data ?? {};
    const meta = (data.pagination ?? data.meta ?? {}) as Record<string, unknown>;
    return {
      totalItems: Number(meta.totalItems ?? meta.total ?? meta.totalRecords ?? 0),
      totalPages: Number(meta.totalPages ?? 1),
      pageSize: Number(meta.pageSize ?? 5),
    };
  }, []);

  const pagination = useHistoryPagination<HistoryReadingRow>({
    buildQuery,
    selectItems,
    selectMeta,
    resetKey: windowKey,
    enabled: Boolean(deviceId),
  });

  const handleSaveLocation = useCallback(
    async (readingId: string, locationName: string | null) => {
      const response = await fetch(`${basePath}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ readingId, locationName }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error?.message ?? 'Failed to save location.');
      }

      // Targeted invalidation: refresh table and inform parent
      pagination.refresh();
      onAnnotationChange?.();
    },
    [basePath, pagination, onAnnotationChange]
  );

  const handleRefresh = useCallback(() => {
    pagination.refresh();
    onAnnotationChange?.();
  }, [pagination, onAnnotationChange]);

  return (
    <div className="flex flex-col gap-4">
      <ReadingHistoryTable
        readings={pagination.items}
        columns={metricColumns}
        loading={pagination.loading}
        error={pagination.error}
        isEmpty={pagination.isEmpty}
        page={pagination.meta.page}
        totalPages={pagination.meta.totalPages}
        totalItems={pagination.meta.totalItems}
        onNextPage={pagination.nextPage}
        onPreviousPage={pagination.previousPage}
        onRefresh={handleRefresh}
        onSaveLocation={handleSaveLocation}
      />
      <p className="px-1 text-[11px] text-app-on-surface-variant">{tHistory('allDataNote')}</p>
    </div>
  );
}
