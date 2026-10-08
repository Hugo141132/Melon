import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import HistoricalChartControls from '@/components/charts/HistoricalChartControls';
import NPKChart, { getCustomXTicks, formatDayMonth } from '@/components/charts/NPKChart';
import WaterNutrientChart from '@/components/charts/WaterNutrientChart';
import { useHistoricalMonitoring } from '@/hooks/useHistoricalMonitoring';

// Mock Recharts ResponsiveContainer to avoid size observer issues in Vitest
vi.mock('recharts', async () => {
  const original = await vi.importActual<any>('recharts');
  return {
    ...original,
    ResponsiveContainer: ({ children }: any) => (
      <div data-testid="responsive-container">{children}</div>
    ),
  };
});

describe('TASK-0504 — Historical Monitoring Charts & Controls Fixes Test Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  describe('HistoricalChartControls Component', () => {
    it('renders soil metric pills correctly including EC in µS/cm', () => {
      const onSelectMetric = vi.fn();
      const onSelectPreset = vi.fn();

      render(
        <HistoricalChartControls
          domain="soil"
          selectedMetric="npk"
          onSelectMetric={onSelectMetric}
          preset="24h"
          onSelectPreset={onSelectPreset}
          customFrom=""
          onCustomFromChange={vi.fn()}
          customTo=""
          onCustomToChange={vi.fn()}
        />
      );

      expect(screen.getByText(/NPK/i)).toBeInTheDocument();
      expect(screen.getByText(/Suhu/i)).toBeInTheDocument();
      expect(screen.getByText(/Kelembapan/i)).toBeInTheDocument();
      expect(screen.getByText(/pH/i)).toBeInTheDocument();
      expect(screen.getByText(/EC \(µS\/cm\)/i)).toBeInTheDocument();

      fireEvent.click(screen.getByText(/Suhu/i));
      expect(onSelectMetric).toHaveBeenCalledWith('temperature');
    });

    it('renders water metric pills correctly with EC in µS/cm', () => {
      const onSelectMetric = vi.fn();

      render(
        <HistoricalChartControls
          domain="water"
          selectedMetric="ec"
          onSelectMetric={onSelectMetric}
          preset="24h"
          onSelectPreset={vi.fn()}
          customFrom=""
          onCustomFromChange={vi.fn()}
          customTo=""
          onCustomToChange={vi.fn()}
        />
      );

      expect(screen.getByText(/EC \(µS\/cm\)/i)).toBeInTheDocument();
      expect(screen.getByText(/pH/i)).toBeInTheDocument();
      expect(screen.getByText(/TDS \(ppm\)/i)).toBeInTheDocument();
    });

    it('renders preset date range options and triggers selection', () => {
      const onSelectPreset = vi.fn();

      render(
        <HistoricalChartControls
          domain="soil"
          selectedMetric="npk"
          onSelectMetric={vi.fn()}
          preset="24h"
          onSelectPreset={onSelectPreset}
          customFrom=""
          onCustomFromChange={vi.fn()}
          customTo=""
          onCustomToChange={vi.fn()}
        />
      );

      expect(screen.getByText('24 Jam')).toBeInTheDocument();
      expect(screen.getByText('7 Hari')).toBeInTheDocument();
      expect(screen.getByText('30 Hari')).toBeInTheDocument();
      expect(screen.getByText('Kustom')).toBeInTheDocument();

      fireEvent.click(screen.getByText('7 Hari'));
      expect(onSelectPreset).toHaveBeenCalledWith('7d');
    });

    it('displays custom date inputs when custom preset is selected', () => {
      render(
        <HistoricalChartControls
          domain="soil"
          selectedMetric="npk"
          onSelectMetric={vi.fn()}
          preset="custom"
          onSelectPreset={vi.fn()}
          customFrom="2026-08-01"
          onCustomFromChange={vi.fn()}
          customTo="2026-08-05"
          onCustomToChange={vi.fn()}
        />
      );

      expect(screen.getByLabelText('Dari:')).toBeInTheDocument();
      expect(screen.getByLabelText('Sampai:')).toBeInTheDocument();
    });

    it('displays date range validation error message when present', () => {
      render(
        <HistoricalChartControls
          domain="soil"
          selectedMetric="npk"
          onSelectMetric={vi.fn()}
          preset="custom"
          onSelectPreset={vi.fn()}
          customFrom=""
          onCustomFromChange={vi.fn()}
          customTo=""
          onCustomToChange={vi.fn()}
          dateRangeError="Rentang tanggal tidak boleh melebihi 31 hari (DEC-MON-087)."
        />
      );

      expect(
        screen.getByText('Rentang tanggal tidak boleh melebihi 31 hari (DEC-MON-087).')
      ).toBeInTheDocument();
    });
  });

  describe('useHistoricalMonitoring Hook & Dedicated /chart Location Flow', () => {
    it('enforces location isolation: does not fetch chart data when location is not selected', async () => {
      const fetchMock = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/locations')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                locations: [
                  {
                    locationKey: 'bed-a',
                    locationName: 'Bed A',
                    readingCount: 5,
                    firstRecordedAt: null,
                    lastRecordedAt: null,
                  },
                ],
              },
            }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
      });
      global.fetch = fetchMock;

      const { result } = renderHook(() =>
        useHistoricalMonitoring({
          deviceId: 'soil-node-001',
          domain: 'soil',
          initialPreset: '24h',
        })
      );

      await waitFor(() => {
        expect(result.current.locations.length).toBe(1);
      });

      // No location selected yet -> data must be empty and /chart never called
      expect(result.current.selectedLocationKey).toBe('');
      expect(result.current.data).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/chart'));
    });

    it('fetches dedicated /chart API for selected location, formats series data, and verifies EC in µS/cm', async () => {
      const now = new Date();
      const tenHoursAgo = new Date(now.getTime() - 10 * 60 * 60 * 1000);
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const mockChartResponse = {
        success: true,
        data: {
          locationKey: 'bed-a',
          locationName: 'Bed A',
          from: yesterday.toISOString(),
          to: now.toISOString(),
          points: [
            {
              readingId: 'read-001',
              timestamp: tenHoursAgo.toISOString(),
              nitrogen: 45,
              phosphorus: 20,
              potassium: 35,
              temperature: 26.5,
              ec: 1800, // stored and displayed directly as 1800 µS/cm
              moisture: null, // null value preserved
            },
          ],
          truncated: false,
        },
      };

      const fetchMock = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/locations')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                locations: [
                  {
                    locationKey: 'bed-a',
                    locationName: 'Bed A',
                    readingCount: 1,
                    firstRecordedAt: null,
                    lastRecordedAt: null,
                  },
                ],
              },
            }),
          });
        }
        if (url.includes('/chart')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockChartResponse,
          });
        }
        return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
      });
      global.fetch = fetchMock;

      const { result } = renderHook(() =>
        useHistoricalMonitoring({
          deviceId: 'soil-node-001',
          domain: 'soil',
          initialPreset: '24h',
          initialLocationKey: 'bed-a',
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data.length).toBe(1);
      expect(result.current.data[0].nitrogen).toBe(45);
      expect(result.current.data[0].ec).toBe(1800); // verified direct EC in µS/cm
      expect(result.current.data[0].moisture).toBeNull(); // verify null preserved
      expect(result.current.error).toBeNull();
    });

    it('enforces maximum 31 days date range limit per DEC-MON-087', async () => {
      const { result } = renderHook(() =>
        useHistoricalMonitoring({
          deviceId: 'soil-node-001',
          domain: 'soil',
          initialPreset: 'custom',
        })
      );

      act(() => {
        result.current.setCustomFrom('2026-01-01');
        result.current.setCustomTo('2026-03-01'); // 59 days > 31 days
      });

      await waitFor(() => {
        expect(result.current.dateRangeError).toContain('31 hari');
      });
    });

    it('stale-response protection: out-of-order response from location A cannot overwrite location B', async () => {
      let resolveLocationA: (val: any) => void = () => {};
      const locationAPromise = new Promise((resolve) => {
        resolveLocationA = resolve;
      });

      const now = new Date();
      const mockLocationAResponse = {
        success: true,
        data: {
          locationKey: 'location-a',
          locationName: 'Location A',
          points: [
            {
              readingId: 'read-a',
              timestamp: now.toISOString(),
              nitrogen: 10,
              phosphorus: 10,
              potassium: 10,
              temperature: 20,
              ec: 1000,
              moisture: 50,
            },
          ],
          truncated: false,
        },
      };

      const mockLocationBResponse = {
        success: true,
        data: {
          locationKey: 'location-b',
          locationName: 'Location B',
          points: [
            {
              readingId: 'read-b',
              timestamp: now.toISOString(),
              nitrogen: 90,
              phosphorus: 90,
              potassium: 90,
              temperature: 30,
              ec: 2000,
              moisture: 70,
            },
          ],
          truncated: false,
        },
      };

      const fetchMock = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/locations')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                locations: [
                  { locationKey: 'location-a', locationName: 'Location A', readingCount: 1 },
                  { locationKey: 'location-b', locationName: 'Location B', readingCount: 1 },
                ],
              },
            }),
          });
        }
        if (url.includes('/chart') && url.includes('locationKey=location-a')) {
          return locationAPromise.then(() => ({
            ok: true,
            json: async () => mockLocationAResponse,
          }));
        }
        if (url.includes('/chart') && url.includes('locationKey=location-b')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockLocationBResponse,
          });
        }
        return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
      });
      global.fetch = fetchMock;

      // 1. Mount with location-a (starts slow fetch for location-a)
      const { result } = renderHook(() =>
        useHistoricalMonitoring({
          deviceId: 'soil-node-001',
          domain: 'soil',
          initialPreset: '24h',
          initialLocationKey: 'location-a',
        })
      );

      // Verify fetch for location-a was dispatched
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('locationKey=location-a'),
        expect.anything()
      );

      // 2. Switch to location-b before location-a finishes
      act(() => {
        result.current.setSelectedLocationKey('location-b');
      });

      // 3. Wait for location-b to complete and populate data
      await waitFor(() => {
        expect(result.current.data.length).toBe(1);
        expect(result.current.data[0].nitrogen).toBe(90);
      });
      expect(result.current.selectedLocationKey).toBe('location-b');

      // 4. Now resolve delayed location-a response
      await act(async () => {
        resolveLocationA(true);
      });

      // 5. Verify location-b data is preserved and NOT overwritten by stale location-a
      expect(result.current.data.length).toBe(1);
      expect(result.current.data[0].nitrogen).toBe(90);
      expect(result.current.selectedLocationKey).toBe('location-b');
    });
  });

  describe('NPKChart Presentational Component', () => {
    it('renders NPK chart title and legends in Indonesian', () => {
      render(
        <NPKChart
          data={[{ timestamp: '2026-08-11T10:00:00.000Z', time: '10:00', n: 40, p: 20, k: 30 }]}
          selectedMetric="npk"
        />
      );

      expect(screen.getByText('Tren NPK Tanah')).toBeInTheDocument();
      expect(screen.getByText('N')).toBeInTheDocument();
      expect(screen.getByText('P')).toBeInTheDocument();
      expect(screen.getByText('K')).toBeInTheDocument();
    });

    it('renders loading skeleton state when loading is true', () => {
      render(<NPKChart loading={true} />);
      expect(screen.getByText('Memuat data riwayat...')).toBeInTheDocument();
    });

    it('renders empty data message when data array is empty', () => {
      render(<NPKChart data={[]} loading={false} />);
      expect(
        screen.getByText('Tidak ada data riwayat untuk rentang waktu ini.')
      ).toBeInTheDocument();
    });

    it('renders error message when error is present', () => {
      render(<NPKChart error="Gagal terhubung ke server." loading={false} />);
      expect(screen.getByText('Gagal terhubung ke server.')).toBeInTheDocument();
    });
  });

  describe('WaterNutrientChart Presentational Component', () => {
    it('renders localized title and chart container for water quality metrics', () => {
      render(
        <WaterNutrientChart
          data={[
            { timestamp: '2026-08-11T10:00:00.000Z', time: '10:00', ec: 1800, ph: 6.5, tds: 900 },
          ]}
          selectedMetric="ec"
        />
      );

      expect(screen.getByText('Riwayat Electrical Conductivity (EC)')).toBeInTheDocument();
    });

    it('renders empty data state correctly', () => {
      render(<WaterNutrientChart data={[]} loading={false} />);
      expect(
        screen.getByText('Tidak ada data riwayat untuk rentang waktu ini.')
      ).toBeInTheDocument();
    });
  });

  describe('formatDayMonth and getCustomXTicks Range-Based X-Axis Formatting', () => {
    it('formats day and month correctly based on locale without trailing commas or punctuation', () => {
      const date = new Date('2026-08-20T10:00:00.000Z');

      // Indonesian locale test
      const idFormatted = formatDayMonth(date, 'id');
      expect(idFormatted).toMatch(/^20\s(Agu|Agst)$/);
      expect(idFormatted).not.toContain(',');
      expect(idFormatted).not.toContain('.');

      // English locale test
      const enFormatted = formatDayMonth(date, 'en');
      expect(enFormatted).toBe('20 Aug');
      expect(enFormatted).not.toContain(',');
      expect(enFormatted).not.toContain('.');
    });

    it('generates 5-8 readable time labels for 24 Hours range instead of all 24 hours', () => {
      const data24h = Array.from({ length: 24 }, (_, i) => {
        const d = new Date('2026-08-30T00:00:00.000Z');
        d.setHours(i);
        const hourStr = String(i).padStart(2, '0');
        return {
          timestamp: d.toISOString(),
          time: `${hourStr}:00`,
          n: 40,
          p: 20,
          k: 30,
        };
      });

      const { ticks, formatTick } = getCustomXTicks(data24h, '24h', 'id');
      expect(ticks.length).toBeGreaterThanOrEqual(5);
      expect(ticks.length).toBeLessThanOrEqual(8);
      expect(ticks.length).toBeLessThan(24);
      expect(formatTick(ticks[0])).toBe('00:00');
    });

    it('generates well-spaced daily labels (4-5 labels) for 7 Days range preventing overlap and respecting locale', () => {
      const data7d = Array.from({ length: 168 }, (_, i) => {
        const d = new Date('2026-08-24T00:00:00.000Z');
        d.setHours(i);
        const day = d.getDate();
        const hour = String(d.getHours()).padStart(2, '0');
        return {
          timestamp: d.toISOString(),
          time: `${day} Agu ${hour}:00`,
          n: 40,
          p: 20,
          k: 30,
        };
      });

      // Test Indonesian locale
      const { ticks: idTicks, formatTick: formatIdTick } = getCustomXTicks(data7d, '7d', 'id');
      expect(idTicks.length).toBeGreaterThanOrEqual(4);
      expect(idTicks.length).toBeLessThanOrEqual(5); // Spaced nicely so labels do not overlap
      expect(formatIdTick(idTicks[0])).toMatch(/^24\s(Agu|Agst)$/);
      expect(formatIdTick(idTicks[0])).not.toContain(',');

      // Test English locale
      const { ticks: enTicks, formatTick: formatEnTick } = getCustomXTicks(data7d, '7d', 'en');
      expect(enTicks.length).toBe(idTicks.length);
      expect(formatEnTick(enTicks[0])).toBe('24 Aug');
      expect(formatEnTick(enTicks[enTicks.length - 1])).toBe('30 Aug');
      expect(formatEnTick(enTicks[0])).not.toContain(',');
    });

    it('generates spaced date labels across 30 Days range with clean locale formatting', () => {
      const data30d = Array.from({ length: 720 }, (_, i) => {
        const d = new Date('2026-08-01T00:00:00.000Z');
        d.setHours(i);
        const day = String(d.getDate()).padStart(2, '0');
        const hour = String(d.getHours()).padStart(2, '0');
        return {
          timestamp: d.toISOString(),
          time: `${day} Agu ${hour}:00`,
          n: 40,
          p: 20,
          k: 30,
        };
      });

      // Test Indonesian locale
      const { ticks: idTicks, formatTick: formatIdTick } = getCustomXTicks(data30d, '30d', 'id');
      expect(idTicks.length).toBeGreaterThanOrEqual(5);
      expect(idTicks.length).toBeLessThanOrEqual(8);
      expect(idTicks.length).toBeLessThan(30);
      expect(formatIdTick(idTicks[0])).toMatch(/^1\s(Agu|Agst)$/);
      expect(formatIdTick(idTicks[0])).not.toContain(',');

      // Test English locale
      const { ticks: enTicks, formatTick: formatEnTick } = getCustomXTicks(data30d, '30d', 'en');
      expect(formatEnTick(enTicks[0])).toBe('1 Aug');
      expect(formatEnTick(enTicks[0])).not.toContain(',');
    });
  });
});
