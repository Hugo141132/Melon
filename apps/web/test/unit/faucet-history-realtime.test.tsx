import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import FaucetHistoryTable from '@/components/controls/FaucetHistoryTable';
import * as realtimeHook from '@/hooks/use-realtime-monitoring';

describe('FaucetHistoryTable Real-Time Optimization & Invariants Tests', () => {
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

  it('strictly restricts dropdown filter options to All Status, COMPLETED, TIMEOUT, and EXPIRED', async () => {
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

    const filterSelect = screen.getByTestId('history-status-filter') as HTMLSelectElement;
    expect(filterSelect).toBeInTheDocument();

    const options = Array.from(filterSelect.options).map((opt) => opt.value);
    expect(options).toEqual(['ALL', 'COMPLETED', 'TIMEOUT', 'EXPIRED']);

    // Ensure non-terminal options are strictly absent
    expect(options).not.toContain('IN_PROGRESS');
    expect(options).not.toContain('QUEUED');
    expect(options).not.toContain('SENT');
    expect(options).not.toContain('ACKNOWLEDGED');

    fetchSpy.mockRestore();
  });

  it('queries statuses=COMPLETED,TIMEOUT,EXPIRED at SQL level when ALL is selected', async () => {
    let capturedUrl = '';
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      capturedUrl = String(url);
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            items: [],
            meta: { pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 } },
          },
        }),
      } as Response;
    });

    render(<FaucetHistoryTable deviceId={mockDeviceId} />);

    expect(capturedUrl).toContain('statuses=COMPLETED%2CTIMEOUT%2CEXPIRED');

    fetchSpy.mockRestore();
  });

  it('ignores non-terminal transitions (IN_PROGRESS, SENT) and refreshes once on terminal transition (COMPLETED)', async () => {
    let fetchCount = 0;
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async () => {
      fetchCount++;
      return {
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
                actualVolumeMl: fetchCount > 1 ? 300 : null,
                status: fetchCount > 1 ? 'COMPLETED' : 'IN_PROGRESS',
                requestedAt: '2026-09-01T10:00:00Z',
                initiatedByRole: 'ADMIN',
              },
            ],
            meta: { pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 } },
          },
        }),
      } as Response;
    });

    render(<FaucetHistoryTable deviceId={mockDeviceId} />);
    expect(fetchCount).toBe(1);

    // 1. Non-terminal events: SENT and IN_PROGRESS should NOT trigger history table fetch
    await act(async () => {
      if (currentOnEvent) {
        currentOnEvent('faucet.command.updated', { commandId: 'cmd-101', status: 'SENT' });
        currentOnEvent('faucet.command.updated', { commandId: 'cmd-101', status: 'IN_PROGRESS' });
      }
    });
    expect(fetchCount).toBe(1);

    // 2. Terminal event: COMPLETED should trigger fetch once
    await act(async () => {
      if (currentOnEvent) {
        currentOnEvent('faucet.command.updated', { commandId: 'cmd-101', status: 'COMPLETED' });
      }
    });
    expect(fetchCount).toBe(2);

    // 3. Duplicate COMPLETED event should be deduplicated and NOT trigger another fetch
    await act(async () => {
      if (currentOnEvent) {
        currentOnEvent('faucet.command.updated', { commandId: 'cmd-101', status: 'COMPLETED' });
      }
    });
    expect(fetchCount).toBe(2);

    // 4. Another command transitioning to TIMEOUT triggers fetch once
    await act(async () => {
      if (currentOnEvent) {
        currentOnEvent('faucet.command.updated', { commandId: 'cmd-102', status: 'TIMEOUT' });
      }
    });
    expect(fetchCount).toBe(3);

    // 5. Another command transitioning to EXPIRED triggers fetch once
    await act(async () => {
      if (currentOnEvent) {
        currentOnEvent('faucet.command.updated', { commandId: 'cmd-103', status: 'EXPIRED' });
      }
    });
    expect(fetchCount).toBe(4);

    fetchSpy.mockRestore();
  });

  it('reconciles history when realtime connection reconnects from CLOSED to OPEN', async () => {
    let fetchCount = 0;
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async () => {
      fetchCount++;
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            items: [],
            meta: { pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 } },
          },
        }),
      } as Response;
    });

    mockHookReturn = { status: 'CONNECTING', lastEvent: null, error: null };
    const { rerender } = render(<FaucetHistoryTable deviceId={mockDeviceId} />);
    expect(fetchCount).toBe(1);

    // Simulate transition to OPEN (reconnect)
    mockHookReturn = { status: 'OPEN', lastEvent: null, error: null };
    rerender(<FaucetHistoryTable deviceId={mockDeviceId} />);

    expect(fetchCount).toBe(2);

    fetchSpy.mockRestore();
  });

  it('renders accessible pagination and navigates pages when total records exceed 10', async () => {
    const requestedPages: number[] = [];
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const parsedUrl = new URL(String(url), 'http://localhost');
      const page = Number(parsedUrl.searchParams.get('page')) || 1;
      requestedPages.push(page);
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            items: Array.from({ length: 10 }).map((_, i) => ({
              id: `cmd-item-${page}-${i}`,
              commandId: `cmd-${page}-${i}`,
              deviceId: mockDeviceId,
              action: 'OPEN',
              status: 'COMPLETED',
              requestedAt: '2026-10-05T10:00:00Z',
              initiatedByRole: 'OWNER',
            })),
            pagination: { page, pageSize: 10, totalItems: 25, totalPages: 3 },
          },
        }),
      } as Response;
    });

    render(<FaucetHistoryTable deviceId={mockDeviceId} />);

    // Initial mount fetches page 1
    expect(requestedPages).toEqual([1]);

    // Next and Previous buttons should be in document
    const prevBtn = await screen.findByTestId('btn-history-prev-page');
    const nextBtn = await screen.findByTestId('btn-history-next-page');
    expect(prevBtn).toBeInTheDocument();
    expect(nextBtn).toBeInTheDocument();

    // On page 1, Prev is disabled, Next is enabled
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).not.toBeDisabled();

    // Click Next button to navigate to page 2
    await act(async () => {
      nextBtn.click();
    });

    expect(requestedPages).toEqual([1, 2]);

    fetchSpy.mockRestore();
  });

  it('preserves current page on realtime terminal transition without resetting to page 1', async () => {
    const requestedPages: number[] = [];
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const parsedUrl = new URL(String(url), 'http://localhost');
      const page = Number(parsedUrl.searchParams.get('page')) || 1;
      requestedPages.push(page);
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            items: [],
            pagination: { page, pageSize: 10, totalItems: 25, totalPages: 3 },
          },
        }),
      } as Response;
    });

    render(<FaucetHistoryTable deviceId={mockDeviceId} />);
    expect(requestedPages).toEqual([1]);

    const nextBtn = await screen.findByTestId('btn-history-next-page');

    // Move to page 2
    await act(async () => {
      nextBtn.click();
    });
    expect(requestedPages).toEqual([1, 2]);

    // When an SSE terminal event arrives, it refetches page 2 (current page), not page 1
    await act(async () => {
      if (currentOnEvent) {
        currentOnEvent('faucet.command.updated', {
          commandId: 'cmd-999',
          status: 'COMPLETED',
        });
      }
    });

    expect(requestedPages).toEqual([1, 2, 2]);

    fetchSpy.mockRestore();
  });
});
