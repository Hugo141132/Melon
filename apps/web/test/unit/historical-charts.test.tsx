import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import HistoricalChartControls from '@/components/charts/HistoricalChartControls';
import NPKChart from '@/components/charts/NPKChart';
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

  describe('useHistoricalMonitoring Hook & Presentation Boundary EC Conversion', () => {
    it('fetches history API, formats series data, and converts EC from mS/cm to µS/cm', async () => {
      const mockHistoryResponse = {
        success: true,
        data: {
          deviceId: 'soil-node-001',
          from: '2026-08-10T00:00:00.000Z',
          to: '2026-08-11T00:00:00.000Z',
          series: [
            {
              timestamp: '2026-08-10T10:00:00.000Z',
              nitrogen: 45,
              phosphorus: 20,
              potassium: 35,
              temperature: 26.5,
              ec: 1.8, // mS/cm -> should convert to 1800 µS/cm for display
              moisture: null, // null value preserved
            },
          ],
          pagination: {
            page: 1,
            pageSize: 100,
            totalRecords: 1,
            totalPages: 1,
          },
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockHistoryResponse,
      });

      const { result } = renderHook(() =>
        useHistoricalMonitoring({
          deviceId: 'soil-node-001',
          domain: 'soil',
          initialPreset: '24h',
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data.length).toBe(1);
      expect(result.current.data[0].nitrogen).toBe(45);
      expect(result.current.data[0].ec).toBe(1800); // verified conversion to µS/cm
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
});
