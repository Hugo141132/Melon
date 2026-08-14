'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useDeviceContext } from '@/context/DeviceContext';
import FaucetPresetSelector from './FaucetPresetSelector';
import FaucetConfirmationModal from './FaucetConfirmationModal';
import FaucetStatusCard, { FaucetCommandDto, ACTIVE_COMMAND_STATUSES } from './FaucetStatusCard';
import FaucetHistoryTable from './FaucetHistoryTable';
import { Cpu } from 'lucide-react';

import { useTranslations } from 'next-intl';

export default function FaucetControlPanel() {
  const tFaucet = useTranslations('faucet');
  const tDevices = useTranslations('devices');
  const tCommon = useTranslations('common');
  const { selectedDevice } = useDeviceContext();

  // Permissions & Auth state
  const [hasControlPermission, setHasControlPermission] = useState<boolean>(true);
  const isFeatureEnabled = true;

  // Active modal selection state
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [selectedPhase, setSelectedPhase] = useState<1 | 2 | 3 | null>(null);
  const [selectedVolumeMl, setSelectedVolumeMl] = useState<number | null>(null);

  // Active command & API state
  const [activeCommand, setActiveCommand] = useState<FaucetCommandDto | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Check auth & permissions once on mount
  useEffect(() => {
    let isMounted = true;
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/v1/auth/session');
        const json = await res.json();
        if (isMounted) {
          if (json.success && json.data?.authenticated && json.data?.user) {
            setHasControlPermission(true);
          } else {
            setHasControlPermission(false);
          }
        }
      } catch {
        if (isMounted) {
          setHasControlPermission(false);
        }
      }
    };
    checkAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  // Stable active command fetcher parameterized by device ID
  const fetchActiveCommand = useCallback(async (targetDeviceId: string) => {
    if (!targetDeviceId) {
      setActiveCommand(null);
      return;
    }

    try {
      const res = await fetch(
        `/api/v1/devices/${targetDeviceId}/faucet-commands?pageSize=5&sort=requestedAt:desc`
      );
      const json = await res.json();
      if (json.success && json.data?.items) {
        const active = json.data.items.find((c: any) => ACTIVE_COMMAND_STATUSES.includes(c.status));
        if (active) {
          setActiveCommand(active);
        } else if (json.data.items.length > 0) {
          setActiveCommand(json.data.items[0]);
        } else {
          setActiveCommand(null);
        }
      }
    } catch {
      // Ignore background error
    }
  }, []);

  // Fetch active command strictly when selectedDevice.deviceId changes
  useEffect(() => {
    const devId = selectedDevice?.deviceId;
    if (devId) {
      fetchActiveCommand(devId);
    } else {
      setActiveCommand(null);
    }
  }, [selectedDevice?.deviceId, fetchActiveCommand]);

  // Stable callback for status updates from card
  const handleCommandUpdated = useCallback((updated: FaucetCommandDto) => {
    setActiveCommand(updated);
  }, []);

  // Open modal handler (pure state update, NO API calls or polling)
  const handleSelectPreset = useCallback((phase: 1 | 2 | 3, volumeMl: number) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setSelectedPhase(phase);
    setSelectedVolumeMl(volumeMl);
    setModalOpen(true);
  }, []);

  // Submit dispense command
  const handleConfirmDispense = async (phase: 1 | 2 | 3, idempotencyKey: string) => {
    if (!selectedDevice) return;

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/v1/devices/${selectedDevice.deviceId}/faucet-commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          phase,
          idempotencyKey,
        }),
      });

      const json = await res.json();

      if (json.success && json.data) {
        setSuccessMsg(tFaucet('commandSentSuccess', { volume: json.data.targetVolumeMl }));
        setActiveCommand(json.data);
        setModalOpen(false);
      } else {
        setErrorMsg(json.error?.message || tFaucet('commandCreateFailed'));
      }
    } catch {
      setErrorMsg(tFaucet('networkErrorDispense'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="faucet-control-panel">
      {/* Feedback Banners */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between animate-fade-in">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="font-bold hover:underline">
            {tCommon('close')}
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center justify-between animate-fade-in">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="font-bold hover:underline">
            {tCommon('close')}
          </button>
        </div>
      )}

      {/* Preset Selector Card */}
      <section className="bg-app-surface-container-lowest p-6 rounded-2xl border border-app-outline-variant/30 soft-elevation-lg">
        <FaucetPresetSelector
          selectedDevice={selectedDevice}
          hasControlPermission={hasControlPermission}
          isFeatureEnabled={isFeatureEnabled}
          activeCommand={activeCommand}
          onSelectPreset={handleSelectPreset}
        />
      </section>

      {/* Active Command Status Card (If an active or recent command exists) */}
      {selectedDevice && activeCommand && (
        <section>
          <FaucetStatusCard
            deviceId={selectedDevice.deviceId}
            command={activeCommand}
            onCommandUpdated={handleCommandUpdated}
          />
        </section>
      )}

      {/* Execution History Table */}
      {selectedDevice ? (
        <section>
          <FaucetHistoryTable deviceId={selectedDevice.deviceId} />
        </section>
      ) : (
        <section className="p-8 bg-app-surface-container-lowest rounded-2xl border border-app-outline-variant/20 text-center text-xs text-app-on-surface-variant space-y-2">
          <Cpu size={32} className="mx-auto text-app-outline" />
          <p className="font-semibold text-[14px]">{tDevices('noDeviceSelected')}</p>
          <p>{tFaucet('noDeviceSelectedDesc')}</p>
        </section>
      )}

      {/* Dispense Confirmation Modal */}
      <FaucetConfirmationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        selectedDevice={selectedDevice}
        phase={selectedPhase}
        volumeMl={selectedVolumeMl}
        onConfirm={handleConfirmDispense}
        isSubmitting={submitting}
        errorMsg={errorMsg}
      />
    </div>
  );
}
