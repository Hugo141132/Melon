import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { ReadingLocationOption } from '@kebun-melon/contracts';

export type DateRangePreset = '24h' | '7d' | '30d' | 'custom';
export type DomainType = 'soil' | 'water';

export interface BaseSeriesItem {
  timestamp: string;
  time: string;
  readingId?: string;
  [key: string]: any;
}

export type { ReadingLocationOption };

export interface UseHistoricalMonitoringOptions {
  deviceId?: string | null;
  domain: DomainType;
  initialPreset?: DateRangePreset;
  initialMetric?: string;
  initialLocationKey?: string;
  annotationCacheToken?: string;
}

const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000; // 31 days per DEC-MON-087

/**
 * Maps each stored reading onto a chart point WITHOUT changing its value or
 * moving it in time.
 *
 * Preserves exact timestamps, values, nulls, and zeroes without hourly
 * bucketing or synthetic aggregation.
 */
function mapReadingsToSeries(data: any[], isMultiDay: boolean): BaseSeriesItem[] {
  return data.map((item) => {
    const itemDate = new Date(item.timestamp);

    const numeric = (field: string): number | null =>
      typeof item[field] === 'number' ? (item[field] as number) : null;

    const hh = String(itemDate.getHours()).padStart(2, '0');
    const mm = String(itemDate.getMinutes()).padStart(2, '0');
    const timeStr = isMultiDay
      ? `${itemDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} ${hh}:${mm}`
      : `${hh}:${mm}`;

    const n = numeric('nitrogen');
    const p = numeric('phosphorus');
    const k = numeric('potassium');
    const ec = numeric('ec');

    return {
      readingId: item.readingId,
      timestamp: itemDate.toISOString(),
      time: timeStr,
      nitrogen: n,
      phosphorus: p,
      potassium: k,
      n, // NPKChart reads the short aliases
      p,
      k,
      temperature: numeric('temperature'),
      moisture: numeric('moisture'),
      ph: numeric('ph'),
      tds: numeric('tds'),
      // EC is canonically stored in µS/cm (DEC-MON-091); no rescaling here.
      ec,
    } as BaseSeriesItem;
  });
}

