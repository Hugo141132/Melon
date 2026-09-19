'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { SoilPredictionDto, WaterPredictionDto } from '@kebun-melon/contracts';

export type LatestPredictionData = SoilPredictionDto | WaterPredictionDto;

export interface UseLatestPredictionResult {
  prediction: LatestPredictionData | null;
  isLoading: boolean;
  isRevalidating: boolean;
  isUnavailable: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export interface UseLatestPredictionOptions {
  pollingIntervalMs?: number;
}

/**
 * Hook to retrieve and auto-poll latest ML predictions and agronomic recommendations
 * for a specific monitoring device (TASK-0413 Phase D).
 *
 * Polling cadence defaults to 30s to match backend cache-aside TTL.
 * Uses activeDeviceIdRef to safely guard against in-flight race conditions during device switching.
 */
export function useLatestPrediction(
  deviceId: string | null | undefined,
  options: UseLatestPredictionOptions = {}
): UseLatestPredictionResult {
  const { pollingIntervalMs = 30000 } = options;
  const [prediction, setPrediction] = useState<LatestPredictionData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRevalidating, setIsRevalidating] = useState<boolean>(false);
  const [isUnavailable, setIsUnavailable] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const activeDeviceIdRef = useRef<string | null | undefined>(deviceId);

  const fetchLatestPrediction = useCallback(
    async (isInitial = false) => {
      if (!deviceId) {
        setPrediction(null);
        setIsLoading(false);
        setIsRevalidating(false);
        setIsUnavailable(false);
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
          `/api/v1/devices/${encodeURIComponent(deviceId)}/predictions/latest`
        );

        // Guard against race condition if user switched devices while request was in-flight
        if (activeDeviceIdRef.current !== deviceId) {
          return;
        }

        if (!response.ok) {
          const json = await response.json().catch(() => null);
          if (response.status === 401) {
            setError('Sesi telah berakhir. Silakan login kembali.');
          } else if (response.status === 403) {
            setError('Anda tidak memiliki akses ke prediksi perangkat ini.');
          } else if (response.status === 404) {
            setError('Perangkat tidak ditemukan.');
          } else {
            setError(json?.error?.message || `Gagal memuat rekomendasi (${response.status})`);
          }
          setPrediction(null);
          setIsUnavailable(false);
          return;
        }

        const json = await response.json();
        if (activeDeviceIdRef.current !== deviceId) {
          return;
        }

        if (json.success) {
          if (json.data) {
            setPrediction(json.data);
            setIsUnavailable(false);
            setError(null);
          } else {
            setPrediction(null);
            setIsUnavailable(json.meta?.status === 'UNAVAILABLE' || true);
            setError(null);
          }
        } else {
          setError(json.error?.message || 'Format data rekomendasi tidak valid.');
          setPrediction(null);
        }
      } catch (err: any) {
        if (activeDeviceIdRef.current === deviceId) {
          setError(err?.message || 'Gagal terhubung ke layanan rekomendasi.');
        }
      } finally {
        if (activeDeviceIdRef.current === deviceId) {
          setIsLoading(false);
          setIsRevalidating(false);
        }
      }
    },
    [deviceId]
  );

  useEffect(() => {
    activeDeviceIdRef.current = deviceId;
    setPrediction(null);
    setError(null);
    setIsUnavailable(false);

    if (!deviceId) {
      setIsLoading(false);
      setIsRevalidating(false);
      return;
    }

    setIsLoading(true);
    fetchLatestPrediction(true);

    const intervalId = setInterval(() => {
      fetchLatestPrediction(false);
    }, pollingIntervalMs);

    return () => {
      clearInterval(intervalId);
    };
  }, [deviceId, fetchLatestPrediction, pollingIntervalMs]);

  return {
    prediction,
    isLoading,
    isRevalidating,
    isUnavailable,
    error,
    refetch: () => fetchLatestPrediction(false),
  };
}
