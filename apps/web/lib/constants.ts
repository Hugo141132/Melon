// ─── NPK Sensor Data ──────────────────────────────────────
export const NPK_DATA = {
  nitrogen: { value: 145, unit: 'mg/kg', percent: 65, status: 'Ideal' },
  fosfor: { value: 42, unit: 'mg/kg', percent: 55, status: 'Ideal' },
  kalium: { value: 198, unit: 'mg/kg', percent: 72, status: 'Ideal' },
};

// ─── Water / Nutrisi Data ─────────────────────────────────
export const WATER_DATA = {
  ec: { value: 1.8, unit: 'mS/cm', status: 'Stabil' },
  ph: { value: 6.2, status: 'Normal', min: 1, max: 14, markerPercent: 44 },
  tds: { value: 920, unit: 'ppm', status: 'Sesuai Target' },
  tankVolume: { value: 450, unit: 'Liter', max: 600, percent: 75 },
  flowRate: { value: 12.5, unit: 'L/mnt', status: 'Aliran Lancar' },
};

// ─── Irrigation Phases ────────────────────────────────────
export const IRRIGATION_PHASES = [
  { id: 1, label: 'Fase 1', volume: '300 ml', active: true },
  { id: 2, label: 'Fase 2', volume: '1 Liter', active: false },
  { id: 3, label: 'Fase 3', volume: '1,5 Liter', active: false },
];

// ─── Dashboard Data ───────────────────────────────────────
export const DASHBOARD_DATA = {
  healthScore: 92,
  healthLabel: 'Sangat Baik',
  userName: '',
  subtitle: 'Tanaman tumbuh optimal hari ini.',
  soil: { percent: 78, label: 'Stabil & Subur' },
  water: { percent: 65, label: 'Irigasi Aktif' },
  weather: {
    condition: 'Cerah Berawan',
    temp: '31°',
    uvIndex: 4,
    note: 'Ideal untuk fotosintesis melon',
  },
};

// ─── Notification Alerts ──────────────────────────────────
export type AlertSeverity = 'error' | 'warning' | 'info';

export interface Alert {
  id: number;
  severity: AlertSeverity;
  title: string;
  current: string;
  optimal: string;
}

export const ALERTS: Alert[] = [
  {
    id: 1,
    severity: 'error',
    title: 'pH Air: Terlalu Rendah',
    current: '5.2 pH',
    optimal: '5.8 - 6.2',
  },
  {
    id: 2,
    severity: 'warning',
    title: 'Nitrogen (N): Terlalu Tinggi',
    current: '240 ppm',
    optimal: '150 - 200',
  },
  {
    id: 3,
    severity: 'error',
    title: 'Kalium (K): Terlalu Rendah',
    current: '180 ppm',
    optimal: '250 - 300',
  },
  {
    id: 4,
    severity: 'warning',
    title: 'Level Air: Terlalu Rendah',
    current: '15%',
    optimal: '≥ 25%',
  },
];

// ─── Nutrisi Trend Chart Mock Data ───────────────────────
export const EC_TREND_DATA = [
  { time: '12:00', ec: 1.6, ph: 5.9 },
  { time: '14:00', ec: 1.75, ph: 6.0 },
  { time: '16:00', ec: 1.9, ph: 6.1 },
  { time: '18:00', ec: 1.7, ph: 6.2 },
  { time: '20:00', ec: 1.8, ph: 6.15 },
  { time: '22:00', ec: 1.85, ph: 6.2 },
  { time: '00:00', ec: 1.8, ph: 6.3 },
  { time: 'Skrg', ec: 1.8, ph: 6.2 },
];

// ─── NPK Trend Chart Mock Data ───────────────────────────
export const NPK_TREND_DATA = [
  { time: 'Sen', n: 130, p: 40, k: 185 },
  { time: 'Sel', n: 138, p: 42, k: 190 },
  { time: 'Rab', n: 145, p: 42, k: 198 },
  { time: 'Kam', n: 142, p: 44, k: 202 },
  { time: 'Jum', n: 148, p: 43, k: 195 },
  { time: 'Sab', n: 145, p: 42, k: 198 },
  { time: 'Min', n: 143, p: 41, k: '200' },
];

// ─── User Profile ─────────────────────────────────────────
export const USER_PROFILE = {
  name: 'Wahyu',
  role: 'Pemilik Lahan',
  phone: '0812-xxxx-xxxx',
  email: 'Wahyu123@gmail.com',
  avatar: 'https://i.pinimg.com/originals/8a/e9/e9/8ae9e92fa4e69967aa61bf2bda967b7b.jpg',
  verified: true,
  devicesCount: 2,
  lastPasswordChange: '3 bulan lalu',
};

// ─── Navigation Routes ────────────────────────────────────
export const NAV_ITEMS = [
  { href: '/', label: 'Beranda', icon: 'home' },
  { href: '/tanah', label: 'Lahan', icon: 'grass' },
  { href: '/air', label: 'Air', icon: 'water_drop' },
  { href: '/notifikasi', label: 'Notifikasi', icon: 'notifications' },
] as const;

// ─── Soil NPK Optimal Ranges ──────────────────────────────
export const NPK_RANGES = {
  nitrogen: { min: 100, max: 200, optimal: { min: 130, max: 170 } },
  fosfor: { min: 20, max: 80, optimal: { min: 35, max: 55 } },
  kalium: { min: 100, max: 300, optimal: { min: 160, max: 220 } },
};

export const SOIL_PHASE_STATUS = 'Ideal for Fase Generatif';
export const SOIL_PHASE_NOTE = 'Pupuk cukup, tanaman akan tumbuh kuat.';
