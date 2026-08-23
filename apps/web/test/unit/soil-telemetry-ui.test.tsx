import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SoilPage from '@/app/soil/page';
import WaterPage from '@/app/water/page';
import { DeviceProvider, AuthorisedDevice } from '@/context/DeviceContext';
import { DeviceType, DeviceConnectionStatus } from '@kebun-melon/contracts';
import type { LatestMonitoringSnapshotDto } from '@kebun-melon/contracts';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/soil',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

// Mock AuthContext
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'usr-1', fullName: 'Budi Santoso', email: 'budi@kebunmelon.com' },
    role: 'OWNER',
    isAuthenticated: true,
  }),
}));

const mockSoilDevice: AuthorisedDevice = {
  id: 'uuid-soil-001',
  deviceId: 'soil-node-001',
  deviceName: 'Sensor Tanah Blok A',
  deviceType: DeviceType.SOIL_NODE,
  siteId: null,
  accountStatus: 'ACTIVE',
  connectionStatus: DeviceConnectionStatus.ONLINE,
  lastSeenAt: '2026-08-23T10:00:00.000Z',
  firmwareVersion: '1.0.0',
  latitude: -6.2,
  longitude: 106.8,
  permissions: { canView: true, canControl: true, canAssign: true, canConfigure: true },
};

const mockWaterDevice: AuthorisedDevice = {
  id: 'uuid-water-002',
  deviceId: 'water-quality-node-001',
  deviceName: 'Sensor Kualitas Air Blok B',
  deviceType: DeviceType.WATER_QUALITY_NODE,
  siteId: null,
  accountStatus: 'ACTIVE',
  connectionStatus: DeviceConnectionStatus.ONLINE,
  lastSeenAt: '2026-08-23T10:00:00.000Z',
  firmwareVersion: '1.0.0',
  latitude: -6.21,
  longitude: 106.81,
  permissions: { canView: true, canControl: false, canAssign: false, canConfigure: false },
};

const mockSoilSnapshot: LatestMonitoringSnapshotDto = {
  deviceId: 'soil-node-001',
  deviceType: DeviceType.SOIL_NODE,
  connectionStatus: DeviceConnectionStatus.ONLINE,
  lastSeenAt: '2026-08-23T10:00:00.000Z',
  soil: {
    deviceId: 'soil-node-001',
    recordedAt: '2026-08-23T10:00:00.000Z',
    receivedAt: '2026-08-23T10:00:01.000Z',
    isStale: false,
    data: {
      nitrogen: 152,
      phosphorus: 48,
      potassium: 210,
      temperature: 29.4,
      moisture: 68.5,
      ph: 6.4,
      ec: 1.85,
      status: 'OPTIMAL',
    },
  },
  water: null,
};

const mockWaterSnapshot: LatestMonitoringSnapshotDto = {
  deviceId: 'water-quality-node-001',
  deviceType: DeviceType.WATER_QUALITY_NODE,
  connectionStatus: DeviceConnectionStatus.ONLINE,
  lastSeenAt: '2026-08-23T10:00:00.000Z',
  soil: null,
  water: {
    deviceId: 'water-quality-node-001',
    recordedAt: '2026-08-23T10:00:00.000Z',
    receivedAt: '2026-08-23T10:00:01.000Z',
    isStale: false,
    data: {
      ph: 6.3,
      tds: 880,
      ec: 1.75,
      tankVolume: null,
      flowRate: null,
      status: 'NORMAL',
    },
  },
};

describe('TASK-0502 — Live Soil and Water Monitoring UI Data Binding', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. /soil renders all 7 soil telemetry parameters with real data flow and agreed units', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/devices') && url.includes('/monitoring/latest')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: mockSoilSnapshot }),
        });
      }
      if (url.includes('/history')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { series: [] } }),
        });
      }
      return Promise.reject(new Error(`Unknown URL: ${url}`));
    });

    render(
      <DeviceProvider initialDevices={[mockSoilDevice]} initialSelectedDeviceId="soil-node-001">
        <SoilPage />
      </DeviceProvider>
    );

    // 1. Primary NPK meters
    await waitFor(() => {
      expect(screen.getByText('152')).toBeInTheDocument(); // Nitrogen
    });
    expect(screen.getByText('48')).toBeInTheDocument(); // Phosphorus
    expect(screen.getByText('210')).toBeInTheDocument(); // Potassium

    // 2. Missing parameters now displayed: Temperature, Moisture, pH, EC
    expect(screen.getByText('29.4')).toBeInTheDocument(); // Temperature
    expect(screen.getByText('°C')).toBeInTheDocument(); // Temperature unit
    expect(screen.getByText('68.5')).toBeInTheDocument(); // Moisture
    expect(screen.getByText('%RH')).toBeInTheDocument(); // Moisture unit (%RH)
    expect(screen.getByText('6.40')).toBeInTheDocument(); // pH (no unit)
    expect(screen.getByText('1850')).toBeInTheDocument(); // EC converted from 1.85 mS/cm to 1850 µS/cm
    expect(screen.getAllByText('µS/cm').length).toBeGreaterThan(0); // EC unit
  });

  it('2. /soil displays safe placeholders when telemetry is null', async () => {
    const nullSoilSnapshot: LatestMonitoringSnapshotDto = {
      ...mockSoilSnapshot,
      soil: {
        ...mockSoilSnapshot.soil!,
        data: {
          nitrogen: null,
          phosphorus: null,
          potassium: null,
          temperature: null,
          moisture: null,
          ph: null,
          ec: null,
          status: null,
        },
      },
    };

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/devices') && url.includes('/monitoring/latest')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: nullSoilSnapshot }),
        });
      }
      if (url.includes('/history')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { series: [] } }),
        });
      }
      return Promise.reject(new Error(`Unknown URL: ${url}`));
    });

    render(
      <DeviceProvider initialDevices={[mockSoilDevice]} initialSelectedDeviceId="soil-node-001">
        <SoilPage />
      </DeviceProvider>
    );

    await waitFor(() => {
      const dashes = screen.getAllByText('-');
      expect(dashes.length).toBeGreaterThanOrEqual(4);
    });
  });

  it('3. /water renders real telemetry (pH, TDS, EC) without hardcoded constants', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/devices') && url.includes('/monitoring/latest')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: mockWaterSnapshot }),
        });
      }
      if (url.includes('/history')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { series: [] } }),
        });
      }
      return Promise.reject(new Error(`Unknown URL: ${url}`));
    });

    render(
      <DeviceProvider
        initialDevices={[mockWaterDevice]}
        initialSelectedDeviceId="water-quality-node-001"
      >
        <WaterPage />
      </DeviceProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('880')).toBeInTheDocument(); // TDS
    });
    expect(screen.getByText('ppm')).toBeInTheDocument(); // TDS unit
    expect(screen.getByText('6.30')).toBeInTheDocument(); // pH
    expect(screen.getByText('1750')).toBeInTheDocument(); // EC converted from 1.75 mS/cm to 1750 µS/cm
    expect(screen.getByText('µS/cm')).toBeInTheDocument(); // EC unit
  });
});
