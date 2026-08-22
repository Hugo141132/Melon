// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DeviceSelector from '@/components/navigation/DeviceSelector';
import TopAppBar from '@/components/navigation/TopAppBar';
import { DeviceProvider, AuthorisedDevice } from '@/context/DeviceContext';
import { NextIntlClientProvider } from 'next-intl';
import { formatDeviceDisplayName } from '@/lib/utils';
import idMessages from '@/messages/id.json';
import enMessages from '@/messages/en.json';

// Mock next/navigation
let mockPathname = '/soil';
const mockPush = vi.fn();
const mockPrefetch = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    prefetch: mockPrefetch,
    refresh: vi.fn(),
  }),
  usePathname: () => mockPathname,
}));

// Mock devices: default names, raw ID names, and custom names
const mockDevices: AuthorisedDevice[] = [
  {
    id: 'db-uuid-1',
    deviceId: 'soil-node-01',
    deviceName: 'Node Sensor Tanah', // System default ID label
    deviceType: 'SOIL_NODE',
    firmwareVersion: '1.0.0',
    connectionStatus: 'ONLINE',
    lastSeenAt: new Date().toISOString(),
    siteId: 'site-1',
    siteName: 'Blok Barat',
    latitude: null,
    longitude: null,
  },
  {
    id: 'db-uuid-2',
    deviceId: 'water-quality-node-3uufzi',
    deviceName: 'water-quality-node-3uufzi', // Raw deviceId format
    deviceType: 'WATER_QUALITY_NODE',
    firmwareVersion: '1.0.0',
    connectionStatus: 'ONLINE',
    lastSeenAt: new Date().toISOString(),
    siteId: 'site-1',
    siteName: 'Kolam Nutrisi',
    latitude: null,
    longitude: null,
  },
  {
    id: 'db-uuid-3',
    deviceId: 'water-tank-01',
    deviceName: 'Node Tangki Air', // System default ID label
    deviceType: 'WATER_TANK_NODE',
    firmwareVersion: '1.0.0',
    connectionStatus: 'ONLINE',
    lastSeenAt: new Date().toISOString(),
    siteId: 'site-1',
    siteName: 'Tangki Utama',
    latitude: null,
    longitude: null,
  },
  {
    id: 'db-uuid-4',
    deviceId: 'soil-custom-01',
    deviceName: 'Lahan Melon Premium Blok A', // User custom name
    deviceType: 'SOIL_NODE',
    firmwareVersion: '1.0.0',
    connectionStatus: 'ONLINE',
    lastSeenAt: new Date().toISOString(),
    siteId: 'site-1',
    siteName: 'Greenhouse A',
    latitude: null,
    longitude: null,
  },
];

describe('Device Display Name Resolver (formatDeviceDisplayName)', () => {
  it('formats system default device labels in id and en', () => {
    const soilDevice = {
      deviceId: 'soil-1',
      deviceName: 'Node Sensor Tanah',
      deviceType: 'SOIL_NODE',
    };
    const waterQualityDevice = {
      deviceId: 'wq-1',
      deviceName: 'water-quality-node-abc',
      deviceType: 'WATER_QUALITY_NODE',
    };
    const tankDevice = {
      deviceId: 'tank-1',
      deviceName: 'Node Tangki Air',
      deviceType: 'WATER_TANK_NODE',
    };
    const genericDevice = { deviceId: 'gen-1', deviceName: '', deviceType: 'UNKNOWN_NODE' };

    // Indonesian mode
    expect(formatDeviceDisplayName(soilDevice, 'id')).toBe('Node Sensor Tanah');
    expect(formatDeviceDisplayName(waterQualityDevice, 'id')).toBe('Node Kualitas Air');
    expect(formatDeviceDisplayName(tankDevice, 'id')).toBe('Node Tangki Air');
    expect(formatDeviceDisplayName(genericDevice, 'id')).toBe('Node Perangkat');
    expect(formatDeviceDisplayName(null, 'id')).toBe('Perangkat');

    // English mode
    expect(formatDeviceDisplayName(soilDevice, 'en')).toBe('Soil Sensor Node');
    expect(formatDeviceDisplayName(waterQualityDevice, 'en')).toBe('Water Quality Node');
    expect(formatDeviceDisplayName(tankDevice, 'en')).toBe('Water Tank Node');
    expect(formatDeviceDisplayName(genericDevice, 'en')).toBe('Device Node');
    expect(formatDeviceDisplayName(null, 'en')).toBe('Device');
  });

  it('preserves custom device names unchanged in both id and en', () => {
    const customDevice1 = {
      deviceId: 'soil-1',
      deviceName: 'Lahan Melon Blok A',
      deviceType: 'SOIL_NODE',
    };
    const customDevice2 = {
      deviceId: 'tank-1',
      deviceName: 'Greenhouse B Main Reservoir',
      deviceType: 'WATER_TANK_NODE',
    };

    expect(formatDeviceDisplayName(customDevice1, 'id')).toBe('Lahan Melon Blok A');
    expect(formatDeviceDisplayName(customDevice1, 'en')).toBe('Lahan Melon Blok A');

    expect(formatDeviceDisplayName(customDevice2, 'id')).toBe('Greenhouse B Main Reservoir');
    expect(formatDeviceDisplayName(customDevice2, 'en')).toBe('Greenhouse B Main Reservoir');
  });

  it('preserves canonical deviceId and deviceType enums without mutation', () => {
    const device = {
      deviceId: 'water-tank-01',
      deviceName: 'Node Tangki Air',
      deviceType: 'WATER_TANK_NODE',
    };
    const formatted = formatDeviceDisplayName(device, 'en');

    expect(formatted).toBe('Water Tank Node');
    expect(device.deviceId).toBe('water-tank-01');
    expect(device.deviceType).toBe('WATER_TANK_NODE');
  });
});

