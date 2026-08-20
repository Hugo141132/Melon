import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import FaucetPresetSelector, {
  formatLitersDisplay,
} from '@/components/controls/FaucetPresetSelector';
import FaucetConfirmationModal from '@/components/controls/FaucetConfirmationModal';
import FaucetStatusCard, {
  getAuthoritativePhysicalStateFromCommand,
} from '@/components/controls/FaucetStatusCard';
import FaucetHistoryTable from '@/components/controls/FaucetHistoryTable';
import { deriveAuthoritativePhysicalState } from '@/components/controls/FaucetControlPanel';
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
  it('renders all 3 preset volume options in Liters (0.3 L, 1 L, 1.5 L per plant)', () => {
    const onSelect = vi.fn();
    render(
      <FaucetPresetSelector
        selectedDevice={mockOnlineDevice}
        hasControlPermission={true}
        isFeatureEnabled={true}
        onSelectPreset={onSelect}
      />
    );

    expect(screen.getByText('0.3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('1.5')).toBeInTheDocument();
    expect(screen.getByText('Fase 1')).toBeInTheDocument();
    expect(screen.getByText('Fase 2')).toBeInTheDocument();
    expect(screen.getByText('Fase 3')).toBeInTheDocument();
    expect(screen.getAllByText('L / tanaman').length).toBe(3);
  });

  it('updates live total calculation preview when plantCount increases or decreases', () => {
    const onSelect = vi.fn();
    render(
      <FaucetPresetSelector
        selectedDevice={mockOnlineDevice}
        hasControlPermission={true}
        isFeatureEnabled={true}
        onSelectPreset={onSelect}
      />
    );

    const input = screen.getByTestId('input-plant-count') as HTMLInputElement;
    expect(input.value).toBe('1');
    expect(screen.getByText(/0\.3 L × 1 tanaman = 0\.3 L/)).toBeInTheDocument();

    const btnInc = screen.getByTestId('btn-increment-plant');
    fireEvent.click(btnInc);

    expect(input.value).toBe('2');
    expect(screen.getByText(/0\.3 L × 2 tanaman = 0\.6 L/)).toBeInTheDocument();

    // Increment again to 3
    fireEvent.click(btnInc);
    expect(input.value).toBe('3');
    expect(screen.getByText(/0\.3 L × 3 tanaman = 0\.9 L/)).toBeInTheDocument();

    // Decrement back to 2
    const btnDec = screen.getByTestId('btn-decrement-plant');
    fireEvent.click(btnDec);
    expect(input.value).toBe('2');
  });

  it('prevents plantCount from going below 1 and handles direct input validation', () => {
    const onSelect = vi.fn();
    render(
      <FaucetPresetSelector
        selectedDevice={mockOnlineDevice}
        hasControlPermission={true}
        isFeatureEnabled={true}
        onSelectPreset={onSelect}
      />
    );

    const input = screen.getByTestId('input-plant-count') as HTMLInputElement;
    const btnDec = screen.getByTestId('btn-decrement-plant');

    // Default is 1, so decrement should be disabled
    expect(btnDec).toBeDisabled();

    // Direct input: enter 0, should clamp to 1
    fireEvent.change(input, { target: { value: '0' } });
    expect(input.value).toBe('1');

    // Direct input: enter 5
    fireEvent.change(input, { target: { value: '5' } });
    expect(input.value).toBe('5');
    expect(screen.getByText(/0\.3 L × 5 tanaman = 1\.5 L/)).toBeInTheDocument();
  });

  it('triggers onSelectPreset with phase, volumeL, plantCount, and totalVolumeL when preset button is clicked', () => {
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

    // Set plantCount to 3
    const input = screen.getByTestId('input-plant-count');
    fireEvent.change(input, { target: { value: '3' } });

    // Click Phase 1 (0.3 L per plant * 3 plants = 0.9 L)
    const btnPhase1 = screen.getByTestId('btn-select-phase-1');
    fireEvent.click(btnPhase1);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(1, 0.3, 3, 0.8999999999999999);
    // Selecting preset does not initiate network polling
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it('renders manual OPEN and CLOSE valve control buttons and triggers action callback', () => {
    const onSelect = vi.fn();
    const onManual = vi.fn();

    render(
      <FaucetPresetSelector
        selectedDevice={mockOnlineDevice}
        hasControlPermission={true}
        isFeatureEnabled={true}
        onSelectPreset={onSelect}
        onSelectManualAction={onManual}
      />
    );

    expect(screen.getByTestId('manual-faucet-control-section')).toBeInTheDocument();
    expect(screen.getByText('Kontrol Manual Keran')).toBeInTheDocument();

    const btnOpen = screen.getByTestId('btn-manual-open');
    const btnClose = screen.getByTestId('btn-manual-close');

    expect(btnOpen).toBeInTheDocument();
    expect(btnClose).toBeInTheDocument();

    fireEvent.click(btnOpen);
    expect(onManual).toHaveBeenCalledWith('OPEN');

    fireEvent.click(btnClose);
    expect(onManual).toHaveBeenCalledWith('CLOSE');
  });

  it('displays authoritative physical faucet states (OPEN, CLOSED, UNKNOWN)', () => {
    const { rerender } = render(
      <FaucetPresetSelector
        selectedDevice={mockOnlineDevice}
        physicalState="UNKNOWN"
        onSelectPreset={vi.fn()}
      />
    );

    expect(screen.getByTestId('authoritative-physical-state')).toHaveTextContent(
      'TIDAK DIKETAHUI (UNKNOWN)'
    );

    rerender(
      <FaucetPresetSelector
        selectedDevice={mockOnlineDevice}
        physicalState="OPEN"
        onSelectPreset={vi.fn()}
      />
    );

    expect(screen.getByTestId('authoritative-physical-state')).toHaveTextContent('TERBUKA (OPEN)');

    rerender(
      <FaucetPresetSelector
        selectedDevice={mockOnlineDevice}
        physicalState="CLOSED"
        onSelectPreset={vi.fn()}
      />
    );

    expect(screen.getByTestId('authoritative-physical-state')).toHaveTextContent(
      'TERTUTUP (CLOSED)'
    );
  });

  it('disables preset selection and manual controls when device is null', () => {
    render(
      <FaucetPresetSelector
        selectedDevice={null}
        hasControlPermission={true}
        isFeatureEnabled={true}
        onSelectPreset={vi.fn()}
      />
    );

    const banner = screen.getByTestId('faucet-disabled-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('Silakan pilih perangkat tandon air');

    expect(screen.getByTestId('btn-select-phase-1')).toBeDisabled();
    expect(screen.getByTestId('btn-manual-open')).toBeDisabled();
    expect(screen.getByTestId('btn-manual-close')).toBeDisabled();
  });

  it('disables preset selection and manual controls when device is OFFLINE', () => {
    render(
      <FaucetPresetSelector
        selectedDevice={mockOfflineDevice}
        hasControlPermission={true}
        isFeatureEnabled={true}
        onSelectPreset={vi.fn()}
      />
    );

    const banner = screen.getByTestId('faucet-disabled-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('sedang OFFLINE');

    expect(screen.getByTestId('btn-select-phase-2')).toBeDisabled();
    expect(screen.getByTestId('btn-manual-open')).toBeDisabled();
  });

  it('disables preset selection and manual controls when feature flag is disabled', () => {
    render(
      <FaucetPresetSelector
        selectedDevice={mockOnlineDevice}
        hasControlPermission={true}
        isFeatureEnabled={false}
        onSelectPreset={vi.fn()}
      />
    );

    const banner = screen.getByTestId('faucet-disabled-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('ENABLE_FAUCET_CONTROL=false');

    expect(screen.getByTestId('btn-select-phase-3')).toBeDisabled();
    expect(screen.getByTestId('btn-manual-close')).toBeDisabled();
  });

  it('disables preset selection and manual controls when user lacks control permission', () => {
    render(
      <FaucetPresetSelector
        selectedDevice={mockOnlineDevice}
        hasControlPermission={false}
        isFeatureEnabled={true}
        onSelectPreset={vi.fn()}
      />
    );

    const banner = screen.getByTestId('faucet-disabled-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('device.control.dispense');

    expect(screen.getByTestId('btn-select-phase-1')).toBeDisabled();
    expect(screen.getByTestId('btn-manual-open')).toBeDisabled();
  });

  it('disables preset selection and manual controls when an active command is in progress', () => {
    render(
      <FaucetPresetSelector
        selectedDevice={mockOnlineDevice}
        hasControlPermission={true}
        isFeatureEnabled={true}
        activeCommand={{
          id: 'cmd-01',
          commandId: 'cmd-01',
          status: 'IN_PROGRESS',
          action: 'DISPENSE',
          phase: 2,
          plantCount: 3,
          targetVolumeMl: 3000,
        }}
        onSelectPreset={vi.fn()}
      />
    );

    const banner = screen.getByTestId('faucet-disabled-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('sedang aktif/berjalan');

    expect(screen.getByTestId('btn-select-phase-2')).toBeDisabled();
    expect(screen.getByTestId('btn-manual-open')).toBeDisabled();
  });
});

describe('FaucetConfirmationModal', () => {
  it('renders confirmation modal for DISPENSE with device name, phase, plant count, and total volume in Liters', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <FaucetConfirmationModal
        isOpen={true}
        onClose={onClose}
        selectedDevice={mockOnlineDevice}
        action="DISPENSE"
        phase={1}
        volumeL={0.3}
        plantCount={3}
        totalVolumeL={0.9}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByTestId('faucet-confirmation-modal')).toBeInTheDocument();
    expect(screen.getAllByText(/0\.9 L/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/3 tanaman/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Water Tank Node 01').length).toBeGreaterThan(0);
    expect(screen.getByTestId('btn-confirm-dispense')).toBeInTheDocument();
  });

  it('renders confirmation modal for manual OPEN action', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <FaucetConfirmationModal
        isOpen={true}
        onClose={onClose}
        selectedDevice={mockOnlineDevice}
        action="OPEN"
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByTestId('faucet-confirmation-modal')).toBeInTheDocument();
    expect(screen.getByText('Konfirmasi Buka Keran (OPEN)')).toBeInTheDocument();
    expect(
      screen.getByText(/Apakah Anda yakin ingin membuka katup keran air/i)
    ).toBeInTheDocument();

    const confirmBtn = screen.getByTestId('btn-confirm-dispense');
    fireEvent.click(confirmBtn);

    expect(onConfirm).toHaveBeenCalledWith('OPEN', expect.any(String));
  });

  it('renders confirmation modal for manual CLOSE action', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <FaucetConfirmationModal
        isOpen={true}
        onClose={onClose}
        selectedDevice={mockOnlineDevice}
        action="CLOSE"
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByTestId('faucet-confirmation-modal')).toBeInTheDocument();
    expect(screen.getByText('Konfirmasi Tutup Keran (CLOSE)')).toBeInTheDocument();

    const confirmBtn = screen.getByTestId('btn-confirm-dispense');
    fireEvent.click(confirmBtn);

    expect(onConfirm).toHaveBeenCalledWith('CLOSE', expect.any(String));
  });

  it('submits confirmation with phase, plantCount, and idempotency key when DISPENSE is confirmed', async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <FaucetConfirmationModal
        isOpen={true}
        onClose={onClose}
        selectedDevice={mockOnlineDevice}
        action="DISPENSE"
        phase={2}
        volumeL={1.0}
        plantCount={4}
        totalVolumeL={4.0}
        onConfirm={onConfirm}
      />
    );

    const confirmBtn = screen.getByTestId('btn-confirm-dispense');
    fireEvent.click(confirmBtn);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0]).toBe(2);
    expect(typeof onConfirm.mock.calls[0][1]).toBe('string');
    expect(onConfirm.mock.calls[0][2]).toBe(4);
  });
});

