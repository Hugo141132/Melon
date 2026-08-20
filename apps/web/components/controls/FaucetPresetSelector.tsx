'use client';

import React, { useState } from 'react';
import {
  Droplets,
  AlertCircle,
  ShieldAlert,
  WifiOff,
  Loader2,
  Sparkles,
  Plus,
  Minus,
  Power,
  PowerOff,
  Activity,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { AuthorisedDevice } from '@/context/DeviceContext';

export interface FaucetPreset {
  phase: 1 | 2 | 3;
  labelKey: 'phase1' | 'phase2' | 'phase3';
  descKey: 'phase1Desc' | 'phase2Desc' | 'phase3Desc';
  volumeL: number;
  volumeMl: number;
}

export const FAUCET_PRESETS: FaucetPreset[] = [
  {
    phase: 1,
    labelKey: 'phase1',
    descKey: 'phase1Desc',
    volumeL: 0.3,
    volumeMl: 300,
  },
  {
    phase: 2,
    labelKey: 'phase2',
    descKey: 'phase2Desc',
    volumeL: 1.0,
    volumeMl: 1000,
  },
  {
    phase: 3,
    labelKey: 'phase3',
    descKey: 'phase3Desc',
    volumeL: 1.5,
    volumeMl: 1500,
  },
];

export type AuthoritativePhysicalState = 'OPEN' | 'CLOSED' | 'UNKNOWN';

export interface FaucetPresetSelectorProps {
  selectedDevice: AuthorisedDevice | null;
  hasControlPermission?: boolean;
  isFeatureEnabled?: boolean;
  activeCommand?: {
    id: string;
    commandId: string;
    status: string;
    action?: string;
    phase?: number | null;
    plantCount?: number | null;
    targetVolumeMl?: number | null;
  } | null;
  physicalState?: AuthoritativePhysicalState;
  plantCount?: number;
  onPlantCountChange?: (count: number) => void;
  onSelectPreset: (
    phase: 1 | 2 | 3,
    volumeL: number,
    plantCount: number,
    totalVolumeL: number
  ) => void;
  onSelectManualAction?: (action: 'OPEN' | 'CLOSE') => void;
  className?: string;
}

export function formatLitersDisplay(liters: number): string {
  if (Number.isInteger(liters)) {
    return liters.toString();
  }
  return parseFloat(liters.toFixed(2)).toString();
}

export default function FaucetPresetSelector({
  selectedDevice,
  hasControlPermission = true,
  isFeatureEnabled = true,
  activeCommand = null,
  physicalState = 'UNKNOWN',
  plantCount: controlledPlantCount,
  onPlantCountChange,
  onSelectPreset,
  onSelectManualAction,
  className,
}: FaucetPresetSelectorProps) {
  const tFaucet = useTranslations('faucet');

  // Local state for plant count if not controlled from parent
  const [internalPlantCount, setInternalPlantCount] = useState<number>(1);
  const plantCount = controlledPlantCount !== undefined ? controlledPlantCount : internalPlantCount;

  const updatePlantCount = (val: number) => {
    const valid = Math.max(1, Math.floor(isNaN(val) ? 1 : val));
    if (onPlantCountChange) {
      onPlantCountChange(valid);
    } else {
      setInternalPlantCount(valid);
    }
  };

  const handleIncrement = () => {
    updatePlantCount(plantCount + 1);
  };

  const handleDecrement = () => {
    if (plantCount > 1) {
      updatePlantCount(plantCount - 1);
    }
  };

  // Determine disabled reason if controls cannot be used
  const getDisabledReason = (): string | null => {
    if (!isFeatureEnabled) {
      return tFaucet('featureDisabledNotice');
    }
    if (!selectedDevice) {
      return tFaucet('selectTankPrompt');
    }
    if (!hasControlPermission) {
      return tFaucet('noControlPermission');
    }
    if (selectedDevice.connectionStatus === 'OFFLINE') {
      return tFaucet('deviceOfflineNotice', { deviceName: selectedDevice.deviceName });
    }
    if (selectedDevice.connectionStatus === 'INACTIVE') {
      return tFaucet('deviceInactiveNotice', { deviceName: selectedDevice.deviceName });
    }
    const isWaterTankNode = selectedDevice.deviceType === 'WATER_TANK_NODE';
    const hasControlCap = selectedDevice.permissions?.canControl ?? isWaterTankNode;
    if (!hasControlCap && !isWaterTankNode) {
      return tFaucet('notSupportedControl', {
        deviceName: selectedDevice.deviceName,
        deviceType: selectedDevice.deviceType,
      });
    }
    if (
      activeCommand &&
      ['QUEUED', 'SENT', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(activeCommand.status)
    ) {
      const displayVol = activeCommand.targetVolumeMl
        ? `${formatLitersDisplay(activeCommand.targetVolumeMl / 1000)} L`
        : activeCommand.action || '';
      return tFaucet('commandActiveNotice', {
        volume: displayVol,
        status: activeCommand.status,
      });
    }
    return null;
  };

  const disabledReason = getDisabledReason();
  const isDisabled = disabledReason !== null;

  return (
    <div className={cn('space-y-6', className)} data-testid="faucet-preset-selector">
      {/* Header & Device Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-[18px] font-bold text-app-primary flex items-center gap-2">
            <Droplets className="text-app-primary" size={20} />
            <span>{tFaucet('presetTitle')}</span>
          </h2>
          <p className="text-[13px] text-app-on-surface-variant">{tFaucet('presetSubtitle')}</p>
        </div>

        {selectedDevice && (
          <div className="flex items-center gap-2 self-start sm:self-auto bg-app-surface-container px-3 py-1.5 rounded-xl border border-app-outline-variant/30 text-xs">
            <span
              className={cn(
                'w-2 h-2 rounded-full',
                selectedDevice.connectionStatus === 'ONLINE'
                  ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)] animate-pulse'
                  : 'bg-amber-500'
              )}
            />
            <span className="font-semibold text-app-on-surface">{selectedDevice.deviceName}</span>
            <span className="text-[10px] text-app-on-surface-variant font-mono">
              ({selectedDevice.connectionStatus})
            </span>
          </div>
        )}
      </div>

      {/* Disabled Warning Banner if controls are restricted */}
      {isDisabled && (
        <div
          className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3 text-xs leading-relaxed animate-fade-in"
          data-testid="faucet-disabled-banner"
        >
          {!hasControlPermission ? (
            <ShieldAlert size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          ) : selectedDevice?.connectionStatus === 'OFFLINE' ? (
            <WifiOff size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          ) : activeCommand ? (
            <Loader2 size={18} className="text-amber-600 flex-shrink-0 mt-0.5 animate-spin" />
          ) : (
            <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <span className="font-bold block mb-0.5">{tFaucet('disabledNoticeTitle')}</span>
            <span>{disabledReason}</span>
          </div>
        </div>
      )}

      {/* Plant Count Stepper Control */}
      <div
        className="bg-app-surface-container/30 p-4 rounded-2xl border border-app-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        data-testid="plant-count-control"
      >
        <div>
          <label
            htmlFor="plant-count-input"
            className="text-[14px] font-bold text-app-on-surface block"
          >
            {tFaucet('plantCount')}
          </label>
          <p className="text-[12px] text-app-on-surface-variant">
            {tFaucet('liveCalculationPreview', {
              perPlant: '0.3',
              count: plantCount,
              total: formatLitersDisplay(0.3 * plantCount),
            })}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            disabled={isDisabled || plantCount <= 1}
            onClick={handleDecrement}
            className="w-9 h-9 rounded-xl border border-app-outline-variant/40 bg-app-surface-container-lowest hover:bg-app-surface-container text-app-on-surface flex items-center justify-center transition-colors disabled:opacity-40 cursor-pointer active:scale-95"
            aria-label="Kurangi jumlah tanaman"
            data-testid="btn-decrement-plant"
          >
            <Minus size={16} />
          </button>

          <div className="relative">
            <input
              id="plant-count-input"
              type="number"
              min={1}
              step={1}
              value={plantCount}
              disabled={isDisabled}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                updatePlantCount(isNaN(val) ? 1 : val);
              }}
              className="w-20 text-center py-1.5 px-2 bg-app-surface-container-lowest border border-app-outline-variant/40 rounded-xl text-sm font-bold text-app-on-surface focus:outline-none focus:border-app-primary disabled:opacity-50"
              data-testid="input-plant-count"
            />
          </div>

          <button
            type="button"
            disabled={isDisabled}
            onClick={handleIncrement}
            className="w-9 h-9 rounded-xl border border-app-outline-variant/40 bg-app-surface-container-lowest hover:bg-app-surface-container text-app-on-surface flex items-center justify-center transition-colors disabled:opacity-40 cursor-pointer active:scale-95"
            aria-label="Tambah jumlah tanaman"
            data-testid="btn-increment-plant"
          >
            <Plus size={16} />
          </button>
          <span className="text-xs text-app-on-surface-variant font-medium ml-1">
            {tFaucet('plantCountUnit')}
          </span>
        </div>
      </div>

      {/* Preset Cards Grid (Liters per Plant) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {FAUCET_PRESETS.map((preset) => {
          const totalLiters = preset.volumeL * plantCount;
          const formattedTotal = formatLitersDisplay(totalLiters);

          return (
            <div
              key={preset.phase}
              className={cn(
                'bg-app-surface-container-lowest p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between space-y-4 shadow-sm relative overflow-hidden group',
                isDisabled
                  ? 'opacity-60 border-app-outline-variant/30 grayscale-[20%]'
                  : 'border-app-outline-variant/40 hover:border-app-primary/60 hover:-translate-y-1 hover:shadow-md cursor-pointer'
              )}
              data-testid={`preset-card-phase-${preset.phase}`}
            >
              {/* Top Row: Phase label & badge */}
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-lg bg-app-primary/10 text-app-primary border border-app-primary/20">
                  {tFaucet(preset.labelKey)}
                </span>
                <Sparkles
                  size={16}
                  className="text-app-primary/40 group-hover:text-app-primary transition-colors"
                />
              </div>

              {/* Volume Display in Liters per plant */}
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[32px] font-extrabold text-app-on-surface tracking-tight leading-none">
                    {preset.volumeL}
                  </span>
                  <span className="text-[14px] font-semibold text-app-primary">
                    {tFaucet('perPlantUnit')}
                  </span>
                </div>
                <p className="text-[12px] text-app-on-surface-variant mt-2 leading-snug">
                  {tFaucet(preset.descKey)}
                </p>

                {/* Calculation preview badge */}
                <div className="mt-3 p-2 rounded-xl bg-app-surface-container/40 border border-app-outline-variant/15 text-[11px] text-app-on-surface flex items-center justify-between font-mono">
                  <span className="text-app-on-surface-variant">
                    {preset.volumeL} L × {plantCount} {tFaucet('plantCountUnit')}:
                  </span>
                  <span className="font-bold text-app-primary">{formattedTotal} L</span>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                disabled={isDisabled}
                onClick={() =>
                  !isDisabled &&
                  onSelectPreset(preset.phase, preset.volumeL, plantCount, totalLiters)
                }
                className={cn(
                  'w-full py-2.5 px-4 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95',
                  isDisabled
                    ? 'bg-app-surface-container text-app-on-surface-variant/50 cursor-not-allowed'
                    : 'bg-app-primary text-white hover:bg-app-primary-container shadow-xs'
                )}
                data-testid={`btn-select-phase-${preset.phase}`}
              >
                <Droplets size={15} />
                <span>{tFaucet('sendDispenseCommand', { total: formattedTotal })}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Manual Valve Controls & Authoritative Physical State */}
      <div
        className="bg-app-surface-container/20 p-5 rounded-2xl border border-app-outline-variant/30 space-y-4"
        data-testid="manual-faucet-control-section"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-bold text-app-on-surface flex items-center gap-2">
              <Activity size={18} className="text-app-primary" />
              <span>{tFaucet('manualControlTitle')}</span>
            </h3>
            <p className="text-[12px] text-app-on-surface-variant">
              {tFaucet('manualControlSubtitle')}
            </p>
          </div>

          {/* Authoritative Physical Faucet State Badge */}
          <div
            className={cn(
              'px-3.5 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-bold self-start sm:self-auto shadow-xs',
              physicalState === 'OPEN' && 'bg-emerald-50 text-emerald-800 border-emerald-300',
              physicalState === 'CLOSED' && 'bg-slate-100 text-slate-800 border-slate-300',
              physicalState === 'UNKNOWN' && 'bg-amber-50 text-amber-900 border-amber-300'
            )}
            data-testid="authoritative-physical-state"
          >
            <span
              className={cn(
                'w-2 h-2 rounded-full',
                physicalState === 'OPEN' && 'bg-emerald-500 animate-pulse',
                physicalState === 'CLOSED' && 'bg-slate-500',
                physicalState === 'UNKNOWN' && 'bg-amber-500'
              )}
            />
            <span>
              {tFaucet('physicalStateTitle')}:{' '}
              {physicalState === 'OPEN'
                ? tFaucet('physicalStateOpen')
                : physicalState === 'CLOSED'
                  ? tFaucet('physicalStateClosed')
                  : tFaucet('physicalStateUnknown')}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            disabled={isDisabled}
            onClick={() => !isDisabled && onSelectManualAction && onSelectManualAction('OPEN')}
            className={cn(
              'py-2.5 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 border',
              isDisabled
                ? 'bg-app-surface-container text-app-on-surface-variant/50 border-app-outline-variant/20 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 shadow-xs'
            )}
            data-testid="btn-manual-open"
          >
            <Power size={15} />
            <span>{tFaucet('openValve')}</span>
          </button>

          <button
            type="button"
            disabled={isDisabled}
            onClick={() => !isDisabled && onSelectManualAction && onSelectManualAction('CLOSE')}
            className={cn(
              'py-2.5 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 border',
              isDisabled
                ? 'bg-app-surface-container text-app-on-surface-variant/50 border-app-outline-variant/20 cursor-not-allowed'
                : 'bg-slate-700 hover:bg-slate-800 text-white border-slate-800 shadow-xs'
            )}
            data-testid="btn-manual-close"
          >
            <PowerOff size={15} />
            <span>{tFaucet('closeValve')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