describe('DeviceSelector Localization & Persistence in id vs en', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    mockPathname = '/soil';
    window.history.replaceState({}, '', 'http://localhost:3000/soil');
    if (typeof document !== 'undefined') {
      document.cookie = 'locale=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    }
  });

  it('renders localized default device names in Indonesian mode (id)', () => {
    render(
      <NextIntlClientProvider locale="id" messages={idMessages}>
        <DeviceProvider initialDevices={mockDevices} initialSelectedDeviceId="water-tank-01">
          <DeviceSelector />
        </DeviceProvider>
      </NextIntlClientProvider>
    );

    const trigger = screen.getByTestId('device-selector-trigger');
    expect(trigger).toHaveTextContent('Node Tangki Air');

    // Open dropdown
    fireEvent.click(trigger);
    expect(screen.getByTestId('device-option-db-uuid-1')).toHaveTextContent('Node Sensor Tanah');
    expect(screen.getByTestId('device-option-db-uuid-2')).toHaveTextContent('Node Kualitas Air');
    expect(screen.getByTestId('device-option-db-uuid-3')).toHaveTextContent('Node Tangki Air');
    expect(screen.getByTestId('device-option-db-uuid-4')).toHaveTextContent(
      'Lahan Melon Premium Blok A'
    );
  });

  it('renders localized default device names in English mode (en)', () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <DeviceProvider initialDevices={mockDevices} initialSelectedDeviceId="water-tank-01">
          <DeviceSelector />
        </DeviceProvider>
      </NextIntlClientProvider>
    );

    const trigger = screen.getByTestId('device-selector-trigger');
    expect(trigger).toHaveTextContent('Water Tank Node');

    // Open dropdown
    fireEvent.click(trigger);
    expect(screen.getByTestId('device-option-db-uuid-1')).toHaveTextContent('Soil Sensor Node');
    expect(screen.getByTestId('device-option-db-uuid-2')).toHaveTextContent('Water Quality Node');
    expect(screen.getByTestId('device-option-db-uuid-3')).toHaveTextContent('Water Tank Node');
    expect(screen.getByTestId('device-option-db-uuid-4')).toHaveTextContent(
      'Lahan Melon Premium Blok A'
    );
  });

  it('preserves selected device ID and selection after locale change', () => {
    const { rerender } = render(
      <NextIntlClientProvider locale="id" messages={idMessages}>
        <DeviceProvider initialDevices={mockDevices} initialSelectedDeviceId="soil-custom-01">
          <DeviceSelector />
        </DeviceProvider>
      </NextIntlClientProvider>
    );

    expect(screen.getByTestId('device-selector-trigger')).toHaveTextContent(
      'Lahan Melon Premium Blok A'
    );

    // Simulate switching locale to en
    rerender(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <DeviceProvider initialDevices={mockDevices} initialSelectedDeviceId="soil-custom-01">
          <DeviceSelector />
        </DeviceProvider>
      </NextIntlClientProvider>
    );

    expect(screen.getByTestId('device-selector-trigger')).toHaveTextContent(
      'Lahan Melon Premium Blok A'
    );
  });
});

describe('DeviceSelector Mobile Centering & Viewport Bounding (360px, 390px, 430px)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockPathname = '/soil';
  });

  it('renders centered trigger in TopAppBar and bounded dropdown on mobile viewports', () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <DeviceProvider initialDevices={mockDevices}>
          <TopAppBar showDeviceSelector={true} />
        </DeviceProvider>
      </NextIntlClientProvider>
    );

    // TopAppBar centering container classes
    const centerContainer = container.querySelector('.absolute.left-1\\/2');
    expect(centerContainer).toBeInTheDocument();
    expect(centerContainer?.className).toContain('-translate-x-1/2');
    expect(centerContainer?.className).toContain('max-w-[calc(100vw-6.5rem)]');

    // Open dropdown
    const trigger = screen.getByTestId('device-selector-trigger');
    fireEvent.click(trigger);

    const dropdown = screen.getByTestId('device-selector-menu');
    expect(dropdown).toBeInTheDocument();
    expect(dropdown.className).toContain('w-[calc(100vw-2rem)]');
    expect(dropdown.className).toContain('left-1/2');
    expect(dropdown.className).toContain('-translate-x-1/2');
    expect(dropdown.className).toContain('sm:right-0');
    expect(dropdown.className).toContain('sm:left-auto');
  });

  it('supports single-device state on mobile without overflow', () => {
    const singleDevice = [mockDevices[0]];
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <DeviceProvider initialDevices={singleDevice} initialSelectedDeviceId="db-uuid-1">
          <DeviceSelector />
        </DeviceProvider>
      </NextIntlClientProvider>
    );

    const singleContainer = screen.getByTestId('device-selector-single');
    expect(singleContainer).toBeInTheDocument();
    expect(singleContainer).toHaveTextContent('Soil Sensor Node');
  });
});