describe('FaucetStatusCard & Authoritative Physical State', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders command status badge in Liters and does NOT start polling when command status is terminal (COMPLETED)', () => {
    const fetchSpy = vi.spyOn(global, 'fetch');

    const mockCommand = {
      id: 'cmd-100',
      commandId: 'cmd-100',
      idempotencyKey: 'key-100',
      deviceId: mockOnlineDevice.id,
      action: 'DISPENSE',
      phase: 2,
      plantCount: 2,
      targetVolumeMl: 2000,
      actualVolumeMl: 2000,
      status: 'COMPLETED',
      requestedAt: new Date().toISOString(),
      events: [],
    };

    render(<FaucetStatusCard deviceId={mockOnlineDevice.deviceId!} command={mockCommand} />);

    expect(screen.getByTestId('faucet-status-card')).toBeInTheDocument();
    expect(screen.getByText('Selesai (COMPLETED)')).toBeInTheDocument();
    expect(screen.getAllByText(/2 L/).length).toBeGreaterThan(0);

    // Completed DISPENSE maps to UNKNOWN physical state (does not infer closed valve)
    expect(screen.getByTestId('status-card-physical-state')).toHaveTextContent(
      'TIDAK DIKETAHUI (UNKNOWN)'
    );

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
              action: 'DISPENSE',
              phase: 2,
              plantCount: 1,
              targetVolumeMl: 1000,
              actualVolumeMl: 1000,
              status: 'COMPLETED',
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
      action: 'DISPENSE',
      phase: 2,
      plantCount: 1,
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

  it('displays confirmed OPEN physical state for completed OPEN command', () => {
    const openCommand = {
      id: 'cmd-open',
      commandId: 'cmd-open',
      idempotencyKey: 'key-open',
      deviceId: mockOnlineDevice.id,
      action: 'OPEN',
      status: 'COMPLETED',
      requestedAt: new Date().toISOString(),
      events: [],
    };

    render(<FaucetStatusCard deviceId={mockOnlineDevice.deviceId!} command={openCommand} />);

    expect(screen.getByTestId('status-card-physical-state')).toHaveTextContent('TERBUKA (OPEN)');
  });

  it('displays confirmed CLOSED physical state for completed CLOSE command', () => {
    const closeCommand = {
      id: 'cmd-close',
      commandId: 'cmd-close',
      idempotencyKey: 'key-close',
      deviceId: mockOnlineDevice.id,
      action: 'CLOSE',
      status: 'COMPLETED',
      requestedAt: new Date().toISOString(),
      events: [],
    };

    render(<FaucetStatusCard deviceId={mockOnlineDevice.deviceId!} command={closeCommand} />);

    expect(screen.getByTestId('status-card-physical-state')).toHaveTextContent('TERTUTUP (CLOSED)');
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

describe('deriveAuthoritativePhysicalState and formatLitersDisplay Helpers', () => {
  it('correctly maps authoritative physical states according to TASK-0806 contract', () => {
    // 1. Completed OPEN command -> OPEN
    expect(
      deriveAuthoritativePhysicalState(
        [
          {
            id: '1',
            commandId: '1',
            idempotencyKey: '1',
            deviceId: 'd1',
            action: 'OPEN',
            status: 'COMPLETED',
            requestedAt: '',
          },
        ],
        null
      )
    ).toBe('OPEN');

    // 2. Completed CLOSE command -> CLOSED
    expect(
      deriveAuthoritativePhysicalState(
        [
          {
            id: '2',
            commandId: '2',
            idempotencyKey: '2',
            deviceId: 'd1',
            action: 'CLOSE',
            status: 'COMPLETED',
            requestedAt: '',
          },
        ],
        null
      )
    ).toBe('CLOSED');

    // 3. Completed DISPENSE command -> UNKNOWN (never infer closed valve)
    expect(
      deriveAuthoritativePhysicalState(
        [
          {
            id: '3',
            commandId: '3',
            idempotencyKey: '3',
            deviceId: 'd1',
            action: 'DISPENSE',
            status: 'COMPLETED',
            requestedAt: '',
          },
        ],
        null
      )
    ).toBe('UNKNOWN');

    // 4. Active command in progress -> UNKNOWN (never premature)
    expect(
      deriveAuthoritativePhysicalState(
        [
          {
            id: '1',
            commandId: '1',
            idempotencyKey: '1',
            deviceId: 'd1',
            action: 'OPEN',
            status: 'COMPLETED',
            requestedAt: '',
          },
        ],
        {
          id: '4',
          commandId: '4',
          idempotencyKey: '4',
          deviceId: 'd1',
          action: 'CLOSE',
          status: 'IN_PROGRESS',
          requestedAt: '',
        }
      )
    ).toBe('UNKNOWN');

    // 5. Failed or timeout command -> UNKNOWN
    expect(
      deriveAuthoritativePhysicalState(
        [
          {
            id: '5',
            commandId: '5',
            idempotencyKey: '5',
            deviceId: 'd1',
            action: 'OPEN',
            status: 'FAILED',
            requestedAt: '',
          },
        ],
        null
      )
    ).toBe('UNKNOWN');

    // 6. Empty list -> UNKNOWN
    expect(deriveAuthoritativePhysicalState([], null)).toBe('UNKNOWN');
  });

  it('correctly maps command physical state in getAuthoritativePhysicalStateFromCommand', () => {
    expect(
      getAuthoritativePhysicalStateFromCommand({
        id: '1',
        commandId: '1',
        idempotencyKey: '1',
        deviceId: 'd1',
        action: 'OPEN',
        status: 'COMPLETED',
        requestedAt: '',
      })
    ).toBe('OPEN');

    expect(
      getAuthoritativePhysicalStateFromCommand({
        id: '2',
        commandId: '2',
        idempotencyKey: '2',
        deviceId: 'd1',
        action: 'CLOSE',
        status: 'COMPLETED',
        requestedAt: '',
      })
    ).toBe('CLOSED');

    expect(
      getAuthoritativePhysicalStateFromCommand({
        id: '3',
        commandId: '3',
        idempotencyKey: '3',
        deviceId: 'd1',
        action: 'DISPENSE',
        status: 'COMPLETED',
        requestedAt: '',
      })
    ).toBe('UNKNOWN');

    expect(
      getAuthoritativePhysicalStateFromCommand({
        id: '4',
        commandId: '4',
        idempotencyKey: '4',
        deviceId: 'd1',
        action: 'OPEN',
        status: 'IN_PROGRESS',
        requestedAt: '',
      })
    ).toBe('UNKNOWN');

    expect(getAuthoritativePhysicalStateFromCommand(null)).toBe('UNKNOWN');
  });

  it('formats Liters numbers cleanly without trailing zero artifacts', () => {
    expect(formatLitersDisplay(0.3)).toBe('0.3');
    expect(formatLitersDisplay(0.9)).toBe('0.9');
    expect(formatLitersDisplay(1)).toBe('1');
    expect(formatLitersDisplay(1.0)).toBe('1');
    expect(formatLitersDisplay(1.5)).toBe('1.5');
    expect(formatLitersDisplay(3.0)).toBe('3');
    expect(formatLitersDisplay(4.5)).toBe('4.5');
  });
});

describe('FaucetHistoryTable', () => {
  it('renders history table with both DISPENSE and manual OPEN/CLOSE entries', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          items: [
            {
              id: 'h1',
              commandId: 'cmd-h1',
              deviceId: mockOnlineDevice.id,
              action: 'DISPENSE',
              phase: 1,
              plantCount: 3,
              targetVolumeMl: 900,
              actualVolumeMl: 900,
              status: 'COMPLETED',
              requestedAt: '2026-08-20T10:00:00Z',
              initiatedByRole: 'ADMIN',
            },
            {
              id: 'h2',
              commandId: 'cmd-h2',
              deviceId: mockOnlineDevice.id,
              action: 'OPEN',
              status: 'COMPLETED',
              requestedAt: '2026-08-20T11:00:00Z',
              initiatedByRole: 'OWNER',
            },
            {
              id: 'h3',
              commandId: 'cmd-h3',
              deviceId: mockOnlineDevice.id,
              action: 'CLOSE',
              status: 'COMPLETED',
              requestedAt: '2026-08-20T11:05:00Z',
              initiatedByRole: 'OWNER',
            },
          ],
          meta: { pagination: { page: 1, pageSize: 10, totalItems: 3, totalPages: 1 } },
        },
      }),
    } as Response);

    render(<FaucetHistoryTable deviceId={mockOnlineDevice.deviceId!} />);

    expect(screen.getByTestId('faucet-history-table')).toBeInTheDocument();
    const items = await screen.findAllByText('0.9 L');
    expect(items.length).toBeGreaterThan(0);
    expect(screen.getByText('(Fase 1 × 3)')).toBeInTheDocument();
    expect(screen.getByText('Buka Keran (OPEN)')).toBeInTheDocument();
    expect(screen.getByText('Tutup Keran (CLOSE)')).toBeInTheDocument();

    fetchSpy.mockRestore();
  });
});
