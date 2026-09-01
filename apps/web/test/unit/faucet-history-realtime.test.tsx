import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import FaucetHistoryTable from '@/components/controls/FaucetHistoryTable';
import * as realtimeHook from '@/hooks/use-realtime-monitoring';

describe('FaucetHistoryTable Real-Time Synchronization Unit Tests', () => {
  const mockDeviceId = 'water-node-001';

  let mockHookReturn: realtimeHook.UseRealtimeReturn = {
    status: 'OPEN',
    lastEvent: null,
    error: null,
  };

  let currentOnEvent: ((name: string, data: any) => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    currentOnEvent = undefined;

    mockHookReturn = {
      status: 'OPEN',
      lastEvent: null,
      error: null,
    };

    vi.spyOn(realtimeHook, 'useRealtimeMonitoring').mockImplementation((options) => {
      if (options?.onEvent) {
        currentOnEvent = options.onEvent;
      }
      return mockHookReturn;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('subscribes to commands channel for active device and updates command status in real-time', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          items: [
            {
              id: 'cmd-item-1',
              commandId: 'cmd-101',
              deviceId: mockDeviceId,
              action: 'DISPENSE',
              phase: 1,
              plantCount: 1,
              targetVolumeMl: 300,
              actualVolumeMl: null,
              status: 'QUEUED',
              requestedAt: '2026-09-01T10:00:00Z',
              initiatedByRole: 'ADMIN',
            },
          ],
          meta: { pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 } },
        },
      }),
    } as Response);

    render(<FaucetHistoryTable deviceId={mockDeviceId} />);

    // Initial render displays QUEUED status
    expect(screen.getByTestId('faucet-history-table')).toBeInTheDocument();
    expect(await screen.findByRole('cell', { name: 'QUEUED' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '—' })).toBeInTheDocument();

    // 1. Simulate real-time event: SENT
    await act(async () => {
      if (currentOnEvent)
        currentOnEvent('faucet.command.updated', { commandId: 'cmd-101', status: 'SENT' });
    });
    expect(await screen.findByRole('cell', { name: 'SENT' })).toBeInTheDocument();

    // 2. Simulate real-time event: ACKNOWLEDGED
    await act(async () => {
      if (currentOnEvent)
        currentOnEvent('faucet.command.updated', { commandId: 'cmd-101', status: 'ACKNOWLEDGED' });
    });
    expect(await screen.findByRole('cell', { name: 'ACKNOWLEDGED' })).toBeInTheDocument();

    // 3. Simulate real-time event: IN_PROGRESS with actual volume
    await act(async () => {
      if (currentOnEvent)
        currentOnEvent('faucet.command.updated', {
          commandId: 'cmd-101',
          status: 'IN_PROGRESS',
          actualVolumeMl: 150,
        });
    });
    expect(await screen.findByRole('cell', { name: 'IN_PROGRESS' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '0.15 L' })).toBeInTheDocument();

    // 4. Simulate real-time event: COMPLETED with final volume
    await act(async () => {
      if (currentOnEvent)
        currentOnEvent('faucet.command.updated', {
          commandId: 'cmd-101',
          status: 'COMPLETED',
          actualVolumeMl: 300,
        });
    });
    expect(await screen.findByRole('cell', { name: 'COMPLETED' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '0.3 L' })).toBeInTheDocument();

    fetchSpy.mockRestore();
  });

  it('prepends newly created commands when received via real-time stream', async () => {
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

    render(<FaucetHistoryTable deviceId={mockDeviceId} />);

    // Initially empty
    expect(await screen.findByText(/Belum ada riwayat/i)).toBeInTheDocument();

    // Emitted newly created command event
    await act(async () => {
      if (currentOnEvent) {
        currentOnEvent('faucet.command.updated', {
          id: 'new-cmd-uuid',
          commandId: 'cmd-new-202',
          deviceId: mockDeviceId,
          action: 'DISPENSE',
          phase: 2,
          plantCount: 2,
          targetVolumeMl: 2000,
          actualVolumeMl: null,
          status: 'QUEUED',
          requestedAt: '2026-09-01T11:00:00Z',
          initiatedByRole: 'OWNER',
        });
      }
    });

    expect(await screen.findByText('2 L')).toBeInTheDocument();
    expect(screen.getByText('(Fase 2 × 2)')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'QUEUED' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'OWNER' })).toBeInTheDocument();

    fetchSpy.mockRestore();
  });

  it('ignores unrelated realtime events', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          items: [
            {
              id: 'cmd-item-1',
              commandId: 'cmd-101',
              deviceId: mockDeviceId,
              action: 'OPEN',
              status: 'QUEUED',
              requestedAt: '2026-09-01T10:00:00Z',
              initiatedByRole: 'ADMIN',
            },
          ],
          meta: { pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 } },
        },
      }),
    } as Response);

    render(<FaucetHistoryTable deviceId={mockDeviceId} />);
    expect(await screen.findByRole('cell', { name: 'QUEUED' })).toBeInTheDocument();

    // Send telemetry event
    await act(async () => {
      if (currentOnEvent) currentOnEvent('telemetry.soil.updated', { nitrogen: 50 });
    });

    // Status remains unchanged
    expect(screen.getByRole('cell', { name: 'QUEUED' })).toBeInTheDocument();

    fetchSpy.mockRestore();
  });
});
