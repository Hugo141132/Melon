import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NotificationsPage from '@/app/notifications/page';
import { AlertStatus, AlertSeverity } from '@kebun-melon/contracts';

let mockPathname = '/notifications';

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    push: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { fullName: 'Operator Unit' },
    role: 'ADMIN',
    isAuthenticated: true,
  }),
  AuthProvider: ({ children }: any) => <>{children}</>,
}));

vi.mock('@/context/DeviceContext', () => ({
  useDevices: () => ({
    devices: [],
    selectedDevice: null,
    setSelectedDeviceId: vi.fn(),
  }),
  DeviceProvider: ({ children }: any) => <>{children}</>,
}));

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => {
    return (key: string, params?: any) => {
      if (ns === 'alerts') {
        if (key === 'title') return 'Alert Notifications';
        if (key === 'alertsSummary')
          return `${params?.critical || 0} critical, ${params?.warning || 0} warning`;
        if (key === 'criticalCount') return `${params?.count || 0} Critical`;
        if (key === 'warningCount') return `${params?.count || 0} Warning`;
        if (key === 'noAlerts') return 'No alerts recorded.';
        if (key === 'acknowledgeAction') return 'Acknowledge';
        if (key === 'acknowledgedBy') return 'Acknowledged';
        if (key === 'acknowledgeSelected') return `Acknowledge Selected (${params?.count || 0})`;
        if (key === 'acknowledgeAll') return 'Acknowledge All';
        if (key === 'selectAll') return 'Select All';
        if (key === 'selectedCount') return `${params?.count || 0} selected`;
        if (key === 'commandTimeoutTitle') return 'Valve Command Timeout';
        if (key === 'commandTimeoutMessage') return 'Command timed out.';
      }
      if (ns === 'common') {
        if (key === 'warning') return 'Warning';
        if (key === 'critical') return 'Critical';
        if (key === 'info') return 'Info';
        if (key === 'refresh') return 'Refresh';
      }
      return key;
    };
  },
  useLocale: () => 'en',
}));

describe('Notifications UI - Bulk Acknowledgement Interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sampleAlerts = [
    {
      id: 'alert-1',
      deviceId: 'dev-1',
      userId: null,
      alertType: 'COMMAND_TIMEOUT',
      severity: AlertSeverity.WARNING,
      status: AlertStatus.OPEN,
      isAcknowledged: false,
      sourceType: 'faucet_command',
      sourceId: null,
      titleKey: 'alerts.commandTimeoutTitle',
      messageKey: 'alerts.commandTimeoutMessage',
      messageParams: null,
      openedAt: '2026-10-03T11:00:00.000Z',
      resolvedAt: null,
      createdAt: '2026-10-03T11:00:00.000Z',
      updatedAt: '2026-10-03T11:00:00.000Z',
    },
    {
      id: 'alert-2',
      deviceId: 'dev-1',
      userId: null,
      alertType: 'COMMAND_TIMEOUT',
      severity: AlertSeverity.CRITICAL,
      status: AlertStatus.OPEN,
      isAcknowledged: false,
      sourceType: 'faucet_command',
      sourceId: null,
      titleKey: 'alerts.commandTimeoutTitle',
      messageKey: 'alerts.commandTimeoutMessage',
      messageParams: null,
      openedAt: '2026-10-03T11:01:00.000Z',
      resolvedAt: null,
      createdAt: '2026-10-03T11:01:00.000Z',
      updatedAt: '2026-10-03T11:01:00.000Z',
    },
    {
      id: 'alert-3',
      deviceId: 'dev-1',
      userId: null,
      alertType: 'COMMAND_TIMEOUT',
      severity: AlertSeverity.WARNING,
      status: AlertStatus.ACKNOWLEDGED,
      isAcknowledged: true,
      acknowledgedAt: '2026-10-03T11:05:00.000Z',
      sourceType: 'faucet_command',
      sourceId: null,
      titleKey: 'alerts.commandTimeoutTitle',
      messageKey: 'alerts.commandTimeoutMessage',
      messageParams: null,
      openedAt: '2026-10-03T10:00:00.000Z',
      resolvedAt: null,
      createdAt: '2026-10-03T10:00:00.000Z',
      updatedAt: '2026-10-03T11:05:00.000Z',
    },
  ];

  it('selects all open alerts and acknowledges them via bulk acknowledge selected', async () => {
    let bulkPayload: any = null;

    global.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (typeof url === 'string' && url === '/api/v1/alerts') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: sampleAlerts }),
        });
      }
      if (typeof url === 'string' && url === '/api/v1/alerts/bulk-acknowledge') {
        bulkPayload = JSON.parse(opts.body);
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                count: 2,
                acknowledgedAlertIds: ['alert-1', 'alert-2'],
              },
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
    });

    render(<NotificationsPage />);

    expect(await screen.findByText('1 Critical')).toBeInTheDocument();
    expect(screen.getByText('1 Warning')).toBeInTheDocument();

    const selectAllCheckbox = await screen.findByTestId('checkbox-select-all');
    expect(selectAllCheckbox).toBeInTheDocument();
    expect(selectAllCheckbox).not.toBeChecked();

    // Toggle select all
    fireEvent.click(selectAllCheckbox);
    expect(selectAllCheckbox).toBeChecked();
    expect(screen.getByText('2 selected')).toBeInTheDocument();

    const bulkSelectedBtn = screen.getByTestId('btn-acknowledge-selected');
    expect(bulkSelectedBtn).toBeInTheDocument();
    expect(bulkSelectedBtn).toHaveTextContent('Acknowledge Selected (2)');

    // Click bulk acknowledge selected
    fireEvent.click(bulkSelectedBtn);

    await waitFor(() => {
      expect(bulkPayload).toEqual({ alertIds: ['alert-1', 'alert-2'] });
      // Both alert-1 and alert-2 are now acknowledged
      expect(screen.getByText('0 Critical')).toBeInTheDocument();
      expect(screen.getByText('0 Warning')).toBeInTheDocument();
      expect(screen.queryByTestId('checkbox-select-all')).not.toBeInTheDocument();
    });
  });

  it('does not render Acknowledge All button and acknowledges individual selected alerts', async () => {
    let bulkPayload: any = null;

    global.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (typeof url === 'string' && url === '/api/v1/alerts') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: sampleAlerts }),
        });
      }
      if (typeof url === 'string' && url === '/api/v1/alerts/bulk-acknowledge') {
        bulkPayload = JSON.parse(opts.body);
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                count: 1,
                acknowledgedAlertIds: ['alert-1'],
              },
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
    });

    render(<NotificationsPage />);

    expect(await screen.findByText('1 Critical')).toBeInTheDocument();

    // Verify Acknowledge All button is NEVER rendered
    expect(screen.queryByTestId('btn-acknowledge-all')).not.toBeInTheDocument();

    // Select single open alert
    const alert1Checkbox = await screen.findByTestId('checkbox-select-alert-1');
    fireEvent.click(alert1Checkbox);

    const bulkSelectedBtn = screen.getByTestId('btn-acknowledge-selected');
    expect(bulkSelectedBtn).toBeInTheDocument();
    expect(bulkSelectedBtn).toHaveTextContent('Acknowledge Selected (1)');

    fireEvent.click(bulkSelectedBtn);

    await waitFor(() => {
      expect(bulkPayload).toEqual({ alertIds: ['alert-1'] });
      expect(screen.getByText('0 Warning')).toBeInTheDocument();
    });
  });
});
