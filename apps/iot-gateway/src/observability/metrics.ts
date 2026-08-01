import { redactSecrets } from '../config/env';

export type BrokerConnectionState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'ERROR';

export interface LatencyStats {
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
  avgMs: number;
  lastMs: number;
}

export interface GatewayMetricsSnapshot {
  broker: {
    state: BrokerConnectionState;
    connectsTotal: number;
    reconnectsTotal: number;
    errorsTotal: number;
  };
  messages: {
    receivedTotal: number;
    validTotal: number;
    invalidTotal: number;
    duplicateTotal: number;
    unknownDeviceAttemptsTotal: number;
  };
  latency: LatencyStats;
  devices: {
    connectedCount: number;
    disconnectedCount: number;
    activeDeviceIds: string[];
  };
  commands: {
    publishedTotal: number;
    acknowledgementsTotal: number;
    failuresTotal: number;
    timeoutsTotal: number;
  };
  uptimeSeconds: number;
  timestamp: string;
}

export interface CorrelationMeta {
  correlationId?: string;
  messageId?: string;
  commandId?: string;
  deviceId?: string;
  ingestionId?: string;
  requestId?: string;
  [key: string]: unknown;
}

export class GatewayMetricsCollector {
  private startTime: number = Date.now();
  private brokerState: BrokerConnectionState = 'DISCONNECTED';
  private connectsTotal: number = 0;
  private reconnectsTotal: number = 0;
  private errorsTotal: number = 0;

  private messagesReceivedTotal: number = 0;
  private messagesValidTotal: number = 0;
  private messagesInvalidTotal: number = 0;
  private messagesDuplicateTotal: number = 0;
  private unknownDeviceAttemptsTotal: number = 0;

  private latencyCount: number = 0;
  private latencyTotalMs: number = 0;
  private latencyMinMs: number = Infinity;
  private latencyMaxMs: number = 0;
  private latencyLastMs: number = 0;

  private connectedDevices: Set<string> = new Set();
  private disconnectedDevicesCount: number = 0;

  private commandsPublishedTotal: number = 0;
  private acknowledgementsTotal: number = 0;
  private commandFailuresTotal: number = 0;
  private commandTimeoutsTotal: number = 0;

  // Broker metrics
  public recordBrokerState(state: BrokerConnectionState): void {
    this.brokerState = state;
  }

  public incrementConnects(): void {
    this.connectsTotal++;
    this.brokerState = 'CONNECTED';
  }

  public incrementReconnects(): void {
    this.reconnectsTotal++;
    this.brokerState = 'RECONNECTING';
  }

  public incrementErrors(): void {
    this.errorsTotal++;
    this.brokerState = 'ERROR';
  }

  // Message metrics
  public incrementMessagesReceived(): void {
    this.messagesReceivedTotal++;
  }

  public incrementMessagesValid(): void {
    this.messagesValidTotal++;
  }

  public incrementMessagesInvalid(): void {
    this.messagesInvalidTotal++;
  }

  public incrementMessagesDuplicate(): void {
    this.messagesDuplicateTotal++;
  }

  public incrementUnknownDeviceAttempts(): void {
    this.unknownDeviceAttemptsTotal++;
  }

  // Latency metrics
  public recordIngestionLatency(durationMs: number): void {
    const validMs = Math.max(0, durationMs);
    this.latencyCount++;
    this.latencyTotalMs += validMs;
    this.latencyLastMs = validMs;
    if (validMs < this.latencyMinMs) {
      this.latencyMinMs = validMs;
    }
    if (validMs > this.latencyMaxMs) {
      this.latencyMaxMs = validMs;
    }
  }

  // Device metrics
  public recordDeviceConnected(deviceId: string): void {
    if (deviceId) {
      this.connectedDevices.add(deviceId);
    }
  }

  public recordDeviceDisconnected(deviceId: string): void {
    if (deviceId && this.connectedDevices.has(deviceId)) {
      this.connectedDevices.delete(deviceId);
      this.disconnectedDevicesCount++;
    }
  }

  // Command metrics
  public incrementCommandsPublished(): void {
    this.commandsPublishedTotal++;
  }

  public incrementAcknowledgements(): void {
    this.acknowledgementsTotal++;
  }

  public incrementCommandFailures(): void {
    this.commandFailuresTotal++;
  }

  public incrementCommandTimeouts(): void {
    this.commandTimeoutsTotal++;
  }

  // Snapshot getter
  public getSnapshot(): GatewayMetricsSnapshot {
    const avgMs = this.latencyCount > 0 ? this.latencyTotalMs / this.latencyCount : 0;
    const minMs = this.latencyMinMs === Infinity ? 0 : this.latencyMinMs;

    return {
      broker: {
        state: this.brokerState,
        connectsTotal: this.connectsTotal,
        reconnectsTotal: this.reconnectsTotal,
        errorsTotal: this.errorsTotal,
      },
      messages: {
        receivedTotal: this.messagesReceivedTotal,
        validTotal: this.messagesValidTotal,
        invalidTotal: this.messagesInvalidTotal,
        duplicateTotal: this.messagesDuplicateTotal,
        unknownDeviceAttemptsTotal: this.unknownDeviceAttemptsTotal,
      },
      latency: {
        count: this.latencyCount,
        totalMs: Number(this.latencyTotalMs.toFixed(2)),
        minMs: Number(minMs.toFixed(2)),
        maxMs: Number(this.latencyMaxMs.toFixed(2)),
        avgMs: Number(avgMs.toFixed(2)),
        lastMs: Number(this.latencyLastMs.toFixed(2)),
      },
      devices: {
        connectedCount: this.connectedDevices.size,
        disconnectedCount: this.disconnectedDevicesCount,
        activeDeviceIds: Array.from(this.connectedDevices),
      },
      commands: {
        publishedTotal: this.commandsPublishedTotal,
        acknowledgementsTotal: this.acknowledgementsTotal,
        failuresTotal: this.commandFailuresTotal,
        timeoutsTotal: this.commandTimeoutsTotal,
      },
      uptimeSeconds: Number(((Date.now() - this.startTime) / 1000).toFixed(2)),
      timestamp: new Date().toISOString(),
    };
  }

  public reset(): void {
    this.startTime = Date.now();
    this.brokerState = 'DISCONNECTED';
    this.connectsTotal = 0;
    this.reconnectsTotal = 0;
    this.errorsTotal = 0;
    this.messagesReceivedTotal = 0;
    this.messagesValidTotal = 0;
    this.messagesInvalidTotal = 0;
    this.messagesDuplicateTotal = 0;
    this.unknownDeviceAttemptsTotal = 0;
    this.latencyCount = 0;
    this.latencyTotalMs = 0;
    this.latencyMinMs = Infinity;
    this.latencyMaxMs = 0;
    this.latencyLastMs = 0;
    this.connectedDevices.clear();
    this.disconnectedDevicesCount = 0;
    this.commandsPublishedTotal = 0;
    this.acknowledgementsTotal = 0;
    this.commandFailuresTotal = 0;
    this.commandTimeoutsTotal = 0;
  }
}

export const metricsCollector = new GatewayMetricsCollector();

/**
 * Generates a correlation identifier for tracking message / ingestion lifecycle.
 */
export function generateCorrelationId(prefix: string = 'corr'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Builds correlation metadata ensuring secrets are redacted.
 */
export function createCorrelationMeta(meta: CorrelationMeta): Record<string, unknown> {
  const correlationId = meta.correlationId || generateCorrelationId();
  const rawMeta: Record<string, unknown> = {
    correlationId,
    ...meta,
  };
  return redactSecrets(rawMeta);
}
