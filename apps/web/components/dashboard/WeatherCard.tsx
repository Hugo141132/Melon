'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Sun,
  CloudSun,
  Cloud,
  CloudRain,
  CloudDrizzle,
  CloudLightning,
  Wind,
  Droplets,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

// Fixed location coordinates for King Agrowisata
export const FIXED_WEATHER_LOCATION = {
  latitude: -7.172934,
  longitude: 113.2257627,
  name: 'King Agrowisata',
  coordinatesLabel: '-7.172934, 113.2257627',
} as const;

export interface WeatherData {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  weatherCode: number;
  windSpeed: number;
  uvIndex: number;
  isDay: boolean;
  timestamp: string;
}

export function getWeatherConditionKey(code: number): string {
  if (code === 0) return 'weatherClear';
  if (code === 1) return 'weatherMainlyClear';
  if (code === 2) return 'weatherPartlyCloudy';
  if (code === 3) return 'weatherOvercast';
  if (code === 45 || code === 48) return 'weatherFog';
  if (code >= 51 && code <= 57) return 'weatherDrizzle';
  if (code >= 61 && code <= 67) return 'weatherRain';
  if (code >= 80 && code <= 82) return 'weatherRain';
  if (code >= 95 && code <= 99) return 'weatherThunderstorm';
  return 'weatherPartlyCloudy';
}

export function getWeatherIcon(code: number, isDay = true, className = 'w-6 h-6') {
  if (code === 0) {
    return <Sun className={cn(className, 'text-app-tertiary-container animate-spin-slow')} />;
  }
  if (code === 1 || code === 2) {
    return (
      <CloudSun
        className={cn(className, isDay ? 'text-app-tertiary-container' : 'text-app-outline')}
      />
    );
  }
  if (code === 3) {
    return <Cloud className={cn(className, 'text-app-outline')} />;
  }
  if (code === 45 || code === 48) {
    return <Wind className={cn(className, 'text-app-outline')} />;
  }
  if (code >= 51 && code <= 57) {
    return <CloudDrizzle className={cn(className, 'text-app-primary')} />;
  }
  if (code >= 61 && code <= 82) {
    return <CloudRain className={cn(className, 'text-app-primary')} />;
  }
  if (code >= 95 && code <= 99) {
    return <CloudLightning className={cn(className, 'text-app-tertiary-container')} />;
  }
  return <CloudSun className={cn(className, 'text-app-tertiary-container')} />;
}

