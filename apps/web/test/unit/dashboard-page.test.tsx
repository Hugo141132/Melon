import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DashboardPage from '@/app/page';
import DashboardDirectPage from '@/app/dashboard/page';
import { DeviceProvider } from '@/context/DeviceContext';
import { AuthProvider } from '@/context/AuthContext';
import { FIXED_WEATHER_LOCATION } from '@/components/dashboard/WeatherCard';
import type { AuthorisedDevice } from '@/context/DeviceContext';
import type { AuthenticatedUserSession } from '@/lib/auth/rbac';
import { AccountStatus, UserRole } from '@kebun-melon/contracts';

// Mock useRouter and usePathname
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
}));

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string, values?: Record<string, any>) => {
    if (namespace === 'dashboard') {
      if (key === 'greeting') return `Selamat Datang${values?.name || ''}`;
      if (key === 'realtimeSystem') return 'Sistem Real-Time';
      if (key === 'subtitle')
        return 'Telemetri tanah, kualitas air, dan reservoir secara real-time';
      if (key === 'totalDevices') return 'Total Perangkat';
      if (key === 'onlineDevices') return 'Terhubung';
      if (key === 'offlineDevices') return 'Terputus / Stale';
      if (key === 'weatherTitle') return 'Kondisi Cuaca Lingkungan';
      if (key === 'weatherLive') return 'Cuaca Langsung';
      if (key === 'location') return 'King Agrowisata';
      if (key === 'humidity') return 'Kelembapan Udara';
      if (key === 'windSpeed') return 'Kecepatan Angin';
      if (key === 'uvIndex') return 'Indeks UV';
      if (key === 'feelsLike') return `Terasa seperti ${values?.temp}°C`;
      if (key === 'weatherClear') return 'Cerah';
      if (key === 'weatherPartlyCloudy') return 'Cerah Berawan';
      if (key === 'systemSnapshot') return 'Snapshot Operasional Sistem';
      if (key === 'systemSnapshotDesc')
        return 'Status saluran telemetri, broker pesan, dan integritas data';
      if (key === 'systemOperational') return 'Semua Saluran Siaga';
      if (key === 'telemetryPipeline') return 'Pipeline Ingesti';
      if (key === 'telemetryActive') return 'Aktif (REST / Wi-Fi)';
      if (key === 'mqttBroker') return 'Broker Pesan IoT';
      if (key === 'mqttActive') return 'Terhubung (TLS MQTT 5.0)';
      if (key === 'sseStream') return 'Saluran Real-Time';
      if (key === 'sseActive') return 'Siaga Sinkronisasi';
      if (key === 'dataFreshness') return 'Kesegaran Telemetri';
      if (key === 'dataFreshnessSynced') return 'Sinkronisasi Real-Time';
      if (key === 'quickActions') return 'Navigasi & Akses Cepat';
      if (key === 'quickActionsDesc')
        return 'Akses langsung ke modul pemantauan lahan dan operasional';
      if (key === 'actionSensorsTitle') return 'Telemetri Lahan';
      if (key === 'actionSensorsDesc')
        return 'Lihat data sensor NPK tanah dan kualitas air irigasi';
      if (key === 'actionControlsTitle') return 'Kontrol Tandon';
      if (key === 'actionControlsDesc') return 'Kelola volume reservoir dan dispensing irigasi';
      if (key === 'actionAlertsTitle') return 'Notifikasi & Anomali';
      if (key === 'actionAlertsDesc') return 'Pantau riwayat peringatan dan ambang batas sensor';
      if (key === 'actionSettingsTitle') return 'Pengaturan Akun';
      if (key === 'actionSettingsDesc') return 'Preferensi bahasa, tema, profil, dan keamanan sesi';
      return key;
    }
    if (namespace === 'devices') {
      if (key === 'allDevices') return 'Semua Perangkat';
      return key;
    }
    if (namespace === 'common') {
      if (key === 'user') return 'Pengguna';
      return key;
    }
    return key;
  },
  useLocale: () => 'id',
}));

// Mock devices
const mockDevices: AuthorisedDevice[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    deviceId: 'soil-node-001',
    deviceName: 'Sensor Tanah Blok A',
    deviceType: 'SOIL_NODE',
    siteId: null,
    connectionStatus: 'ONLINE',
    firmwareVersion: '1.0.0',
    lastSeenAt: new Date().toISOString(),
    latitude: -7.172934,
    longitude: 113.2257627,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    deviceId: 'water-quality-node-001',
    deviceName: 'Sensor Kualitas Air',
    deviceType: 'WATER_QUALITY_NODE',
    siteId: null,
    connectionStatus: 'ONLINE',
    firmwareVersion: '1.0.0',
    lastSeenAt: new Date().toISOString(),
    latitude: -7.172934,
    longitude: 113.2257627,
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    deviceId: 'water-tank-node-zi37gz',
    deviceName: 'Kontrol Tandon Utama',
    deviceType: 'WATER_TANK_NODE',
    siteId: null,
    connectionStatus: 'OFFLINE',
    firmwareVersion: '1.0.0',
    lastSeenAt: new Date().toISOString(),
    latitude: -7.172934,
    longitude: 113.2257627,
  },
];

const mockSession: AuthenticatedUserSession = {
  id: 'user-001',
  email: 'owner@kebunmelon.id',
  fullName: 'Pak Budi',
  accountStatus: AccountStatus.ACTIVE,
  activeRoles: [UserRole.OWNER],
  assignedDeviceIds: [],
};

