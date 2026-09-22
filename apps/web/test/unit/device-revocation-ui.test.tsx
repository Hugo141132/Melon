import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SoilPage from '@/app/soil/page';
import WaterPage from '@/app/water/page';
import ControlsPage from '@/app/controls/page';
import { DeviceProvider, AuthorisedDevice } from '@/context/DeviceContext';
import { NextIntlClientProvider } from 'next-intl';
import idMessages from '@/messages/id.json';
import { DeviceType, DeviceConnectionStatus } from '@kebun-melon/contracts';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/soil',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

// Mock AuthContext
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'usr-admin-1', fullName: 'Admin User', email: 'admin@melon.com' },
    role: 'ADMIN',
    isAuthenticated: true,
  }),
}));

// Mock dynamic charts
vi.mock('@/components/charts/NPKChart', () => ({
  default: () => <div data-testid="mock-npk-chart">NPK Chart Mock</div>,
}));
vi.mock('@/components/charts/WaterNutrientChart', () => ({
  default: () => <div data-testid="mock-water-chart">Water Chart Mock</div>,
}));

// Mock controls panels
vi.mock('@/components/controls/FaucetControlPanel', () => ({
  default: () => <div data-testid="mock-faucet-panel">Faucet Control Panel</div>,
}));
vi.mock('@/components/monitoring/WaterTankMonitoringCard', () => ({
  default: () => <div data-testid="mock-tank-card">Water Tank Card</div>,
}));

