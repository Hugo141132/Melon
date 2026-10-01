'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useDeviceContext } from '@/context/DeviceContext';
import { useAuth } from '@/context/AuthContext';
import FaucetPresetSelector, {
  AuthoritativePhysicalState,
  formatLitersDisplay,
  deriveValveTransitionState,
} from './FaucetPresetSelector';
import FaucetPresetSelectorSkeleton from './FaucetPresetSelectorSkeleton';
import FaucetConfirmationModal from './FaucetConfirmationModal';
import FaucetStatusCard, { FaucetCommandDto, ACTIVE_COMMAND_STATUSES } from './FaucetStatusCard';
import FaucetHistoryTable from './FaucetHistoryTable';
import { Cpu } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function deriveAuthoritativePhysicalState(
  recentCommands: FaucetCommandDto[],
  activeCommand: FaucetCommandDto | null,
  initialValveState?: AuthoritativePhysicalState
): AuthoritativePhysicalState {
  // If an active command is currently in flight, physical state is transitioning/unknown
  if (activeCommand && ACTIVE_COMMAND_STATUSES.includes(activeCommand.status)) {
    return 'UNKNOWN';
  }

  // Look for the most recent completed command
  const latestCompleted = recentCommands?.find((c) => c.status === 'COMPLETED');
  if (latestCompleted) {
    // Check if hardware-reported physical state exists in metadata or completion events
    const completionEvent = latestCompleted.events?.find((e) => e.eventStatus === 'COMPLETED');
    const reportedPhysicalState =
      completionEvent?.metadata?.physicalState || completionEvent?.metadata?.reportedState;
    if (reportedPhysicalState === 'OPEN' || reportedPhysicalState === 'CLOSED') {
      return reportedPhysicalState;
    }

    if (latestCompleted.action === 'OPEN') {
      return 'OPEN';
    }
    if (latestCompleted.action === 'CLOSE') {
      return 'CLOSED';
    }

    // Completed DISPENSE does NOT confirm closed valve without sensor confirmation
  }

  // Fallback to initial hardware physical valve state when no completed commands exist
  if (initialValveState && (initialValveState === 'OPEN' || initialValveState === 'CLOSED')) {
    return initialValveState;
  }

  return 'UNKNOWN';
}

