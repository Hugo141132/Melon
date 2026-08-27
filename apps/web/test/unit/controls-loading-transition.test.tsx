import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import ControlsLoading from '@/app/controls/loading';
import { WaterTankMonitoringCard } from '@/components/monitoring/WaterTankMonitoringCard';
import FaucetControlPanel from '@/components/controls/FaucetControlPanel';
import FaucetHistoryTable from '@/components/controls/FaucetHistoryTable';
import { DeviceProvider, AuthorisedDevice } from '@/context/DeviceContext';
import { AuthProvider } from '@/context/AuthContext';

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

const mockOwnerSession = {
  id: 'user-001',
  email: 'owner@kebunmelon.com',
  name: 'Owner Kebun',
  accountStatus: 'ACTIVE',
  activeRoles: ['OWNER' as any],
  createdAt: '2026-01-01T00:00:00Z',
};

describe('Controls Page Loading & Layout Stability Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders route-level instant loading shell (loading.tsx) with structural parity', () => {
    render(
      <AuthProvider initialSession={mockOwnerSession as any}>
        <DeviceProvider>
          <ControlsLoading />
        </DeviceProvider>
      </AuthProvider>
    );

    // Tank monitoring skeleton section
    expect(screen.getByTestId('controls-loading-tank')).toBeInTheDocument();
    expect(screen.getByText('WATER_TANK_NODE')).toBeInTheDocument();
    expect(screen.getByText('0L')).toBeInTheDocument();
    expect(screen.getByText('600L')).toBeInTheDocument();
    expect(screen.getByText('L')).toBeInTheDocument();
    expect(screen.getByText('m³/h')).toBeInTheDocument();

    // Preset selector skeleton section
    expect(screen.getByTestId('controls-loading-presets')).toBeInTheDocument();

    // History table skeleton section
    expect(screen.getByTestId('controls-loading-history')).toBeInTheDocument();
  });

  it('WaterTankMonitoringCard renders structured skeleton matching 2-column layout during loading without fabricated numbers', () => {
    global.fetch = vi.fn().mockImplementation(
      () => new Promise(() => {}) // pending loading
    );

    render(
      <DeviceProvider
        initialDevices={[mockWaterTankDevice]}
        initialSelectedDeviceId="water-tank-001"
      >
        <WaterTankMonitoringCard />
      </DeviceProvider>
    );

    const skeleton = screen.getByTestId('water-tank-skeleton');
    expect(skeleton).toBeInTheDocument();
    // Labels are present immediately
    expect(screen.getByText('Volume Air Tangki')).toBeInTheDocument();
    expect(screen.getByText('Debit Air')).toBeInTheDocument();
    expect(screen.getByText('0L')).toBeInTheDocument();
    expect(screen.getByText('600L')).toBeInTheDocument();
    expect(screen.getByText('L')).toBeInTheDocument();
    expect(screen.getByText('m³/h')).toBeInTheDocument();

    // Device header is displayed with device info
    expect(screen.getByText('Tangki Utama Kebun')).toBeInTheDocument();
    expect(screen.getByText('WATER_TANK_NODE')).toBeInTheDocument();

    // Telemetry numbers are not fabricated
    expect(screen.queryByText('450.5')).not.toBeInTheDocument();
    expect(screen.queryByText('2.4')).not.toBeInTheDocument();
  });

  it('FaucetControlPanel retains stable FaucetHistoryTable during device loading without flashing unselected box', () => {
    global.fetch = vi.fn().mockImplementation(
      () => new Promise(() => {}) // pending
    );

    render(
      <AuthProvider initialSession={mockOwnerSession as any}>
        <DeviceProvider
          initialDevices={[mockWaterTankDevice]}
          initialSelectedDeviceId="water-tank-001"
        >
          <FaucetControlPanel />
        </DeviceProvider>
      </AuthProvider>
    );

    // Preset selector is immediately visible
    expect(screen.getByTestId('faucet-preset-selector')).toBeInTheDocument();
    expect(screen.getByText('Preset Dosis Penyiraman Faucet')).toBeInTheDocument();

    // History table container is rendered in place
    expect(screen.getByTestId('faucet-history-table')).toBeInTheDocument();
    expect(screen.getByText('Riwayat Perintah Keran')).toBeInTheDocument();

    // No jarring unselected message box flashing in place of history
    expect(
      screen.queryByText(
        'Pilih perangkat dari dropdown navigasi di bagian atas untuk melihat riwayat perintah kran.'
      )
    ).not.toBeInTheDocument();
  });

  it('FaucetHistoryTable renders skeleton rows and maintains layout when isLoading is true', () => {
    render(<FaucetHistoryTable deviceId={null} isLoading={true} />);

    expect(screen.getByTestId('faucet-history-table')).toBeInTheDocument();
    expect(screen.getByText('Riwayat Perintah Keran')).toBeInTheDocument();
    expect(screen.getByTestId('history-status-filter')).toBeInTheDocument();
    expect(screen.getByTestId('btn-refresh-history')).toBeInTheDocument();

    // Table headers are present
    expect(screen.getByRole('columnheader', { name: /Fase \/ Target/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Volume Aktual/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Status/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Waktu Minta/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Aktor/i })).toBeInTheDocument();
  });
});