export function useHistoricalMonitoring({
  deviceId,
  domain,
  initialPreset = '24h',
  initialMetric,
  initialLocationKey = '',
  annotationCacheToken,
}: UseHistoricalMonitoringOptions) {
  const defaultMetric = initialMetric || (domain === 'soil' ? 'npk' : 'ec');

  const [preset, setPreset] = useState<DateRangePreset>(initialPreset);
  const [selectedMetric, setSelectedMetric] = useState<string>(defaultMetric);
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');

  const [locations, setLocations] = useState<ReadingLocationOption[]>([]);
  const [selectedLocationKey, setSelectedLocationKey] = useState<string>(initialLocationKey);

  const [data, setData] = useState<BaseSeriesItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRangeError, setDateRangeError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState<boolean>(false);
  const chartRequestIdRef = useRef<number>(0);
  const chartAbortControllerRef = useRef<AbortController | null>(null);

  // Pure computation for the effective date range window
  const calculateDateRange = useCallback((): { from: Date; to: Date } | null => {
    const now = new Date();
    let from: Date;
    let to: Date = now;

    if (preset === '24h') {
      from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    } else if (preset === '7d') {
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (preset === '30d') {
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      if (!customFrom) {
        return null;
      }
      from = new Date(customFrom);
      to = customTo
        ? new Date(customTo.includes('T') ? customTo : `${customTo}T23:59:59.999Z`)
        : now;
    }

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return null;
    }

    if (from.getTime() > to.getTime()) {
      return null;
    }

    // An over-wide window is rejected rather than silently served as a partial dataset (DEC-MON-087)
    if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
      return null;
    }

    return { from, to };
  }, [preset, customFrom, customTo]);

  const resolvedRange = useMemo(() => calculateDateRange(), [calculateDateRange]);

  // Validate date range and report user-facing error message
  useEffect(() => {
    if (resolvedRange) {
      setDateRangeError(null);
      return;
    }

    const customStart = customFrom ? new Date(customFrom) : null;
    const customEnd = customTo
      ? new Date(customTo.includes('T') ? customTo : `${customTo}T23:59:59.999Z`)
      : null;

    if (customStart && isNaN(customStart.getTime())) {
      setDateRangeError('Format tanggal tidak valid.');
      return;
    }
    if (customEnd && isNaN(customEnd.getTime())) {
      setDateRangeError('Format tanggal tidak valid.');
      return;
    }
    if (customStart && customEnd && customStart.getTime() > customEnd.getTime()) {
      setDateRangeError('Tanggal mulai harus sebelum tanggal selesai.');
      return;
    }
    if (customStart && customEnd && customEnd.getTime() - customStart.getTime() > MAX_RANGE_MS) {
      setDateRangeError('Rentang tanggal tidak boleh melebihi 31 hari (DEC-MON-087).');
      return;
    }
  }, [resolvedRange, customFrom, customTo]);

  // Load distinct annotated locations for device and domain
  const loadLocations = useCallback(async () => {
    if (!deviceId || typeof deviceId !== 'string' || !deviceId.trim()) {
      setLocations([]);
      return;
    }

    try {
      const res = await fetch(
        `/api/v1/devices/${encodeURIComponent(deviceId.trim())}/monitoring/${domain}/locations`,
        { headers: { Accept: 'application/json' }, cache: 'no-store' }
      );
      if (!res.ok) {
        setLocations([]);
        return;
      }
      const contentType = res.headers?.get?.('content-type');
      if (contentType && !contentType.includes('application/json')) {
        setLocations([]);
        return;
      }
      const json = await res.json().catch(() => null);
      if (!json?.success || !json.data?.locations) {
        setLocations([]);
        return;
      }
      const fetchedLocations: ReadingLocationOption[] = json.data.locations;
      setLocations(fetchedLocations);

      setSelectedLocationKey((prev) => {
        if (prev && !fetchedLocations.some((l) => l.locationKey === prev)) {
          return '';
        }
        return prev;
      });
    } catch {
      setLocations([]);
    }
  }, [deviceId, domain]);

  // Fetch locations on mount and whenever device, domain or annotation token changes
  useEffect(() => {
    void loadLocations();
  }, [loadLocations, annotationCacheToken]);

  // Load chart series from dedicated /chart endpoint for selected location and date window
  const loadChartData = useCallback(async () => {
    // Abort any prior in-flight fetch on the wire
    if (chartAbortControllerRef.current) {
      chartAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    chartAbortControllerRef.current = abortController;

    const currentRequestId = ++chartRequestIdRef.current;

    if (!deviceId || typeof deviceId !== 'string' || !deviceId.trim()) {
      setData([]);
      setLoading(false);
      setError(null);
      setTruncated(false);
      return;
    }

    // Location isolation: A location must be selected before anything is plotted
    if (!selectedLocationKey) {
      setData([]);
      setLoading(false);
      setError(null);
      setTruncated(false);
      return;
    }

    const range = calculateDateRange();
    if (!range) {
      setData([]);
      setLoading(false);
      return;
    }

    const fromTime = range.from.getTime();
    const toTime = range.to.getTime();
    const fromIso = range.from.toISOString();
    const toIso = range.to.toISOString();

    setLoading(true);
    setError(null);
    setTruncated(false);

    try {
      const BATCH_SIZE = 1000;
      let currentCursor: string | null = null;
      const seenCursors = new Set<string>();
      const accumulatedPoints: any[] = [];

      do {
        // Stale response guard: cancel further batching if filters or location changed
        if (currentRequestId !== chartRequestIdRef.current) {
          return;
        }

        const params = new URLSearchParams({
          locationKey: selectedLocationKey,
          from: fromIso,
          to: toIso,
          limit: String(BATCH_SIZE),
        });
        if (currentCursor) {
          params.set('cursor', currentCursor);
        }

        const url = `/api/v1/devices/${encodeURIComponent(
          deviceId
        )}/monitoring/${domain}/chart?${params.toString()}`;

        const res = await fetch(url, {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
          signal: abortController.signal,
        });

        const json = await res.json().catch(() => ({}));

        if (currentRequestId !== chartRequestIdRef.current) {
          return;
        }

        if (!res.ok || json?.success === false) {
          const errorMsg =
            json?.error?.message || `Gagal mengambil data grafik (HTTP ${res.status}).`;
          setError(errorMsg);
          setData([]);
          setTruncated(false);
          return;
        }

        const batchPoints = json.data?.points || [];
        accumulatedPoints.push(...batchPoints);

        const nextCursor = json.data?.nextCursor || null;
        if (nextCursor) {
          if (seenCursors.has(nextCursor)) {
            throw new Error('Terdeteksi kursor non-advancing pada pagination grafik.');
          }
          seenCursors.add(nextCursor);
        }
        currentCursor = nextCursor;
      } while (currentCursor);

      if (currentRequestId !== chartRequestIdRef.current) {
        return;
      }

      // Re-order strictly chronologically by sensor recordedAt (fallback receivedAt/timestamp)
      accumulatedPoints.sort((a, b) => {
        const at = new Date(a.recordedAt || a.timestamp || a.receivedAt).getTime();
        const bt = new Date(b.recordedAt || b.timestamp || b.receivedAt).getTime();
        if (at !== bt) return at - bt;
        const aId = a.readingId || a.id || '';
        const bId = b.readingId || b.id || '';
        return aId < bId ? -1 : aId > bId ? 1 : 0;
      });

      const isMultiDay = toTime - fromTime > 24 * 60 * 60 * 1000;
      const mapped = mapReadingsToSeries(accumulatedPoints, isMultiDay);

      setData(mapped);
      setTruncated(false);
      setError(null);
    } catch (err: any) {
      if (err?.name === 'AbortError' || currentRequestId !== chartRequestIdRef.current) {
        return;
      }
      setError(err?.message || 'Terjadi kesalahan saat memuat data grafik.');
      setData([]);
      setTruncated(false);
    } finally {
      if (currentRequestId === chartRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [deviceId, domain, selectedLocationKey, calculateDateRange]);

  // Clean up in-flight abort controller on unmount
  useEffect(() => {
    return () => {
      chartAbortControllerRef.current?.abort();
    };
  }, []);

  // Refetches chart when location, date range, or annotation token changes
  useEffect(() => {
    void loadChartData();
  }, [loadChartData, annotationCacheToken]);

  return {
    preset,
    setPreset,
    selectedMetric,
    setSelectedMetric,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    resolvedRange,
    locations,
    selectedLocationKey,
    setSelectedLocationKey,
    data,
    loading,
    error,
    dateRangeError,
    truncated,
    refetchLocations: loadLocations,
    refetchChart: loadChartData,
    refetch: loadChartData,
  };
}
