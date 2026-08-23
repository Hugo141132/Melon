import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Sidebar from '@/components/navigation/Sidebar';
import TopAppBar from '@/components/navigation/TopAppBar';
import { DeviceProvider, AuthorisedDevice } from '@/context/DeviceContext';
import DeviceSelector from '@/components/navigation/DeviceSelector';

let mockPathname = '/sensor';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    push: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

let mockUser: any = null;
let mockRole: any = null;

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    role: mockRole,
    isAuthenticated: !!mockUser,
  }),
  AuthProvider: ({ children }: any) => <>{children}</>,
}));

const mockDevices: AuthorisedDevice[] = [
  {
    id: '1',
    deviceId: 'soil-node-01',
    deviceName: 'Sensor Melon Blok A',
    deviceType: 'SOIL_NODE',
    siteId: 'site-1',
    connectionStatus: 'ONLINE',
    lastSeenAt: new Date().toISOString(),
    firmwareVersion: '1.0.0',
    latitude: null,
    longitude: null,
  },
  {
    id: '2',
    deviceId: 'water-node-01',
    deviceName: 'Kualitas Air Kolam A',
    deviceType: 'WATER_QUALITY_NODE',
    siteId: 'site-1',
    connectionStatus: 'ONLINE',
    lastSeenAt: new Date().toISOString(),
    firmwareVersion: '1.0.0',
    latitude: null,
    longitude: null,
  },
  {
    id: '3',
    deviceId: 'tank-node-01',
    deviceName: 'Reservoir Utama',
    deviceType: 'WATER_TANK_NODE',
    siteId: 'site-1',
    connectionStatus: 'ONLINE',
    lastSeenAt: new Date().toISOString(),
    firmwareVersion: '1.0.0',
    latitude: null,
    longitude: null,
  },
];

describe('Sidebar Navigation Header Display Name & Fallback', () => {
  const mockClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = '/sensor';
    sessionStorage.clear();
    localStorage.clear();
    mockUser = null;
    mockRole = null;
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] }),
      })
    );
  });

  it('renders authenticated account display name without Pak prefix', () => {
    mockUser = { fullName: 'Pak Wahyu Prasetyo' };
    mockRole = 'ADMIN';
    render(<Sidebar isOpen={true} onClose={mockClose} />);

    expect(screen.getByTestId('sidebar-display-name')).toHaveTextContent('Wahyu Prasetyo');
  });

  it('renders neutral account placeholder "Pengguna" during loading or expired session (never Kebun Melon)', () => {
    mockUser = null;
    mockRole = null;
    const { rerender } = render(<Sidebar isOpen={true} onClose={mockClose} />);

    // Null user / unauthenticated / loading
    expect(screen.getByTestId('sidebar-display-name')).toHaveTextContent('Pengguna');
    expect(screen.getByTestId('sidebar-display-name')).not.toHaveTextContent('Kebun Melon');

    // Empty string user name
    mockUser = { fullName: '' };
    mockRole = 'ADMIN';
    rerender(<Sidebar isOpen={true} onClose={mockClose} />);
    expect(screen.getByTestId('sidebar-display-name')).toHaveTextContent('Pengguna');
    expect(screen.getByTestId('sidebar-display-name')).not.toHaveTextContent('Kebun Melon');
  });

  it('renders Sensor menu item and excludes removed sub-links (Sensor Tanah, Kualitas Air, Kontrol Kran)', () => {
    mockUser = { fullName: 'Wahyu' };
    mockRole = 'ADMIN';
    render(<Sidebar isOpen={true} onClose={mockClose} />);

    expect(screen.getByTestId('sidebar-drawer')).toHaveClass('translate-x-0');
    expect(screen.getByText('Beranda')).toBeInTheDocument();
    expect(screen.getByText('Sensor')).toBeInTheDocument();
    expect(screen.getByText('Notifikasi')).toBeInTheDocument();

    expect(screen.queryByText('Sensor Tanah')).not.toBeInTheDocument();
    expect(screen.queryByText('Kualitas Air')).not.toBeInTheDocument();
    expect(screen.queryByText('Kontrol Kran')).not.toBeInTheDocument();
  });
});

describe('DeviceSelector Auto-Restoration & Display Name Regression Tests', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    window.history.replaceState({}, '', 'http://localhost:3000/');
  });

  it('rehydrates candidate device from ?deviceId= on route refresh when authorised, and remains neutral without param', () => {
    // 1. With valid authorised device in route URL, rehydrates selected device
    window.history.replaceState({}, '', 'http://localhost:3000/water?deviceId=water-node-01');

    const { unmount } = render(
      <DeviceProvider initialDevices={mockDevices}>
        <DeviceSelector />
      </DeviceProvider>
    );

    // Verify selector rehydrates the route candidate
    const selectorTrigger = screen.getByTestId('device-selector-trigger');
    expect(selectorTrigger).toBeInTheDocument();
    expect(selectorTrigger).toHaveTextContent('Kualitas Air Kolam A');

    unmount();

    // 2. Fresh load without query params remains neutral (Pilih Perangkat)
    window.history.replaceState({}, '', 'http://localhost:3000/water');

    render(
      <DeviceProvider initialDevices={mockDevices}>
        <DeviceSelector />
      </DeviceProvider>
    );

    const neutralTrigger = screen.getByTestId('device-selector-trigger');
    expect(neutralTrigger).toHaveTextContent('Pilih Perangkat');
  });
});

