import type { Metadata } from 'next';
import TopAppBar from '@/components/navigation/TopAppBar';
import BottomNav from '@/components/navigation/BottomNav';
import { DASHBOARD_DATA, ALERTS } from '@/lib/constants';
import {
  Sun,
  Droplets,
  Sprout,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  Thermometer,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Beranda - Kebun Melon',
  description: 'Dashboard monitoring kesehatan tanaman melon Anda secara real-time.',
};

// ─── Health Score Half Gauge ────────────────────────────
function HealthScoreGauge({ score }: { score: number }) {
  // 0-100 → -135deg to 135deg (270deg total arc)
  const angle = -135 + (score / 100) * 270;
  return (
    <div className="flex flex-col items-center">
      <div className="gauge-container mb-2">
        <div className="ec-gauge-track" />
        <div className="ec-gauge-fill" style={{ transform: `rotate(${angle - 90}deg)` }} />
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-0">
          <span className="text-[28px] leading-9 font-bold text-app-primary">{score}</span>
          <span className="text-[12px] leading-4 font-medium text-app-on-surface-variant">
            /100
          </span>
        </div>
      </div>
      <span className="text-[14px] leading-5 font-semibold text-app-primary">
        {DASHBOARD_DATA.healthLabel}
      </span>
    </div>
  );
}

// ─── Bento Metric Card ────────────────────────────────
interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  percent?: number;
  chipLabel?: string;
  chipColor?: string;
  className?: string;
}

