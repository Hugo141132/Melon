import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { WaterTankMonitoringCard } from '@/components/monitoring/WaterTankMonitoringCard';
import { DeviceProvider, AuthorisedDevice } from '@/context/DeviceContext';

// Mock device
const mockWaterTankDevice: AuthorisedDevice = {
  id: 'db-wt-001',
  deviceId: 'water-tank-001',
  deviceName: 'Tangki Utama Kebun',
  deviceType: 'WATER_TANK_NODE',
  siteId: 'site-001',
  siteName: 'Blok Utama',
  accountStatus: 'ACTIVE',
  connectionStatus: 'ONLINE',
  lastSeenAt: '2026-08-04T10:00:00Z',
  firmwareVersion: '1.0.0',
  latitude: null,
  longitude: null,
  permissions: { canView: true, canControl: true, canAssign: true, canConfigure: true },
};

describe('WaterTankMonitoringCard Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders loading skeleton when fetching latest monitoring data', async () => {
    global.fetch = vi.fn().mockImplementation(
      () => new Promise(() => {}) // pending promise for loading state
    );

    render(
      <DeviceProvider
        initialDevices={[mockWaterTankDevice]}
        initialSelectedDeviceId="water-tank-001"
      >
        <WaterTankMonitoringCard />
      </DeviceProvider>
    );

    const skeletonElement = screen.getByTestId('water-tank-skeleton');
    expect(skeletonElement).toBeInTheDocument();
    const skeletonGrid = skeletonElement.querySelector('.grid');
    expect(skeletonGrid?.className).toContain('grid-cols-1');
    expect(skeletonGrid?.className).not.toContain('sm:grid-cols-2');
    expect(screen.getByText('0 L')).toBeInTheDocument();
    expect(screen.getByText('2200 L')).toBeInTheDocument();
  });

  it('renders live tank volume (L) and status badge when data is present', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          water: {
            recordedAt: '2026-08-04T10:00:00Z',
            data: {
              tankVolume: 450.5,
              status: 'NORMAL',
            },
          },
        },
      }),
    } as Response);

    render(
      <DeviceProvider
        initialDevices={[mockWaterTankDevice]}
        initialSelectedDeviceId="water-tank-001"
      >
        <WaterTankMonitoringCard />
      </DeviceProvider>
    );

    expect(await screen.findByText('450.50')).toBeInTheDocument();
    expect(screen.getByText('Volume Air Tangki')).toBeInTheDocument();
    expect(screen.getByText('NORMAL')).toBeInTheDocument();
    expect(screen.getByText('L')).toBeInTheDocument();
    expect(screen.getByText('0 L')).toBeInTheDocument();
    expect(screen.getByText('2200 L')).toBeInTheDocument();
    expect(screen.queryByText('Debit Air')).not.toBeInTheDocument();
    expect(screen.queryByText('m³/h')).not.toBeInTheDocument();

    const metricGrid = screen.getByText('Volume Air Tangki').closest('.grid');
    expect(metricGrid?.className).toContain('grid-cols-1');
    expect(metricGrid?.className).not.toContain('sm:grid-cols-2');

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '2200');
    expect(progressBar).toHaveAttribute('aria-valuenow', '450.5');
  });

  it('correctly calculates 0% progress bar and ARIA attributes for 0 L', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          water: {
            recordedAt: '2026-08-04T10:00:00Z',
            data: {
              tankVolume: 0,
              status: 'EMPTY',
            },
          },
        },
      }),
    } as Response);

    render(
      <DeviceProvider
        initialDevices={[mockWaterTankDevice]}
        initialSelectedDeviceId="water-tank-001"
      >
        <WaterTankMonitoringCard />
      </DeviceProvider>
    );

    expect(await screen.findByText('0')).toBeInTheDocument();
    expect(screen.getByText('Volume Air Tangki')).toBeInTheDocument();
    expect(screen.getByText('EMPTY')).toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();
    expect(screen.getByText('0 L')).toBeInTheDocument();
    expect(screen.getByText('2200 L')).toBeInTheDocument();

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '2200');
    expect(progressBar).toHaveAttribute('aria-valuenow', '0');

    const fillBar = screen.getByTestId('tank-volume-progress-bar');
    expect(fillBar).toHaveStyle({ width: '0%' });
  });

  it('correctly calculates 50% progress bar and ARIA attributes for 1100 L (~50%)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          water: {
            recordedAt: '2026-08-04T10:00:00Z',
            data: {
              tankVolume: 1100,
              status: 'HALF',
            },
          },
        },
      }),
    } as Response);

    render(
      <DeviceProvider
        initialDevices={[mockWaterTankDevice]}
        initialSelectedDeviceId="water-tank-001"
      >
        <WaterTankMonitoringCard />
      </DeviceProvider>
    );

    expect(await screen.findByText('1100')).toBeInTheDocument();
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '1100');

    const fillBar = screen.getByTestId('tank-volume-progress-bar');
    expect(fillBar).toHaveStyle({ width: '50%' });
  });

  it('correctly calculates 100% progress bar and ARIA attributes for 2200 L (100%)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          water: {
            recordedAt: '2026-08-04T10:00:00Z',
            data: {
              tankVolume: 2200,
              status: 'FULL',
            },
          },
        },
      }),
    } as Response);

    render(
      <DeviceProvider
        initialDevices={[mockWaterTankDevice]}
        initialSelectedDeviceId="water-tank-001"
      >
        <WaterTankMonitoringCard />
      </DeviceProvider>
    );

    expect(await screen.findByText('2200')).toBeInTheDocument();
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '2200');

    const fillBar = screen.getByTestId('tank-volume-progress-bar');
    expect(fillBar).toHaveStyle({ width: '100%' });
  });

  it('clamps values above 2200 L to 100% and aria-valuenow to 2200', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          water: {
            recordedAt: '2026-08-04T10:00:00Z',
            data: {
              tankVolume: 2500,
              status: 'OVERFLOW',
            },
          },
        },
      }),
    } as Response);

    render(
      <DeviceProvider
        initialDevices={[mockWaterTankDevice]}
        initialSelectedDeviceId="water-tank-001"
      >
        <WaterTankMonitoringCard />
      </DeviceProvider>
    );

    expect(await screen.findByText('2500')).toBeInTheDocument();
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '2200');

    const fillBar = screen.getByTestId('tank-volume-progress-bar');
    expect(fillBar).toHaveStyle({ width: '100%' });
  });

  it('supports status-only telemetry when tankVolume is null without falling back to smoothFlow', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          water: {
            recordedAt: '2026-08-04T10:00:00Z',
            data: {
              tankVolume: null,
              status: 'FILLING',
            },
          },
        },
      }),
    } as Response);

    render(
      <DeviceProvider
        initialDevices={[mockWaterTankDevice]}
        initialSelectedDeviceId="water-tank-001"
      >
        <WaterTankMonitoringCard />
      </DeviceProvider>
    );

    expect(await screen.findByText('—')).toBeInTheDocument();
    expect(screen.getByText('FILLING')).toBeInTheDocument();
    expect(screen.queryByText('Aliran Lancar')).not.toBeInTheDocument();
    expect(screen.queryByText('Smooth Flow')).not.toBeInTheDocument();
  });

  it('renders metric cards with — placeholder and Belum ada data when telemetry is null/unavailable', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          water: {
            recordedAt: null,
            data: {
              tankVolume: null,
              status: null,
            },
          },
        },
      }),
    } as Response);

    render(
      <DeviceProvider
        initialDevices={[mockWaterTankDevice]}
        initialSelectedDeviceId="water-tank-001"
      >
        <WaterTankMonitoringCard />
      </DeviceProvider>
    );

    const dashes = await screen.findAllByText('—');
    expect(dashes.length).toBe(1);
    expect(screen.getByText('Volume Air Tangki')).toBeInTheDocument();
    expect(screen.getByText('L')).toBeInTheDocument();
    expect(screen.getByText('0 L')).toBeInTheDocument();
    expect(screen.getByText('2200 L')).toBeInTheDocument();
    expect(screen.queryByText('Debit Air')).not.toBeInTheDocument();
    expect(screen.queryByText('m³/h')).not.toBeInTheDocument();
    expect(screen.getAllByText('Belum ada data').length).toBeGreaterThan(0);

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).not.toHaveAttribute('aria-valuenow');
    const fillBar = screen.getByTestId('tank-volume-progress-bar');
    expect(fillBar).toHaveStyle({ width: '0%' });
  });

  it('renders error state and handles retry button', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ success: false, error: { message: 'Server telemetry error' } }),
    } as Response);

    render(
      <DeviceProvider
        initialDevices={[mockWaterTankDevice]}
        initialSelectedDeviceId="water-tank-001"
      >
        <WaterTankMonitoringCard />
      </DeviceProvider>
    );

    expect(await screen.findByTestId('water-tank-error')).toBeInTheDocument();
    expect(screen.getByText('Gagal Memuat Data Tangki Air')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Coba Lagi/i })).toBeInTheDocument();
  });

  it('renders stale data alert banner when connection is STALE and hides tank volume', async () => {
    const staleDevice: AuthorisedDevice = {
      ...mockWaterTankDevice,
      connectionStatus: 'STALE',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          connectionStatus: 'STALE',
          lastSeenAt: '2026-08-04T10:00:00Z',
          water: {
            recordedAt: '2026-08-04T10:00:00Z',
            isStale: true,
            data: {
              tankVolume: 300,
              status: 'STALE',
            },
          },
        },
      }),
    } as Response);

    render(
      <DeviceProvider initialDevices={[staleDevice]} initialSelectedDeviceId="water-tank-001">
        <WaterTankMonitoringCard />
      </DeviceProvider>
    );

    // Stale status badge
    expect(await screen.findByText(/Data Usang \(Stale\)/i)).toBeInTheDocument();
    // Stale warning notice banner
    expect(
      screen.getByText(/Data pemantauan tangki air saat ini tidak diperbarui/i)
    ).toBeInTheDocument();
    // Last seen timestamp remains visible
    expect(screen.getByText(/Terakhir Terlihat/i)).toBeInTheDocument();
    // Tank volume number is hidden; placeholder is shown
    expect(screen.queryByText('300')).not.toBeInTheDocument();
    expect(screen.queryByText('300.00')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    // Progress bar fill is 0%
    const fillBar = screen.getByTestId('tank-volume-progress-bar');
    expect(fillBar).toHaveStyle({ width: '0%' });
  });

  it('hides tank volume and displays placeholder when connection is OFFLINE', async () => {
    const offlineDevice: AuthorisedDevice = {
      ...mockWaterTankDevice,
      connectionStatus: 'OFFLINE',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          connectionStatus: 'OFFLINE',
          lastSeenAt: '2026-08-04T09:00:00Z',
          water: {
            recordedAt: '2026-08-04T09:00:00Z',
            isStale: true,
            data: {
              tankVolume: 500,
              status: 'OFFLINE',
            },
          },
        },
      }),
    } as Response);

    render(
      <DeviceProvider initialDevices={[offlineDevice]} initialSelectedDeviceId="water-tank-001">
        <WaterTankMonitoringCard />
      </DeviceProvider>
    );

    // Offline badge
    expect(await screen.findByText(/Terputus \(Offline\)/i)).toBeInTheDocument();
    // Last seen timestamp remains visible
    expect(screen.getByText(/Terakhir Terlihat/i)).toBeInTheDocument();
    // Tank volume number is hidden; placeholder is shown
    expect(screen.queryByText('500')).not.toBeInTheDocument();
    expect(screen.queryByText('500.00')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    // Progress bar fill is 0%
    const fillBar = screen.getByTestId('tank-volume-progress-bar');
    expect(fillBar).toHaveStyle({ width: '0%' });
  });
});