describe('TopAppBar Route-based DeviceSelector Visibility & Centering', () => {
  it('shows DeviceSelector strictly on canonical /soil, /water, and /controls (and hides on legacy /tanah and /air)', () => {
    mockPathname = '/soil';
    const { rerender } = render(
      <DeviceProvider initialDevices={mockDevices}>
        <TopAppBar showDeviceSelector={true} />
      </DeviceProvider>
    );
    expect(screen.getByTestId('device-selector-multiple')).toBeInTheDocument();

    mockPathname = '/water';
    rerender(
      <DeviceProvider initialDevices={mockDevices}>
        <TopAppBar showDeviceSelector={true} />
      </DeviceProvider>
    );
    expect(screen.getByTestId('device-selector-multiple')).toBeInTheDocument();

    mockPathname = '/controls';
    rerender(
      <DeviceProvider initialDevices={mockDevices}>
        <TopAppBar showDeviceSelector={true} />
      </DeviceProvider>
    );
    expect(screen.getByTestId('device-selector-multiple')).toBeInTheDocument();

    mockPathname = '/tanah';
    rerender(
      <DeviceProvider initialDevices={mockDevices}>
        <TopAppBar showDeviceSelector={true} />
      </DeviceProvider>
    );
    expect(screen.queryByTestId('device-selector-multiple')).not.toBeInTheDocument();

    mockPathname = '/controls';
    rerender(
      <DeviceProvider initialDevices={mockDevices}>
        <TopAppBar showDeviceSelector={true} />
      </DeviceProvider>
    );
    expect(screen.getByTestId('device-selector-multiple')).toBeInTheDocument();
  });

  it('hides DeviceSelector on /sensor, /, and /devices', () => {
    mockPathname = '/sensor';
    const { rerender } = render(
      <DeviceProvider initialDevices={mockDevices}>
        <TopAppBar showDeviceSelector={true} />
      </DeviceProvider>
    );
    expect(screen.queryByTestId('device-selector-multiple')).not.toBeInTheDocument();

    mockPathname = '/';
    rerender(
      <DeviceProvider initialDevices={mockDevices}>
        <TopAppBar showDeviceSelector={true} />
      </DeviceProvider>
    );
    expect(screen.queryByTestId('device-selector-multiple')).not.toBeInTheDocument();

    mockPathname = '/devices';
    rerender(
      <DeviceProvider initialDevices={mockDevices}>
        <TopAppBar showDeviceSelector={true} />
      </DeviceProvider>
    );
    expect(screen.queryByTestId('device-selector-multiple')).not.toBeInTheDocument();
  });
});

describe('Sidebar Alerts Notification Badge (Live Backend State)', () => {
  const mockClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = '/';
    mockUser = { fullName: 'Wahyu Prasetyo' };
    mockRole = 'ADMIN';
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/api/v1/alerts')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: [
                { id: '1', severity: 'CRITICAL', status: 'OPEN' },
                { id: '2', severity: 'CRITICAL', status: 'OPEN' },
              ],
              meta: { pagination: { totalItems: 2 } },
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] }),
      });
    });
  });

  it('renders dynamic critical alert badge count when open critical alerts exist', async () => {
    render(<Sidebar isOpen={true} onClose={mockClose} />);

    const badge = await screen.findByText('2');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-app-error');
  });

  it('hides alert badge when count is zero', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/api/v1/alerts')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: [],
              meta: { pagination: { totalItems: 0 } },
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
    });

    render(<Sidebar isOpen={true} onClose={mockClose} />);

    expect(screen.queryByText('2')).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('hides alert badge when unauthenticated', async () => {
    mockUser = null;
    mockRole = null;

    render(<Sidebar isOpen={true} onClose={mockClose} />);

    expect(screen.queryByText('2')).not.toBeInTheDocument();
  });

  it('updates alert badge dynamically when alert updated event is dispatched', async () => {
    let alertCount = 3;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/api/v1/alerts')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: [],
              meta: { pagination: { totalItems: alertCount } },
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
    });

    render(<Sidebar isOpen={true} onClose={mockClose} />);

    expect(await screen.findByText('3')).toBeInTheDocument();

    alertCount = 1;
    window.dispatchEvent(new CustomEvent('melon:alert-updated'));

    expect(await screen.findByText('1')).toBeInTheDocument();
  });
});
