// @vitest-environment jsdom
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DeviceRegistryPage from '@/app/devices/page';
import { NextIntlClientProvider } from 'next-intl';
import idMessages from '@/messages/id.json';
import enMessages from '@/messages/en.json';
import { UserRole } from '@kebun-melon/contracts';

let mockAuthContext: any = {
  user: null,
  role: null,
  isAuthenticated: false,
};

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mockAuthContext,
  AuthProvider: ({ children }: any) => <>{children}</>,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/devices',
  useRouter: () => ({
    push: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const mockDevices = [
  {
    id: 'd9b0e271-9df6-48c9-95e2-6aa14eb91981',
    deviceId: 'soil-node-001',
    siteId: 'site-1',
    name: 'Soil Node Greenhouse A',
    deviceType: 'SOIL_NODE',
    accountStatus: 'ACTIVE',
    connectionStatus: 'ONLINE',
    firmwareVersion: '1.0.0',
    hardwareRevision: 'rev-A',
    schemaVersion: '1.0',
    lastSeenAt: '2026-09-04T10:00:00.000Z',
    lastMessageAt: '2026-09-04T10:00:00.000Z',
    latitude: -6.2,
    longitude: 106.8,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    deactivatedAt: null,
    capabilities: ['SOIL_NPK', 'SOIL_MOISTURE'],
  },
];

describe('DeviceRegistryPage Auth State Hydration & Permission Scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/devices')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: mockDevices,
              meta: {
                pagination: {
                  page: 1,
                  pageSize: 10,
                  totalItems: 1,
                  totalPages: 1,
                },
              },
            }),
        });
      }
      return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    });
  });

  const renderComponent = (locale: string = 'id', messages: any = idMessages) =>
    render(
      <NextIntlClientProvider locale={locale} messages={messages}>
        <DeviceRegistryPage />
      </NextIntlClientProvider>
    );

  it('1. renders immediately from AuthContext without "Memeriksa sesi pengguna..." blocking spinner', async () => {
    mockAuthContext = {
      user: {
        id: 'usr-1',
        fullName: 'Owner Kebun',
        email: 'owner@kebunmelon.id',
        accountStatus: 'ACTIVE',
        activeRoles: [UserRole.OWNER],
      },
      role: UserRole.OWNER,
      isAuthenticated: true,
    };

    renderComponent();

    // Verification: Checking session spinner must never be in document
    expect(screen.queryByText('Memeriksa sesi pengguna...')).not.toBeInTheDocument();
    expect(screen.queryByText('Checking user session...')).not.toBeInTheDocument();

    // Verify header renders immediately
    expect(
      screen.getByRole('heading', { level: 1, name: 'Manajemen Perangkat' })
    ).toBeInTheDocument();

    // Verify fetch('/api/v1/devices') called immediately without waiting for redundant session fetch
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/v1/devices?'));
    });

    // Verify device item appears
    await waitFor(() => {
      expect(screen.getByText('Soil Node Greenhouse A')).toBeInTheDocument();
    });
  });

  it('2. displays canonical deviceId and Owner action buttons (Edit & Deactivate) when user is OWNER', async () => {
    mockAuthContext = {
      user: {
        id: 'usr-1',
        fullName: 'Owner Kebun',
        email: 'owner@kebunmelon.id',
        accountStatus: 'ACTIVE',
        activeRoles: [UserRole.OWNER],
      },
      role: UserRole.OWNER,
      isAuthenticated: true,
    };

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Soil Node Greenhouse A')).toBeInTheDocument();
    });

    // DEC-DEV-028: Canonical deviceId is visible to OWNER
    expect(screen.getByText('soil-node-001')).toBeInTheDocument();

    // Edit and Deactivate action buttons are visible for OWNER
    expect(screen.getByTitle('Ubah')).toBeInTheDocument();
    expect(screen.getByTitle('Nonaktifkan Perangkat?')).toBeInTheDocument();
  });

  it('3. conceals Owner action buttons (Edit & Deactivate) when user is ADMIN', async () => {
    mockAuthContext = {
      user: {
        id: 'usr-2',
        fullName: 'Admin Lapangan',
        email: 'admin@kebunmelon.id',
        accountStatus: 'ACTIVE',
        activeRoles: [UserRole.ADMIN],
      },
      role: UserRole.ADMIN,
      isAuthenticated: true,
    };

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Soil Node Greenhouse A')).toBeInTheDocument();
    });

    // Edit and Deactivate action buttons must NOT be visible to ADMIN
    expect(screen.queryByTitle('Ubah')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Nonaktifkan Perangkat?')).not.toBeInTheDocument();
  });

  it('4. renders responsive search and filter controls with localized domain options', async () => {
    mockAuthContext = {
      user: {
        id: 'usr-1',
        fullName: 'Owner Kebun',
        email: 'owner@kebunmelon.id',
        accountStatus: 'ACTIVE',
        activeRoles: [UserRole.OWNER],
      },
      role: UserRole.OWNER,
      isAuthenticated: true,
    };

    renderComponent();

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('Cari ID Perangkat, nama, atau versi firmware...')
      ).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(
      'Cari ID Perangkat, nama, atau versi firmware...'
    );
    expect(searchInput.className).toContain('truncate');

    // Localized domain options
    expect(screen.getByRole('option', { name: 'Semua Domain' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Sensor Tanah' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Kualitas Air' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Tangki Air' })).toBeInTheDocument();

    // Localized connection status options (simplified to Connected, Disconnected, Inactive)
    expect(screen.getByRole('option', { name: 'Semua Status Koneksi' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Terhubung' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Terputus' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Tidak Aktif' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Data Tidak Mutakhir' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Tidak Diketahui' })).not.toBeInTheDocument();

    // Localized card status badge and parameter count
    expect(screen.getAllByText('Terhubung')).toHaveLength(2);
    expect(screen.getByText('2 parameter')).toBeInTheDocument();
  });

  it('5. separates internal parameter keys from user-facing labels and displays proper units', async () => {
    mockAuthContext = {
      user: {
        id: 'usr-1',
        fullName: 'Owner Kebun',
        email: 'owner@kebunmelon.id',
        accountStatus: 'ACTIVE',
        activeRoles: [UserRole.OWNER],
      },
      role: UserRole.OWNER,
      isAuthenticated: true,
    };

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Soil Node Greenhouse A')).toBeInTheDocument();
    });

    // Header domain badge and filter option both show Sensor Tanah
    expect(screen.getAllByText('Sensor Tanah')).toHaveLength(2);

    // Monitoring parameters heading
    expect(screen.getByText('Parameter Pemantauan')).toBeInTheDocument();

    // Human-friendly labels instead of raw 'SOIL_NPK' and 'SOIL_MOISTURE'
    expect(screen.getByText('Nutrisi NPK (N, P, K)')).toBeInTheDocument();
    expect(screen.getByText('Kelembapan Tanah')).toBeInTheDocument();

    // Measurement units
    expect(screen.getByText('mg/kg')).toBeInTheDocument();
    expect(screen.getByText('%')).toBeInTheDocument();
  });

  it('6. expands SOIL_TELEMETRY into 7 canonical agronomic parameters with measurement units', async () => {
    const soilTelemetryDevice = [
      {
        ...mockDevices[0],
        capabilities: ['SOIL_TELEMETRY'],
      },
    ];

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/devices')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: soilTelemetryDevice,
              meta: {
                pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
              },
            }),
        });
      }
      return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    });

    mockAuthContext = {
      user: {
        id: 'usr-1',
        fullName: 'Owner Kebun',
        email: 'owner@kebunmelon.id',
        accountStatus: 'ACTIVE',
        activeRoles: [UserRole.OWNER],
      },
      role: UserRole.OWNER,
      isAuthenticated: true,
    };

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Soil Node Greenhouse A')).toBeInTheDocument();
    });

    // 7 canonical parameters
    expect(screen.getByText('Nitrogen (N)')).toBeInTheDocument();
    expect(screen.getByText('Fosfor (P)')).toBeInTheDocument();
    expect(screen.getByText('Kalium (K)')).toBeInTheDocument();
    expect(screen.getByText('Suhu Tanah')).toBeInTheDocument();
    expect(screen.getByText('Kelembapan Tanah')).toBeInTheDocument();
    expect(screen.getByText('pH Tanah')).toBeInTheDocument();
    expect(screen.getByText('EC Tanah')).toBeInTheDocument();

    // Measurement units
    expect(screen.getAllByText('mg/kg')).toHaveLength(3); // N, P, K
    expect(screen.getByText('°C')).toBeInTheDocument();
    expect(screen.getByText('%')).toBeInTheDocument();
    expect(screen.getByText('pH')).toBeInTheDocument();
    expect(screen.getByText('µS/cm')).toBeInTheDocument();
  });

  it('7. formats water quality parameters and water tank controls with presets and units', async () => {
    const waterAndTankDevices = [
      {
        id: 'water-node-id',
        deviceId: 'water-001',
        siteId: 'site-1',
        name: 'Water Quality Pond 1',
        deviceType: 'WATER_QUALITY_NODE',
        accountStatus: 'ACTIVE',
        connectionStatus: 'ONLINE',
        firmwareVersion: '1.0.0',
        hardwareRevision: 'rev-A',
        schemaVersion: '1.0',
        lastSeenAt: '2026-09-04T10:00:00.000Z',
        lastMessageAt: '2026-09-04T10:00:00.000Z',
        latitude: -6.2,
        longitude: 106.8,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
        deactivatedAt: null,
        capabilities: ['WATER_TELEMETRY'],
      },
      {
        id: 'tank-node-id',
        deviceId: 'tank-001',
        siteId: 'site-1',
        name: 'Reservoir Tank Main',
        deviceType: 'WATER_TANK_NODE',
        accountStatus: 'ACTIVE',
        connectionStatus: 'ONLINE',
        firmwareVersion: '1.0.0',
        hardwareRevision: 'rev-A',
        schemaVersion: '1.0',
        lastSeenAt: '2026-09-04T10:00:00.000Z',
        lastMessageAt: '2026-09-04T10:00:00.000Z',
        latitude: -6.2,
        longitude: 106.8,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
        deactivatedAt: null,
        capabilities: ['WATER_TANK_VOLUME', 'FAUCET_CONTROL'],
      },
    ];

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/devices')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: waterAndTankDevices,
              meta: {
                pagination: { page: 1, pageSize: 10, totalItems: 2, totalPages: 1 },
              },
            }),
        });
      }
      return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    });

    mockAuthContext = {
      user: {
        id: 'usr-1',
        fullName: 'Owner Kebun',
        email: 'owner@kebunmelon.id',
        accountStatus: 'ACTIVE',
        activeRoles: [UserRole.OWNER],
      },
      role: UserRole.OWNER,
      isAuthenticated: true,
    };

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Water Quality Pond 1')).toBeInTheDocument();
      expect(screen.getByText('Reservoir Tank Main')).toBeInTheDocument();
    });

    // Water Quality 3 parameters
    expect(screen.getByText('pH Air')).toBeInTheDocument();
    expect(screen.getByText('TDS Air')).toBeInTheDocument();
    expect(screen.getByText('EC Air')).toBeInTheDocument();
    expect(screen.getByText('ppm')).toBeInTheDocument();

    // Water Tank Volume and Faucet Control
    expect(screen.getByText('Volume Tangki')).toBeInTheDocument();
    expect(screen.getByText('L')).toBeInTheDocument();
    expect(screen.getByText('Kontrol Katup Irigasi')).toBeInTheDocument();
    expect(screen.getByText('Preset: 0.3L, 1L, 1.5L')).toBeInTheDocument();
  });

  it('8. strictly prevents Irrigation Valve Control from displaying on Soil Node and Water Quality Node even if FAUCET_CONTROL is present in capabilities', async () => {
    const devicesWithStrayCapabilities = [
      {
        id: 'soil-stray-id',
        deviceId: 'soil-stray-001',
        siteId: 'site-1',
        name: 'Soil Node With Stray Cap',
        deviceType: 'SOIL_NODE',
        accountStatus: 'ACTIVE',
        connectionStatus: 'ONLINE',
        firmwareVersion: '1.0.0',
        hardwareRevision: 'rev-A',
        schemaVersion: '1.0',
        lastSeenAt: '2026-09-04T10:00:00.000Z',
        lastMessageAt: '2026-09-04T10:00:00.000Z',
        latitude: -6.2,
        longitude: 106.8,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
        deactivatedAt: null,
        capabilities: ['SOIL_TELEMETRY', 'FAUCET_CONTROL'],
      },
      {
        id: 'water-stray-id',
        deviceId: 'water-stray-001',
        siteId: 'site-1',
        name: 'Water Quality With Stray Cap',
        deviceType: 'WATER_QUALITY_NODE',
        accountStatus: 'ACTIVE',
        connectionStatus: 'ONLINE',
        firmwareVersion: '1.0.0',
        hardwareRevision: 'rev-A',
        schemaVersion: '1.0',
        lastSeenAt: '2026-09-04T10:00:00.000Z',
        lastMessageAt: '2026-09-04T10:00:00.000Z',
        latitude: -6.2,
        longitude: 106.8,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
        deactivatedAt: null,
        capabilities: ['WATER_TELEMETRY', 'FAUCET_CONTROL'],
      },
    ];

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/devices')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: devicesWithStrayCapabilities,
              meta: {
                pagination: { page: 1, pageSize: 10, totalItems: 2, totalPages: 1 },
              },
            }),
        });
      }
      return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    });

    mockAuthContext = {
      user: {
        id: 'usr-1',
        fullName: 'Owner Kebun',
        email: 'owner@kebunmelon.id',
        accountStatus: 'ACTIVE',
        activeRoles: [UserRole.OWNER],
      },
      role: UserRole.OWNER,
      isAuthenticated: true,
    };

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Soil Node With Stray Cap')).toBeInTheDocument();
      expect(screen.getByText('Water Quality With Stray Cap')).toBeInTheDocument();
    });

    // Soil Node shows soil parameters
    expect(screen.getByText('Nitrogen (N)')).toBeInTheDocument();
    expect(screen.getByText('Kelembapan Tanah')).toBeInTheDocument();

    // Water Quality Node shows water parameters
    expect(screen.getByText('pH Air')).toBeInTheDocument();
    expect(screen.getByText('TDS Air')).toBeInTheDocument();

    // Neither node shall display Faucet Control or Control Capabilities section
    expect(screen.queryByText('Kontrol Katup Irigasi')).not.toBeInTheDocument();
    expect(screen.queryByText('Irrigation Valve Control')).not.toBeInTheDocument();
    expect(screen.queryByText('Kemampuan Kontrol')).not.toBeInTheDocument();
    expect(screen.queryByText('Control Capabilities')).not.toBeInTheDocument();
    expect(screen.queryByText('Preset: 0.3L, 1L, 1.5L')).not.toBeInTheDocument();
  });

  it('9. displays Irrigation Valve Control on Water Tank Node only if supported, and hides it when omitted', async () => {
    const tankWithoutFaucet = [
      {
        id: 'tank-monitoring-only-id',
        deviceId: 'tank-monitor-001',
        siteId: 'site-1',
        name: 'Reservoir Tank Monitor Only',
        deviceType: 'WATER_TANK_NODE',
        accountStatus: 'ACTIVE',
        connectionStatus: 'ONLINE',
        firmwareVersion: '1.0.0',
        hardwareRevision: 'rev-A',
        schemaVersion: '1.0',
        lastSeenAt: '2026-09-04T10:00:00.000Z',
        lastMessageAt: '2026-09-04T10:00:00.000Z',
        latitude: -6.2,
        longitude: 106.8,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
        deactivatedAt: null,
        capabilities: ['WATER_TANK_VOLUME'],
      },
    ];

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/devices')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: tankWithoutFaucet,
              meta: {
                pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
              },
            }),
        });
      }
      return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    });

    mockAuthContext = {
      user: {
        id: 'usr-1',
        fullName: 'Owner Kebun',
        email: 'owner@kebunmelon.id',
        accountStatus: 'ACTIVE',
        activeRoles: [UserRole.OWNER],
      },
      role: UserRole.OWNER,
      isAuthenticated: true,
    };

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Reservoir Tank Monitor Only')).toBeInTheDocument();
    });

    // Shows reservoir volume
    expect(screen.getByText('Volume Tangki')).toBeInTheDocument();

    // Does NOT show faucet control when capability is not present
    expect(screen.queryByText('Kontrol Katup Irigasi')).not.toBeInTheDocument();
    expect(screen.queryByText('Preset: 0.3L, 1L, 1.5L')).not.toBeInTheDocument();
  });

  it('10. renders localized UI elements in English when locale is set to en', async () => {
    mockAuthContext = {
      user: {
        id: 'usr-1',
        fullName: 'Owner Kebun',
        email: 'owner@kebunmelon.id',
        accountStatus: 'ACTIVE',
        activeRoles: [UserRole.OWNER],
      },
      role: UserRole.OWNER,
      isAuthenticated: true,
    };

    renderComponent('en', enMessages);

    await waitFor(() => {
      expect(screen.getByText('Soil Node Greenhouse A')).toBeInTheDocument();
    });

    // English page header and search
    expect(screen.getByRole('heading', { name: 'Device Management' })).toBeInTheDocument();
    expect(
      screen.getByText('List & connection status of sensors and controllers')
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Search Device ID, name, or firmware version...')
    ).toBeInTheDocument();

    // English filter options
    expect(screen.getByRole('option', { name: 'All Domains' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Soil Monitoring' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Water Quality' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Water Tank' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'All Connection Statuses' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Connected' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Disconnected' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Inactive' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Data Stale' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Unknown' })).not.toBeInTheDocument();

    // English card elements
    expect(screen.getByText('Monitoring Parameters')).toBeInTheDocument();
    expect(screen.getByText('2 params')).toBeInTheDocument();
    expect(screen.getAllByText('Connected')).toHaveLength(2);
  });

  it('11. manages device deactivation and reactivation lifecycle with optimistic in-place state transition and localized prompts', async () => {
    let currentDevice = { ...mockDevices[0] };

    global.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
      if (
        url.includes('/api/v1/devices') &&
        (!options || options.method === 'GET' || !options.method)
      ) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: [currentDevice],
              meta: {
                pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
              },
            }),
        });
      }
      if (url.includes('/deactivate') && options?.method === 'POST') {
        currentDevice = {
          ...currentDevice,
          accountStatus: 'DEACTIVATED',
          connectionStatus: 'INACTIVE',
        };
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, message: 'Device deactivated' }),
        });
      }
      if (url.includes('/activate') && options?.method === 'POST') {
        currentDevice = { ...currentDevice, accountStatus: 'ACTIVE', connectionStatus: 'OFFLINE' };
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, message: 'Device reactivated' }),
        });
      }
      return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    });

    mockAuthContext = {
      user: {
        id: 'usr-1',
        fullName: 'Owner Kebun',
        email: 'owner@kebunmelon.id',
        accountStatus: 'ACTIVE',
        activeRoles: [UserRole.OWNER],
      },
      role: UserRole.OWNER,
      isAuthenticated: true,
    };

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Soil Node Greenhouse A')).toBeInTheDocument();
    });

    // 1. Initial active state has "Terhubung" badge and deactivation action button
    expect(screen.getAllByText('Terhubung')).toHaveLength(2);
    const deactivateBtn = screen.getByTitle('Nonaktifkan Perangkat?');
    expect(deactivateBtn).toBeInTheDocument();

    // 2. Click deactivate button -> opens modal with localized prompt
    fireEvent.click(deactivateBtn);
    expect(screen.getByRole('heading', { name: 'Nonaktifkan Perangkat?' })).toBeInTheDocument();
    expect(
      screen.getByText('Apakah Anda yakin ingin menonaktifkan perangkat Soil Node Greenhouse A?')
    ).toBeInTheDocument();

    // 3. Confirm deactivation
    const confirmDeactivateBtn = screen.getByRole('button', { name: 'Ya, Nonaktifkan' });
    fireEvent.click(confirmDeactivateBtn);

    // 4. Modal closes and card optimistically updates in-place without page reloading
    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: 'Nonaktifkan Perangkat?' })
      ).not.toBeInTheDocument();
      expect(screen.getAllByText('Tidak Aktif')).toHaveLength(2);
    });

    // Action button switches to activate button
    const activateBtn = screen.getByTitle('Aktifkan Perangkat');
    expect(activateBtn).toBeInTheDocument();
    expect(screen.queryByTitle('Nonaktifkan Perangkat?')).not.toBeInTheDocument();

    // 5. Click activate button -> opens modal with localized prompt
    fireEvent.click(activateBtn);
    expect(screen.getByRole('heading', { name: 'Aktifkan Perangkat' })).toBeInTheDocument();
    expect(
      screen.getByText('Aktifkan kembali perangkat Soil Node Greenhouse A?')
    ).toBeInTheDocument();

    // 6. Confirm activation
    const confirmActivateBtn = screen.getByRole('button', { name: 'Ya, Aktifkan' });
    fireEvent.click(confirmActivateBtn);

    // 7. Modal closes and card optimistically updates in-place back to active/offline
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Aktifkan Perangkat' })).not.toBeInTheDocument();
      expect(screen.getAllByText('Terputus')).toHaveLength(2);
    });

    // Action button switches back to deactivation button
    expect(screen.getByTitle('Nonaktifkan Perangkat?')).toBeInTheDocument();
  });

  it('12. maps canonical statuses to simplified presentation (ONLINE -> Connected, OFFLINE/STALE/UNKNOWN -> Disconnected, INACTIVE -> Inactive) and supports client filtering', async () => {
    const devicesWithVariousStatuses = [
      {
        ...mockDevices[0],
        id: 'dev-online',
        deviceId: 'dev-online-01',
        name: 'Device Online Node',
        connectionStatus: 'ONLINE',
        accountStatus: 'ACTIVE',
      },
      {
        ...mockDevices[0],
        id: 'dev-offline',
        deviceId: 'dev-offline-02',
        name: 'Device Offline Node',
        connectionStatus: 'OFFLINE',
        accountStatus: 'ACTIVE',
      },
      {
        ...mockDevices[0],
        id: 'dev-stale',
        deviceId: 'dev-stale-03',
        name: 'Device Stale Node',
        connectionStatus: 'STALE',
        accountStatus: 'ACTIVE',
      },
      {
        ...mockDevices[0],
        id: 'dev-unknown',
        deviceId: 'dev-unknown-04',
        name: 'Device Unknown Node',
        connectionStatus: 'UNKNOWN',
        accountStatus: 'ACTIVE',
      },
      {
        ...mockDevices[0],
        id: 'dev-inactive',
        deviceId: 'dev-inactive-05',
        name: 'Device Inactive Node',
        connectionStatus: 'INACTIVE',
        accountStatus: 'DEACTIVATED',
      },
    ];

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/devices')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: devicesWithVariousStatuses,
              meta: {
                pagination: { page: 1, pageSize: 10, totalItems: 5, totalPages: 1 },
              },
            }),
        });
      }
      return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    });

    mockAuthContext = {
      user: {
        id: 'usr-1',
        fullName: 'Owner Kebun',
        email: 'owner@kebunmelon.id',
        accountStatus: 'ACTIVE',
        activeRoles: [UserRole.OWNER],
      },
      role: UserRole.OWNER,
      isAuthenticated: true,
    };

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Device Online Node')).toBeInTheDocument();
      expect(screen.getByText('Device Offline Node')).toBeInTheDocument();
      expect(screen.getByText('Device Stale Node')).toBeInTheDocument();
      expect(screen.getByText('Device Unknown Node')).toBeInTheDocument();
      expect(screen.getByText('Device Inactive Node')).toBeInTheDocument();
    });

    // Verify status mapping in Indonesian:
    // 1 ONLINE -> 1 Connected card badge + 1 dropdown option = 2 "Terhubung"
    expect(screen.getAllByText('Terhubung')).toHaveLength(2);

    // 3 Disconnected (OFFLINE, STALE, UNKNOWN) -> 3 badges + 1 dropdown option = 4 "Terputus"
    expect(screen.getAllByText('Terputus')).toHaveLength(4);

    // 1 Inactive -> 1 badge + 1 dropdown option = 2 "Tidak Aktif"
    expect(screen.getAllByText('Tidak Aktif')).toHaveLength(2);

    // Deprecated/raw individual statuses must NEVER be presented in user UI
    expect(screen.queryByText('Data Tidak Mutakhir')).not.toBeInTheDocument();
    expect(screen.queryByText('Tidak Diketahui')).not.toBeInTheDocument();

    // Verify client-side status filtering:
    const selects = screen.getAllByRole('combobox');
    const statusFilterSelect = selects[1];

    // Filter by Connected:
    fireEvent.change(statusFilterSelect, { target: { value: 'CONNECTED' } });
    expect(screen.getByText('Device Online Node')).toBeInTheDocument();
    expect(screen.queryByText('Device Offline Node')).not.toBeInTheDocument();
    expect(screen.queryByText('Device Stale Node')).not.toBeInTheDocument();
    expect(screen.queryByText('Device Unknown Node')).not.toBeInTheDocument();
    expect(screen.queryByText('Device Inactive Node')).not.toBeInTheDocument();

    // Filter by Disconnected:
    fireEvent.change(statusFilterSelect, { target: { value: 'DISCONNECTED' } });
    expect(screen.queryByText('Device Online Node')).not.toBeInTheDocument();
    expect(screen.getByText('Device Offline Node')).toBeInTheDocument();
    expect(screen.getByText('Device Stale Node')).toBeInTheDocument();
    expect(screen.getByText('Device Unknown Node')).toBeInTheDocument();
    expect(screen.queryByText('Device Inactive Node')).not.toBeInTheDocument();

    // Filter by Inactive:
    fireEvent.change(statusFilterSelect, { target: { value: 'INACTIVE' } });
    expect(screen.queryByText('Device Online Node')).not.toBeInTheDocument();
    expect(screen.queryByText('Device Offline Node')).not.toBeInTheDocument();
    expect(screen.queryByText('Device Stale Node')).not.toBeInTheDocument();
    expect(screen.queryByText('Device Unknown Node')).not.toBeInTheDocument();
    expect(screen.getByText('Device Inactive Node')).toBeInTheDocument();

    // Filter by All:
    fireEvent.change(statusFilterSelect, { target: { value: 'ALL' } });
    expect(screen.getByText('Device Online Node')).toBeInTheDocument();
    expect(screen.getByText('Device Offline Node')).toBeInTheDocument();
    expect(screen.getByText('Device Stale Node')).toBeInTheDocument();
    expect(screen.getByText('Device Unknown Node')).toBeInTheDocument();
    expect(screen.getByText('Device Inactive Node')).toBeInTheDocument();
  });
});
