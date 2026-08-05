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
  useRouter: () => ({
    push: vi.fn(),
    prefetch: vi.fn(),
  }),
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
  });

  it('renders authenticated account display name without Pak prefix', () => {
    render(
      <Sidebar isOpen={true} onClose={mockClose} userRole="ADMIN" userName="Pak Wahyu Prasetyo" />
    );

    expect(screen.getByTestId('sidebar-display-name')).toHaveTextContent('Wahyu Prasetyo');
  });

  it('renders neutral account placeholder "Pengguna" during loading or expired session (never Kebun Melon)', () => {
    const { rerender } = render(
      <Sidebar isOpen={true} onClose={mockClose} userRole={null} userName={null} />
    );

    // Null user / unauthenticated / loading
    expect(screen.getByTestId('sidebar-display-name')).toHaveTextContent('Pengguna');
    expect(screen.getByTestId('sidebar-display-name')).not.toHaveTextContent('Kebun Melon');

    // Empty string user name
    rerender(<Sidebar isOpen={true} onClose={mockClose} userRole="ADMIN" userName="" />);
    expect(screen.getByTestId('sidebar-display-name')).toHaveTextContent('Pengguna');
    expect(screen.getByTestId('sidebar-display-name')).not.toHaveTextContent('Kebun Melon');
  });

  it('renders Sensor menu item and excludes removed sub-links (Sensor Tanah, Kualitas Air, Kontrol Kran)', () => {
    render(<Sidebar isOpen={true} onClose={mockClose} userRole="ADMIN" userName="Wahyu" />);

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
  });

  it('automatically displays currently selected device name from sessionStorage / DeviceContext on page load/refresh', () => {
    // Save selected device in sessionStorage
    sessionStorage.setItem('kebun_melon_selected_device_id', 'water-node-01');

    render(
      <DeviceProvider initialDevices={mockDevices}>
        <DeviceSelector />
      </DeviceProvider>
    );

    // Verify selector displays the restored device name automatically and is not blank
    const selectorTrigger = screen.getByTestId('device-selector-trigger');
    expect(selectorTrigger).toBeInTheDocument();
    expect(selectorTrigger).toHaveTextContent('Kualitas Air Kolam A');
    expect(selectorTrigger).not.toHaveTextContent('Pilih Perangkat');
  });

  it('automatically displays route-preferred device type if no previous selection is saved', () => {
    mockPathname = '/water';

    render(
      <DeviceProvider initialDevices={mockDevices}>
        <DeviceSelector />
      </DeviceProvider>
    );

    // On /water route without prior stored selection, WATER_QUALITY_NODE is restored automatically
    const selectorTrigger = screen.getByTestId('device-selector-trigger');
    expect(selectorTrigger).toHaveTextContent('Kualitas Air Kolam A');
  });
});

describe('TopAppBar Route-based DeviceSelector Visibility & Centering', () => {
  it('shows DeviceSelector on /soil, /water, and /controls (including /tanah and /air aliases)', () => {
    mockPathname = '/soil';
    const { rerender } = render(
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
    expect(screen.getByTestId('device-selector-multiple')).toBeInTheDocument();

    mockPathname = '/water';
    rerender(
      <DeviceProvider initialDevices={mockDevices}>
        <TopAppBar showDeviceSelector={true} />
      </DeviceProvider>
    );
    expect(screen.getByTestId('device-selector-multiple')).toBeInTheDocument();

    mockPathname = '/air';
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
