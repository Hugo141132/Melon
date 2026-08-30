import { useState, useEffect, useCallback } from 'react';

export type DateRangePreset = '24h' | '7d' | '30d' | 'custom';
export type DomainType = 'soil' | 'water';

export interface BaseSeriesItem {
  timestamp: string;
  time: string;
  [key: string]: any;
}

export interface UseHistoricalMonitoringOptions {
  deviceId?: string | null;
  domain: DomainType;
  initialPreset?: DateRangePreset;
  initialMetric?: string;
}

const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000; // 31 days per DEC-MON-087

const TIME_DRIFT_TOLERANCE_MS = 60 * 1000; // 1 minute tolerance for recent data

// In-memory cache to prevent reloading the entire history
interface GlobalCache {
  rawData: any[];
  earliestDate: number;
  latestDate: number;
}
export const globalHistoryCache = new Map<string, GlobalCache>();

function groupDataByHour(data: any[], isMultiDay: boolean): BaseSeriesItem[] {
  const groups = new Map<number, any[]>();

  for (const item of data) {
    const d = new Date(item.timestamp);
    d.setMinutes(0, 0, 0); // Truncate to the top of the hour
    const t = d.getTime();
    if (!groups.has(t)) {
      groups.set(t, []);
    }
    groups.get(t)!.push(item);
  }

  const result: BaseSeriesItem[] = [];
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => a - b);

  for (const t of sortedKeys) {
    const items = groups.get(t)!;
    const itemDate = new Date(t);
    const day = itemDate.getDate();
    const month = itemDate
      .toLocaleDateString('id-ID', { month: 'short' })
      .replace(/,/g, '')
      .replace(/\./g, '')
      .trim();
    const hh = String(itemDate.getHours()).padStart(2, '0');
    const mm = String(itemDate.getMinutes()).padStart(2, '0');
    const timeStr = isMultiDay ? `${day} ${month} ${hh}:${mm}` : `${hh}:${mm}`;

    const avg = (field: string) => {
      const valid = items.filter((i) => typeof i[field] === 'number');
      if (valid.length === 0) return null;
      const sum = valid.reduce((acc, i) => acc + i[field], 0);
      return Number((sum / valid.length).toFixed(2));
    };

    // Calculate averages for numeric metrics
    const n = avg('nitrogen');
    const p = avg('phosphorus');
    const k = avg('potassium');

    const ecRaw = avg('ec');
    // Explicit presentation conversion from source unit (mS/cm) to display unit (µS/cm: 1 mS/cm = 1000 µS/cm)
    const ecVal = ecRaw !== null ? Math.round(ecRaw * 1000) : null;

    // Sort items by timestamp to ensure we get the latest status
    items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    result.push({
      timestamp: itemDate.toISOString(),
      time: timeStr,
      nitrogen: n,
      phosphorus: p,
      potassium: k,
      n, // map to n for NPKChart compatibility
      p, // map to p for NPKChart compatibility
      k, // map to k for NPKChart compatibility
      temperature: avg('temperature'),
      moisture: avg('moisture'),
      ph: avg('ph'),
      tds: avg('tds'),
      ec: ecVal,
      status: items[items.length - 1].status, // take latest status within this hour
    });
  }

  return result;
}

