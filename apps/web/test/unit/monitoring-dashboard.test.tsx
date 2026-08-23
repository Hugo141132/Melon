import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MonitoringDashboard from '@/components/monitoring/MonitoringDashboard';
import { DeviceProvider, AuthorisedDevice } from '@/context/DeviceContext';
import type { LatestMonitoringSnapshotDto } from '@kebun-melon/contracts';
import { DeviceType, DeviceConnectionStatus } from '@kebun-melon/contracts';

// Mock device data
const mockSoilDevice: AuthorisedDevice = {
  id: 'uuid-001',
  deviceId: 'soil-node-001',
  deviceName: 'Sensor Tanah Blok A',
  deviceType: DeviceType.SOIL_NODE,
  siteId: null,
  accountStatus: 'ACTIVE',
  connectionStatus: DeviceConnectionStatus.ONLINE,
  lastSeenAt: '2026-08-04T09:00:00.000Z',
  firmwareVersion: '1.0.0',
  latitude: -6.2,
  longitude: 106.8,
  permissions: { canView: true, canControl: true, canAssign: true, canConfigure: true },
};

const mockWaterQualityDevice: AuthorisedDevice = {
  id: 'uuid-002',
  deviceId: 'water-node-002',
  deviceName: 'Sensor Kualitas Air B',
  deviceType: DeviceType.WATER_QUALITY_NODE,
  siteId: null,
  accountStatus: 'ACTIVE',
  connectionStatus: DeviceConnectionStatus.ONLINE,
  lastSeenAt: '2026-08-04T09:05:00.000Z',
  firmwareVersion: '1.0.0',
  latitude: -6.21,
  longitude: 106.81,
  permissions: { canView: true, canControl: false, canAssign: false, canConfigure: false },
};

const mockWaterTankDevice: AuthorisedDevice = {
  id: 'uuid-003',
  deviceId: 'water-tank-003',
  deviceName: 'Tangki Air Utama',
  deviceType: DeviceType.WATER_TANK_NODE,
  siteId: null,
  accountStatus: 'ACTIVE',
  connectionStatus: DeviceConnectionStatus.ONLINE,
  lastSeenAt: '2026-08-04T09:10:00.000Z',
  firmwareVersion: '1.0.0',
  latitude: null,
  longitude: null,
  permissions: { canView: true, canControl: true, canAssign: false, canConfigure: false },
};

const mockSoilSnapshot: LatestMonitoringSnapshotDto = {
  deviceId: 'soil-node-001',
  deviceType: DeviceType.SOIL_NODE as DeviceType,
  connectionStatus: DeviceConnectionStatus.ONLINE as DeviceConnectionStatus,
  lastSeenAt: '2026-08-04T09:00:00.000Z',
  soil: {
    deviceId: 'soil-node-001',
    recordedAt: '2026-08-04T09:00:00.000Z',
    receivedAt: '2026-08-04T09:00:01.000Z',
    isStale: false,
    data: {
      nitrogen: 145,
      phosphorus: 42,
      potassium: 198,
      temperature: 28.5,
      moisture: 65.2,
      ph: 6.5,
      ec: 1.8,
      status: 'NORMAL',
    },
  },
  water: null,
};

const mockWaterQualitySnapshot: LatestMonitoringSnapshotDto = {
  deviceId: 'water-node-002',
  deviceType: DeviceType.WATER_QUALITY_NODE as DeviceType,
  connectionStatus: DeviceConnectionStatus.ONLINE as DeviceConnectionStatus,
  lastSeenAt: '2026-08-04T09:05:00.000Z',
  soil: null,
  water: {
    deviceId: 'water-node-002',
    recordedAt: '2026-08-04T09:05:00.000Z',
    receivedAt: '2026-08-04T09:05:01.000Z',
    isStale: false,
    data: {
      ph: 6.8,
      tds: 450,
      ec: 1.9,
      tankVolume: null,
      flowRate: null,
      status: 'NORMAL',
    },
  },
};

const mockWaterTankSnapshot: LatestMonitoringSnapshotDto = {
  deviceId: 'water-tank-003',
  deviceType: DeviceType.WATER_TANK_NODE as DeviceType,
  connectionStatus: DeviceConnectionStatus.ONLINE as DeviceConnectionStatus,
  lastSeenAt: '2026-08-04T09:10:00.000Z',
  soil: null,
  water: {
    deviceId: 'water-tank-003',
    recordedAt: '2026-08-04T09:10:00.000Z',
    receivedAt: '2026-08-04T09:10:01.000Z',
    isStale: false,
    data: {
      ph: null,
      tds: null,
      ec: null,
      tankVolume: 1250,
      flowRate: 14.2,
      status: 'NORMAL',
    },
  },
};

