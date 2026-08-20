import { describe, it, expect, beforeEach } from 'vitest';
import { FaucetEventProcessor, determinePhysicalFaucetState } from '../events/processor';
import { GatewayMqttClient } from '../mqtt/client';
import { validateGatewayEnv } from '../config/env';
import { metricsCollector } from '../observability/metrics';
import {
  FaucetCommandStatus,
  FaucetCommandAction,
  DeviceType,
  DeviceAccountStatus,
} from '@kebun-melon/contracts';

describe('TASK-0806: FaucetEventProcessor (Faucet Execution State Machine & Event Processing)', () => {
  const env = validateGatewayEnv({
    NODE_ENV: 'test',
    APP_ENV: 'development',
  });

  const mockWaterNodeDevice = {
    id: 'device-uuid-001',
    deviceId: 'water-tank-001',
    siteId: 'site-01',
    deviceType: DeviceType.WATER_TANK_NODE,
    accountStatus: DeviceAccountStatus.ACTIVE,
    isOnline: true,
  };

  const mockSoilNodeDevice = {
    id: 'device-uuid-002',
    deviceId: 'soil-node-001',
    siteId: 'site-01',
    deviceType: DeviceType.SOIL_NODE,
    accountStatus: DeviceAccountStatus.ACTIVE,
    isOnline: true,
  };

  beforeEach(() => {
    metricsCollector.reset();
  });

  describe('Topic Subscription', () => {
    it('subscribes to canonical faucet event topics pattern on startup', async () => {
      let subscribedTopic = '';
      let listenerRegistered = false;

      const mockMqttClient = {
        subscribe: async (topic: string) => {
          subscribedTopic = topic;
        },
        onMessage: () => {
          listenerRegistered = true;
          return () => {};
        },
      } as unknown as GatewayMqttClient;

      const processor = new FaucetEventProcessor({ env, mqttClient: mockMqttClient });
      await processor.subscribeToEvents();

      expect(subscribedTopic).toBe('agriculture/development/+/+/event/faucet');
      expect(listenerRegistered).toBe(true);
    });
  });

  describe('Authoritative Physical Faucet State Determination Helper', () => {
    it('returns OPEN for COMPLETED OPEN commands', () => {
      expect(determinePhysicalFaucetState(FaucetCommandAction.OPEN, 'COMPLETED')).toBe('OPEN');
      expect(determinePhysicalFaucetState('OPEN', 'COMPLETED')).toBe('OPEN');
    });

    it('returns CLOSED for COMPLETED CLOSE commands', () => {
      expect(determinePhysicalFaucetState(FaucetCommandAction.CLOSE, 'COMPLETED')).toBe('CLOSED');
      expect(determinePhysicalFaucetState('CLOSE', 'COMPLETED')).toBe('CLOSED');
    });

    it('returns UNKNOWN for COMPLETED DISPENSE commands (do not infer CLOSED)', () => {
      expect(determinePhysicalFaucetState(FaucetCommandAction.DISPENSE, 'COMPLETED')).toBe(
        'UNKNOWN'
      );
      expect(determinePhysicalFaucetState('DISPENSE', 'COMPLETED')).toBe('UNKNOWN');
    });

    it('returns UNKNOWN for IN_PROGRESS or FAILED states regardless of action', () => {
      expect(determinePhysicalFaucetState(FaucetCommandAction.OPEN, 'IN_PROGRESS')).toBe('UNKNOWN');
      expect(determinePhysicalFaucetState(FaucetCommandAction.CLOSE, 'IN_PROGRESS')).toBe(
        'UNKNOWN'
      );
      expect(determinePhysicalFaucetState(FaucetCommandAction.DISPENSE, 'IN_PROGRESS')).toBe(
        'UNKNOWN'
      );
      expect(determinePhysicalFaucetState(FaucetCommandAction.OPEN, 'FAILED')).toBe('UNKNOWN');
      expect(determinePhysicalFaucetState(FaucetCommandAction.CLOSE, 'FAILED')).toBe('UNKNOWN');
      expect(determinePhysicalFaucetState(FaucetCommandAction.DISPENSE, 'FAILED')).toBe('UNKNOWN');
    });
  });

  describe('Command Action Validation', () => {
    it('rejects events for commands with invalid/unsupported persisted action', async () => {
      const mockCommand = {
        id: 'cmd-uuid-1',
        commandId: 'cmd-01JXYZ123',
        deviceId: 'water-tank-001',
        action: 'INVALID_ACTION',
        status: FaucetCommandStatus.IN_PROGRESS,
        events: [],
      };

      const mockFaucetCommandRepo = {
        getCommandById: async () => mockCommand as any,
      };

      const mockDeviceRepo = {
        getDeviceByCanonicalId: async () => mockWaterNodeDevice as any,
      };

      const processor = new FaucetEventProcessor({
        env,
        faucetCommandRepo: mockFaucetCommandRepo as any,
        deviceRepo: mockDeviceRepo as any,
      });

      const topic = 'agriculture/development/site-01/water-tank-001/event/faucet';
      const eventPayload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          messageId: 'event-msg-act-1',
          commandId: 'cmd-01JXYZ123',
          deviceId: 'water-tank-001',
          data: {
            status: 'IN_PROGRESS',
          },
        })
      );

      const result = await processor.processEventMessage(topic, eventPayload);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('Invalid or unsupported command action');
    });
  });

  describe('IN_PROGRESS Event Processing', () => {
    it('transitions command status from ACKNOWLEDGED to IN_PROGRESS', async () => {
      let updatedStatus: FaucetCommandStatus | null = null;
      let updateEventData: any = null;

      const mockCommand = {
        id: 'cmd-uuid-1',
        commandId: 'cmd-01JXYZ123',
        deviceId: 'water-tank-001',
        action: FaucetCommandAction.DISPENSE,
        status: FaucetCommandStatus.ACKNOWLEDGED,
        events: [],
      };

      const mockFaucetCommandRepo = {
        getCommandById: async (id: string) =>
          id === 'cmd-01JXYZ123' ? (mockCommand as any) : null,
        updateCommandStatus: async (_id: string, status: FaucetCommandStatus, eventData: any) => {
          updatedStatus = status;
          updateEventData = eventData;
          return { ...mockCommand, status };
        },
      };

      const mockDeviceRepo = {
        getDeviceByCanonicalId: async (id: string) =>
          id === 'water-tank-001' ? (mockWaterNodeDevice as any) : null,
      };

      const processor = new FaucetEventProcessor({
        env,
        faucetCommandRepo: mockFaucetCommandRepo as any,
        deviceRepo: mockDeviceRepo as any,
      });

      const topic = 'agriculture/development/site-01/water-tank-001/event/faucet';
      const eventPayload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          messageId: 'event-msg-001',
          commandId: 'cmd-01JXYZ123',
          deviceId: 'water-tank-001',
          recordedAt: '2026-08-03T10:05:00.000Z',
          data: {
            status: 'IN_PROGRESS',
            actualVolumeMl: 450,
          },
        })
      );

      const result = await processor.processEventMessage(topic, eventPayload);

      expect(result.success).toBe(true);
      expect(updatedStatus).toBe(FaucetCommandStatus.IN_PROGRESS);
      expect(updateEventData).toMatchObject({
        messageId: 'event-msg-001',
        actualVolumeMl: 450,
        metadata: {
          eventData: {
            status: 'IN_PROGRESS',
            actualVolumeMl: 450,
          },
          physicalState: 'UNKNOWN',
          action: FaucetCommandAction.DISPENSE,
        },
      });
    });

    it('appends progress event log when command is already IN_PROGRESS', async () => {
      let appendedEvent: any = null;

      const mockCommand = {
        id: 'cmd-uuid-1',
        commandId: 'cmd-01JXYZ123',
        deviceId: 'water-tank-001',
        action: FaucetCommandAction.DISPENSE,
        status: FaucetCommandStatus.IN_PROGRESS,
        events: [],
      };

      const mockFaucetCommandRepo = {
        getCommandById: async (id: string) =>
          id === 'cmd-01JXYZ123' ? (mockCommand as any) : null,
        addCommandEvent: async (_id: string, eventData: any) => {
          appendedEvent = eventData;
          return { id: 'evt-002', eventStatus: FaucetCommandStatus.IN_PROGRESS, ...eventData };
        },
      };

      const mockDeviceRepo = {
        getDeviceByCanonicalId: async (id: string) =>
          id === 'water-tank-001' ? (mockWaterNodeDevice as any) : null,
      };

      const processor = new FaucetEventProcessor({
        env,
        faucetCommandRepo: mockFaucetCommandRepo as any,
        deviceRepo: mockDeviceRepo as any,
      });

      const topic = 'agriculture/development/site-01/water-tank-001/event/faucet';
      const eventPayload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          messageId: 'event-msg-002',
          commandId: 'cmd-01JXYZ123',
          deviceId: 'water-tank-001',
          data: {
            status: 'IN_PROGRESS',
            actualVolumeMl: 750,
          },
        })
      );

      const result = await processor.processEventMessage(topic, eventPayload);

      expect(result.success).toBe(true);
      expect(appendedEvent).toMatchObject({
        eventStatus: FaucetCommandStatus.IN_PROGRESS,
        messageId: 'event-msg-002',
        actualVolumeMl: 750,
        metadata: {
          physicalState: 'UNKNOWN',
          action: FaucetCommandAction.DISPENSE,
        },
      });
    });
  });

  describe('COMPLETED Event Processing - DISPENSE Action', () => {
    it('transitions DISPENSE from IN_PROGRESS to COMPLETED with actualVolumeMl and physicalState UNKNOWN', async () => {
      let updatedStatus: FaucetCommandStatus | null = null;
      let updateEventData: any = null;

      const mockCommand = {
        id: 'cmd-uuid-1',
        commandId: 'cmd-01JXYZ123',
        deviceId: 'water-tank-001',
        action: FaucetCommandAction.DISPENSE,
        status: FaucetCommandStatus.IN_PROGRESS,
        targetVolumeMl: 1000,
        events: [],
      };

      const mockFaucetCommandRepo = {
        getCommandById: async (id: string) =>
          id === 'cmd-01JXYZ123' ? (mockCommand as any) : null,
        updateCommandStatus: async (_id: string, status: FaucetCommandStatus, eventData: any) => {
          updatedStatus = status;
          updateEventData = eventData;
          return { ...mockCommand, status };
        },
      };

      const mockDeviceRepo = {
        getDeviceByCanonicalId: async (id: string) =>
          id === 'water-tank-001' ? (mockWaterNodeDevice as any) : null,
      };

      const processor = new FaucetEventProcessor({
        env,
        faucetCommandRepo: mockFaucetCommandRepo as any,
        deviceRepo: mockDeviceRepo as any,
      });

      const topic = 'agriculture/development/site-01/water-tank-001/event/faucet';
      const eventPayload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          messageId: 'event-msg-003',
          commandId: 'cmd-01JXYZ123',
          deviceId: 'water-tank-001',
          data: {
            status: 'COMPLETED',
            targetVolumeMl: 1000,
            actualVolumeMl: 1005,
          },
        })
      );

      const result = await processor.processEventMessage(topic, eventPayload);

      expect(result.success).toBe(true);
      expect(updatedStatus).toBe(FaucetCommandStatus.COMPLETED);
      expect(updateEventData).toMatchObject({
        messageId: 'event-msg-003',
        actualVolumeMl: 1005,
        metadata: {
          physicalState: 'UNKNOWN',
          action: FaucetCommandAction.DISPENSE,
        },
      });
    });

    it('transitions DISPENSE to COMPLETED when actualVolumeMl is omitted', async () => {
      let updatedStatus: FaucetCommandStatus | null = null;
      let updateEventData: any = null;

      const mockCommand = {
        id: 'cmd-uuid-1',
        commandId: 'cmd-01JXYZ123',
        deviceId: 'water-tank-001',
        action: FaucetCommandAction.DISPENSE,
        status: FaucetCommandStatus.IN_PROGRESS,
        targetVolumeMl: 300,
        events: [],
      };

      const mockFaucetCommandRepo = {
        getCommandById: async () => mockCommand as any,
        updateCommandStatus: async (_id: string, status: FaucetCommandStatus, eventData: any) => {
          updatedStatus = status;
          updateEventData = eventData;
          return { ...mockCommand, status };
        },
      };

      const mockDeviceRepo = {
        getDeviceByCanonicalId: async () => mockWaterNodeDevice as any,
      };

      const processor = new FaucetEventProcessor({
        env,
        faucetCommandRepo: mockFaucetCommandRepo as any,
        deviceRepo: mockDeviceRepo as any,
      });

      const topic = 'agriculture/development/site-01/water-tank-001/event/faucet';
      const eventPayload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          messageId: 'event-msg-dispense-novol',
          commandId: 'cmd-01JXYZ123',
          deviceId: 'water-tank-001',
          data: {
            status: 'COMPLETED',
            targetVolumeMl: 300,
          },
        })
      );

      const result = await processor.processEventMessage(topic, eventPayload);

      expect(result.success).toBe(true);
      expect(updatedStatus).toBe(FaucetCommandStatus.COMPLETED);
      expect(updateEventData.metadata.physicalState).toBe('UNKNOWN');
      expect(updateEventData.actualVolumeMl).toBeUndefined();
    });

    it('rejects DISPENSE COMPLETED event targetVolumeMl mismatch', async () => {
      const mockCommand = {
        id: 'cmd-uuid-1',
        commandId: 'cmd-01JXYZ123',
        deviceId: 'water-tank-001',
        action: FaucetCommandAction.DISPENSE,
        status: FaucetCommandStatus.IN_PROGRESS,
        targetVolumeMl: 1000,
        events: [],
      };

      const mockFaucetCommandRepo = {
        getCommandById: async () => mockCommand as any,
      };

      const mockDeviceRepo = {
        getDeviceByCanonicalId: async () => mockWaterNodeDevice as any,
      };

      const processor = new FaucetEventProcessor({
        env,
        faucetCommandRepo: mockFaucetCommandRepo as any,
        deviceRepo: mockDeviceRepo as any,
      });

      const topic = 'agriculture/development/site-01/water-tank-001/event/faucet';

      // Mismatched targetVolumeMl (1500 vs 1000)
      const mismatchPayload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          messageId: 'evt-mismatch-vol',
          commandId: 'cmd-01JXYZ123',
          deviceId: 'water-tank-001',
          data: {
            status: 'COMPLETED',
            targetVolumeMl: 1500,
            actualVolumeMl: 1500,
          },
        })
      );

      const resultMismatch = await processor.processEventMessage(topic, mismatchPayload);
      expect(resultMismatch.success).toBe(false);
      expect(resultMismatch.reason).toBe('Target volume mismatch in COMPLETED event');
    });
  });

  describe('COMPLETED Event Processing - OPEN Action', () => {
    it('transitions OPEN from IN_PROGRESS to COMPLETED and sets physicalState to OPEN', async () => {
      let updatedStatus: FaucetCommandStatus | null = null;
      let updateEventData: any = null;

      const mockCommand = {
        id: 'cmd-uuid-open-1',
        commandId: 'cmd-open-001',
        deviceId: 'water-tank-001',
        action: FaucetCommandAction.OPEN,
        status: FaucetCommandStatus.IN_PROGRESS,
        targetVolumeMl: null,
        events: [],
      };

      const mockFaucetCommandRepo = {
        getCommandById: async () => mockCommand as any,
        updateCommandStatus: async (_id: string, status: FaucetCommandStatus, eventData: any) => {
          updatedStatus = status;
          updateEventData = eventData;
          return { ...mockCommand, status };
        },
      };

      const mockDeviceRepo = {
        getDeviceByCanonicalId: async () => mockWaterNodeDevice as any,
      };

      const processor = new FaucetEventProcessor({
        env,
        faucetCommandRepo: mockFaucetCommandRepo as any,
        deviceRepo: mockDeviceRepo as any,
      });

      const topic = 'agriculture/development/site-01/water-tank-001/event/faucet';
      const eventPayload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          messageId: 'event-msg-open-comp',
          commandId: 'cmd-open-001',
          deviceId: 'water-tank-001',
          data: {
            status: 'COMPLETED',
          },
        })
      );

      const result = await processor.processEventMessage(topic, eventPayload);

      expect(result.success).toBe(true);
      expect(updatedStatus).toBe(FaucetCommandStatus.COMPLETED);
      expect(updateEventData).toMatchObject({
        messageId: 'event-msg-open-comp',
        metadata: {
          physicalState: 'OPEN',
          action: FaucetCommandAction.OPEN,
        },
      });
    });

    it('completes OPEN command even if actualVolumeMl is provided in event, ignoring it on command record', async () => {
      let updatedStatus: FaucetCommandStatus | null = null;
      let updateEventData: any = null;

      const mockCommand = {
        id: 'cmd-uuid-open-1',
        commandId: 'cmd-open-001',
        deviceId: 'water-tank-001',
        action: FaucetCommandAction.OPEN,
        status: FaucetCommandStatus.IN_PROGRESS,
        targetVolumeMl: null,
        events: [],
      };

      const mockFaucetCommandRepo = {
        getCommandById: async () => mockCommand as any,
        updateCommandStatus: async (_id: string, status: FaucetCommandStatus, eventData: any) => {
          updatedStatus = status;
          updateEventData = eventData;
          return { ...mockCommand, status };
        },
      };

      const mockDeviceRepo = {
        getDeviceByCanonicalId: async () => mockWaterNodeDevice as any,
      };

      const processor = new FaucetEventProcessor({
        env,
        faucetCommandRepo: mockFaucetCommandRepo as any,
        deviceRepo: mockDeviceRepo as any,
      });

      const topic = 'agriculture/development/site-01/water-tank-001/event/faucet';
      const eventPayload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          messageId: 'event-msg-open-actvol',
          commandId: 'cmd-open-001',
          deviceId: 'water-tank-001',
          data: {
            status: 'COMPLETED',
            actualVolumeMl: 100,
          },
        })
      );

      const result = await processor.processEventMessage(topic, eventPayload);
      expect(result.success).toBe(true);
      expect(updatedStatus).toBe(FaucetCommandStatus.COMPLETED);
      expect(updateEventData.actualVolumeMl).toBeUndefined();
      expect(updateEventData.metadata.physicalState).toBe('OPEN');
    });
  });

  describe('COMPLETED Event Processing - CLOSE Action', () => {
    it('transitions CLOSE from IN_PROGRESS to COMPLETED and sets physicalState to CLOSED', async () => {
      let updatedStatus: FaucetCommandStatus | null = null;
      let updateEventData: any = null;

      const mockCommand = {
        id: 'cmd-uuid-close-1',
        commandId: 'cmd-close-001',
        deviceId: 'water-tank-001',
        action: FaucetCommandAction.CLOSE,
        status: FaucetCommandStatus.IN_PROGRESS,
        targetVolumeMl: null,
        events: [],
      };

      const mockFaucetCommandRepo = {
        getCommandById: async () => mockCommand as any,
        updateCommandStatus: async (_id: string, status: FaucetCommandStatus, eventData: any) => {
          updatedStatus = status;
          updateEventData = eventData;
          return { ...mockCommand, status };
        },
      };

      const mockDeviceRepo = {
        getDeviceByCanonicalId: async () => mockWaterNodeDevice as any,
      };

      const processor = new FaucetEventProcessor({
        env,
        faucetCommandRepo: mockFaucetCommandRepo as any,
        deviceRepo: mockDeviceRepo as any,
      });

      const topic = 'agriculture/development/site-01/water-tank-001/event/faucet';
      const eventPayload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          messageId: 'event-msg-close-comp',
          commandId: 'cmd-close-001',
          deviceId: 'water-tank-001',
          data: {
            status: 'COMPLETED',
          },
        })
      );

      const result = await processor.processEventMessage(topic, eventPayload);

      expect(result.success).toBe(true);
      expect(updatedStatus).toBe(FaucetCommandStatus.COMPLETED);
      expect(updateEventData).toMatchObject({
        messageId: 'event-msg-close-comp',
        actualVolumeMl: undefined,
        metadata: {
          physicalState: 'CLOSED',
          action: FaucetCommandAction.CLOSE,
        },
      });
    });

    it('completes CLOSE command even if actualVolumeMl is provided in event, ignoring it on command record', async () => {
      let updatedStatus: FaucetCommandStatus | null = null;
      let updateEventData: any = null;

      const mockCommand = {
        id: 'cmd-uuid-close-1',
        commandId: 'cmd-close-001',
        deviceId: 'water-tank-001',
        action: FaucetCommandAction.CLOSE,
        status: FaucetCommandStatus.IN_PROGRESS,
        targetVolumeMl: null,
        events: [],
      };

      const mockFaucetCommandRepo = {
        getCommandById: async () => mockCommand as any,
        updateCommandStatus: async (_id: string, status: FaucetCommandStatus, eventData: any) => {
          updatedStatus = status;
          updateEventData = eventData;
          return { ...mockCommand, status };
        },
      };

      const mockDeviceRepo = {
        getDeviceByCanonicalId: async () => mockWaterNodeDevice as any,
      };

      const processor = new FaucetEventProcessor({
        env,
        faucetCommandRepo: mockFaucetCommandRepo as any,
        deviceRepo: mockDeviceRepo as any,
      });

      const topic = 'agriculture/development/site-01/water-tank-001/event/faucet';
      const eventPayload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          messageId: 'event-msg-close-actvol',
          commandId: 'cmd-close-001',
          deviceId: 'water-tank-001',
          data: {
            status: 'COMPLETED',
            actualVolumeMl: 50,
          },
        })
      );

      const result = await processor.processEventMessage(topic, eventPayload);
      expect(result.success).toBe(true);
      expect(updatedStatus).toBe(FaucetCommandStatus.COMPLETED);
      expect(updateEventData.actualVolumeMl).toBeUndefined();
      expect(updateEventData.metadata.physicalState).toBe('CLOSED');
    });
  });

  describe('FAILED Event Processing', () => {
    it('transitions command status from IN_PROGRESS to FAILED with reasonCode and physicalState UNKNOWN', async () => {
      let updatedStatus: FaucetCommandStatus | null = null;
      let updateEventData: any = null;

      const mockCommand = {
        id: 'cmd-uuid-1',
        commandId: 'cmd-01JXYZ123',
        deviceId: 'water-tank-001',
        action: FaucetCommandAction.DISPENSE,
        status: FaucetCommandStatus.IN_PROGRESS,
        events: [],
      };

      const mockFaucetCommandRepo = {
        getCommandById: async (id: string) =>
          id === 'cmd-01JXYZ123' ? (mockCommand as any) : null,
        updateCommandStatus: async (_id: string, status: FaucetCommandStatus, eventData: any) => {
          updatedStatus = status;
          updateEventData = eventData;
          return { ...mockCommand, status };
        },
      };

      const mockDeviceRepo = {
        getDeviceByCanonicalId: async (id: string) =>
          id === 'water-tank-001' ? (mockWaterNodeDevice as any) : null,
      };

      let createdAlertInput: any = null;
      const mockAlertRepo = {
        createCommandFailureAlert: async (input: any) => {
          createdAlertInput = input;
          return { id: 'alert-fail-002', ...input };
        },
      };

      const processor = new FaucetEventProcessor({
        env,
        faucetCommandRepo: mockFaucetCommandRepo as any,
        deviceRepo: mockDeviceRepo as any,
        alertRepo: mockAlertRepo as any,
      });

      const topic = 'agriculture/development/site-01/water-tank-001/event/faucet';
      const eventPayload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          messageId: 'event-msg-004',
          commandId: 'cmd-01JXYZ123',
          deviceId: 'water-tank-001',
          data: {
            status: 'FAILED',
            reasonCode: 'FLOW_NOT_DETECTED',
          },
        })
      );

      const result = await processor.processEventMessage(topic, eventPayload);

      expect(result.success).toBe(true);
      expect(updatedStatus).toBe(FaucetCommandStatus.FAILED);
      expect(updateEventData).toMatchObject({
        messageId: 'event-msg-004',
        reasonCode: 'FLOW_NOT_DETECTED',
        metadata: {
          physicalState: 'UNKNOWN',
          action: FaucetCommandAction.DISPENSE,
        },
      });
      expect(createdAlertInput).toMatchObject({
        deviceId: mockWaterNodeDevice.id,
        commandId: mockCommand.id,
        reasonCode: 'FLOW_NOT_DETECTED',
        metadata: {
          physicalOutcome: 'UNKNOWN',
          action: FaucetCommandAction.DISPENSE,
        },
      });
    });

    it('transitions command status from ACKNOWLEDGED to FAILED on early failure', async () => {
      let updatedStatus: FaucetCommandStatus | null = null;

      const mockCommand = {
        id: 'cmd-uuid-ack-fail',
        commandId: 'cmd-ack-fail-01',
        deviceId: 'water-tank-001',
        action: FaucetCommandAction.OPEN,
        status: FaucetCommandStatus.ACKNOWLEDGED,
        events: [],
      };

      const mockFaucetCommandRepo = {
        getCommandById: async () => mockCommand as any,
        updateCommandStatus: async (_id: string, status: FaucetCommandStatus) => {
          updatedStatus = status;
          return { ...mockCommand, status };
        },
      };

      const mockDeviceRepo = {
        getDeviceByCanonicalId: async () => mockWaterNodeDevice as any,
      };

      const mockAlertRepo = {
        createCommandFailureAlert: async () => ({ id: 'alert-fail-003' }),
      };

      const processor = new FaucetEventProcessor({
        env,
        faucetCommandRepo: mockFaucetCommandRepo as any,
        deviceRepo: mockDeviceRepo as any,
        alertRepo: mockAlertRepo as any,
      });

      const topic = 'agriculture/development/site-01/water-tank-001/event/faucet';
      const eventPayload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          messageId: 'event-msg-ack-fail',
          commandId: 'cmd-ack-fail-01',
          deviceId: 'water-tank-001',
          data: {
            status: 'FAILED',
            reasonCode: 'HARDWARE_FAULT',
          },
        })
      );

      const result = await processor.processEventMessage(topic, eventPayload);
      expect(result.success).toBe(true);
      expect(updatedStatus).toBe(FaucetCommandStatus.FAILED);
    });
  });

  describe('State Regression & Terminal State Protection', () => {
    it('ignores events for commands already in terminal state COMPLETED', async () => {
      let updateCalled = false;

      const mockCommand = {
        id: 'cmd-uuid-1',
        commandId: 'cmd-01JXYZ123',
        deviceId: 'water-tank-001',
        action: FaucetCommandAction.DISPENSE,
        status: FaucetCommandStatus.COMPLETED,
        events: [],
      };

      const mockFaucetCommandRepo = {
        getCommandById: async () => mockCommand as any,
        updateCommandStatus: async () => {
          updateCalled = true;
          return mockCommand as any;
        },
      };

      const mockDeviceRepo = {
        getDeviceByCanonicalId: async () => mockWaterNodeDevice as any,
      };

      const processor = new FaucetEventProcessor({
        env,
        faucetCommandRepo: mockFaucetCommandRepo as any,
        deviceRepo: mockDeviceRepo as any,
      });

      const topic = 'agriculture/development/site-01/water-tank-001/event/faucet';
      const eventPayload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          messageId: 'event-msg-late',
          commandId: 'cmd-01JXYZ123',
          deviceId: 'water-tank-001',
          data: {
            status: 'FAILED',
            reasonCode: 'LATE_ERROR',
          },
        })
      );

      const result = await processor.processEventMessage(topic, eventPayload);

      expect(result.success).toBe(true);
      expect(result.reason).toContain('terminal state');
      expect(updateCalled).toBe(false);
    });

    it('ignores events for commands already in terminal state FAILED', async () => {
      let updateCalled = false;

      const mockCommand = {
        id: 'cmd-uuid-1',
        commandId: 'cmd-01JXYZ123',
        deviceId: 'water-tank-001',
        action: FaucetCommandAction.DISPENSE,
        status: FaucetCommandStatus.FAILED,
        events: [],
      };

      const mockFaucetCommandRepo = {
        getCommandById: async () => mockCommand as any,
        updateCommandStatus: async () => {
          updateCalled = true;
          return mockCommand as any;
        },
      };

      const mockDeviceRepo = {
        getDeviceByCanonicalId: async () => mockWaterNodeDevice as any,
      };

      const processor = new FaucetEventProcessor({
        env,
        faucetCommandRepo: mockFaucetCommandRepo as any,
        deviceRepo: mockDeviceRepo as any,
      });

      const topic = 'agriculture/development/site-01/water-tank-001/event/faucet';
      const eventPayload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          messageId: 'event-msg-late-failed',
          commandId: 'cmd-01JXYZ123',
          deviceId: 'water-tank-001',
          data: {
            status: 'COMPLETED',
            actualVolumeMl: 500,
          },
        })
      );

      const result = await processor.processEventMessage(topic, eventPayload);

      expect(result.success).toBe(true);
      expect(result.reason).toContain('terminal state');
      expect(updateCalled).toBe(false);
    });

    it('ignores events for commands already in terminal state TIMEOUT', async () => {
      let updateCalled = false;

      const mockCommand = {
        id: 'cmd-uuid-timeout',
        commandId: 'cmd-timeout-01',
        deviceId: 'water-tank-001',
        action: FaucetCommandAction.OPEN,
        status: FaucetCommandStatus.TIMEOUT,
        events: [],
      };

      const mockFaucetCommandRepo = {
        getCommandById: async () => mockCommand as any,
        updateCommandStatus: async () => {
          updateCalled = true;
          return mockCommand as any;
        },
      };

      const mockDeviceRepo = {
        getDeviceByCanonicalId: async () => mockWaterNodeDevice as any,
      };

      const processor = new FaucetEventProcessor({
        env,
        faucetCommandRepo: mockFaucetCommandRepo as any,
        deviceRepo: mockDeviceRepo as any,
      });

      const topic = 'agriculture/development/site-01/water-tank-001/event/faucet';
      const eventPayload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          messageId: 'event-msg-late-timeout',
          commandId: 'cmd-timeout-01',
          deviceId: 'water-tank-001',
          data: {
            status: 'COMPLETED',
          },
        })
      );

      const result = await processor.processEventMessage(topic, eventPayload);

      expect(result.success).toBe(true);
      expect(result.reason).toContain('terminal state');
      expect(updateCalled).toBe(false);
    });

    it('ignores invalid initial state transitions (e.g. IN_PROGRESS while QUEUED)', async () => {
      let updateCalled = false;

      const mockCommand = {
        id: 'cmd-uuid-1',
        commandId: 'cmd-01JXYZ123',
        deviceId: 'water-tank-001',
        action: FaucetCommandAction.DISPENSE,
        status: FaucetCommandStatus.QUEUED,
        events: [],
      };

      const mockFaucetCommandRepo = {
        getCommandById: async () => mockCommand as any,
        updateCommandStatus: async () => {
          updateCalled = true;
          return mockCommand as any;
        },
      };

      const mockDeviceRepo = {
        getDeviceByCanonicalId: async () => mockWaterNodeDevice as any,
      };

      const processor = new FaucetEventProcessor({
        env,
        faucetCommandRepo: mockFaucetCommandRepo as any,
        deviceRepo: mockDeviceRepo as any,
      });

      const topic = 'agriculture/development/site-01/water-tank-001/event/faucet';
      const eventPayload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          messageId: 'event-msg-queued',
          commandId: 'cmd-01JXYZ123',
          deviceId: 'water-tank-001',
          data: {
            status: 'IN_PROGRESS',
          },
        })
      );

      const result = await processor.processEventMessage(topic, eventPayload);

      expect(result.success).toBe(true);
      expect(result.reason).toBe("IN_PROGRESS event ignored because command status is 'QUEUED'");
      expect(updateCalled).toBe(false);
    });

    it('rejects direct ACKNOWLEDGED -> COMPLETED transition', async () => {
      let updateCalled = false;

      const mockCommand = {
        id: 'cmd-uuid-1',
        commandId: 'cmd-01JXYZ123',
        deviceId: 'water-tank-001',
        action: FaucetCommandAction.DISPENSE,
        status: FaucetCommandStatus.ACKNOWLEDGED,
        targetVolumeMl: 1000,
        events: [],
      };

      const mockFaucetCommandRepo = {
        getCommandById: async () => mockCommand as any,
        updateCommandStatus: async () => {
          updateCalled = true;
          return mockCommand as any;
        },
      };

      const mockDeviceRepo = {
        getDeviceByCanonicalId: async () => mockWaterNodeDevice as any,
      };

      const processor = new FaucetEventProcessor({
        env,
        faucetCommandRepo: mockFaucetCommandRepo as any,
        deviceRepo: mockDeviceRepo as any,
      });

      const topic = 'agriculture/development/site-01/water-tank-001/event/faucet';
      const eventPayload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          messageId: 'evt-direct-completed',
          commandId: 'cmd-01JXYZ123',
          deviceId: 'water-tank-001',
          data: {
            status: 'COMPLETED',
            actualVolumeMl: 1000,
          },
        })
      );

      const result = await processor.processEventMessage(topic, eventPayload);
      expect(result.success).toBe(true);
      expect(result.reason).toBe(
        "COMPLETED event ignored because command status is 'ACKNOWLEDGED'"
      );
      expect(updateCalled).toBe(false);
    });
  });

  describe('Duplicate messageId Idempotency', () => {
    it('handles duplicate messageId idempotently without DB update', async () => {
      let updateCalled = false;

      const mockCommand = {
        id: 'cmd-uuid-1',
        commandId: 'cmd-01JXYZ123',
        deviceId: 'water-tank-001',
        action: FaucetCommandAction.DISPENSE,
        status: FaucetCommandStatus.IN_PROGRESS,
        events: [
          {
            id: 'evt-1',
            messageId: 'event-msg-dup-001',
            eventStatus: FaucetCommandStatus.IN_PROGRESS,
          },
        ],
      };

      const mockFaucetCommandRepo = {
        getCommandById: async () => mockCommand as any,
        updateCommandStatus: async () => {
          updateCalled = true;
          return mockCommand as any;
        },
      };

      const mockDeviceRepo = {
        getDeviceByCanonicalId: async () => mockWaterNodeDevice as any,
      };

      const processor = new FaucetEventProcessor({
        env,
        faucetCommandRepo: mockFaucetCommandRepo as any,
        deviceRepo: mockDeviceRepo as any,
      });

      const topic = 'agriculture/development/site-01/water-tank-001/event/faucet';
      const eventPayload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          messageId: 'event-msg-dup-001',
          commandId: 'cmd-01JXYZ123',
          deviceId: 'water-tank-001',
          data: {
            status: 'COMPLETED',
          },
        })
      );

      const result = await processor.processEventMessage(topic, eventPayload);

      expect(result.success).toBe(true);
      expect(result.reason).toContain('Duplicate messageId handled idempotently');
      expect(updateCalled).toBe(false);
    });
  });

  describe('Validation & Boundary Checks', () => {
    it('rejects topic and payload deviceId mismatch', async () => {
      const processor = new FaucetEventProcessor({ env });
      const topic = 'agriculture/development/site-01/water-tank-001/event/faucet';
      const payload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          messageId: 'evt-001',
          commandId: 'cmd-001',
          deviceId: 'different-device-id',
          data: { status: 'IN_PROGRESS' },
        })
      );

      const result = await processor.processEventMessage(topic, payload);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('Topic and payload deviceId mismatch');
    });

    it('rejects events for non-WATER_TANK_NODE devices', async () => {
      const mockFaucetCommandRepo = {
        getCommandById: async () =>
          ({
            id: 'cmd-1',
            commandId: 'cmd-001',
            deviceId: 'soil-node-001',
            action: FaucetCommandAction.DISPENSE,
          }) as any,
      };

      const mockDeviceRepo = {
        getDeviceByCanonicalId: async () => mockSoilNodeDevice as any,
      };

      const processor = new FaucetEventProcessor({
        env,
        faucetCommandRepo: mockFaucetCommandRepo as any,
        deviceRepo: mockDeviceRepo as any,
      });

      const topic = 'agriculture/development/site-01/soil-node-001/event/faucet';
      const payload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          messageId: 'evt-001',
          commandId: 'cmd-001',
          deviceId: 'soil-node-001',
          data: { status: 'IN_PROGRESS' },
        })
      );

      const result = await processor.processEventMessage(topic, payload);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('Device is not a WATER_TANK_NODE');
    });

    it('rejects topic siteId mismatch with resolved device siteId', async () => {
      const mockDeviceRepo = {
        getDeviceByCanonicalId: async () => mockWaterNodeDevice as any, // siteId is 'site-01'
      };

      const processor = new FaucetEventProcessor({
        env,
        deviceRepo: mockDeviceRepo as any,
      });

      // Topic specifies 'site-99' while device siteId is 'site-01'
      const topic = 'agriculture/development/site-99/water-tank-001/event/faucet';
      const payload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          messageId: 'evt-001',
          commandId: 'cmd-001',
          deviceId: 'water-tank-001',
          data: { status: 'IN_PROGRESS' },
        })
      );

      const result = await processor.processEventMessage(topic, payload);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('Topic siteId mismatch with device site');
    });

    it('rejects unknown commandId', async () => {
      const mockFaucetCommandRepo = {
        getCommandById: async () => null,
      };

      const mockDeviceRepo = {
        getDeviceByCanonicalId: async () => mockWaterNodeDevice as any,
      };

      const processor = new FaucetEventProcessor({
        env,
        faucetCommandRepo: mockFaucetCommandRepo as any,
        deviceRepo: mockDeviceRepo as any,
      });

      const topic = 'agriculture/development/site-01/water-tank-001/event/faucet';
      const payload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          messageId: 'evt-unk-cmd',
          commandId: 'cmd-unknown',
          deviceId: 'water-tank-001',
          data: { status: 'IN_PROGRESS' },
        })
      );

      const result = await processor.processEventMessage(topic, payload);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('Unknown commandId');
    });

    it('rejects command deviceId mismatch with resolved device', async () => {
      const mockCommand = {
        id: 'cmd-uuid-mismatch',
        commandId: 'cmd-01JXYZ123',
        deviceId: 'other-device-uuid-999',
        action: FaucetCommandAction.DISPENSE,
        status: FaucetCommandStatus.IN_PROGRESS,
        events: [],
      };

      const mockFaucetCommandRepo = {
        getCommandById: async () => mockCommand as any,
      };

      const mockDeviceRepo = {
        getDeviceByCanonicalId: async () => mockWaterNodeDevice as any,
      };

      const processor = new FaucetEventProcessor({
        env,
        faucetCommandRepo: mockFaucetCommandRepo as any,
        deviceRepo: mockDeviceRepo as any,
      });

      const topic = 'agriculture/development/site-01/water-tank-001/event/faucet';
      const payload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          messageId: 'evt-dev-mismatch',
          commandId: 'cmd-01JXYZ123',
          deviceId: 'water-tank-001',
          data: { status: 'IN_PROGRESS' },
        })
      );

      const result = await processor.processEventMessage(topic, payload);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('Command target deviceId mismatch');
    });

    it('rejects invalid JSON payload', async () => {
      const processor = new FaucetEventProcessor({ env });
      const topic = 'agriculture/development/site-01/water-tank-001/event/faucet';
      const invalidJsonPayload = Buffer.from('NOT_JSON_PAYLOAD');

      const result = await processor.processEventMessage(topic, invalidJsonPayload);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('Invalid JSON payload');
    });

    it('rejects schema-invalid payload', async () => {
      const processor = new FaucetEventProcessor({ env });
      const topic = 'agriculture/development/site-01/water-tank-001/event/faucet';
      const invalidSchemaPayload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          // missing messageId, commandId, deviceId
          data: { status: 'INVALID_STATUS' },
        })
      );

      const result = await processor.processEventMessage(topic, invalidSchemaPayload);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('Payload schema validation failed');
    });
  });
});
