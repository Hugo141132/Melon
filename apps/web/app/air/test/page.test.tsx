import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import AirPage from '../page';
import { DeviceProvider, AuthorisedDevice } from '@/context/DeviceContext';

// Mock Next.js navigation hooks
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/air',
}));

// Mock Recharts / WaterNutrientChart to prevent canvas render issues in Vitest
vi.mock('@/components/charts/WaterNutrientChart', () => ({
  default: () => <div data-testid="water-nutrient-chart">Water Nutrient Chart</div>,
}));

// Mock devices
const mockWaterQualityDevice: AuthorisedDevice = {
  id: 'db-wq-001',
  deviceId: 'water-node-001',
  deviceName: 'Water Quality Node A',
  deviceType: 'WATER_QUALITY_NODE',
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

const mockWaterTankDevice: AuthorisedDevice = {
  id: 'db-wt-001',
  deviceId: 'water-tank-node-001',
  deviceName: 'Water Tank Node B',
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

const mockSoilDevice: AuthorisedDevice = {
  id: 'db-soil-001',
  deviceId: 'soil-node-001',
  deviceName: 'Soil Sensor Node C',
  deviceType: 'SOIL_NODE',
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

describe('/air Page Monitoring Domain Isolation Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            soil: null,
            water: {
              recordedAt: '2026-08-04T10:00:00Z',
              receivedAt: '2026-08-04T10:00:00Z',
              data: {
                ph: 6.5,
                tds: 920,
                ec: 1.8,
                tankVolume: 450,
                flowRate: 12.5,
                status: 'NORMAL',
              },
            },
          },
        }),
      })
    );
  });

  it('1. Renders ONLY WATER_QUALITY metrics (pH, TDS ppm, EC mS/cm) when WATER_QUALITY_NODE selected', () => {
    render(
      <DeviceProvider initialDevices={[mockWaterQualityDevice]}>
        <AirPage />
      </DeviceProvider>
    );

    // WATER_QUALITY metric titles & canonical units
    expect(screen.getByText('Electrical Conductivity (EC)')).toBeInTheDocument();
    expect(screen.getByText('pH Level')).toBeInTheDocument();
    expect(screen.getByText('Total Dissolved Solids')).toBeInTheDocument();
    expect(screen.getByText('ppm')).toBeInTheDocument();
    expect(screen.getAllByText('mS/cm').length).toBeGreaterThan(0);

    // MUST NOT render WATER_TANK metrics
    expect(screen.queryByText('Volume Air Tangki')).toBeNull();
    expect(screen.queryByText('m³/h')).toBeNull();
  });

  it('2. Shows device switch prompt when WATER_TANK_NODE selected', () => {
    render(
      <DeviceProvider initialDevices={[mockWaterTankDevice]}>
        <AirPage />
      </DeviceProvider>
    );

    // Prompt displayed for WATER_TANK_NODE on /air
    expect(screen.getByText('Perangkat Tangki Air Aktif')).toBeInTheDocument();

    // MUST NOT render WATER_TANK or WATER_QUALITY telemetry cards on /air
    expect(screen.queryByText('Volume Air Tangki')).toBeNull();
    expect(screen.queryByText('Electrical Conductivity (EC)')).toBeNull();
  });

  it('3. /air page contains WATER_QUALITY metrics only and no tank metrics', () => {
    render(
      <DeviceProvider initialDevices={[mockWaterQualityDevice]}>
        <AirPage />
      </DeviceProvider>
    );

    // In Water Quality view, no Tank metrics exist
    expect(screen.getByText('pH Level')).toBeInTheDocument();
    expect(screen.queryByText('Volume Air Tangki')).toBeNull();
    expect(screen.queryByText('Debit Air')).toBeNull();
  });

  it('4. Removes "Pilihan Fase Pengairan" section completely', () => {
    render(
      <DeviceProvider initialDevices={[mockWaterQualityDevice]}>
        <AirPage />
      </DeviceProvider>
    );

    expect(screen.queryByText('Pilihan Fase Pengairan')).toBeNull();
    expect(screen.queryByText(/300 mL/i)).toBeNull();
    expect(screen.queryByText(/1,000 mL/i)).toBeNull();
  });

  it('5. Removes "Kontrol Kran Air Otomatis" quick navigation section', () => {
    render(
      <DeviceProvider initialDevices={[mockWaterQualityDevice]}>
        <AirPage />
      </DeviceProvider>
    );

    expect(screen.queryByText('Kontrol Kran Air Otomatis')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Buka Panel Kontrol' })).toBeNull();
  });

  it('6. Shows device switch prompt when SOIL_NODE is selected', () => {
    render(
      <DeviceProvider initialDevices={[mockSoilDevice]}>
        <AirPage />
      </DeviceProvider>
    );

    expect(screen.getByText('Perangkat Sensor Tanah Aktif')).toBeInTheDocument();
    expect(screen.queryByText('Electrical Conductivity (EC)')).toBeNull();
    expect(screen.queryByText('Volume Air Tangki')).toBeNull();
  });
});
