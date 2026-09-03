import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SoilPage from '@/app/soil/page';
import WaterPage from '@/app/water/page';
import DashboardPage from '@/app/page';
import NPKChart from '@/components/charts/NPKChart';
import WaterNutrientChart from '@/components/charts/WaterNutrientChart';
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

  it('1. /soil renders all 7 soil telemetry parameters with unified visual meters, clean titles, and agreed units when telemetry is fresh', async () => {
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

    // 2. Clean parameter titles (no "Tanah" or "Soil" prefix)
    expect(screen.getByText('Nitrogen (N)')).toBeInTheDocument();
    expect(screen.getByText('Fosfor (P)')).toBeInTheDocument();
    expect(screen.getByText('Kalium (K)')).toBeInTheDocument();
    expect(screen.getByText('Suhu')).toBeInTheDocument();
    expect(screen.getByText('Kelembapan')).toBeInTheDocument();

    // 3. Environmental & Chemical parameters rendered in identical unified card design
    expect(screen.getByText('29.4')).toBeInTheDocument(); // Temperature
    expect(screen.getAllByText('°C').length).toBeGreaterThanOrEqual(1); // Temperature unit and/or symbol
    expect(screen.getByText('68.5')).toBeInTheDocument(); // Moisture
    expect(screen.getByText('%RH')).toBeInTheDocument(); // Moisture unit (%RH)
    expect(screen.getByText('6.40')).toBeInTheDocument(); // pH (no unit)
    expect(screen.getByText('1850')).toBeInTheDocument(); // EC converted from 1.85 mS/cm to 1850 µS/cm
    expect(screen.getAllByText('µS/cm').length).toBeGreaterThan(0); // EC unit

    // Check symbols for cards
    expect(screen.getAllByText('N').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('P').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('K').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('pH').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('EC').length).toBeGreaterThanOrEqual(1);
  });

  it('2. /soil does NOT display sensor values when telemetry is marked as stale', async () => {
    const staleSoilSnapshot: LatestMonitoringSnapshotDto = {
      ...mockSoilSnapshot,
      connectionStatus: DeviceConnectionStatus.UNKNOWN,
      soil: {
        ...mockSoilSnapshot.soil!,
        isStale: true,
        // Even though old data contains numbers, they must NOT be displayed
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
    };

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/devices') && url.includes('/monitoring/latest')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: staleSoilSnapshot }),
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
      // Must display '-' placeholders instead of the old sensor values
      const dashes = screen.getAllByText('-');
      expect(dashes.length).toBeGreaterThanOrEqual(7);
    });

    // Stale banner and status indicator must be present
    expect(screen.getAllByText(/Kedaluwarsa|Stale/i).length).toBeGreaterThanOrEqual(1);

    // Old numerical values must NOT be displayed
    expect(screen.queryByText('152')).toBeNull();
    expect(screen.queryByText('210')).toBeNull();
    expect(screen.queryByText('29.4')).toBeNull();
    expect(screen.queryByText('68.5')).toBeNull();
    expect(screen.queryByText('1850')).toBeNull();

    // Fake optimal status quote must NOT be shown
    expect(screen.queryByText(/"Pupuk cukup, tanaman akan tumbuh kuat."/i)).toBeNull();
  });

  it('3. /soil displays safe empty states and placeholders when telemetry is null', async () => {
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
      expect(dashes.length).toBeGreaterThanOrEqual(7);
    });

    // Check that fake optimal quotes are not displayed
    expect(screen.queryByText(/Status NPK: Optimal/i)).toBeNull();
    expect(screen.queryByText(/"Pupuk cukup, tanaman akan tumbuh kuat."/i)).toBeNull();
    expect(screen.getAllByText(/Belum ada data/i).length).toBeGreaterThanOrEqual(1);
  });

  it('4. /water renders real telemetry (pH, TDS, EC) without hardcoded constants when fresh', async () => {
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

  it('5. /water does NOT display sensor values when telemetry is marked as stale', async () => {
    const staleWaterSnapshot: LatestMonitoringSnapshotDto = {
      ...mockWaterSnapshot,
      connectionStatus: DeviceConnectionStatus.UNKNOWN,
      water: {
        ...mockWaterSnapshot.water!,
        isStale: true,
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

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/devices') && url.includes('/monitoring/latest')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: staleWaterSnapshot }),
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
      // Must display '-' placeholders instead of the old sensor values
      const dashes = screen.getAllByText('-');
      expect(dashes.length).toBeGreaterThanOrEqual(3);
    });

    // Stale banner must be present
    expect(screen.getAllByText(/Kedaluwarsa|Stale/i).length).toBeGreaterThanOrEqual(1);

    // Old sensor values must NOT be displayed
    expect(screen.queryByText('880')).toBeNull();
    expect(screen.queryByText('6.30')).toBeNull();
    expect(screen.queryByText('1750')).toBeNull();
  });

  it('6. Root dashboard page (/) does not embed MonitoringDashboard', () => {
    render(
      <DeviceProvider initialDevices={[mockSoilDevice]}>
        <DashboardPage />
      </DeviceProvider>
    );
    expect(screen.getByText(/King Agrowisata/i)).toBeInTheDocument();
    expect(screen.queryByText(/Pemantauan Tanah \(SOIL\)/i)).toBeNull();
    expect(screen.queryByText(/Kualitas Air Irigasi/i)).toBeNull();
    expect(screen.queryByText(/Pemantauan Tangki Air/i)).toBeNull();
  });

  it('7. Historical charts (NPKChart and WaterNutrientChart) render empty states by default without mock fallbacks', () => {
    const { unmount } = render(<NPKChart data={[]} />);
    expect(screen.getByText(/Tidak ada data riwayat/i)).toBeInTheDocument();
    unmount();

    render(<WaterNutrientChart data={[]} />);
    expect(screen.getByText(/Tidak ada data riwayat/i)).toBeInTheDocument();
  });
});
