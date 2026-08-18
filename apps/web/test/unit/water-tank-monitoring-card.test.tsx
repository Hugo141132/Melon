import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
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

    expect(screen.getByTestId('water-tank-skeleton')).toBeInTheDocument();
  });

  it('renders live tank volume (L) and flow rate (m³/h) when data is present', async () => {
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
              flowRate: 2.4,
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

    expect(await screen.findByText('Volume Air Tangki')).toBeInTheDocument();
    expect(screen.getByText('Debit Air')).toBeInTheDocument();
    expect(screen.getByText('450.5')).toBeInTheDocument();
    expect(screen.getByText('L')).toBeInTheDocument();
    expect(screen.getByText('2.4')).toBeInTheDocument();
    expect(screen.getByText('m³/h')).toBeInTheDocument();
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
              flowRate: null,
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

    expect(await screen.findByText('Volume Air Tangki')).toBeInTheDocument();
    expect(screen.getByText('Debit Air')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBe(2);
    expect(screen.getByText('L')).toBeInTheDocument();
    expect(screen.getByText('m³/h')).toBeInTheDocument();
    expect(screen.getAllByText('Belum ada data').length).toBeGreaterThan(0);
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

  it('renders stale data alert banner when connection is STALE', async () => {
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
          water: {
            recordedAt: '2026-08-04T10:00:00Z',
            isStale: true,
            data: {
              tankVolume: 300,
              flowRate: 0,
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

    expect(await screen.findByText(/Data Usang \(Stale\)/i)).toBeInTheDocument();
  });
});
