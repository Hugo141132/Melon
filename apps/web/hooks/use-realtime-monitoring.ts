import { useEffect, useState, useRef } from 'react';

export interface UseRealtimeOptions {
  deviceId?: string;
  channels?: string[];
  enabled?: boolean;
  onEvent?: (eventName: string, data: any) => void;
}

export interface UseRealtimeReturn {
  status: 'CONNECTING' | 'OPEN' | 'CLOSED' | 'POLLING';
  lastEvent: { name: string; data: any; timestamp: string } | null;
  error: string | null;
}

export function useRealtimeMonitoring({
  deviceId,
  channels,
  enabled = true,
  onEvent,
}: UseRealtimeOptions = {}): UseRealtimeReturn {
  const [status, setStatus] = useState<'CONNECTING' | 'OPEN' | 'CLOSED' | 'POLLING'>('CLOSED');
  const [lastEvent, setLastEvent] = useState<{ name: string; data: any; timestamp: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled) {
      setStatus('CLOSED');
      return;
    }

    if (typeof window === 'undefined' || !window.EventSource) {
      setStatus('POLLING');
      return;
    }

    const query = new URLSearchParams();
    if (deviceId) query.set('deviceId', deviceId);
    if (channels && channels.length > 0) query.set('channels', channels.join(','));

    const url = `/api/v1/realtime/stream${query.toString() ? `?${query.toString()}` : ''}`;
    setStatus('CONNECTING');

    const es = new EventSource(url, { withCredentials: true });
    eventSourceRef.current = es;

    es.onopen = () => {
      setStatus('OPEN');
      setError(null);
    };

    es.onerror = () => {
      setError('Realtime stream disconnected. Falling back to polling mode.');
      setStatus('POLLING');
      es.close();
    };

    const handleMessage = (name: string) => (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const eventObj = { name, data, timestamp: new Date().toISOString() };
        setLastEvent(eventObj);
        onEvent?.(name, data);

        if (name === 'session.expired' || name === 'access.revoked') {
          setStatus('CLOSED');
          es.close();
        }
      } catch {
        // Ignore JSON parse errors
      }
    };

    const eventNames = [
      'connected',
      'ping',
      'telemetry.soil.updated',
      'telemetry.water.updated',
      'device.status.updated',
      'alert.created',
      'alert.updated',
      'faucet.command.updated',
      'access.revoked',
      'session.expired',
    ];

    eventNames.forEach((evtName) => {
      es.addEventListener(evtName, handleMessage(evtName) as EventListener);
    });

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [deviceId, channels?.join(','), enabled]);

  return { status, lastEvent, error };
}
