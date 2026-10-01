import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import ControlsLoading from '@/app/controls/loading';
import { WaterTankMonitoringCard } from '@/components/monitoring/WaterTankMonitoringCard';
import FaucetControlPanel from '@/components/controls/FaucetControlPanel';
import FaucetPresetSelector, {
  deriveValveTransitionState,
} from '@/components/controls/FaucetPresetSelector';
import FaucetStatusCard from '@/components/controls/FaucetStatusCard';
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
    expect(screen.queryByText('WATER_TANK_NODE')).not.toBeInTheDocument();
    expect(screen.getByText('0 L')).toBeInTheDocument();
    expect(screen.getByText('2200 L')).toBeInTheDocument();
    expect(screen.getByText('L')).toBeInTheDocument();
    expect(screen.queryByText('m³/h')).not.toBeInTheDocument();

    // Preset selector skeleton section
    expect(screen.getByTestId('controls-loading-presets')).toBeInTheDocument();

    // History table skeleton section
    expect(screen.getByTestId('controls-loading-history')).toBeInTheDocument();
  });

  it('WaterTankMonitoringCard renders structured skeleton during loading without fabricated numbers', () => {
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
    expect(screen.queryByText('Debit Air')).not.toBeInTheDocument();
    expect(screen.getByText('0 L')).toBeInTheDocument();
    expect(screen.getByText('2200 L')).toBeInTheDocument();
    expect(screen.getByText('L')).toBeInTheDocument();
    expect(screen.queryByText('m³/h')).not.toBeInTheDocument();

    // Device header is displayed with device info
    expect(screen.getByText('Tangki Utama Kebun')).toBeInTheDocument();
    expect(screen.queryByText('WATER_TANK_NODE')).not.toBeInTheDocument();

    // Telemetry numbers are not fabricated and no empty data placeholder is flashed
    expect(screen.queryByText('450.5')).not.toBeInTheDocument();
    expect(screen.queryByText('Belum ada data')).not.toBeInTheDocument();
    expect(screen.queryByText('No data available')).not.toBeInTheDocument();
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
    expect(screen.getByText('Preset Dosis Irigasi Katup')).toBeInTheDocument();

    // History table container is rendered in place
    expect(screen.getByTestId('faucet-history-table')).toBeInTheDocument();
    expect(screen.getByText('Riwayat Perintah Katup')).toBeInTheDocument();

    // No jarring unselected message box flashing in place of history
    expect(
      screen.queryByText(
        'Pilih perangkat dari dropdown navigasi di bagian atas untuk melihat riwayat perintah katup.'
      )
    ).not.toBeInTheDocument();

    // Authoritative physical state badge immediately renders in neutral loading checking state without flashing amber UNKNOWN
    const badge = screen.getByTestId('authoritative-physical-state');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-app-surface-container/60');
    expect(badge).not.toHaveClass('bg-amber-50');
    expect(screen.queryByText('Tidak Diketahui')).not.toBeInTheDocument();
    expect(screen.queryByText('Unknown')).not.toBeInTheDocument();

    // History table renders skeleton rows rather than flashing empty state
    expect(screen.queryByText('Belum ada riwayat perintah katup')).not.toBeInTheDocument();
    expect(screen.queryByText('No valve command history yet')).not.toBeInTheDocument();
  });

  it('FaucetControlPanel renders FaucetPresetSelectorSkeleton during initial device loading without flashing disabled warning banner', () => {
    global.fetch = vi.fn().mockImplementation(
      () => new Promise(() => {}) // pending loading
    );

    render(
      <AuthProvider initialSession={mockOwnerSession as any}>
        <DeviceProvider>
          <FaucetControlPanel />
        </DeviceProvider>
      </AuthProvider>
    );

    // Skeleton should be rendered immediately
    expect(screen.getByTestId('controls-loading-presets')).toBeInTheDocument();
    expect(screen.queryByTestId('faucet-preset-selector')).not.toBeInTheDocument();
    expect(screen.queryByTestId('faucet-disabled-banner')).not.toBeInTheDocument();

    // History table should also render skeleton
    expect(screen.getByTestId('faucet-history-table')).toBeInTheDocument();
  });

  it('FaucetHistoryTable renders skeleton rows and maintains layout when isLoading is true', () => {
    render(<FaucetHistoryTable deviceId={null} isLoading={true} />);

    expect(screen.getByTestId('faucet-history-table')).toBeInTheDocument();
    expect(screen.getByText('Riwayat Perintah Katup')).toBeInTheDocument();
    expect(screen.getByTestId('history-status-filter')).toBeInTheDocument();
    expect(screen.getByTestId('btn-refresh-history')).toBeInTheDocument();

    // Table headers are present
    expect(screen.getByRole('columnheader', { name: /Fase \/ Target/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Volume Aktual/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Status/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Waktu Minta/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Aktor/i })).toBeInTheDocument();
  });

  it('FaucetPresetSelector renders neutral loading status badge during valve status check without premature UNKNOWN warning', () => {
    render(
      <FaucetPresetSelector
        selectedDevice={mockWaterTankDevice}
        hasControlPermission={true}
        isFeatureEnabled={true}
        isValveStatusLoading={true}
        physicalState="UNKNOWN"
        onSelectPreset={vi.fn()}
      />
    );

    const badge = screen.getByTestId('authoritative-physical-state');
    expect(badge).toBeInTheDocument();
    // Neutral loading classes
    expect(badge).toHaveClass('bg-app-surface-container/60');
    expect(badge).not.toHaveClass('bg-amber-50');
    // Does NOT render "Tidak Diketahui" text while loading
    expect(screen.queryByText('Tidak Diketahui')).not.toBeInTheDocument();
    expect(screen.queryByText('Unknown')).not.toBeInTheDocument();
  });

  it('FaucetPresetSelector transitions to confirmed physical state when isValveStatusLoading is false', () => {
    const { rerender } = render(
      <FaucetPresetSelector
        selectedDevice={mockWaterTankDevice}
        hasControlPermission={true}
        isFeatureEnabled={true}
        isValveStatusLoading={true}
        physicalState="UNKNOWN"
        onSelectPreset={vi.fn()}
      />
    );

    expect(screen.getByTestId('authoritative-physical-state')).toHaveClass(
      'bg-app-surface-container/60'
    );

    // Simulate valve status resolved to CLOSED
    rerender(
      <FaucetPresetSelector
        selectedDevice={mockWaterTankDevice}
        hasControlPermission={true}
        isFeatureEnabled={true}
        isValveStatusLoading={false}
        physicalState="CLOSED"
        onSelectPreset={vi.fn()}
      />
    );

    const badge = screen.getByTestId('authoritative-physical-state');
    expect(badge).toHaveClass('bg-slate-100');
    expect(badge).toHaveClass('text-slate-800');
    expect(screen.getByText(/Tertutup|Closed/i)).toBeInTheDocument();
  });

  describe('Intermediate Valve Transition States & Genuine Unknown Preservation', () => {
    it('deriveValveTransitionState maps active commands and submission states correctly', () => {
      // Submitting modal actions
      expect(deriveValveTransitionState(null, true, 'OPEN')).toBe('OPENING');
      expect(deriveValveTransitionState(null, true, 'CLOSE')).toBe('CLOSING');
      expect(deriveValveTransitionState(null, true, 'DISPENSE')).toBe('DISPENSING');
      expect(deriveValveTransitionState(null, true, 'UNKNOWN_ACTION')).toBe('WAITING_CONFIRMATION');

      // Active commands in flight
      expect(deriveValveTransitionState({ status: 'QUEUED', action: 'OPEN' })).toBe('OPENING');
      expect(deriveValveTransitionState({ status: 'SENT', action: 'CLOSE' })).toBe('CLOSING');
      expect(deriveValveTransitionState({ status: 'IN_PROGRESS', action: 'DISPENSE' })).toBe(
        'DISPENSING'
      );
      expect(deriveValveTransitionState({ status: 'ACKNOWLEDGED', action: 'CUSTOM' })).toBe(
        'WAITING_CONFIRMATION'
      );

      // Terminal or non-active commands
      expect(deriveValveTransitionState({ status: 'COMPLETED', action: 'OPEN' })).toBe(null);
      expect(deriveValveTransitionState({ status: 'FAILED', action: 'OPEN' })).toBe(null);
      expect(deriveValveTransitionState(null, false)).toBe(null);
    });

    it('renders Opening transition badge without flashing UNKNOWN when opening command is in flight', () => {
      render(
        <FaucetPresetSelector
          selectedDevice={mockWaterTankDevice}
          hasControlPermission={true}
          isFeatureEnabled={true}
          isValveStatusLoading={false}
          physicalState="UNKNOWN"
          activeCommand={{
            id: 'cmd-01',
            commandId: 'cmd-01',
            status: 'SENT',
            action: 'OPEN',
          }}
          onSelectPreset={vi.fn()}
        />
      );

      const badge = screen.getByTestId('authoritative-physical-state');
      expect(badge).toHaveClass('bg-sky-50');
      expect(badge).toHaveClass('text-sky-800');
      expect(badge).not.toHaveClass('bg-amber-50');
      expect(screen.getByText(/Membuka|Opening/i)).toBeInTheDocument();
      expect(screen.queryByText('Tidak Diketahui')).not.toBeInTheDocument();
      expect(screen.queryByText('Unknown')).not.toBeInTheDocument();
    });

    it('renders Closing transition badge when close command is in flight', () => {
      render(
        <FaucetPresetSelector
          selectedDevice={mockWaterTankDevice}
          hasControlPermission={true}
          isFeatureEnabled={true}
          isValveStatusLoading={false}
          physicalState="UNKNOWN"
          activeCommand={{
            id: 'cmd-02',
            commandId: 'cmd-02',
            status: 'IN_PROGRESS',
            action: 'CLOSE',
          }}
          onSelectPreset={vi.fn()}
        />
      );

      const badge = screen.getByTestId('authoritative-physical-state');
      expect(badge).toHaveClass('bg-indigo-50');
      expect(badge).toHaveClass('text-indigo-800');
      expect(badge).not.toHaveClass('bg-amber-50');
      expect(screen.getByText(/Menutup|Closing/i)).toBeInTheDocument();
    });

    it('renders Dispensing transition badge when dispense command is in flight', () => {
      render(
        <FaucetPresetSelector
          selectedDevice={mockWaterTankDevice}
          hasControlPermission={true}
          isFeatureEnabled={true}
          isValveStatusLoading={false}
          physicalState="UNKNOWN"
          activeCommand={{
            id: 'cmd-03',
            commandId: 'cmd-03',
            status: 'IN_PROGRESS',
            action: 'DISPENSE',
          }}
          onSelectPreset={vi.fn()}
        />
      );

      const badge = screen.getByTestId('authoritative-physical-state');
      expect(badge).toHaveClass('bg-cyan-50');
      expect(badge).toHaveClass('text-cyan-800');
      expect(badge).not.toHaveClass('bg-amber-50');
      expect(screen.getByText(/Menyalurkan|Dispensing/i)).toBeInTheDocument();
    });

    it('renders Waiting for confirmation transition badge when command is submitted or generic in flight', () => {
      render(
        <FaucetPresetSelector
          selectedDevice={mockWaterTankDevice}
          hasControlPermission={true}
          isFeatureEnabled={true}
          isValveStatusLoading={false}
          physicalState="UNKNOWN"
          isSubmitting={true}
          submittingAction={null}
          onSelectPreset={vi.fn()}
        />
      );

      const badge = screen.getByTestId('authoritative-physical-state');
      expect(badge).toHaveClass('bg-blue-50');
      expect(badge).toHaveClass('text-blue-800');
      expect(badge).not.toHaveClass('bg-amber-50');
      expect(screen.getByText(/Menunggu konfirmasi|Waiting for confirmation/i)).toBeInTheDocument();
    });

    it('preserves genuine UNKNOWN badge when no command is in flight and device state is unconfirmed', () => {
      render(
        <FaucetPresetSelector
          selectedDevice={mockWaterTankDevice}
          hasControlPermission={true}
          isFeatureEnabled={true}
          isValveStatusLoading={false}
          physicalState="UNKNOWN"
          activeCommand={null}
          isSubmitting={false}
          onSelectPreset={vi.fn()}
        />
      );

      const badge = screen.getByTestId('authoritative-physical-state');
      // Must NOT hide genuine UNKNOWN
      expect(badge).toHaveClass('bg-amber-50');
      expect(badge).toHaveClass('text-amber-900');
      expect(screen.getByText(/Tidak Diketahui|Unknown/i)).toBeInTheDocument();
    });

    it('FaucetStatusCard renders Opening transition state consistently with pulsing dot and description', () => {
      render(
        <FaucetStatusCard
          deviceId={mockWaterTankDevice.deviceId!}
          command={{
            id: 'cmd-active-01',
            commandId: 'cmd-active-01',
            idempotencyKey: 'idemp-01',
            deviceId: mockWaterTankDevice.deviceId!,
            action: 'OPEN',
            status: 'SENT',
            requestedAt: new Date().toISOString(),
          }}
        />
      );

      const statusBadge = screen.getByTestId('status-card-physical-state');
      expect(statusBadge).toHaveAttribute('data-state', 'OPENING');
      expect(statusBadge).toHaveClass('bg-sky-50/70');
      expect(statusBadge).toHaveClass('text-sky-900');
      expect(statusBadge).toHaveTextContent(/Membuka|Opening/i);
      expect(statusBadge).not.toHaveClass('bg-amber-50/70');
      expect(statusBadge).not.toHaveTextContent('Tidak Diketahui');
      expect(statusBadge).not.toHaveTextContent('Unknown');
    });

    it('FaucetStatusCard renders Closing transition state consistently during active CLOSE command', () => {
      render(
        <FaucetStatusCard
          deviceId={mockWaterTankDevice.deviceId!}
          command={{
            id: 'cmd-active-02',
            commandId: 'cmd-active-02',
            idempotencyKey: 'idemp-02',
            deviceId: mockWaterTankDevice.deviceId!,
            action: 'CLOSE',
            status: 'IN_PROGRESS',
            requestedAt: new Date().toISOString(),
          }}
        />
      );

      const statusBadge = screen.getByTestId('status-card-physical-state');
      expect(statusBadge).toHaveAttribute('data-state', 'CLOSING');
      expect(statusBadge).toHaveClass('bg-indigo-50/70');
      expect(statusBadge).toHaveClass('text-indigo-900');
      expect(statusBadge).toHaveTextContent(/Menutup|Closing/i);
    });

    it('FaucetStatusCard renders Dispensing transition state consistently during active DISPENSE command', () => {
      render(
        <FaucetStatusCard
          deviceId={mockWaterTankDevice.deviceId!}
          command={{
            id: 'cmd-active-03',
            commandId: 'cmd-active-03',
            idempotencyKey: 'idemp-03',
            deviceId: mockWaterTankDevice.deviceId!,
            action: 'DISPENSE',
            phase: 1,
            targetVolumeMl: 300,
            status: 'IN_PROGRESS',
            requestedAt: new Date().toISOString(),
          }}
        />
      );

      const statusBadge = screen.getByTestId('status-card-physical-state');
      expect(statusBadge).toHaveAttribute('data-state', 'DISPENSING');
      expect(statusBadge).toHaveClass('bg-cyan-50/70');
      expect(statusBadge).toHaveClass('text-cyan-900');
      expect(statusBadge).toHaveTextContent(/Menyalurkan|Dispensing/i);
    });

    it('FaucetStatusCard renders Waiting for confirmation transition state when action is generic/waiting ack', () => {
      render(
        <FaucetStatusCard
          deviceId={mockWaterTankDevice.deviceId!}
          command={{
            id: 'cmd-active-04',
            commandId: 'cmd-active-04',
            idempotencyKey: 'idemp-04',
            deviceId: mockWaterTankDevice.deviceId!,
            action: 'CUSTOM_UNKNOWN',
            status: 'QUEUED',
            requestedAt: new Date().toISOString(),
          }}
        />
      );

      const statusBadge = screen.getByTestId('status-card-physical-state');
      expect(statusBadge).toHaveAttribute('data-state', 'WAITING_CONFIRMATION');
      expect(statusBadge).toHaveClass('bg-blue-50/70');
      expect(statusBadge).toHaveClass('text-blue-900');
      expect(statusBadge).toHaveTextContent(/Menunggu konfirmasi|Waiting for confirmation/i);
    });

    it('FaucetStatusCard preserves genuine UNKNOWN when command is completed and position unconfirmed', () => {
      render(
        <FaucetStatusCard
          deviceId={mockWaterTankDevice.deviceId!}
          command={{
            id: 'cmd-completed-dispense',
            commandId: 'cmd-completed-dispense',
            idempotencyKey: 'idemp-comp',
            deviceId: mockWaterTankDevice.deviceId!,
            action: 'DISPENSE',
            phase: 2,
            targetVolumeMl: 1000,
            actualVolumeMl: 1000,
            status: 'COMPLETED',
            requestedAt: new Date().toISOString(),
            events: [],
          }}
        />
      );

      const statusBadge = screen.getByTestId('status-card-physical-state');
      expect(statusBadge).toHaveAttribute('data-state', 'UNKNOWN');
      expect(statusBadge).toHaveClass('bg-amber-50/70');
      expect(statusBadge).toHaveClass('text-amber-900');
      expect(screen.getByText(/Tidak Diketahui|Unknown/i)).toBeInTheDocument();
    });

    it('FaucetControlPanel updates notification message when command transitions to COMPLETED', async () => {
      // Mock FaucetStatusCard child callback
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('faucet-commands') && !url.includes('POST')) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                items: [
                  {
                    id: 'cmd-active-1',
                    commandId: 'cmd-active-1',
                    deviceId: mockWaterTankDevice.deviceId,
                    action: 'CLOSE',
                    status: 'QUEUED',
                    requestedAt: new Date().toISOString(),
                  },
                ],
                meta: { pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 } },
              },
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: { isConfirmed: true, confirmedState: 'CLOSED' },
          }),
        };
      });

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

      // Wait for active command status card to render
      expect(await screen.findByTestId('faucet-status-card')).toBeInTheDocument();

      // Trigger status update to COMPLETED via command poll response
      // When card polls /api/v1/devices/.../faucet-commands/cmd-active-1 returning COMPLETED:
      global.fetch = vi.fn().mockImplementation(async () => {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: 'cmd-active-1',
              commandId: 'cmd-active-1',
              deviceId: mockWaterTankDevice.deviceId,
              action: 'CLOSE',
              status: 'COMPLETED',
              requestedAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              events: [
                {
                  id: 'evt-1',
                  faucetCommandId: 'cmd-active-1',
                  eventStatus: 'COMPLETED',
                  receivedAt: new Date().toISOString(),
                  createdAt: new Date().toISOString(),
                },
              ],
            },
          }),
        };
      });
    });
  });
});
