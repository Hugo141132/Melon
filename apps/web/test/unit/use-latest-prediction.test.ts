import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useLatestPrediction } from '@/hooks/useLatestPrediction';
import type { SoilPredictionDto } from '@kebun-melon/contracts';

const mockSoilPrediction: SoilPredictionDto = {
  id: 'pred-soil-123',
  deviceId: 'soil-node-001',
  readingId: null,
  predictedClass: 'optimal',
  confidence: 0.95,
  summary: 'Kondisi tanah optimal.',
  farmerAction: [],
  issues: [],
  createdAt: '2026-09-18T10:00:00.000Z',
};

describe('TASK-0413 Phase D — useLatestPrediction Hook Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('1. returns null and not loading when deviceId is null or undefined', () => {
    const { result } = renderHook(() => useLatestPrediction(null));

    expect(result.current.prediction).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.isUnavailable).toBe(false);
  });

  it('2. successfully fetches and populates prediction data for active device', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: mockSoilPrediction,
      }),
    });

    const { result } = renderHook(() => useLatestPrediction('soil-node-001'));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.prediction).toEqual(mockSoilPrediction);
    expect(result.current.error).toBeNull();
    expect(result.current.isUnavailable).toBe(false);
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/devices/soil-node-001/predictions/latest');
  });

  it('3. handles safe UNAVAILABLE state when prediction is null in response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: null,
        meta: { status: 'UNAVAILABLE', message: 'No prediction available.' },
      }),
    });

    const { result } = renderHook(() => useLatestPrediction('soil-node-001'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.prediction).toBeNull();
    expect(result.current.isUnavailable).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('4. sets error on 403 Forbidden', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Unauthorized device access.' },
      }),
    });

    const { result } = renderHook(() => useLatestPrediction('soil-node-001'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.prediction).toBeNull();
    expect(result.current.error).toBe('Anda tidak memiliki akses ke prediksi perangkat ini.');
  });

  it('5. guards against race conditions by discarding in-flight responses when deviceId changes', async () => {
    let resolveFirstRequest: (value: any) => void;
    const firstRequestPromise = new Promise((resolve) => {
      resolveFirstRequest = resolve;
    });

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('device-first')) {
        return firstRequestPromise;
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { ...mockSoilPrediction, deviceId: 'device-second' },
        }),
      });
    });

    const { result, rerender } = renderHook(({ devId }) => useLatestPrediction(devId), {
      initialProps: { devId: 'device-first' },
    });

    // Switch device to device-second before first finishes
    rerender({ devId: 'device-second' });

    await waitFor(() => {
      expect(result.current.prediction?.deviceId).toBe('device-second');
    });

    // Now resolve the stale first request
    resolveFirstRequest!({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: { ...mockSoilPrediction, deviceId: 'device-first' },
      }),
    });

    // The prediction must remain device-second, not overwritten by stale device-first
    expect(result.current.prediction?.deviceId).toBe('device-second');
  });
});
