'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDeviceContext } from '@/context/DeviceContext';
import type { LatestMonitoringSnapshotDto } from '@kebun-melon/contracts';

export interface UseLatestMonitoringResult {
  snapshot: LatestMonitoringSnapshotDto | null;
  isLoading: boolean;
  isRevalidating: boolean;
  isStale: boolean;
  connectionStatus: string | null;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useLatestMonitoring(): UseLatestMonitoringResult {
  const { selectedDeviceId, selectedDevice } = useDeviceContext();
  const [snapshot, setSnapshot] = useState<LatestMonitoringSnapshotDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRevalidating, setIsRevalidating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const activeDeviceIdRef = useRef<string | null>(selectedDeviceId);

  const fetchLatestSnapshot = useCallback(
    async (isInitial = false) => {
      if (!selectedDeviceId) {
        setSnapshot(null);
        setIsLoading(false);
        setIsRevalidating(false);
        setError(null);
        return;
      }

      if (isInitial) {
        setIsLoading(true);
      } else {
        setIsRevalidating(true);
      }

      try {
        const response = await fetch(
          `/api/v1/devices/${encodeURIComponent(selectedDeviceId)}/monitoring/latest`
        );

        // Guard against race condition: if device changed while request was in-flight, discard
        if (activeDeviceIdRef.current !== selectedDeviceId) {
          return;
        }

        if (!response.ok) {
          const json = await response.json().catch(() => null);
          if (response.status === 401) {
            setError('Sesi telah berakhir. Silakan login kembali.');
          } else if (response.status === 403) {
            setError('Anda tidak memiliki akses ke data pemantauan perangkat ini.');
          } else if (response.status === 404) {
            setError('Perangkat tidak ditemukan.');
          } else {
            setError(json?.error?.message || `Gagal memuat data pemantauan (${response.status})`);
          }
          setSnapshot(null);
          return;
        }

        const json = await response.json();
        if (activeDeviceIdRef.current !== selectedDeviceId) {
          return;
        }

        if (json.success && json.data) {
          setSnapshot(json.data);
          setError(null);
        } else {
          setError(json.error?.message || 'Format data pemantauan tidak valid.');
          setSnapshot(null);
        }
      } catch (err: any) {
        if (activeDeviceIdRef.current === selectedDeviceId) {
          setError(err?.message || 'Gagal terhubung ke server pemantauan.');
        }
      } finally {
        if (activeDeviceIdRef.current === selectedDeviceId) {
          setIsLoading(false);
          setIsRevalidating(false);
        }
      }
    },
    [selectedDeviceId]
  );

  // Immediate data clearing on device switch
  useEffect(() => {
    activeDeviceIdRef.current = selectedDeviceId;
    setSnapshot(null);
    setError(null);

    if (!selectedDeviceId) {
      setIsLoading(false);
      setIsRevalidating(false);
      return;
    }

    setIsLoading(true);
    fetchLatestSnapshot(true);

    // Auto-polling loop every 10 seconds
    const intervalId = setInterval(() => {
      fetchLatestSnapshot(false);
    }, 10000);

    return () => {
      clearInterval(intervalId);
    };
  }, [selectedDeviceId, fetchLatestSnapshot]);

  const isStale =
    snapshot?.soil?.isStale ||
    snapshot?.water?.isStale ||
    selectedDevice?.connectionStatus === 'STALE' ||
    false;

  const connectionStatus = selectedDevice?.connectionStatus || snapshot?.connectionStatus || null;

  return {
    snapshot,
    isLoading,
    isRevalidating,
    isStale,
    connectionStatus,
    error,
    refetch: () => fetchLatestSnapshot(false),
  };
}
