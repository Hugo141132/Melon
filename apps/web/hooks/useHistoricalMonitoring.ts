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
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fromIso = range.from.toISOString();
      const toIso = range.to.toISOString();
      const pageSize = 100;
      let page = 1;
      let allSeries: any[] = [];
      let totalPages = 1;

      const isMultiDay = range.to.getTime() - range.from.getTime() > 24 * 60 * 60 * 1000;

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
        allSeries = allSeries.concat(seriesChunk);

        totalPages = json.data.pagination?.totalPages || 1;
        page++;
      }

      // Format items with localised time display & presentation boundary EC conversion (mS/cm -> µS/cm)
      const formattedItems: BaseSeriesItem[] = allSeries.map((item: any) => {
        const itemDate = new Date(item.timestamp);
        const timeStr = isMultiDay
          ? itemDate.toLocaleString('id-ID', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })
          : itemDate.toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
            });

        // Explicit presentation conversion from source unit (mS/cm) to display unit (µS/cm: 1 mS/cm = 1000 µS/cm)
        let ecVal = item.ec;
        if (ecVal !== null && ecVal !== undefined && typeof ecVal === 'number') {
          ecVal = Math.round(ecVal * 1000);
        }

        return {
          ...item,
          ec: ecVal,
          time: timeStr,
        };
      });

      setData(formattedItems);
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
