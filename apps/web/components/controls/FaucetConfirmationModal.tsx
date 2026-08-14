'use client';

import React, { useState, useEffect } from 'react';
import { X, Droplets, AlertTriangle, Loader2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AuthorisedDevice } from '@/context/DeviceContext';

export interface FaucetConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDevice: AuthorisedDevice | null;
  phase: 1 | 2 | 3 | null;
  volumeMl: number | null;
  onConfirm: (phase: 1 | 2 | 3, idempotencyKey: string) => Promise<void>;
  isSubmitting?: boolean;
  errorMsg?: string | null;
}

export default function FaucetConfirmationModal({
  isOpen,
  onClose,
  selectedDevice,
  phase,
  volumeMl,
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

  if (!isOpen || !selectedDevice || !phase || !volumeMl) {
    return null;
  }

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalKey = customKey.trim() || `cmd-${Date.now()}`;
    await onConfirm(phase, finalKey);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
      data-testid="faucet-confirmation-modal"
    >
      <div className="bg-app-surface-container-lowest rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-app-outline-variant/30 animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-app-outline-variant/20 pb-3">
          <div className="flex items-center gap-2 text-app-primary">
            <div className="w-9 h-9 rounded-xl bg-app-primary/10 flex items-center justify-center">
              <Droplets size={20} />
            </div>
            <div>
              <h3 className="text-[17px] font-bold text-app-primary">{tFaucet('confirmTitle')}</h3>
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
        <div className="p-4 bg-app-primary/5 rounded-xl border border-app-primary/20 space-y-3">
          <p className="text-[14px] font-bold text-app-on-surface leading-snug">
            {tFaucet('confirmPrompt', {
              volume: volumeMl.toLocaleString('id-ID'),
              deviceName: selectedDevice.deviceName,
            })}
          </p>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-app-primary/10 text-xs">
            <div>
              <span className="text-app-on-surface-variant block text-[10px] uppercase font-bold">
                {tDevices('deviceName')}:
              </span>
              <span className="font-semibold text-app-on-surface truncate block">
                {selectedDevice.deviceName}
              </span>
            </div>

            <div>
              <span className="text-app-on-surface-variant block text-[10px] uppercase font-bold">
                {tDevices('siteLocation')}:
              </span>
              <span className="font-semibold text-app-on-surface">
                {selectedDevice.siteName || tDevices('mainSiteDefault')}
              </span>
            </div>

            <div>
              <span className="text-app-on-surface-variant block text-[10px] uppercase font-bold">
                {tFaucet('preset')}:
              </span>
              <span className="font-bold text-app-primary">
                {tFaucet('phaseVolumeLabel', { phase, volume: volumeMl })}
              </span>
            </div>

            <div>
              <span className="text-app-on-surface-variant block text-[10px] uppercase font-bold">
                {tDevices('connectionStatus')}:
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {selectedDevice.connectionStatus}
              </span>
            </div>
          </div>
        </div>

        {/* Safety Note & Idempotency Key */}
        <form onSubmit={handleConfirmSubmit} className="space-y-4">
          <div className="p-3 bg-app-surface-container rounded-xl text-[11px] text-app-on-surface-variant space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-app-on-surface">
              <ShieldCheck size={14} className="text-app-primary" />
              <span>{tFaucet('automaticSafetyTitle')}</span>
            </div>
            <p>{tFaucet('automaticSafetyDesc')}</p>
          </div>

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
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-app-primary text-white hover:bg-app-primary-container disabled:opacity-50 transition-all shadow-sm cursor-pointer active:scale-95"
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
                  <span>{tFaucet('sendBatchCommand', { volume: volumeMl })}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
