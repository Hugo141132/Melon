'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  XCircle,
  RefreshCw,
  Droplets,
  ArrowRight,
  ShieldCheck,
  Power,
  PowerOff,
  Activity,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { formatLitersDisplay } from './FaucetPresetSelector';

export interface FaucetCommandEventDto {
  id: string;
  eventType?: string;
  eventStatus?: string;
  previousStatus?: string | null;
  newStatus?: string;
  messageId?: string | null;
  reasonCode?: string | null;
  payload?: any;
  metadata?: any;
  createdAt: string;
}

export interface FaucetCommandDto {
  id: string;
  commandId: string;
  idempotencyKey: string;
  deviceId: string;
  action?: 'DISPENSE' | 'OPEN' | 'CLOSE' | string;
  phase?: number | null;
  plantCount?: number | null;
  targetVolumeMl?: number | null;
  actualVolumeMl?: number | null;
  status: string;
  reasonCode?: string | null;
  failureReasonCode?: string | null;
  requestedAt: string;
  sentAt?: string | null;
  acknowledgedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  expiresAt?: string | null;
  initiatedByUserId?: string | null;
  initiatedByRole?: string | null;
  events?: FaucetCommandEventDto[];
}

export interface FaucetStatusCardProps {
  deviceId: string;
  command: FaucetCommandDto;
  onCommandUpdated?: (updated: FaucetCommandDto) => void;
  className?: string;
}

export const ACTIVE_COMMAND_STATUSES = ['QUEUED', 'SENT', 'ACKNOWLEDGED', 'IN_PROGRESS'];
export const TERMINAL_COMMAND_STATUSES = ['COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT', 'EXPIRED'];

export function getAuthoritativePhysicalStateFromCommand(
  cmd: FaucetCommandDto | null | undefined
): 'OPEN' | 'CLOSED' | 'UNKNOWN' {
  if (!cmd) return 'UNKNOWN';

  // Never infer OPEN/CLOSED if command is still active
  if (ACTIVE_COMMAND_STATUSES.includes(cmd.status)) {
    return 'UNKNOWN';
  }

  // Only terminal COMPLETED commands establish physical state
  if (cmd.status === 'COMPLETED') {
    if (cmd.action === 'OPEN') {
      return 'OPEN';
    }
    if (cmd.action === 'CLOSE') {
      return 'CLOSED';
    }
    // Completed DISPENSE does NOT infer closed valve
    return 'UNKNOWN';
  }

  return 'UNKNOWN';
}

