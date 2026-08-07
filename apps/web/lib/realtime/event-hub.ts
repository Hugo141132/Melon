export type RealtimeEventName =
  | 'telemetry.soil.updated'
  | 'telemetry.water.updated'
  | 'device.status.updated'
  | 'alert.created'
  | 'alert.updated'
  | 'faucet.command.updated'
  | 'access.revoked'
  | 'session.expired';

export interface RealtimeMonitoringEvent {
  name: RealtimeEventName;
  deviceId?: string;
  data: Record<string, unknown>;
  timestamp?: string;
}

export type RealtimeEventListener = (event: RealtimeMonitoringEvent) => void;

export class RealtimeEventHub {
  private listeners: Set<RealtimeEventListener> = new Set();

  public subscribe(listener: RealtimeEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public publish(event: RealtimeMonitoringEvent): void {
    const timestampedEvent: RealtimeMonitoringEvent = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
    };
    this.listeners.forEach((listener) => {
      try {
        listener(timestampedEvent);
      } catch {
        // Ignore listener invocation errors
      }
    });
  }

  public get listenerCount(): number {
    return this.listeners.size;
  }

  public clearListeners(): void {
    this.listeners.clear();
  }
}

const globalForRealtime = globalThis as unknown as {
  realtimeEventHub?: RealtimeEventHub;
};

export const realtimeEventHub = globalForRealtime.realtimeEventHub || new RealtimeEventHub();

if (process.env.NODE_ENV !== 'production') {
  globalForRealtime.realtimeEventHub = realtimeEventHub;
}
