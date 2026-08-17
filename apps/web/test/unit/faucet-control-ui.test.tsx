import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import FaucetPresetSelector from '@/components/controls/FaucetPresetSelector';
import FaucetConfirmationModal from '@/components/controls/FaucetConfirmationModal';
import FaucetStatusCard from '@/components/controls/FaucetStatusCard';
import FaucetHistoryTable from '@/components/controls/FaucetHistoryTable';
import { AuthorisedDevice } from '@/context/DeviceContext';

const mockOnlineDevice: AuthorisedDevice = {
  id: 'dev-uuid-001',
  deviceId: 'water-node-001',
  deviceName: 'Water Tank Node 01',
  deviceType: 'WATER_TANK_NODE',
  siteId: 'site-01',
  siteName: 'Lahan Melon 1',
  connectionStatus: 'ONLINE',
  lastSeenAt: '2026-08-03T12:00:00Z',
  firmwareVersion: '1.0.0',
  latitude: null,
  longitude: null,
  permissions: {
    canView: true,
    canControl: true,
    canAssign: true,
    canConfigure: true,
  },
};

const mockOfflineDevice: AuthorisedDevice = {
  ...mockOnlineDevice,
  deviceId: 'water-node-002',
  deviceName: 'Water Tank Node 02',
  connectionStatus: 'OFFLINE',
};