export default function FaucetStatusCard({
  deviceId,
  command,
  onCommandUpdated,
  className,
}: FaucetStatusCardProps) {
  const tFaucet = useTranslations('faucet');
  const tCommon = useTranslations('common');

  const [currentCommand, setCurrentCommand] = useState<FaucetCommandDto>(command);
  const [isPolling, setIsPolling] = useState(false);
  const onCommandUpdatedRef = useRef(onCommandUpdated);

  useEffect(() => {
    onCommandUpdatedRef.current = onCommandUpdated;
  }, [onCommandUpdated]);

  const targetCommandId = command.commandId || command.id;
  const status = currentCommand.status;
  const isActiveState = ACTIVE_COMMAND_STATUSES.includes(status);
  const action = currentCommand.action || 'DISPENSE';
  const isDispense = action === 'DISPENSE';
  const physicalState = getAuthoritativePhysicalStateFromCommand(currentCommand);

  // Sync prop command changes (e.g. when a new command is created)
  useEffect(() => {
    setCurrentCommand(command);
  }, [command]);

  // Single status fetcher helper
  const fetchCommandStatus = useCallback(async () => {
    if (!deviceId || !targetCommandId) return;

    try {
      const res = await fetch(`/api/v1/devices/${deviceId}/faucet-commands/${targetCommandId}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.data) {
        setCurrentCommand(json.data);
        if (onCommandUpdatedRef.current) {
          onCommandUpdatedRef.current(json.data);
        }
      }
    } catch {
      // Ignore background network error
    }
  }, [deviceId, targetCommandId]);

  // Poll status ONLY while command is in active non-terminal state
  useEffect(() => {
    if (!isActiveState || !deviceId || !targetCommandId) {
      setIsPolling(false);
      return;
    }

    let isMounted = true;
    setIsPolling(true);

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/devices/${deviceId}/faucet-commands/${targetCommandId}`);
        if (!res.ok || !isMounted) return;
        const json = await res.json();

        if (isMounted && json.success && json.data) {
          setCurrentCommand(json.data);
          if (onCommandUpdatedRef.current) {
            onCommandUpdatedRef.current(json.data);
          }

          // If command has reached terminal state, stop polling immediately
          if (TERMINAL_COMMAND_STATUSES.includes(json.data.status)) {
            setIsPolling(false);
          }
        }
      } catch {
        // Ignore background polling errors
      }
    }, 2500);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      setIsPolling(false);
    };
  }, [deviceId, targetCommandId, isActiveState]);

  // Status Badge Helper
  const getStatusBadge = (commandStatus: string) => {
    switch (commandStatus) {
      case 'QUEUED':
        return {
          bg: 'bg-blue-50 text-blue-800 border-blue-200',
          icon: Clock,
          label: tFaucet('queued'),
          animate: false,
        };
      case 'SENT':
        return {
          bg: 'bg-indigo-50 text-indigo-800 border-indigo-200',
          icon: Loader2,
          label: tFaucet('sent'),
          animate: true,
        };
      case 'ACKNOWLEDGED':
        return {
          bg: 'bg-cyan-50 text-cyan-800 border-cyan-200',
          icon: ShieldCheck,
          label: tFaucet('acknowledged'),
          animate: false,
        };
      case 'IN_PROGRESS':
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-300',
          icon: Loader2,
          label: tFaucet('inProgress'),
          animate: true,
        };
      case 'COMPLETED':
        return {
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
          icon: CheckCircle2,
          label: tFaucet('completed'),
          animate: false,
        };
      case 'FAILED':
        return {
          bg: 'bg-rose-50 text-rose-800 border-rose-300',
          icon: XCircle,
          label: tFaucet('failed'),
          animate: false,
        };
      case 'TIMEOUT':
        return {
          bg: 'bg-amber-50 text-amber-900 border-amber-300',
          icon: AlertTriangle,
          label: tFaucet('timeout'),
          animate: false,
        };
      case 'EXPIRED':
        return {
          bg: 'bg-gray-100 text-gray-800 border-gray-300',
          icon: Clock,
          label: tFaucet('expired'),
          animate: false,
        };
      default:
        return {
          bg: 'bg-gray-100 text-gray-800 border-gray-300',
          icon: Clock,
          label: commandStatus,
          animate: false,
        };
    }
  };

  const badge = getStatusBadge(currentCommand.status);
  const StatusIcon = badge.icon;

  const targetVolL = currentCommand.targetVolumeMl ? currentCommand.targetVolumeMl / 1000 : null;
  const actualVolL =
    currentCommand.actualVolumeMl !== null && currentCommand.actualVolumeMl !== undefined
      ? currentCommand.actualVolumeMl / 1000
      : null;

  return (
    <div
      className={cn(
        'bg-app-surface-container-lowest p-5 rounded-2xl border soft-elevation-lg space-y-4 animate-fade-in',
        isActiveState
          ? 'border-app-primary/40 ring-1 ring-app-primary/20'
          : 'border-app-outline-variant/30',
        className
      )}
      data-testid="faucet-status-card"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {action === 'OPEN' ? (
            <Power className="text-emerald-600" size={20} />
          ) : action === 'CLOSE' ? (
            <PowerOff className="text-slate-700" size={20} />
          ) : (
            <Droplets className="text-app-primary" size={20} />
          )}
          <h3 className="text-[16px] font-bold text-app-on-surface">
            {tFaucet('statusCardTitle')}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {isActiveState && isPolling && (
            <span
              className="text-[11px] text-app-primary font-medium flex items-center gap-1 bg-app-primary/10 px-2 py-0.5 rounded-full"
              data-testid="live-polling-indicator"
            >
              <Loader2 size={12} className="animate-spin" /> {tFaucet('liveUpdates')}
            </span>
          )}
          <button
            onClick={() => fetchCommandStatus()}
            className="p-1 rounded-lg hover:bg-app-surface-container text-app-on-surface-variant transition-colors cursor-pointer"
            title={tCommon('refresh')}
            data-testid="btn-refresh-status"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Primary Status Banner */}
      <div
        className={cn('p-4 rounded-xl border flex items-center justify-between gap-3', badge.bg)}
      >
        <div className="flex items-center gap-3">
          <StatusIcon size={22} className={badge.animate ? 'animate-spin' : ''} />
          <div>
            <p className="text-[14px] font-bold leading-tight">{badge.label}</p>
            <span className="text-[11px] font-medium opacity-90 block mt-0.5">
              {action === 'OPEN'
                ? tFaucet('commandActionOpen')
                : action === 'CLOSE'
                  ? tFaucet('commandActionClose')
                  : tFaucet('commandActionDispense')}
            </span>
          </div>
        </div>

        <div className="text-right">
          {isDispense && targetVolL !== null ? (
            <>
              <span className="text-[20px] font-extrabold block leading-tight font-mono">
                {formatLitersDisplay(actualVolL ?? targetVolL)} L
              </span>
              <span className="text-[10px] uppercase font-bold opacity-80">
                {currentCommand.phase
                  ? tFaucet('phaseTargetSubtitle', { phase: currentCommand.phase })
                  : tFaucet('totalWater')}
              </span>
            </>
          ) : (
            <span className="text-[14px] font-extrabold block font-mono">
              {action === 'OPEN'
                ? tFaucet('commandActionOpen')
                : action === 'CLOSE'
                  ? tFaucet('commandActionClose')
                  : action}
            </span>
          )}
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-app-surface-container/40 p-3 rounded-xl border border-app-outline-variant/10">
        <div>
          <span className="text-app-on-surface-variant text-[10px] font-bold uppercase block">
            {tFaucet('requestedAtHeader')}:
          </span>
          <span className="font-medium text-app-on-surface">
            {new Date(currentCommand.requestedAt).toLocaleTimeString('id-ID')}
          </span>
        </div>

        {isDispense ? (
          <>
            <div>
              <span className="text-app-on-surface-variant text-[10px] font-bold uppercase block">
                {tFaucet('totalWater')} (Target):
              </span>
              <span className="font-bold text-app-primary font-mono">
                {targetVolL !== null ? `${formatLitersDisplay(targetVolL)} L` : '—'}
              </span>
            </div>

            <div>
              <span className="text-app-on-surface-variant text-[10px] font-bold uppercase block">
                {tFaucet('actualVolumeHeader')}:
              </span>
              <span className="font-bold text-app-on-surface font-mono">
                {actualVolL !== null ? `${formatLitersDisplay(actualVolL)} L` : tCommon('waiting')}
              </span>
            </div>
          </>
        ) : (
          <div className="col-span-2">
            <span className="text-app-on-surface-variant text-[10px] font-bold uppercase block">
              {tFaucet('actionHeader')}:
            </span>
            <span className="font-bold text-app-on-surface">
              {action === 'OPEN' ? tFaucet('commandActionOpen') : tFaucet('commandActionClose')}
            </span>
          </div>
        )}
      </div>

      {/* Authoritative Physical State Indication */}
      <div
        className={cn(
          'p-3 rounded-xl border text-xs flex items-center justify-between gap-2',
          physicalState === 'OPEN' && 'bg-emerald-50/70 border-emerald-200 text-emerald-900',
          physicalState === 'CLOSED' && 'bg-slate-50 border-slate-200 text-slate-900',
          physicalState === 'UNKNOWN' && 'bg-amber-50/70 border-amber-200 text-amber-900'
        )}
        data-testid="status-card-physical-state"
      >
        <div className="flex items-center gap-2 font-medium">
          <Activity size={15} />
          <span>{tFaucet('physicalStateTitle')}:</span>
          <span className="font-bold">
            {physicalState === 'OPEN'
              ? tFaucet('physicalStateOpen')
              : physicalState === 'CLOSED'
                ? tFaucet('physicalStateClosed')
                : tFaucet('physicalStateUnknown')}
          </span>
        </div>
        <span className="text-[10px] opacity-80 hidden sm:inline">
          {physicalState === 'OPEN'
            ? tFaucet('physicalStateOpenDesc')
            : physicalState === 'CLOSED'
              ? tFaucet('physicalStateClosedDesc')
              : tFaucet('physicalStateUnknownDesc')}
        </span>
      </div>

      {/* Reason / Failure Banner if FAILED */}
      {currentCommand.status === 'FAILED' &&
        (currentCommand.reasonCode || currentCommand.failureReasonCode) && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
            <span className="font-bold">{tFaucet('failureReasonLabel')}</span>
            <span>{currentCommand.reasonCode || currentCommand.failureReasonCode}</span>
          </div>
        )}

      {/* State Transitions Timeline */}
      {currentCommand.events && currentCommand.events.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-app-outline-variant/20">
          <span className="text-[11px] font-bold text-app-on-surface-variant uppercase tracking-wider block">
            {tFaucet('eventHistoryTitle')}
          </span>

          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {currentCommand.events.map((evt) => {
              const statusName = evt.newStatus || evt.eventStatus || 'UNKNOWN';
              return (
                <div
                  key={evt.id}
                  className="flex items-center justify-between text-[11px] p-2 bg-app-surface-container-lowest rounded-lg border border-app-outline-variant/20"
                >
                  <div className="flex items-center gap-1.5 font-mono">
                    {evt.previousStatus && (
                      <>
                        <span className="text-app-on-surface-variant">{evt.previousStatus}</span>
                        <ArrowRight size={12} className="text-app-outline" />
                      </>
                    )}
                    <span className="font-bold text-app-primary">{statusName}</span>
                  </div>

                  <span className="text-app-on-surface-variant font-mono">
                    {new Date(evt.createdAt).toLocaleTimeString('id-ID')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
