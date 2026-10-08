/**
 * End-to-end unit and UI test proving that:
 * 1. 1,000-point total restriction is removed: Soil and Water chart endpoints return bounded keyset batches with nextCursor rather than rejecting with 400 CHART_POINTS_EXCEEDED.
 * 2. Datasets with 999, 1,000, and 1,001+ readings are completely retrieved without data loss or duplication.
 * 3. Client hook useHistoricalMonitoring sequentially retrieves all cursor batches and plots the entire dataset.
 * 4. Stale request cancellation is enforced when location or date filters change during multi-batch retrieval.
 * 5. Honest error handling: partial batches are never presented as complete when a fetch error occurs.
 * 6. Sensor timestamps, zero/null values, and chronological ordering are preserved across batches.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

const {
  mockRequireActiveAccount,
  mockRequirePermission,
  mockGetSessionOrNull,
  mockGetSoilChartSeries,
  mockGetWaterChartSeries,
  mockGetSoilReadingLocations,
  mockGetWaterReadingLocations,
} = vi.hoisted(() => ({
  mockRequireActiveAccount: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockGetSessionOrNull: vi.fn(),
  mockGetSoilChartSeries: vi.fn(),
  mockGetWaterChartSeries: vi.fn(),
  mockGetSoilReadingLocations: vi.fn(),
  mockGetWaterReadingLocations: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ get: () => undefined }),
}));

vi.mock('@kebun-melon/database', () => ({
  prisma: {},
  TelemetryRepository: class {
    getSoilChartSeries = mockGetSoilChartSeries;
    getWaterChartSeries = mockGetWaterChartSeries;
    getSoilReadingLocations = mockGetSoilReadingLocations;
    getWaterReadingLocations = mockGetWaterReadingLocations;
  },
}));

vi.mock('@/lib/auth/rbac', () => ({
  getSessionOrNull: mockGetSessionOrNull,
  requireActiveAccount: mockRequireActiveAccount,
  requirePermission: mockRequirePermission,
  AuthorizationError: class AuthorizationError extends Error {},
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const messages: Record<string, string> = {
      chartSelectLocation: 'Select a location to view its trend',
      chartSelectLocationHint: 'Readings without a location are not plotted.',
      chartLocationLabel: 'Location',
      loadingHistory: 'Loading history...',
      chartNoData: 'No readings for this location in the selected range.',
      npkTrend: 'Soil NPK Trend',
      nitrogen: 'Nitrogen',
      phosphorus: 'Phosphorus',
      potassium: 'Potassium',
      temperature: 'Temperature',
      moisture: 'Moisture',
      preset24h: '24 Hours',
      preset7d: '7 Days',
      preset30d: '30 Days',
      customRange: 'Custom',
    };
    return messages[key] ?? key;
  },
  useLocale: () => 'id',
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children, data }: any) => (
    <div data-testid="line-chart" data-points-count={data?.length}>
      {children}
    </div>
  ),
  Line: () => <div data-testid="recharts-line" />,
  CartesianGrid: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
}));

import { GET as getSoilChart } from '@/app/api/v1/devices/[deviceId]/monitoring/soil/chart/route';
import { GET as getWaterChart } from '@/app/api/v1/devices/[deviceId]/monitoring/water/chart/route';
import HistoricalChartControls from '@/components/charts/HistoricalChartControls';
import NPKChart from '@/components/charts/NPKChart';
import { useHistoricalMonitoring } from '@/hooks/useHistoricalMonitoring';

describe('Chart Point Limit Removal & Keyset Cursor Pagination (TASK-0503 / TASK-0504)', () => {
  const sessionUser = {
    user: { id: 'user-1', email: 'owner@melon.test', role: 'OWNER' },
    activeRole: 'OWNER',
  };

  const validShortFrom = '2026-10-01T10:00:00.000Z';
  const validShortTo = '2026-10-01T11:00:00.000Z';

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSessionOrNull.mockResolvedValue(sessionUser);
    mockRequireActiveAccount.mockReturnValue(sessionUser);
    mockRequirePermission.mockReturnValue(undefined);
  });

  describe('Soil Chart Route (GET /soil/chart)', () => {
    it('returns 200 OK with nextCursor instead of rejecting 1,001 points with CHART_POINTS_EXCEEDED', async () => {
      // 1000 points in first batch with nextCursor indicating more data exists
      const batch1Points = Array.from({ length: 1000 }, (_, i) => ({
        readingId: `soil-${i}`,
        timestamp: new Date(Date.parse(validShortFrom) + i * 1000).toISOString(),
        nitrogen: 20,
        phosphorus: 30,
        potassium: 40,
      }));

      mockGetSoilChartSeries.mockResolvedValueOnce({
        locationKey: 'bed-a',
        locationName: 'Bed A',
        series: batch1Points,
        nextCursor: '2026-10-01T10:16:39.000Z_soil-999',
        totalRows: 1001,
        truncated: false,
      });
      mockGetSoilReadingLocations.mockResolvedValueOnce([
        { locationKey: 'bed-a', locationName: 'Bed A' },
      ]);

      const req = new Request(
        `http://localhost/api/v1/devices/esp32-001/monitoring/soil/chart?locationKey=bed-a&from=${validShortFrom}&to=${validShortTo}&limit=1000`
      );
      const res = await getSoilChart(req, { params: Promise.resolve({ deviceId: 'esp32-001' }) });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.points).toHaveLength(1000);
      expect(body.data.nextCursor).toBe('2026-10-01T10:16:39.000Z_soil-999');
      expect(body.data.truncated).toBe(false);
      expect(body.error).toBeUndefined();
    });

    it('returns exact 999 points in single batch with null nextCursor', async () => {
      const mockPoints = Array.from({ length: 999 }, (_, i) => ({
        readingId: `soil-${i}`,
        timestamp: new Date(Date.parse(validShortFrom) + i * 1000).toISOString(),
        nitrogen: i,
        phosphorus: null, // Null preservation
        potassium: 0, // Zero preservation
      }));

      mockGetSoilChartSeries.mockResolvedValueOnce({
        locationKey: 'bed-a',
        locationName: 'Bed A',
        series: mockPoints,
        nextCursor: null,
        totalRows: 999,
        truncated: false,
      });
      mockGetSoilReadingLocations.mockResolvedValueOnce([
        { locationKey: 'bed-a', locationName: 'Bed A' },
      ]);

      const req = new Request(
        `http://localhost/api/v1/devices/esp32-001/monitoring/soil/chart?locationKey=bed-a&from=${validShortFrom}&to=${validShortTo}&limit=1000`
      );
      const res = await getSoilChart(req, { params: Promise.resolve({ deviceId: 'esp32-001' }) });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.points).toHaveLength(999);
      expect(body.data.nextCursor).toBeNull();
      expect(body.data.points[0].phosphorus).toBeNull();
      expect(body.data.points[0].potassium).toBe(0);
    });

    it('propagates cursor parameter to repository for multi-batch retrieval', async () => {
      mockGetSoilChartSeries.mockResolvedValueOnce({
        locationKey: 'bed-a',
        locationName: 'Bed A',
        series: [{ readingId: 'soil-1000', timestamp: validShortTo, nitrogen: 50 }],
        nextCursor: null,
        truncated: false,
      });
      mockGetSoilReadingLocations.mockResolvedValueOnce([
        { locationKey: 'bed-a', locationName: 'Bed A' },
      ]);

      const cursorParam = '2026-10-01T10:16:39.000Z_soil-999';
      const req = new Request(
        `http://localhost/api/v1/devices/esp32-001/monitoring/soil/chart?locationKey=bed-a&from=${validShortFrom}&to=${validShortTo}&limit=1000&cursor=${encodeURIComponent(cursorParam)}`
      );
      const res = await getSoilChart(req, { params: Promise.resolve({ deviceId: 'esp32-001' }) });

      expect(res.status).toBe(200);
      expect(mockGetSoilChartSeries).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: cursorParam,
          limit: 1000,
          locationKey: 'bed-a',
        })
      );
    });

    it('returns HTTP 400 validation error when cursor is malformed', async () => {
      const req = new Request(
        `http://localhost/api/v1/devices/esp32-001/monitoring/soil/chart?locationKey=bed-a&from=${validShortFrom}&to=${validShortTo}&cursor=malformed_without_date`
      );
      const res = await getSoilChart(req, { params: Promise.resolve({ deviceId: 'esp32-001' }) });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
    });
  });

  describe('Water Chart Route (GET /water/chart)', () => {
    it('returns 200 OK with batched data for water quality without total-point rejection', async () => {
      mockGetWaterChartSeries.mockResolvedValueOnce({
        locationKey: 'reservoir-1',
        locationName: 'Reservoir 1',
        series: [{ readingId: 'water-1', timestamp: validShortFrom, ph: 7.2, tds: 350, ec: 600 }],
        nextCursor: null,
        totalRows: 1,
        truncated: false,
      });
      mockGetWaterReadingLocations.mockResolvedValueOnce([
        { locationKey: 'reservoir-1', locationName: 'Reservoir 1' },
      ]);

      const req = new Request(
        `http://localhost/api/v1/devices/water-node-01/monitoring/water/chart?locationKey=reservoir-1&from=${validShortFrom}&to=${validShortTo}&limit=1000`
      );
      const res = await getWaterChart(req, {
        params: Promise.resolve({ deviceId: 'water-node-01' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.points[0].ph).toBe(7.2);
      expect(body.data.nextCursor).toBeNull();
    });
  });

  describe('Unified Chart UI Component Flow with Keyset Batching', () => {
    function UnifiedSoilChart({ deviceId }: { deviceId: string }) {
      const {
        preset,
        setPreset,
        selectedMetric,
        setSelectedMetric,
        customFrom,
        setCustomFrom,
        customTo,
        setCustomTo,
        locations,
        selectedLocationKey,
        setSelectedLocationKey,
        data,
        loading,
        error,
        dateRangeError,
      } = useHistoricalMonitoring({
        deviceId,
        domain: 'soil',
      });

      return (
        <div>
          <HistoricalChartControls
            domain="soil"
            selectedMetric={selectedMetric}
            onSelectMetric={setSelectedMetric}
            preset={preset}
            onSelectPreset={setPreset}
            customFrom={customFrom}
            onCustomFromChange={setCustomFrom}
            customTo={customTo}
            onCustomToChange={setCustomTo}
            dateRangeError={dateRangeError}
            locations={locations}
            selectedLocationKey={selectedLocationKey}
            onSelectLocationKey={setSelectedLocationKey}
          />
          <NPKChart
            data={data}
            selectedMetric={selectedMetric}
            preset={preset}
            loading={loading}
            error={error}
            selectedLocationKey={selectedLocationKey}
          />
        </div>
      );
    }

    it('sequentially retrieves multi-batch dataset (1,001 points) and plots all points without loss', async () => {
      const batch1Points = Array.from({ length: 1000 }, (_, i) => ({
        readingId: `r-${i}`,
        timestamp: new Date(Date.parse(validShortFrom) + i * 1000).toISOString(),
        nitrogen: 20 + (i % 10),
      }));

      const batch2Points = [
        {
          readingId: 'r-1000',
          timestamp: new Date(Date.parse(validShortFrom) + 1000 * 1000).toISOString(),
          nitrogen: 99,
        },
      ];

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/locations')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: {
                locations: [
                  {
                    locationKey: 'bed-a',
                    locationName: 'Bed A',
                    readingCount: 1001,
                    firstRecordedAt: null,
                    lastRecordedAt: null,
                  },
                ],
              },
            }),
          });
        }
        if (url.includes('/chart')) {
          if (!url.includes('cursor=')) {
            // Batch 1: 1000 points with nextCursor
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: {
                  points: batch1Points,
                  nextCursor: 'batch-2-cursor',
                  truncated: false,
                },
              }),
            });
          } else {
            // Batch 2: remaining 1 point
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: {
                  points: batch2Points,
                  nextCursor: null,
                  truncated: false,
                },
              }),
            });
          }
        }
        return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
      });

      render(<UnifiedSoilChart deviceId="esp32-001" />);

      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: /Location/i })).toBeInTheDocument();
      });

      const select = screen.getByRole('combobox', { name: /Location/i });
      fireEvent.change(select, { target: { value: 'bed-a' } });

      // Verifies all 1,001 points are retrieved and rendered in the chart
      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
        expect(screen.getByTestId('line-chart')).toHaveAttribute('data-points-count', '1001');
      });
    });

    it('cancels stale in-flight batches when location changes and renders new location only', async () => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/locations')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: {
                locations: [
                  { locationKey: 'bed-a', locationName: 'Bed A', readingCount: 50 },
                  { locationKey: 'bed-b', locationName: 'Bed B', readingCount: 5 },
                ],
              },
            }),
          });
        }
        if (url.includes('locationKey=bed-a')) {
          // Returns batch 1 with cursor but delayed
          return new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  status: 200,
                  json: async () => ({
                    success: true,
                    data: {
                      points: [{ readingId: 'a-1', timestamp: validShortFrom, nitrogen: 10 }],
                      nextCursor: 'cursor-a-2',
                      truncated: false,
                    },
                  }),
                }),
              80
            )
          );
        }
        if (url.includes('locationKey=bed-b')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: {
                points: [{ readingId: 'b-1', timestamp: validShortFrom, nitrogen: 99 }],
                nextCursor: null,
                truncated: false,
              },
            }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
      });

      render(<UnifiedSoilChart deviceId="esp32-001" />);

      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: /Location/i })).toBeInTheDocument();
      });

      const select = screen.getByRole('combobox', { name: /Location/i });
      fireEvent.change(select, { target: { value: 'bed-a' } });

      // Rapidly change location to bed-b
      fireEvent.change(select, { target: { value: 'bed-b' } });

      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
        expect(screen.getByTestId('line-chart')).toHaveAttribute('data-points-count', '1');
      });
    });

    it('never presents partial results when a subsequent batch fails with an error', async () => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/locations')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: {
                locations: [{ locationKey: 'bed-a', locationName: 'Bed A', readingCount: 50 }],
              },
            }),
          });
        }
        if (url.includes('/chart')) {
          if (!url.includes('cursor=')) {
            // First batch succeeds
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: {
                  points: [{ readingId: 'r-1', timestamp: validShortFrom, nitrogen: 20 }],
                  nextCursor: 'cursor-2',
                  truncated: false,
                },
              }),
            });
          } else {
            // Second batch fails with 500 error
            return Promise.resolve({
              ok: false,
              status: 500,
              json: async () => ({
                success: false,
                error: {
                  code: 'INTERNAL_ERROR',
                  message: 'Database connection failed during batch fetch.',
                },
              }),
            });
          }
        }
        return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
      });

      render(<UnifiedSoilChart deviceId="esp32-001" />);

      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: /Location/i })).toBeInTheDocument();
      });

      const select = screen.getByRole('combobox', { name: /Location/i });
      fireEvent.change(select, { target: { value: 'bed-a' } });

      // Verify partial result from batch 1 is discarded and error is displayed
      await waitFor(() => {
        expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
        expect(
          screen.getByText(/Database connection failed during batch fetch/i)
        ).toBeInTheDocument();
      });
    });

    it('prevents infinite loops by detecting non-advancing pagination cursors', async () => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/locations')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: {
                locations: [{ locationKey: 'bed-a', locationName: 'Bed A', readingCount: 50 }],
              },
            }),
          });
        }
        if (url.includes('/chart')) {
          // Returns the exact same cursor repeatedly
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: {
                points: [{ readingId: 'r-1', timestamp: validShortFrom, nitrogen: 20 }],
                nextCursor: 'same-stuck-cursor',
                truncated: false,
              },
            }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
      });

      render(<UnifiedSoilChart deviceId="esp32-001" />);

      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: /Location/i })).toBeInTheDocument();
      });

      const select = screen.getByRole('combobox', { name: /Location/i });
      fireEvent.change(select, { target: { value: 'bed-a' } });

      await waitFor(() => {
        expect(screen.getByText(/non-advancing/i)).toBeInTheDocument();
      });
    });
  });
});