function MetricCard({
  icon,
  label,
  value,
  sub,
  percent,
  chipLabel,
  chipColor = 'text-app-primary',
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        'bg-app-surface-container-lowest rounded-xl p-5 soft-elevation-lg border border-app-outline-variant/30 flex flex-col justify-between',
        className
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-full bg-app-primary/10 flex items-center justify-center text-app-primary">
          {icon}
        </div>
        {chipLabel && (
          <span className={cn('text-[12px] leading-4 font-semibold', chipColor)}>{chipLabel}</span>
        )}
      </div>
      <div>
        <p className="text-[12px] leading-4 font-medium text-app-on-surface-variant mb-1">
          {label}
        </p>
        <p className="text-[28px] leading-9 font-bold text-app-on-surface">
          {value}
          {sub && (
            <span className="text-[12px] leading-4 font-medium text-app-on-surface-variant ml-1">
              {sub}
            </span>
          )}
        </p>
      </div>
      {percent !== undefined && (
        <div className="mt-3">
          <div className="h-1.5 rounded-full bg-app-surface-container overflow-hidden">
            <div
              className="h-full bg-app-primary rounded-full transition-all duration-700"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-[11px] leading-4 text-app-on-surface-variant mt-1">
            {percent}% optimal
          </p>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const criticalCount = ALERTS.filter((a) => a.severity === 'error').length;

  return (
    <div className="bg-app-surface text-app-on-surface min-h-dvh pb-24">
      <TopAppBar showNotification notificationCount={criticalCount} />

      <main className="pt-20 px-[1rem] space-y-5">
        {/* ── Hero Greeting Section ─── */}
        <section className="bg-app-surface-container-lowest rounded-2xl p-5 soft-elevation-lg border border-app-outline-variant/30 animate-fade-in">
          <div className="flex items-start justify-between gap-4">
            {/* Left: Text */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-app-primary animate-pulse" />
                <span className="text-[12px] leading-4 font-semibold text-app-primary">
                  Update: 2 mnt lalu
                </span>
              </div>
              <h2 className="text-[20px] leading-7 font-bold text-app-on-surface mb-1">
                Selamat Pagi, {DASHBOARD_DATA.userName} 👋
              </h2>
              <p className="text-[16px] leading-6 text-app-on-surface-variant">
                {DASHBOARD_DATA.subtitle}
              </p>
            </div>

            {/* Right: Health Score Gauge */}
            <HealthScoreGauge score={DASHBOARD_DATA.healthScore} />
          </div>
        </section>

        {/* ── Weather Card ─── */}
        <section className="bg-app-primary text-white rounded-2xl p-5 flex items-center justify-between soft-elevation-lg animate-fade-in">
          <div>
            <p className="text-[12px] leading-4 font-medium opacity-80 mb-1">
              Kondisi Cuaca Saat Ini
            </p>
            <h3 className="text-[20px] leading-7 font-bold mb-1">
              {DASHBOARD_DATA.weather.condition}
            </h3>
            <p className="text-[14px] leading-5 opacity-80">{DASHBOARD_DATA.weather.note}</p>
          </div>
          <div className="text-right">
            <div className="text-[40px] leading-none font-bold mb-1">
              {DASHBOARD_DATA.weather.temp}
            </div>
            <div className="flex items-center justify-end gap-1">
              <Sun size={14} className="text-yellow-300" />
              <span className="text-[12px] opacity-80">UV {DASHBOARD_DATA.weather.uvIndex}</span>
            </div>
          </div>
        </section>

        {/* ── Bento Grid Metrics ─── */}
        <div className="grid grid-cols-2 gap-4 animate-fade-in">
          <MetricCard
            icon={<Sprout size={20} />}
            label="Kesehatan Tanah"
            value={`${DASHBOARD_DATA.soil.percent}%`}
            chipLabel={DASHBOARD_DATA.soil.label}
            percent={DASHBOARD_DATA.soil.percent}
            chipColor="text-app-primary"
          />
          <MetricCard
            icon={<Droplets size={20} />}
            label="Irigasi"
            value={`${DASHBOARD_DATA.water.percent}%`}
            chipLabel={DASHBOARD_DATA.water.label}
            percent={DASHBOARD_DATA.water.percent}
            chipColor="text-app-tertiary"
          />
        </div>

        {/* ── Alert Banner ─── */}
        {criticalCount > 0 && (
          <section className="bg-app-error/5 border border-app-error/30 rounded-xl p-4 flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-3">
              <AlertTriangle size={20} className="text-app-error flex-shrink-0" />
              <div>
                <p className="text-[14px] leading-5 font-bold text-app-error">
                  {criticalCount} Peringatan Kritis
                </p>
                <p className="text-[12px] leading-4 text-app-on-surface-variant">
                  Perlu tindakan segera
                </p>
              </div>
            </div>
            <a
              href="/notifikasi"
              className="text-[12px] leading-4 font-semibold text-app-error underline underline-offset-2 cursor-pointer"
            >
              Lihat
            </a>
          </section>
        )}

        {/* ── Quick Action Cards ─── */}
        <section className="space-y-3 animate-fade-in">
          <h3 className="text-[20px] leading-7 font-bold text-app-on-surface">Ringkasan Sensor</h3>
          {[
            {
              icon: <Sprout size={18} className="text-app-primary" />,
              title: 'Tanah NPK',
              status: 'Optimal',
              sub: 'N:145 · P:42 · K:198',
              href: '/tanah',
              ok: true,
            },
            {
              icon: <Droplets size={18} className="text-app-primary" />,
              title: 'Air & Nutrisi',
              status: 'Stabil',
              sub: 'EC 1.8 · pH 6.2',
              href: '/air',
              ok: true,
            },
            {
              icon: <Thermometer size={18} className="text-app-primary" />,
              title: 'Suhu & Kelembapan',
              status: 'Baik',
              sub: '31°C · 72% RH',
              href: '#',
              ok: true,
            },
          ].map(({ icon, title, status, sub, href, ok }) => (
            <a
              key={title}
              href={href}
              className="flex items-center justify-between bg-app-surface-container-lowest rounded-xl p-4 soft-elevation border border-app-outline-variant/20 hover:bg-app-surface-container-low transition-colors active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-app-primary/10 flex items-center justify-center">
                  {icon}
                </div>
                <div>
                  <p className="text-[14px] leading-5 font-bold text-app-on-surface">{title}</p>
                  <p className="text-[12px] leading-4 text-app-on-surface-variant">{sub}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {ok ? (
                  <CheckCircle size={18} className="text-app-primary" />
                ) : (
                  <AlertTriangle size={18} className="text-app-error" />
                )}
                <span
                  className={cn(
                    'text-[12px] leading-4 font-semibold',
                    ok ? 'text-app-primary' : 'text-app-error'
                  )}
                >
                  {status}
                </span>
              </div>
            </a>
          ))}
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