// Mock monitoring hooks to return empty snapshot
vi.mock('@/hooks/useLatestMonitoring', () => ({
  useLatestMonitoring: () => ({
    snapshot: null,
    isLoading: false,
    isRevalidating: false,
    isStale: false,
    connectionStatus: null,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/hooks/useHistoricalMonitoring', () => ({
  useHistoricalMonitoring: () => ({
    preset: '24h',
    setPreset: vi.fn(),
    selectedMetric: 'npk',
    setSelectedMetric: vi.fn(),
    customFrom: '',
    setCustomFrom: vi.fn(),
    customTo: '',
    setCustomTo: vi.fn(),
    data: null,
    loading: false,
    error: null,
    dateRangeError: null,
  }),
}));

vi.mock('@/hooks/useLatestPrediction', () => ({
  useLatestPrediction: () => ({
    prediction: null,
    isLoading: false,
    error: null,
  }),
}));

const mockAssignedDeviceB: AuthorisedDevice = {
  id: 'uuid-device-b',
  deviceId: 'device-b',
  deviceName: 'Device B Active',
  deviceType: DeviceType.SOIL_NODE,
  siteId: null,
  accountStatus: 'ACTIVE',
  connectionStatus: DeviceConnectionStatus.ONLINE,
  lastSeenAt: '2026-08-23T10:00:00.000Z',
  firmwareVersion: '1.0.0',
  latitude: -6.2,
  longitude: 106.8,
  permissions: { canView: true, canControl: true, canAssign: false, canConfigure: false },
};

describe('Device Access Revocation UI Tests (/soil, /water, /controls)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. SoilPage: Renders 403 DeviceAccessForbidden with human-readable name without exposing raw UUID', async () => {
    // ADMIN accessed a device with raw database UUID that is revoked/unassigned
    const rawUuid = '3216f033-4c21-4b19-adc6-365854c31704';

    render(
      <NextIntlClientProvider locale="id" messages={idMessages}>
        <DeviceProvider initialDevices={[mockAssignedDeviceB]} initialSelectedDeviceId={rawUuid}>
          <SoilPage />
        </DeviceProvider>
      </NextIntlClientProvider>
    );

    // Forbidden view must be rendered
    await waitFor(() => {
      expect(screen.getByText(idMessages.devices.deviceAccessRevokedTitle)).toBeInTheDocument();
    });
    expect(screen.getByText(idMessages.devices.deviceAccessRevokedDesc)).toBeInTheDocument();
    expect(screen.getByText(idMessages.devices.backToSensorOverview)).toBeInTheDocument();
    expect(screen.getByText(idMessages.devices.viewMyDevices)).toBeInTheDocument();

    // Human-readable device label must be rendered
    expect(screen.getByText('Node Sensor Tanah')).toBeInTheDocument();

    // Raw database UUID must NOT be exposed in the UI
    expect(screen.queryByText(rawUuid)).not.toBeInTheDocument();

    // Sensitive telemetry UI must NOT be rendered
    expect(screen.queryByText(idMessages.soil.mainNutrients)).not.toBeInTheDocument();
  });

  it('2. WaterPage: Renders 403 DeviceAccessForbidden with human-readable name without exposing raw UUID', async () => {
    const rawUuid = '3216f033-4c21-4b19-adc6-365854c31704';

    render(
      <NextIntlClientProvider locale="id" messages={idMessages}>
        <DeviceProvider initialDevices={[mockAssignedDeviceB]} initialSelectedDeviceId={rawUuid}>
          <WaterPage />
        </DeviceProvider>
      </NextIntlClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(idMessages.devices.deviceAccessRevokedTitle)).toBeInTheDocument();
    });
    expect(screen.getByText(idMessages.devices.deviceAccessRevokedDesc)).toBeInTheDocument();

    // Human-readable water device label rendered, raw UUID concealed
    expect(screen.getByText('Node Kualitas Air')).toBeInTheDocument();
    expect(screen.queryByText(rawUuid)).not.toBeInTheDocument();
    expect(screen.queryByTestId('mock-water-chart')).not.toBeInTheDocument();
  });

  it('3. ControlsPage: Renders 403 DeviceAccessForbidden with human-readable name without exposing raw UUID', async () => {
    const rawUuid = '3216f033-4c21-4b19-adc6-365854c31704';

    render(
      <NextIntlClientProvider locale="id" messages={idMessages}>
        <DeviceProvider initialDevices={[mockAssignedDeviceB]} initialSelectedDeviceId={rawUuid}>
          <ControlsPage />
        </DeviceProvider>
      </NextIntlClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(idMessages.devices.deviceAccessRevokedTitle)).toBeInTheDocument();
    });
    expect(screen.getByText(idMessages.devices.deviceAccessRevokedDesc)).toBeInTheDocument();

    // Human-readable tank/control device label rendered, raw UUID concealed
    expect(screen.getByText('Node Tangki Air')).toBeInTheDocument();
    expect(screen.queryByText(rawUuid)).not.toBeInTheDocument();
    expect(screen.queryByTestId('mock-faucet-panel')).not.toBeInTheDocument();
  });

  it('4. Renders cached custom device display name when available in session cache', async () => {
    const revokedUuid = '9876f033-4c21-4b19-adc6-365854c39999';
    sessionStorage.setItem(
      'kebun_melon_device_cache',
      JSON.stringify({
        [revokedUuid]: {
          deviceName: 'Sensor Lahan Melon Utama',
          deviceType: 'SOIL_NODE',
        },
      })
    );

    render(
      <NextIntlClientProvider locale="id" messages={idMessages}>
        <DeviceProvider
          initialDevices={[mockAssignedDeviceB]}
          initialSelectedDeviceId={revokedUuid}
        >
          <SoilPage />
        </DeviceProvider>
      </NextIntlClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(idMessages.devices.deviceAccessRevokedTitle)).toBeInTheDocument();
    });

    // Custom friendly name from cache must be rendered
    expect(screen.getByText('Sensor Lahan Melon Utama')).toBeInTheDocument();
    // Raw UUID must never be shown
    expect(screen.queryByText(revokedUuid)).not.toBeInTheDocument();
  });

  it('5. SoilPage: Renders normally when requested device is actively assigned', async () => {
    render(
      <NextIntlClientProvider locale="id" messages={idMessages}>
        <DeviceProvider
          initialDevices={[mockAssignedDeviceB]}
          initialSelectedDeviceId="uuid-device-b"
        >
          <SoilPage />
        </DeviceProvider>
      </NextIntlClientProvider>
    );

    // Forbidden view must NOT be shown
    expect(screen.queryByText(idMessages.devices.deviceAccessRevokedTitle)).not.toBeInTheDocument();
    // Real page content shown
    expect(screen.getAllByText('Device B Active').length).toBeGreaterThan(0);
    expect(screen.getByText(idMessages.soil.mainNutrients)).toBeInTheDocument();
  });
});