describe('FaucetPresetSelector', () => {
  it('renders all 3 preset volume options (300, 1000, 1500 mL)', () => {
    const onSelect = vi.fn();
    render(
      <FaucetPresetSelector
        selectedDevice={mockOnlineDevice}
        hasControlPermission={true}
        isFeatureEnabled={true}
        onSelectPreset={onSelect}
      />
    );

    expect(screen.getByText('300')).toBeInTheDocument();
    expect(screen.getByText('1.000')).toBeInTheDocument();
    expect(screen.getByText('1.500')).toBeInTheDocument();
    expect(screen.getByText('Fase 1')).toBeInTheDocument();
    expect(screen.getByText('Fase 2')).toBeInTheDocument();
    expect(screen.getByText('Fase 3')).toBeInTheDocument();
  });

  it('triggers onSelectPreset callback without making API calls or starting polling when preset button is clicked', () => {
    const onSelect = vi.fn();
    const fetchSpy = vi.spyOn(global, 'fetch');

    render(
      <FaucetPresetSelector
        selectedDevice={mockOnlineDevice}
        hasControlPermission={true}
        isFeatureEnabled={true}
        onSelectPreset={onSelect}
      />
    );

    const btnPhase2 = screen.getByTestId('btn-select-phase-2');
    fireEvent.click(btnPhase2);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(2, 1000);
    // Verifies selecting preset does NOT start any network fetch/polling
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it('disables preset selection and shows warning banner when device is null', () => {
    const onSelect = vi.fn();
    render(
      <FaucetPresetSelector
        selectedDevice={null}
        hasControlPermission={true}
        isFeatureEnabled={true}
        onSelectPreset={onSelect}
      />
    );

    const banner = screen.getByTestId('faucet-disabled-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('Silakan pilih perangkat tandon air');

    const btnPhase1 = screen.getByTestId('btn-select-phase-1');
    expect(btnPhase1).toBeDisabled();
  });

  it('disables preset selection when device is OFFLINE', () => {
    const onSelect = vi.fn();
    render(
      <FaucetPresetSelector
        selectedDevice={mockOfflineDevice}
        hasControlPermission={true}
        isFeatureEnabled={true}
        onSelectPreset={onSelect}
      />
    );

    const banner = screen.getByTestId('faucet-disabled-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('sedang OFFLINE');

    const btnPhase2 = screen.getByTestId('btn-select-phase-2');
    expect(btnPhase2).toBeDisabled();
  });

  it('disables preset selection when feature flag is disabled', () => {
    const onSelect = vi.fn();
    render(
      <FaucetPresetSelector
        selectedDevice={mockOnlineDevice}
        hasControlPermission={true}
        isFeatureEnabled={false}
        onSelectPreset={onSelect}
      />
    );

    const banner = screen.getByTestId('faucet-disabled-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('ENABLE_FAUCET_CONTROL=false');
  });

  it('disables preset selection when user lacks control permission', () => {
    const onSelect = vi.fn();
    render(
      <FaucetPresetSelector
        selectedDevice={mockOnlineDevice}
        hasControlPermission={false}
        isFeatureEnabled={true}
        onSelectPreset={onSelect}
      />
    );

    const banner = screen.getByTestId('faucet-disabled-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('device.control.dispense');
  });

  it('disables preset selection when an active command is in progress', () => {
    const onSelect = vi.fn();
    render(
      <FaucetPresetSelector
        selectedDevice={mockOnlineDevice}
        hasControlPermission={true}
        isFeatureEnabled={true}
        activeCommand={{
          id: 'cmd-01',
          commandId: 'cmd-01',
          status: 'IN_PROGRESS',
          phase: 2,
          targetVolumeMl: 1000,
        }}
        onSelectPreset={onSelect}
      />
    );

    const banner = screen.getByTestId('faucet-disabled-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('sedang aktif/berjalan');
  });
});

describe('FaucetConfirmationModal', () => {
  it('renders confirmation modal with device name, phase, and target volume details', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <FaucetConfirmationModal
        isOpen={true}
        onClose={onClose}
        selectedDevice={mockOnlineDevice}
        phase={2}
        volumeMl={1000}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByTestId('faucet-confirmation-modal')).toBeInTheDocument();
    expect(screen.getByText(/1\.000 mL/)).toBeInTheDocument();
    expect(screen.getAllByText('Water Tank Node 01').length).toBeGreaterThan(0);
  });

  it('submits confirmation with phase and idempotency key when confirmed', async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <FaucetConfirmationModal
        isOpen={true}
        onClose={onClose}
        selectedDevice={mockOnlineDevice}
        phase={3}
        volumeMl={1500}
        onConfirm={onConfirm}
      />
    );

    const confirmBtn = screen.getByTestId('btn-confirm-dispense');
    fireEvent.click(confirmBtn);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0]).toBe(3);
    expect(typeof onConfirm.mock.calls[0][1]).toBe('string');
  });
});

describe('FaucetStatusCard Polling Regression', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders command status badge and does NOT start polling when command status is terminal (COMPLETED)', () => {
    const fetchSpy = vi.spyOn(global, 'fetch');

    const mockCommand = {
      id: 'cmd-100',
      commandId: 'cmd-100',
      idempotencyKey: 'key-100',
      deviceId: mockOnlineDevice.id,
      phase: 2,
      targetVolumeMl: 1000,
      actualVolumeMl: 1000,
      status: 'COMPLETED',
      requestedAt: new Date().toISOString(),
      events: [],
    };

    render(<FaucetStatusCard deviceId={mockOnlineDevice.deviceId!} command={mockCommand} />);

    expect(screen.getByTestId('faucet-status-card')).toBeInTheDocument();
    expect(screen.getByText('Selesai (COMPLETED)')).toBeInTheDocument();

    // Advance timers by 10 seconds
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // Zero polling calls for terminal status
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('polls command detail only while command status is active (IN_PROGRESS) and stops when terminal status is reached', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation((url) => {
      if (url.toString().includes('faucet-commands/cmd-200')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: 'cmd-200',
              commandId: 'cmd-200',
              idempotencyKey: 'key-200',
              deviceId: mockOnlineDevice.id,
              phase: 2,
              targetVolumeMl: 1000,
              actualVolumeMl: 1000,
              status: 'COMPLETED', // transitions to terminal status
              requestedAt: new Date().toISOString(),
            },
          }),
        } as Response);
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    const activeCommand = {
      id: 'cmd-200',
      commandId: 'cmd-200',
      idempotencyKey: 'key-200',
      deviceId: mockOnlineDevice.id,
      phase: 2,
      targetVolumeMl: 1000,
      actualVolumeMl: null,
      status: 'IN_PROGRESS',
      requestedAt: new Date().toISOString(),
      events: [],
    };

    render(<FaucetStatusCard deviceId={mockOnlineDevice.deviceId!} command={activeCommand} />);

    expect(screen.getByTestId('live-polling-indicator')).toBeInTheDocument();

    // Advance timers by 2.5s tick
    await act(async () => {
      vi.advanceTimersByTime(2600);
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Advance timers another 5s
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    // Poll stopped after reaching COMPLETED terminal status!
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('cleans up polling interval immediately when component unmounts', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: 'cmd-300',
            commandId: 'cmd-300',
            status: 'IN_PROGRESS',
            targetVolumeMl: 1000,
            requestedAt: new Date().toISOString(),
          },
        }),
      } as Response)
    );

    const activeCommand = {
      id: 'cmd-300',
      commandId: 'cmd-300',
      idempotencyKey: 'key-300',
      deviceId: mockOnlineDevice.id,
      phase: 1,
      targetVolumeMl: 300,
      status: 'QUEUED',
      requestedAt: new Date().toISOString(),
    };

    const { unmount } = render(
      <FaucetStatusCard deviceId={mockOnlineDevice.deviceId!} command={activeCommand} />
    );

    // Unmount before first timer tick
    unmount();

    await act(async () => {
      vi.advanceTimersByTime(10000);
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('FaucetHistoryTable', () => {
  it('renders history table structure and prevents repeated history fetching for same deviceId', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          items: [],
          meta: { pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 } },
        },
      }),
    } as Response);

    const { rerender } = render(<FaucetHistoryTable deviceId={mockOnlineDevice.deviceId!} />);

    expect(screen.getByTestId('faucet-history-table')).toBeInTheDocument();
    expect(screen.getByTestId('history-status-filter')).toBeInTheDocument();
    expect(await screen.findByText('Belum ada riwayat perintah faucet')).toBeInTheDocument();

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Re-rendering with identical props should not re-trigger fetch
    rerender(<FaucetHistoryTable deviceId={mockOnlineDevice.deviceId!} />);

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    fetchSpy.mockRestore();
  });
});
