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
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FaucetCommandEventDto {
  id: string;
  eventType: string;
  previousStatus?: string | null;
  newStatus: string;
  messageId?: string | null;
  reasonCode?: string | null;
  payload?: any;
  createdAt: string;
}

export interface FaucetCommandDto {
  id: string;
  commandId: string;
  idempotencyKey: string;
  deviceId: string;
  phase: number;
  targetVolumeMl: number;
  actualVolumeMl?: number | null;
  status: string;
  reasonCode?: string | null;
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

export default function FaucetStatusCard({
  deviceId,
  command,
  onCommandUpdated,
  className,
}: FaucetStatusCardProps) {
  const [currentCommand, setCurrentCommand] = useState<FaucetCommandDto>(command);
  const [isPolling, setIsPolling] = useState(false);
  const onCommandUpdatedRef = useRef(onCommandUpdated);

  useEffect(() => {
    onCommandUpdatedRef.current = onCommandUpdated;
  }, [onCommandUpdated]);

  const targetCommandId = command.commandId || command.id;
  const status = currentCommand.status;
  const isActiveState = ACTIVE_COMMAND_STATUSES.includes(status);

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
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'QUEUED':
        return {
          bg: 'bg-blue-50 text-blue-800 border-blue-200',
          icon: Clock,
          label: 'Dalam Antrean (QUEUED)',
          animate: false,
        };
      case 'SENT':
        return {
          bg: 'bg-indigo-50 text-indigo-800 border-indigo-200',
          icon: Loader2,
          label: 'Terkirim ke Broker (SENT)',
          animate: true,
        };
      case 'ACKNOWLEDGED':
        return {
          bg: 'bg-cyan-50 text-cyan-800 border-cyan-200',
          icon: ShieldCheck,
          label: 'Diterima Alat (ACKNOWLEDGED)',
          animate: false,
        };
      case 'IN_PROGRESS':
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-300',
          icon: Loader2,
          label: 'Sedang Menyiram (IN_PROGRESS)',
          animate: true,
        };
      case 'COMPLETED':
        return {
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
          icon: CheckCircle2,
          label: 'Selesai (COMPLETED)',
          animate: false,
        };
      case 'FAILED':
        return {
          bg: 'bg-rose-50 text-rose-800 border-rose-300',
          icon: XCircle,
          label: 'Gagal (FAILED)',
          animate: false,
        };
      case 'TIMEOUT':
        return {
          bg: 'bg-amber-50 text-amber-900 border-amber-300',
          icon: AlertTriangle,
          label: 'Waktu Habis (TIMEOUT)',
          animate: false,
        };
      case 'EXPIRED':
        return {
          bg: 'bg-gray-100 text-gray-800 border-gray-300',
          icon: Clock,
          label: 'Kadaluarsa (EXPIRED)',
          animate: false,
        };
      default:
        return {
          bg: 'bg-gray-100 text-gray-800 border-gray-300',
          icon: Clock,
          label: status,
          animate: false,
        };
    }
  };

  const badge = getStatusBadge(currentCommand.status);
  const StatusIcon = badge.icon;

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
          <Droplets className="text-app-primary" size={20} />
          <h3 className="text-[16px] font-bold text-app-on-surface">Status Perintah Penyiraman</h3>
        </div>

        <div className="flex items-center gap-2">
          {isActiveState && isPolling && (
            <span
              className="text-[11px] text-app-primary font-medium flex items-center gap-1 bg-app-primary/10 px-2 py-0.5 rounded-full"
              data-testid="live-polling-indicator"
            >
              <Loader2 size={12} className="animate-spin" /> Live Updates
            </span>
          )}
          <button
            onClick={() => fetchCommandStatus()}
            className="p-1 rounded-lg hover:bg-app-surface-container text-app-on-surface-variant transition-colors cursor-pointer"
            title="Muat ulang status"
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
            <p className="text-[11px] opacity-90 mt-0.5 font-mono">
              ID: {currentCommand.commandId || currentCommand.id}
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[20px] font-extrabold block leading-tight">
            {(currentCommand.actualVolumeMl ?? currentCommand.targetVolumeMl).toLocaleString(
              'id-ID'
            )}{' '}
            mL
          </span>
          <span className="text-[10px] uppercase font-bold opacity-80">
            Fase {currentCommand.phase} Target
          </span>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-app-surface-container/40 p-3 rounded-xl border border-app-outline-variant/10">
        <div>
          <span className="text-app-on-surface-variant text-[10px] font-bold uppercase block">
            Diminta Pada:
          </span>
          <span className="font-medium text-app-on-surface">
            {new Date(currentCommand.requestedAt).toLocaleTimeString('id-ID')}
          </span>
        </div>

        <div>
          <span className="text-app-on-surface-variant text-[10px] font-bold uppercase block">
            Target Volume:
          </span>
          <span className="font-bold text-app-primary">
            {currentCommand.targetVolumeMl.toLocaleString('id-ID')} mL
          </span>
        </div>

        <div>
          <span className="text-app-on-surface-variant text-[10px] font-bold uppercase block">
            Volume Aktual:
          </span>
          <span className="font-bold text-app-on-surface">
            {currentCommand.actualVolumeMl !== null && currentCommand.actualVolumeMl !== undefined
              ? `${currentCommand.actualVolumeMl.toLocaleString('id-ID')} mL`
              : 'Menunggu...'}
          </span>
        </div>
      </div>

      {/* Reason / Failure Banner if FAILED */}
      {currentCommand.status === 'FAILED' && currentCommand.reasonCode && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
          <span className="font-bold">Alasan Kegagalan: </span>
          <span>{currentCommand.reasonCode}</span>
        </div>
      )}

      {/* State Transitions Timeline */}
      {currentCommand.events && currentCommand.events.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-app-outline-variant/20">
          <span className="text-[11px] font-bold text-app-on-surface-variant uppercase tracking-wider block">
            Riwayat Event Perintah:
          </span>

          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {currentCommand.events.map((evt) => (
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
                  <span className="font-bold text-app-primary">{evt.newStatus}</span>
                </div>

                <span className="text-app-on-surface-variant font-mono">
                  {new Date(evt.createdAt).toLocaleTimeString('id-ID')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