export default function FaucetControlPanel() {
  const tFaucet = useTranslations('faucet');
  const tDevices = useTranslations('devices');
  const tCommon = useTranslations('common');
  const { selectedDevice, isLoading: isDeviceLoading } = useDeviceContext();
  const { isAuthenticated, user } = useAuth();

  // Permissions & Auth state (hydrated directly from AuthContext without client fetch delay)
  const hasControlPermission = Boolean(isAuthenticated && user);
  const isFeatureEnabled = true;

  // Plant count state (default 1)
  const [plantCount, setPlantCount] = useState<number>(1);

  // Active modal selection state
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [modalAction, setModalAction] = useState<'DISPENSE' | 'OPEN' | 'CLOSE'>('DISPENSE');
  const [selectedPhase, setSelectedPhase] = useState<1 | 2 | 3 | null>(null);
  const [selectedVolumeL, setSelectedVolumeL] = useState<number | null>(null);
  const [selectedTotalVolumeL, setSelectedTotalVolumeL] = useState<number | null>(null);

  // Active command & API state
  const [activeCommand, setActiveCommand] = useState<FaucetCommandDto | null>(null);
  const [recentCommands, setRecentCommands] = useState<FaucetCommandDto[]>([]);
  const [commandsPagination, setCommandsPagination] = useState<any>(null);
  const [initialValveState, setInitialValveState] = useState<AuthoritativePhysicalState>('UNKNOWN');
  const [isValveStatusLoading, setIsValveStatusLoading] = useState<boolean>(false);
  const [isCommandsLoading, setIsCommandsLoading] = useState<boolean>(false);
  const [loadedDeviceId, setLoadedDeviceId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const devId = selectedDevice?.deviceId || selectedDevice?.id;
  const isInitialLoadingForDevice = Boolean(devId) && loadedDeviceId !== devId;
  const effectiveValveLoading = isValveStatusLoading || isInitialLoadingForDevice;
  const effectiveCommandsLoading = isCommandsLoading || isInitialLoadingForDevice;

  // Stable recent command fetcher parameterized by device ID
  const fetchRecentCommands = useCallback(async (targetDeviceId: string) => {
    if (!targetDeviceId) {
      setActiveCommand(null);
      setRecentCommands([]);
      setCommandsPagination(null);
      setIsCommandsLoading(false);
      return;
    }

    setIsCommandsLoading(true);
    try {
      const res = await fetch(
        `/api/v1/devices/${targetDeviceId}/faucet-commands?pageSize=10&sort=requestedAt:desc`
      );
      const json = await res.json();
      if (json.success && json.data?.items) {
        const items: FaucetCommandDto[] = json.data.items;
        setRecentCommands(items);
        if (json.data.meta?.pagination) {
          setCommandsPagination(json.data.meta.pagination);
        }

        const active = items.find((c) => ACTIVE_COMMAND_STATUSES.includes(c.status));
        if (active) {
          setActiveCommand(active);
        } else if (items.length > 0) {
          setActiveCommand(items[0]);
        } else {
          setActiveCommand(null);
        }
      }
    } catch {
      // Ignore background error
    } finally {
      setIsCommandsLoading(false);
    }
  }, []);

  // Fetch standalone physical valve status directly from hardware status records
  const fetchValveStatus = useCallback(async (targetDeviceId: string) => {
    if (!targetDeviceId) {
      setInitialValveState('UNKNOWN');
      setIsValveStatusLoading(false);
      return;
    }
    setIsValveStatusLoading(true);
    try {
      const res = await fetch(`/api/v1/devices/${encodeURIComponent(targetDeviceId)}/valve-status`);
      const json = await res.json();
      if (json.success && json.data) {
        if (json.data.physicalState === 'OPEN' || json.data.physicalState === 'CLOSED') {
          setInitialValveState(json.data.physicalState);
        }
      }
    } catch {
      // Ignore background network error
    } finally {
      setIsValveStatusLoading(false);
    }
  }, []);

  // Fetch active command & initial valve status strictly when selectedDevice changes
  useEffect(() => {
    const devId = selectedDevice?.deviceId || selectedDevice?.id;
    if (devId) {
      setIsValveStatusLoading(true);
      setIsCommandsLoading(true);
      // Coordinated parallel loading
      Promise.allSettled([fetchRecentCommands(devId), fetchValveStatus(devId)]).then(() => {
        setLoadedDeviceId(devId);
      });
    } else {
      setActiveCommand(null);
      setRecentCommands([]);
      setCommandsPagination(null);
      setInitialValveState('UNKNOWN');
      setLoadedDeviceId(null);
      setIsValveStatusLoading(false);
      setIsCommandsLoading(false);
    }
  }, [selectedDevice?.deviceId, selectedDevice?.id, fetchRecentCommands, fetchValveStatus]);

  // Dynamic message derivation to ensure notifications reflect latest command lifecycle state
  const getCommandStatusMessage = useCallback(
    (cmd: FaucetCommandDto): { type: 'success' | 'error'; message: string } => {
      const action = cmd.action || 'COMMAND';
      const actionLabel =
        action === 'DISPENSE'
          ? tFaucet('commandActionDispense')
          : action === 'OPEN'
            ? tFaucet('commandActionOpen')
            : tFaucet('commandActionClose');

      if (cmd.status === 'COMPLETED') {
        return { type: 'success', message: tFaucet('commandCompleted') };
      }

      if (cmd.status === 'FAILED') {
        return {
          type: 'error',
          message: cmd.failureReasonCode || tFaucet('commandFailed'),
        };
      }

      if (cmd.status === 'TIMEOUT') {
        return { type: 'error', message: tFaucet('commandTimeout') };
      }

      if (cmd.status === 'QUEUED') {
        if (action === 'DISPENSE' && cmd.targetVolumeMl) {
          const totalL = formatLitersDisplay(cmd.targetVolumeMl / 1000);
          return {
            type: 'success',
            message: tFaucet('commandSentSuccess', { volume: `${totalL} L` }),
          };
        }
        return {
          type: 'success',
          message: tFaucet('commandSentSuccessGeneric', { action }),
        };
      }

      // Active execution statuses (SENT, ACKNOWLEDGED, IN_PROGRESS)
      const statusKey =
        cmd.status === 'IN_PROGRESS'
          ? 'inProgress'
          : cmd.status === 'ACKNOWLEDGED'
            ? 'acknowledged'
            : cmd.status === 'SENT'
              ? 'sent'
              : 'commandStatus';
      const statusLabel = tFaucet(statusKey as any);
      return {
        type: 'success',
        message: tFaucet('commandExecuting', {
          action: actionLabel,
          status: statusLabel,
        }),
      };
    },
    [tFaucet]
  );

  // Stable callback for status updates from card
  const handleCommandUpdated = useCallback(
    (updated: FaucetCommandDto) => {
      setActiveCommand(updated);
      setRecentCommands((prev) => {
        const index = prev.findIndex(
          (c) => c.commandId === updated.commandId || c.id === updated.id
        );
        if (index >= 0) {
          const updatedList = [...prev];
          updatedList[index] = updated;
          return updatedList;
        }
        return [updated, ...prev];
      });

      // Update feedback notification to reflect latest status
      const notif = getCommandStatusMessage(updated);
      if (notif.type === 'error') {
        setErrorMsg(notif.message);
        setSuccessMsg(null);
      } else {
        setSuccessMsg(notif.message);
        setErrorMsg(null);
      }
    },
    [getCommandStatusMessage]
  );

  // Open modal for DISPENSE preset
  const handleSelectPreset = useCallback(
    (phase: 1 | 2 | 3, volumeL: number, count: number, totalL: number) => {
      setErrorMsg(null);
      setSuccessMsg(null);
      setModalAction('DISPENSE');
      setSelectedPhase(phase);
      setSelectedVolumeL(volumeL);
      setSelectedTotalVolumeL(totalL);
      setPlantCount(count);
      setModalOpen(true);
    },
    []
  );

  // Open modal for manual OPEN / CLOSE action
  const handleSelectManualAction = useCallback((action: 'OPEN' | 'CLOSE') => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setModalAction(action);
    setSelectedPhase(null);
    setSelectedVolumeL(null);
    setSelectedTotalVolumeL(null);
    setModalOpen(true);
  }, []);

  // Submit faucet command (DISPENSE, OPEN, or CLOSE)
  const handleConfirmCommand = async (
    actionOrPhase: 'DISPENSE' | 'OPEN' | 'CLOSE' | 1 | 2 | 3,
    idempotencyKey: string,
    plantCountParam?: number
  ) => {
    if (!selectedDevice) return;
    const targetDevId = selectedDevice.deviceId || selectedDevice.id;
    if (!targetDevId) return;

    const action =
      typeof actionOrPhase === 'number'
        ? 'DISPENSE'
        : actionOrPhase === 'DISPENSE'
          ? 'DISPENSE'
          : actionOrPhase === 'OPEN'
            ? 'OPEN'
            : 'CLOSE';

    const effectivePhase = typeof actionOrPhase === 'number' ? actionOrPhase : selectedPhase;
    const effectivePlantCount = plantCountParam ?? plantCount;

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payloadBody: any = {
        action,
      };

      if (action === 'DISPENSE') {
        payloadBody.phase = effectivePhase;
        payloadBody.plantCount = effectivePlantCount;
      }

      const res = await fetch(
        `/api/v1/devices/${encodeURIComponent(targetDevId)}/faucet-commands`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify(payloadBody),
        }
      );

      const json = await res.json();

      if (json.success && json.data) {
        const notif = getCommandStatusMessage(json.data);
        if (notif.type === 'error') {
          setErrorMsg(notif.message);
          setSuccessMsg(null);
        } else {
          setSuccessMsg(notif.message);
          setErrorMsg(null);
        }
        setActiveCommand(json.data);
        setRecentCommands((prev) => [json.data, ...prev]);
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

  const physicalState = deriveAuthoritativePhysicalState(
    recentCommands,
    activeCommand,
    initialValveState
  );

  const transitionState = deriveValveTransitionState(activeCommand, submitting, modalAction);

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
      {isDeviceLoading ? (
        <FaucetPresetSelectorSkeleton />
      ) : (
        <section className="bg-app-surface-container-lowest p-6 rounded-2xl border border-app-outline-variant/30 soft-elevation-lg">
          <FaucetPresetSelector
            selectedDevice={selectedDevice}
            hasControlPermission={hasControlPermission}
            isFeatureEnabled={isFeatureEnabled}
            activeCommand={activeCommand}
            physicalState={physicalState}
            transitionState={transitionState}
            isValveStatusLoading={effectiveValveLoading}
            isSubmitting={submitting}
            submittingAction={modalAction}
            plantCount={plantCount}
            onPlantCountChange={setPlantCount}
            onSelectPreset={handleSelectPreset}
            onSelectManualAction={handleSelectManualAction}
          />
        </section>
      )}

      {/* Active Command Status Card (If an active or recent command exists) */}
      {selectedDevice && !isInitialLoadingForDevice && activeCommand && (
        <section className="animate-fade-in">
          <FaucetStatusCard
            deviceId={selectedDevice.deviceId || selectedDevice.id}
            command={activeCommand}
            transitionState={transitionState}
            onCommandUpdated={handleCommandUpdated}
          />
        </section>
      )}

      {/* Execution History Table */}
      {selectedDevice ? (
        <section>
          <FaucetHistoryTable
            deviceId={selectedDevice.deviceId || selectedDevice.id}
            initialItems={recentCommands}
            initialPagination={commandsPagination}
            isLoading={effectiveCommandsLoading}
          />
        </section>
      ) : isDeviceLoading ? (
        <section>
          <FaucetHistoryTable deviceId={null} isLoading={true} />
        </section>
      ) : (
        <section className="p-8 bg-app-surface-container-lowest rounded-2xl border border-app-outline-variant/20 text-center text-xs text-app-on-surface-variant space-y-2">
          <Cpu size={32} className="mx-auto text-app-outline" />
          <p className="font-semibold text-[14px]">{tDevices('noDeviceSelected')}</p>
          <p>{tFaucet('noDeviceSelectedDesc')}</p>
        </section>
      )}

      {/* Confirmation Modal (DISPENSE, OPEN, or CLOSE) */}
      <FaucetConfirmationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        selectedDevice={selectedDevice}
        action={modalAction}
        phase={selectedPhase}
        volumeL={selectedVolumeL}
        plantCount={plantCount}
        totalVolumeL={selectedTotalVolumeL}
        onConfirm={handleConfirmCommand}
        isSubmitting={submitting}
        errorMsg={errorMsg}
      />
    </div>
  );
}
