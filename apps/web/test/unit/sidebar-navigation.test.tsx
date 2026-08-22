// @vitest-environment jsdom
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