export function useHistoricalMonitoring({
  deviceId,
  domain,
  initialPreset = '24h',
  initialMetric,
}: UseHistoricalMonitoringOptions) {
  const defaultMetric = initialMetric || (domain === 'soil' ? 'npk' : 'ec');

  const [preset, setPreset] = useState<DateRangePreset>(initialPreset);
  const [selectedMetric, setSelectedMetric] = useState<string>(defaultMetric);
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');

  const [data, setData] = useState<BaseSeriesItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRangeError, setDateRangeError] = useState<string | null>(null);

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
      setDateRangeError('Format tanggal tidak valid.');
      return null;
    }

    if (from.getTime() > to.getTime()) {
      setDateRangeError('Tanggal mulai harus sebelum tanggal selesai.');
      return null;
    }

    if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
      setDateRangeError('Rentang tanggal tidak boleh melebihi 31 hari (DEC-MON-087).');
      return null;
    }

    setDateRangeError(null);
    return { from, to };
  }, [preset, customFrom, customTo]);

  const fetchData = useCallback(async () => {
    if (!deviceId) {
      setData([]);
      setLoading(false);
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
    const cacheKey = `${domain}-${deviceId}`;

    // Initialize cache for this device/domain if it doesn't exist
    if (!globalHistoryCache.has(cacheKey)) {
      globalHistoryCache.set(cacheKey, { rawData: [], earliestDate: toTime, latestDate: 0 });
    }
    const cache = globalHistoryCache.get(cacheKey)!;

    const rangesToFetch: { from: Date; to: Date }[] = [];

    // Determine which sub-ranges are missing from the cache
    if (cache.rawData.length === 0) {
      rangesToFetch.push({ from: range.from, to: range.to });
    } else {
      // If we requested earlier data than what's cached
      if (fromTime < cache.earliestDate) {
        rangesToFetch.push({ from: range.from, to: new Date(cache.earliestDate) });
      }
      // If we requested newer data than what's cached (with drift tolerance)
      if (toTime > cache.latestDate + TIME_DRIFT_TOLERANCE_MS) {
        rangesToFetch.push({ from: new Date(cache.latestDate), to: range.to });
      }
    }

    // If all requested data already exists in cache, update immediately without loading state
    if (rangesToFetch.length === 0) {
      const filteredData = cache.rawData.filter((item) => {
        const t = new Date(item.timestamp).getTime();
        return t >= fromTime && t <= toTime;
      });

      const isMultiDay = toTime - fromTime > 24 * 60 * 60 * 1000;
      const aggregatedItems = groupDataByHour(filteredData, isMultiDay);

      setData(aggregatedItems);
      setError(null);
      setLoading(false);
      return;
    }

    // Real API fetch required -> show loading state
    setLoading(true);
    setError(null);

    try {
      // Fetch the missing ranges
      for (const fetchRange of rangesToFetch) {
        const fromIso = fetchRange.from.toISOString();
        const toIso = fetchRange.to.toISOString();
        const pageSize = 100;
        let page = 1;
        let totalPages = 1;

        while (page <= totalPages && page <= 10) {
          const url = `/api/v1/devices/${encodeURIComponent(
            deviceId
          )}/monitoring/${domain}/history?from=${encodeURIComponent(
            fromIso
          )}&to=${encodeURIComponent(toIso)}&pageSize=${pageSize}&page=${page}`;

          const res = await fetch(url);
          if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            throw new Error(
              errJson?.error?.message || `Gagal mengambil data riwayat (HTTP ${res.status}).`
            );
          }

          const json = await res.json();
          if (!json.success || !json.data) {
            throw new Error(json?.error?.message || 'Respons API riwayat tidak valid.');
          }

          const seriesChunk = json.data.series || [];
          cache.rawData = cache.rawData.concat(seriesChunk);

          totalPages = json.data.pagination?.totalPages || 1;
          page++;
        }
      }

      // Deduplicate and sort cached data after merging
      cache.rawData.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      const uniqueData = [];
      let lastTime = '';
      for (const item of cache.rawData) {
        if (item.timestamp !== lastTime) {
          uniqueData.push(item);
          lastTime = item.timestamp;
        }
      }

      cache.rawData = uniqueData;
      cache.earliestDate = Math.min(fromTime, cache.earliestDate);
      cache.latestDate = Math.max(toTime, cache.latestDate);

      // Filter raw data to match the requested range precisely
      const filteredData = cache.rawData.filter((item) => {
        const t = new Date(item.timestamp).getTime();
        return t >= fromTime && t <= toTime;
      });

      const isMultiDay = toTime - fromTime > 24 * 60 * 60 * 1000;

      // Downsample/aggregate data to 1-hour interval for UI visualization
      const aggregatedItems = groupDataByHour(filteredData, isMultiDay);

      setData(aggregatedItems);
    } catch (err: any) {
      setError(err?.message || 'Terjadi kesalahan saat memuat data riwayat.');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [deviceId, domain, calculateDateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    preset,
    setPreset,
    selectedMetric,
    setSelectedMetric,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    data,
    loading,
    error,
    dateRangeError,
    refetch: fetchData,
  };
}