describe('Dashboard UI & Fixed-Location Weather Suite (TASK-0506 Final Refined)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        current: {
          temperature_2m: 29.4,
          apparent_temperature: 32.1,
          relative_humidity_2m: 65,
          weather_code: 1,
          wind_speed_10m: 14.2,
          uv_index: 4.0,
          is_day: 1,
          time: '2026-09-02T10:00:00Z',
        },
      }),
    });
  });

  it('1. Removes fake health score (92/100) and synthetic farm performance claims', async () => {
    render(
      <AuthProvider initialSession={mockSession}>
        <DeviceProvider initialDevices={mockDevices}>
          <DashboardPage />
        </DeviceProvider>
      </AuthProvider>
    );

    // Verify 92/100 and fake health text are completely absent
    expect(screen.queryByText('/100')).toBeNull();
    expect(screen.queryByText('92')).toBeNull();
    expect(
      screen.queryByText(/Kondisi lahan Anda secara keseluruhan dalam keadaan optimal/i)
    ).toBeNull();
    expect(screen.queryByText(/Your farm conditions are overall in an optimal state/i)).toBeNull();
    expect(screen.queryByText(/healthExcellent/i)).toBeNull();
  });

  it('2. Renders fixed location weather card with exact coordinates (-7.172934, 113.2257627)', async () => {
    render(
      <AuthProvider initialSession={mockSession}>
        <DeviceProvider initialDevices={mockDevices}>
          <DashboardPage />
        </DeviceProvider>
      </AuthProvider>
    );

    // Check fixed location label and coordinates
    expect(screen.getByText('King Agrowisata')).toBeInTheDocument();
    expect(screen.getByText(FIXED_WEATHER_LOCATION.coordinatesLabel)).toBeInTheDocument();
    expect(FIXED_WEATHER_LOCATION.latitude).toBe(-7.172934);
    expect(FIXED_WEATHER_LOCATION.longitude).toBe(113.2257627);

    // Verify Open-Meteo was called with fixed coordinates
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('latitude=-7.172934&longitude=113.2257627')
      );
    });

    // Check rendered weather metrics
    await waitFor(() => {
      expect(screen.getByText('29.4°C')).toBeInTheDocument();
      expect(screen.getByText(/Terasa seperti 32.1°C/i)).toBeInTheDocument();
      expect(screen.getByText(/65%/i)).toBeInTheDocument();
      expect(screen.getByText(/14.2/i)).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
    });
  });

  it('3. Renders top operational node summary (Total, Online, Offline/Stale)', () => {
    render(
      <AuthProvider initialSession={mockSession}>
        <DeviceProvider initialDevices={mockDevices}>
          <DashboardPage />
        </DeviceProvider>
      </AuthProvider>
    );

    // Fleet count check (total 3, online 2, offline 1)
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Total Perangkat')).toBeInTheDocument();
    expect(screen.getByText('Terhubung')).toBeInTheDocument();
    expect(screen.getByText('Terputus / Stale')).toBeInTheDocument();
  });

  it('4. Confirms portal-like sections (System Snapshot & Quick Actions) and hero redundant texts are removed', () => {
    render(
      <AuthProvider initialSession={mockSession}>
        <DeviceProvider initialDevices={mockDevices}>
          <DashboardPage />
        </DeviceProvider>
      </AuthProvider>
    );

    // Ensure Real-Time System and subtitle are absent
    expect(screen.queryByText('Sistem Real-Time')).toBeNull();
    expect(
      screen.queryByText('Telemetri tanah, kualitas air, dan reservoir secara real-time')
    ).toBeNull();

    // Ensure System Operational Snapshot is absent
    expect(screen.queryByText('Snapshot Operasional Sistem')).toBeNull();
    expect(screen.queryByText('Pipeline Ingesti')).toBeNull();
    expect(screen.queryByText('Broker Pesan IoT')).toBeNull();
    expect(screen.queryByText('Saluran Real-Time')).toBeNull();
    expect(screen.queryByText('Kesegaran Telemetri')).toBeNull();

    // Ensure Quick Actions & Navigation is absent
    expect(screen.queryByText('Navigasi & Akses Cepat')).toBeNull();
    expect(screen.queryByText('Telemetri Lahan')).toBeNull();
    expect(screen.queryByText('Kontrol Tandon')).toBeNull();
    expect(screen.queryByText('Notifikasi & Anomali')).toBeNull();
    expect(screen.queryByText('Pengaturan Akun')).toBeNull();

    // Ensure duplicate domain cards and fleet directory are absent
    expect(screen.queryByText('Ringkasan Pemantauan Tanah')).toBeNull();
    expect(screen.queryByText('Ringkasan Pemantauan Air')).toBeNull();
    expect(screen.queryByText('Ringkasan Pemantauan Reservoir')).toBeNull();
    expect(screen.queryByText('Status Armada Perangkat')).toBeNull();
  });

  it('5. Renders identical focused DashboardView on /dashboard route without redirects', () => {
    render(
      <AuthProvider initialSession={mockSession}>
        <DeviceProvider initialDevices={mockDevices}>
          <DashboardDirectPage />
        </DeviceProvider>
      </AuthProvider>
    );

    expect(screen.getByText(/Selamat Datang, Budi/i)).toBeInTheDocument();
    expect(screen.getByText('King Agrowisata')).toBeInTheDocument();
  });

  it('6. Strictly contains zero emojis across all greetings, cards, and labels', () => {
    const { container } = render(
      <AuthProvider initialSession={mockSession}>
        <DeviceProvider initialDevices={mockDevices}>
          <DashboardPage />
        </DeviceProvider>
      </AuthProvider>
    );

    // Match Unicode emoji characters
    const emojiRegex = /\p{Extended_Pictographic}/u;
    const textContent = container.textContent || '';
    expect(emojiRegex.test(textContent)).toBe(false);
  });
});
