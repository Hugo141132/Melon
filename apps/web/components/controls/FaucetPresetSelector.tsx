'use client';

import React from 'react';
import { Droplets, AlertCircle, ShieldAlert, WifiOff, Loader2, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { AuthorisedDevice } from '@/context/DeviceContext';

export interface FaucetPreset {
  phase: 1 | 2 | 3;
  labelKey: 'phase1' | 'phase2' | 'phase3';
  descKey: 'phase1Desc' | 'phase2Desc' | 'phase3Desc';
  volumeMl: number;
}

export const FAUCET_PRESETS: FaucetPreset[] = [
  {
    phase: 1,
    labelKey: 'phase1',
    descKey: 'phase1Desc',
    volumeMl: 300,
  },
  {
    phase: 2,
    labelKey: 'phase2',
    descKey: 'phase2Desc',
    volumeMl: 1000,
  },
  {
    phase: 3,
    labelKey: 'phase3',
    descKey: 'phase3Desc',
    volumeMl: 1500,
  },
];

export interface FaucetPresetSelectorProps {
  selectedDevice: AuthorisedDevice | null;
  hasControlPermission?: boolean;
  isFeatureEnabled?: boolean;
  activeCommand?: {
    id: string;
    commandId: string;
    status: string;
    phase: number;
    targetVolumeMl: number;
  } | null;
  onSelectPreset: (phase: 1 | 2 | 3, volumeMl: number) => void;
  className?: string;
}

export default function FaucetPresetSelector({
  selectedDevice,
  hasControlPermission = true,
  isFeatureEnabled = true,
  activeCommand = null,
  onSelectPreset,
  className,
}: FaucetPresetSelectorProps) {
  const tFaucet = useTranslations('faucet');

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
      return tFaucet('commandActiveNotice', {
        volume: activeCommand.targetVolumeMl,
        status: activeCommand.status,
      });
    }
    return null;
  };

  const disabledReason = getDisabledReason();
  const isDisabled = disabledReason !== null;

  return (
    <div className={cn('space-y-4', className)} data-testid="faucet-preset-selector">
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

      {/* Preset Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {FAUCET_PRESETS.map((preset) => {
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

              {/* Volume Display (PROMINENT) */}
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[32px] font-extrabold text-app-on-surface tracking-tight leading-none">
                    {preset.volumeMl.toLocaleString('id-ID')}
                  </span>
                  <span className="text-[16px] font-semibold text-app-primary">mL</span>
                </div>
                <p className="text-[12px] text-app-on-surface-variant mt-2 leading-snug">
                  {tFaucet(preset.descKey)}
                </p>
              </div>

              {/* Action Button */}
              <button
                type="button"
                disabled={isDisabled}
                onClick={() => !isDisabled && onSelectPreset(preset.phase, preset.volumeMl)}
                className={cn(
                  'w-full py-2.5 px-4 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95',
                  isDisabled
                    ? 'bg-app-surface-container text-app-on-surface-variant/50 cursor-not-allowed'
                    : 'bg-app-primary text-white hover:bg-app-primary-container shadow-xs'
                )}
                data-testid={`btn-select-phase-${preset.phase}`}
              >
                <Droplets size={15} />
                <span>{tFaucet('selectVolume', { volume: preset.volumeMl })}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
