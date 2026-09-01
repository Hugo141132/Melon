'use client';

import React, { useState, useEffect } from 'react';
import { X, Droplets, AlertTriangle, Loader2, CheckCircle2, Power, PowerOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AuthorisedDevice } from '@/context/DeviceContext';
import { formatLitersDisplay } from './FaucetPresetSelector';

export interface FaucetConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDevice: AuthorisedDevice | null;
  action?: 'DISPENSE' | 'OPEN' | 'CLOSE';
  phase?: 1 | 2 | 3 | null;
  volumeL?: number | null;
  volumeMl?: number | null;
  plantCount?: number;
  totalVolumeL?: number | null;
  onConfirm: (
    actionOrPhase: 'DISPENSE' | 'OPEN' | 'CLOSE' | 1 | 2 | 3,
    idempotencyKey: string,
    plantCount?: number
  ) => Promise<void>;
  isSubmitting?: boolean;
  errorMsg?: string | null;
}

export default function FaucetConfirmationModal({
  isOpen,
  onClose,
  selectedDevice,
  action = 'DISPENSE',
  phase = null,
  volumeL = null,
  volumeMl = null,
  plantCount = 1,
  totalVolumeL = null,
  onConfirm,
  isSubmitting = false,
  errorMsg = null,
}: FaucetConfirmationModalProps) {
  const tFaucet = useTranslations('faucet');
  const tDevices = useTranslations('devices');
  const tCommon = useTranslations('common');

  const [customKey, setCustomKey] = useState('');

  // Generate fresh idempotency key when modal opens
  useEffect(() => {
    if (isOpen) {
      setCustomKey(`cmd-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);
    }
  }, [isOpen]);

  if (!isOpen || !selectedDevice) {
    return null;
  }

  // Calculate volume figures if action is DISPENSE
  const effectiveVolumeL =
    volumeL ??
    (volumeMl ? volumeMl / 1000 : phase === 1 ? 0.3 : phase === 2 ? 1.0 : phase === 3 ? 1.5 : 0.3);
  const effectiveTotalL = totalVolumeL ?? effectiveVolumeL * plantCount;
  const formattedTotalL = formatLitersDisplay(effectiveTotalL);
  const formattedVolumeL = formatLitersDisplay(effectiveVolumeL);

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalKey = customKey.trim() || `cmd-${Date.now()}`;
    if (action === 'DISPENSE' && phase) {
      await onConfirm(phase, finalKey, plantCount);
    } else {
      await onConfirm(action, finalKey);
    }
  };

  const isDispense = action === 'DISPENSE';
  const isOpenAction = action === 'OPEN';
  const isCloseAction = action === 'CLOSE';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
      data-testid="faucet-confirmation-modal"
    >
      <div className="bg-app-surface-container-lowest rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-app-outline-variant/30 animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-app-outline-variant/20 pb-3">
          <div className="flex items-center gap-2 text-app-primary">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isOpenAction
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : isCloseAction
                    ? 'bg-slate-500/10 text-slate-700'
                    : 'bg-app-primary/10 text-app-primary'
              }`}
            >
              {isOpenAction ? (
                <Power size={20} />
              ) : isCloseAction ? (
                <PowerOff size={20} />
              ) : (
                <Droplets size={20} />
              )}
            </div>
            <div>
              <h3 className="text-[17px] font-bold text-app-on-surface">
                {isOpenAction
                  ? tFaucet('confirmOpenTitle')
                  : isCloseAction
                    ? tFaucet('confirmCloseTitle')
                    : tFaucet('confirmDispenseTitle')}
              </h3>
              <p className="text-[11px] text-app-on-surface-variant">
                {tFaucet('physicalActionNote')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-app-outline hover:text-app-on-surface p-1 rounded-lg transition-colors cursor-pointer"
            aria-label={tCommon('close')}
          >
            <X size={20} />
          </button>
        </div>

        {/* Error Notice */}
        {errorMsg && (
          <div
            className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5 text-xs animate-fade-in"
            data-testid="faucet-modal-error"
          >
            <AlertTriangle size={16} className="text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">{errorMsg}</div>
          </div>
        )}

        {/* Primary Confirmation Prompt */}
        <div
          className={`p-4 rounded-xl border space-y-3 ${
            isOpenAction
              ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
              : isCloseAction
                ? 'bg-slate-50/70 border-slate-200 text-slate-950'
                : 'bg-app-primary/5 border-app-primary/20 text-app-on-surface'
          }`}
        >
          <p className="text-[14px] font-bold leading-snug">
            {isOpenAction
              ? tFaucet('confirmOpenPrompt', { deviceName: selectedDevice.deviceName })
              : isCloseAction
                ? tFaucet('confirmClosePrompt', { deviceName: selectedDevice.deviceName })
                : tFaucet('confirmDispensePrompt', {
                    total: formattedTotalL,
                    deviceName: selectedDevice.deviceName,
                  })}
          </p>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-app-outline-variant/15 text-xs">
            {isDispense && phase ? (
              <>
                <div>
                  <span className="text-app-on-surface-variant block text-[10px] uppercase font-bold">
                    {tFaucet('preset')}:
                  </span>
                  <span className="font-bold text-app-primary">
                    Fase {phase} ({formattedVolumeL} L / {tFaucet('plantCountUnit')})
                  </span>
                </div>

                <div>
                  <span className="text-app-on-surface-variant block text-[10px] uppercase font-bold">
                    {tFaucet('plantCount')}:
                  </span>
                  <span className="font-bold text-app-on-surface">
                    {plantCount} {tFaucet('plantCountUnit')}
                  </span>
                </div>

                <div className="col-span-2 pt-1 border-t border-app-outline-variant/10 flex items-center justify-between">
                  <span className="text-app-on-surface-variant text-[11px] font-bold uppercase">
                    {tFaucet('totalWater')}:
                  </span>
                  <span className="text-[16px] font-extrabold text-app-primary font-mono">
                    {formattedTotalL} L
                  </span>
                </div>
              </>
            ) : (
              <div className="col-span-2">
                <span className="text-app-on-surface-variant block text-[10px] uppercase font-bold">
                  {tFaucet('actionHeader')}:
                </span>
                <span className="font-bold text-app-on-surface">
                  {isOpenAction ? tFaucet('commandActionOpen') : tFaucet('commandActionClose')}
                </span>
              </div>
            )}

            <div className="col-span-2 pt-1 flex items-center gap-1.5 text-[11px]">
              <span className="text-app-on-surface-variant font-bold">
                {tDevices('connectionStatus')}:
              </span>
              <span
                className={`inline-flex items-center gap-1 font-semibold ${
                  selectedDevice.connectionStatus === 'ONLINE'
                    ? 'text-emerald-600'
                    : 'text-amber-600'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    selectedDevice.connectionStatus === 'ONLINE'
                      ? 'bg-emerald-500 animate-pulse'
                      : 'bg-amber-500'
                  }`}
                />
                {selectedDevice.connectionStatus}
              </span>
            </div>
          </div>
        </div>

        {/* Submit Form */}
        <form onSubmit={handleConfirmSubmit} className="space-y-4">
          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-app-outline-variant/20">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-app-on-surface-variant hover:bg-app-surface-container transition-colors disabled:opacity-50 cursor-pointer"
            >
              {tCommon('cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-sm cursor-pointer active:scale-95 disabled:opacity-50 ${
                isOpenAction
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : isCloseAction
                    ? 'bg-slate-700 hover:bg-slate-800'
                    : 'bg-app-primary hover:bg-app-primary-container'
              }`}
              data-testid="btn-confirm-dispense"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{tCommon('processing')}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>
                    {isOpenAction
                      ? tFaucet('sendOpenCommand')
                      : isCloseAction
                        ? tFaucet('sendCloseCommand')
                        : tFaucet('sendDispenseCommand', { total: formattedTotalL })}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
