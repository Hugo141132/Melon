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
    user: { fullName: 'Operator A' },
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

describe('Notifications UI - User-Scoped Acknowledgement State', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders unacknowledged warning alert with Acknowledge action and transitions on direct acknowledge', async () => {
    const mockAlerts = [
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
    ];

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url === '/api/v1/alerts') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockAlerts }),
        });
      }
      if (typeof url === 'string' && url.includes('/acknowledge')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                alertId: 'alert-1',
                status: AlertStatus.ACKNOWLEDGED,
                acknowledgedAt: new Date().toISOString(),
              },
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
    });

    render(<NotificationsPage />);

    // Initially shows Warning count 1
    expect(await screen.findByText('1 Warning')).toBeInTheDocument();

    const ackBtn = await screen.findByTestId('btn-acknowledge-alert-1');
    expect(ackBtn).toBeInTheDocument();

    // Click acknowledge
    fireEvent.click(ackBtn);

    // Transitions to Acknowledged badge and count drops to 0 Warning
    await waitFor(() => {
      expect(screen.getByText('Acknowledged')).toBeInTheDocument();
      expect(screen.getByText('0 Warning')).toBeInTheDocument();
      expect(screen.queryByTestId('btn-acknowledge-alert-1')).not.toBeInTheDocument();
    });
  });

  it('renders pre-acknowledged alert with Acknowledged badge and no acknowledge action button', async () => {
    const mockAlerts = [
      {
        id: 'alert-1',
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
        openedAt: '2026-10-03T11:00:00.000Z',
        resolvedAt: null,
        createdAt: '2026-10-03T11:00:00.000Z',
        updatedAt: '2026-10-03T11:05:00.000Z',
      },
    ];

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url === '/api/v1/alerts') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockAlerts }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
    });

    render(<NotificationsPage />);

    expect(await screen.findByText('Acknowledged')).toBeInTheDocument();
    expect(screen.getByText('0 Warning')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-acknowledge-alert-1')).not.toBeInTheDocument();
  });
});