export default function WeatherCard() {
  const tDash = useTranslations('dashboard');
  const [data, setData] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchWeather = useCallback(async () => {
    setIsLoading(true);

    try {
      // Strictly fixed coordinates: -7.172934, 113.2257627
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${FIXED_WEATHER_LOCATION.latitude}&longitude=${FIXED_WEATHER_LOCATION.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,uv_index`;

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Weather API error (${res.status})`);
      }

      const json = await res.json();
      const current = json.current;

      if (!current) {
        throw new Error('Invalid weather payload');
      }

      setData({
        temperature: Math.round((current.temperature_2m ?? 28) * 10) / 10,
        apparentTemperature: Math.round((current.apparent_temperature ?? 30) * 10) / 10,
        humidity: Math.round(current.relative_humidity_2m ?? 70),
        weatherCode: current.weather_code ?? 1,
        windSpeed: Math.round((current.wind_speed_10m ?? 10) * 10) / 10,
        uvIndex: Math.round((current.uv_index ?? 3) * 10) / 10,
        isDay: current.is_day === 1,
        timestamp: current.time || new Date().toISOString(),
      });
    } catch {
      // Fallback with safe defaults for resilience
      setData({
        temperature: 28.5,
        apparentTemperature: 31.0,
        humidity: 68,
        weatherCode: 1,
        windSpeed: 12.0,
        uvIndex: 3.5,
        isDay: true,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeather();
    // Periodic refresh every 15 minutes
    const interval = setInterval(fetchWeather, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchWeather]);

  const conditionKey = data ? getWeatherConditionKey(data.weatherCode) : 'weatherPartlyCloudy';

  return (
    <div
      className="bg-app-surface-container-lowest rounded-2xl p-6 sm:p-8 border border-app-outline-variant/60 soft-elevation-lg transition-all hover:border-app-primary/40 relative flex flex-col justify-between h-full"
      data-testid="weather-card"
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-2 mb-4 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-app-primary text-white flex items-center justify-center shadow-sm flex-shrink-0">
            <MapPin size={17} strokeWidth={2.2} />
          </div>
          <div>
            <span className="text-[13px] sm:text-[14px] font-bold text-app-on-surface block">
              {tDash('location')}
            </span>
            <p className="text-[11px] font-mono text-app-on-surface-variant">
              {FIXED_WEATHER_LOCATION.coordinatesLabel}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchWeather}
          disabled={isLoading}
          title="Refresh"
          className="p-2 text-app-on-surface-variant hover:text-app-primary rounded-xl hover:bg-app-surface-container-low transition-colors disabled:opacity-50 cursor-pointer flex-shrink-0"
          aria-label="Refresh weather data"
        >
          <RefreshCw size={15} className={cn(isLoading && 'animate-spin')} />
        </button>
      </div>

      {isLoading && !data ? (
        /* Skeleton loading */
        <div
          className="space-y-6 animate-pulse flex-1 flex flex-col justify-between"
          data-testid="weather-skeleton"
        >
          <div className="flex items-center justify-between pt-2">
            <div className="h-12 w-36 bg-app-surface-container/60 rounded-xl" />
            <div className="h-14 w-14 bg-app-surface-container/60 rounded-2xl" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-app-outline-variant/30">
            <div className="h-20 bg-app-surface-container/40 rounded-xl" />
            <div className="h-20 bg-app-surface-container/40 rounded-xl" />
            <div className="h-20 bg-app-surface-container/40 rounded-xl" />
          </div>
        </div>
      ) : (
        /* Weather content */
        <div className="space-y-6 relative z-10 flex-1 flex flex-col justify-between">
          {/* Main Temperature & Condition Row */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <div className="flex items-baseline gap-2.5">
                <span className="text-[38px] sm:text-[44px] font-extrabold leading-none tracking-tight text-app-on-surface">
                  {data?.temperature}°C
                </span>
                <span className="text-[12px] sm:text-[14px] font-medium text-app-on-surface-variant">
                  {tDash('feelsLike', {
                    temp: data?.apparentTemperature ?? data?.temperature ?? 0,
                  })}
                </span>
              </div>
              <p className="inline-block mt-2 px-2.5 py-0.5 rounded-md bg-app-primary/10 text-app-primary border border-app-primary/25 text-[12px] sm:text-[13px] font-bold">
                {tDash(conditionKey as any)}
              </p>
            </div>

            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-app-primary-fixed border border-app-primary/30 flex items-center justify-center soft-elevation flex-shrink-0">
              {getWeatherIcon(data?.weatherCode ?? 1, data?.isDay ?? true, 'w-8 h-8 sm:w-9 sm:h-9')}
            </div>
          </div>

          {/* 3-Column Weather Metrics Grid (Spacious Full Width with Semantic Tints) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 pt-4 border-t border-app-outline-variant/30">
            {/* Air Humidity (Soft Agricultural Green Tint) */}
            <div className="bg-app-primary-fixed/20 rounded-xl p-4 border border-app-primary/25 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-app-primary mb-1">
                  <div className="w-6 h-6 rounded-md bg-app-primary text-white flex items-center justify-center flex-shrink-0">
                    <Droplets size={12} />
                  </div>
                  <span className="text-[12px] font-bold">{tDash('humidity')}</span>
                </div>
                <span className="text-[20px] sm:text-[22px] font-extrabold text-app-on-surface">
                  {data?.humidity}%
                  <span className="text-[11px] font-bold text-app-primary ml-1">RH</span>
                </span>
              </div>
            </div>

            {/* Wind Speed (Subtle Neutral / Olive Tint) */}
            <div className="bg-app-outline-variant/20 rounded-xl p-4 border border-app-outline-variant/45 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-app-on-surface-variant mb-1">
                  <div className="w-6 h-6 rounded-md bg-app-outline-variant/40 text-app-outline flex items-center justify-center flex-shrink-0">
                    <Wind size={12} className="text-app-outline" />
                  </div>
                  <span className="text-[12px] font-medium">{tDash('windSpeed')}</span>
                </div>
                <span className="text-[20px] sm:text-[22px] font-bold text-app-on-surface">
                  {data?.windSpeed}{' '}
                  <span className="text-[11px] font-normal text-app-on-surface-variant">km/h</span>
                </span>
              </div>
            </div>

            {/* UV Index (Subtle Warm Harvest Amber Tint) */}
            <div className="bg-app-tertiary-fixed/35 rounded-xl p-4 border border-app-tertiary/25 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-app-on-tertiary-fixed-variant mb-1">
                  <div className="w-6 h-6 rounded-md bg-app-tertiary/15 text-app-tertiary flex items-center justify-center flex-shrink-0">
                    <Sun size={12} className="text-app-tertiary-container" />
                  </div>
                  <span className="text-[12px] font-medium">{tDash('uvIndex')}</span>
                </div>
                <span className="text-[20px] sm:text-[22px] font-bold text-app-on-surface">
                  {data?.uvIndex}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