describe('TASK-0502 — Real-Time Monitoring Dashboard Integration Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Loading Skeleton State during initial telemetry fetch', async () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {})); // pending fetch

    render(
      <DeviceProvider initialDevices={[mockSoilDevice]} initialSelectedDeviceId="soil-node-001">
        <MonitoringDashboard />
      </DeviceProvider>
    );

    expect(screen.getByTestId('monitoring-skeleton')).toBeInTheDocument();
  });

  it('2. Render Canonical SOIL Telemetry Metrics (N/P/K, Temp, Moisture, pH, EC)', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/devices')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: mockSoilSnapshot }),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    render(
      <DeviceProvider initialDevices={[mockSoilDevice]} initialSelectedDeviceId="soil-node-001">
        <MonitoringDashboard />
      </DeviceProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Pemantauan Tanah (SOIL)')).toBeInTheDocument();
    });

    // Check canonical SOIL metrics
    expect(screen.getByText('145')).toBeInTheDocument(); // Nitrogen
    expect(screen.getByText('42')).toBeInTheDocument(); // Phosphorus
    expect(screen.getByText('198')).toBeInTheDocument(); // Potassium
    expect(screen.getByText('28.5')).toBeInTheDocument(); // Temperature
    expect(screen.getByText('65.2')).toBeInTheDocument(); // Moisture
    expect(screen.getByText('%RH')).toBeInTheDocument(); // Moisture Unit
    expect(screen.getByText('6.50')).toBeInTheDocument(); // pH
    expect(screen.getByText('1800')).toBeInTheDocument(); // EC in µS/cm (1.8 * 1000)
  });

  it('3. Render Canonical WATER QUALITY Metrics (pH, TDS, EC)', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/devices')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: mockWaterQualitySnapshot }),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    render(
      <DeviceProvider
        initialDevices={[mockWaterQualityDevice]}
        initialSelectedDeviceId="water-node-002"
      >
        <MonitoringDashboard />
      </DeviceProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Kualitas Air Irigasi')).toBeInTheDocument();
    });

    expect(screen.getByText('6.80')).toBeInTheDocument(); // pH
    expect(screen.getByText('450')).toBeInTheDocument(); // TDS
    expect(screen.getByText('1900')).toBeInTheDocument(); // EC in µS/cm (1.9 * 1000)
  });

  it('4. Render Canonical WATER TANK Metrics (Volume, Flow Rate) without Reservoir terminology', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/devices')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: mockWaterTankSnapshot }),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    render(
      <DeviceProvider
        initialDevices={[mockWaterTankDevice]}
        initialSelectedDeviceId="water-tank-003"
      >
        <MonitoringDashboard />
      </DeviceProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Pemantauan Tangki Air')).toBeInTheDocument();
    });

    expect(screen.getByText('1250')).toBeInTheDocument(); // Volume
    expect(screen.getByText('14.2')).toBeInTheDocument(); // Flow rate
    expect(screen.getByText('m³/h')).toBeInTheDocument(); // Canonical Flow Rate Unit

    // Prohibition Checks: Verify NO reservoir terminology or battery/GPS/MQTT mentions
    expect(screen.queryByText(/reservoir/i)).toBeNull();
    expect(screen.queryByText(/battery/i)).toBeNull();
    expect(screen.queryByText(/mqtt/i)).toBeNull();
    expect(screen.queryByText(/latitude/i)).toBeNull();
  });

  it('5. Stale Data Warning Banner and OFFLINE Connection Badge', async () => {
    const offlineDevice: AuthorisedDevice = {
      ...mockSoilDevice,
      connectionStatus: DeviceConnectionStatus.OFFLINE,
    };

    const staleSnapshot: LatestMonitoringSnapshotDto = {
      ...mockSoilSnapshot,
      connectionStatus: DeviceConnectionStatus.OFFLINE as DeviceConnectionStatus,
      soil: {
        ...mockSoilSnapshot.soil!,
        isStale: true,
      },
    };

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/devices')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: staleSnapshot }),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    render(
      <DeviceProvider initialDevices={[offlineDevice]} initialSelectedDeviceId="soil-node-001">
        <MonitoringDashboard />
      </DeviceProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Terputus (Offline)')).toBeInTheDocument();
      expect(
        screen.getByText(/Perhatian: Data pemantauan saat ini tidak diperbarui/i)
      ).toBeInTheDocument();
    });
  });

  it('6. Empty Telemetry State Handling (Device has no readings yet)', async () => {
    const emptySnapshot: LatestMonitoringSnapshotDto = {
      deviceId: 'soil-node-001',
      deviceType: DeviceType.SOIL_NODE as DeviceType,
      connectionStatus: DeviceConnectionStatus.ONLINE as DeviceConnectionStatus,
      lastSeenAt: null,
      soil: null,
      water: null,
    };

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/devices')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: emptySnapshot }),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    render(
      <DeviceProvider initialDevices={[mockSoilDevice]} initialSelectedDeviceId="soil-node-001">
        <MonitoringDashboard />
      </DeviceProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Belum Ada Data Pemantauan')).toBeInTheDocument();
    });
  });

  it('7. Error State Handling and Manual Retry', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/devices')) {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: async () => ({ error: { message: 'Server database error' } }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: mockSoilSnapshot }),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    render(
      <DeviceProvider initialDevices={[mockSoilDevice]} initialSelectedDeviceId="soil-node-001">
        <MonitoringDashboard />
      </DeviceProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Gagal Memuat Data Pemantauan')).toBeInTheDocument();
      expect(screen.getByText('Server database error')).toBeInTheDocument();
    });

    // Click retry
    const retryBtn = screen.getByRole('button', { name: /Coba Lagi/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Pemantauan Tanah (SOIL)')).toBeInTheDocument();
    });
  });
});
