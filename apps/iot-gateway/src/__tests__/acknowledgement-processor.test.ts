import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AcknowledgementProcessor } from '../acknowledgements/processor';
import { GatewayMqttClient } from '../mqtt/client';
import { validateGatewayEnv } from '../config/env';
import { metricsCollector } from '../observability/metrics';
import { FaucetCommandStatus, DeviceType, DeviceAccountStatus } from '@kebun-melon/contracts';

describe('TASK-0805: AcknowledgementProcessor (Device Acknowledgement Processing)', () => {
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
    it('subscribes to canonical faucet ACK topics pattern on startup', async () => {
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

      const processor = new AcknowledgementProcessor({ env, mqttClient: mockMqttClient });
      await processor.subscribeToAcknowledgements();

      expect(subscribedTopic).toBe('agriculture/development/+/+/ack/faucet');
      expect(listenerRegistered).toBe(true);
    });
  });

  describe('Accepted ACK Processing (SENT -> ACKNOWLEDGED only)', () => {
    it('processes accepted ACK and transitions command from SENT to ACKNOWLEDGED', async () => {
      let updatedStatus: FaucetCommandStatus | null = null;
      let updateEventData: any = null;

      const mockCommand = {
        id: 'cmd-uuid-1',
        commandId: 'cmd-01JXYZ123',
        deviceId: 'water-tank-001',
        status: FaucetCommandStatus.SENT,
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

      const processor = new AcknowledgementProcessor({
        env,
        faucetCommandRepo: mockFaucetCommandRepo as any,
        deviceRepo: mockDeviceRepo as any,
      });

      const topic = 'agriculture/development/site-01/water-tank-001/ack/faucet';
      const ackPayload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          messageId: 'ack-msg-001',
          commandId: 'cmd-01JXYZ123',
          deviceId: 'water-tank-001',
          recordedAt: '2026-08-03T10:00:00.000Z',
          data: {
            status: 'ACKNOWLEDGED',
            accepted: true,
          },
        })
      );

      const result = await processor.processAcknowledgementMessage(topic, ackPayload);

      expect(result.success).toBe(true);
      expect(updatedStatus).toBe(FaucetCommandStatus.ACKNOWLEDGED);
      expect(updateEventData).toMatchObject({
        messageId: 'ack-msg-001',
        metadata: {
          ackData: {
            status: 'ACKNOWLEDGED',
            accepted: true,
          },
        },
      });
      // Crucial requirement check: status must NOT be COMPLETED
      expect(updatedStatus).not.toBe(FaucetCommandStatus.COMPLETED);
    });

    it('resolves external deviceId to internal Device.id UUID for command device matching', async () => {
      let updatedStatus: FaucetCommandStatus | null = null;

      // Command stores internal Device.id UUID in FaucetCommand.deviceId
      const mockCommand = {
        id: 'cmd-uuid-uuid-test',
        commandId: 'cmd-uuid-match-001',
        deviceId: 'device-uuid-001', // Internal UUID stored in DB
        status: FaucetCommandStatus.SENT,
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
        // getDeviceByCanonicalId receives external deviceId 'water-tank-001' and returns Device record with id 'device-uuid-001'
        getDeviceByCanonicalId: async (id: string) =>
          id === 'water-tank-001' ? (mockWaterNodeDevice as any) : null,
      };

      const processor = new AcknowledgementProcessor({
        env,
        faucetCommandRepo: mockFaucetCommandRepo as any,
        deviceRepo: mockDeviceRepo as any,
      });

      // MQTT Topic and payload use external canonical deviceId 'water-tank-001'
      const topic = 'agriculture/development/site-01/water-tank-001/ack/faucet';
      const ackPayload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          messageId: 'ack-uuid-match-001',
          commandId: 'cmd-uuid-match-001',
          deviceId: 'water-tank-001',
          data: { status: 'ACKNOWLEDGED', accepted: true },
        })
      );

      const result = await processor.processAcknowledgementMessage(topic, ackPayload);

      expect(result.success).toBe(true);
      expect(updatedStatus).toBe(FaucetCommandStatus.ACKNOWLEDGED);
    });

    it('rejects ACK when command.deviceId does not match resolved Device.id or Device.deviceId', async () => {
      const updateCommandStatusMock = vi.fn();

      const mockCommand = {
        id: 'cmd-uuid-mismatch',
        commandId: 'cmd-mismatch-001',
        deviceId: 'device-uuid-DIFFERENT-999', // Mismatched DB UUID
        status: FaucetCommandStatus.SENT,
        events: [],
      };

      const processor = new AcknowledgementProcessor({
        env,
        faucetCommandRepo: {
          getCommandById: async () => mockCommand as any,
          updateCommandStatus: updateCommandStatusMock,
        } as any,
        deviceRepo: {
          getDeviceByCanonicalId: async () => mockWaterNodeDevice as any, // returns id: 'device-uuid-001'
        } as any,
      });

      const topic = 'agriculture/development/site-01/water-tank-001/ack/faucet';
      const ackPayload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          messageId: 'ack-mismatch-001',
          commandId: 'cmd-mismatch-001',
          deviceId: 'water-tank-001',
          data: { status: 'ACKNOWLEDGED', accepted: true },
        })
      );

      const result = await processor.processAcknowledgementMessage(topic, ackPayload);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('Command target deviceId mismatch');
      expect(updateCommandStatusMock).not.toHaveBeenCalled();
    });

    it('ignores accepted ACK if command status is QUEUED, ACKNOWLEDGED, IN_PROGRESS, or COMPLETED', async () => {
      const statusesToTest = [
        FaucetCommandStatus.QUEUED,
        FaucetCommandStatus.ACKNOWLEDGED,
        FaucetCommandStatus.IN_PROGRESS,
        FaucetCommandStatus.COMPLETED,
        FaucetCommandStatus.FAILED,
      ];

      for (const status of statusesToTest) {
        const updateCommandStatusMock = vi.fn();
        const mockCommand = {
          id: 'cmd-uuid-test',
          commandId: 'cmd-test',
          deviceId: 'water-tank-001',
          status,
          events: [],
        };

        const processor = new AcknowledgementProcessor({
          env,
          faucetCommandRepo: {
            getCommandById: async () => mockCommand as any,
            updateCommandStatus: updateCommandStatusMock,
          } as any,
          deviceRepo: {
            getDeviceByCanonicalId: async () => mockWaterNodeDevice as any,
          } as any,
        });

        const topic = 'agriculture/development/site-01/water-tank-001/ack/faucet';
        const ackPayload = Buffer.from(
          JSON.stringify({
            schemaVersion: '1.0',
            messageId: `ack-msg-${status}`,
            commandId: 'cmd-test',
            deviceId: 'water-tank-001',
            data: { status: 'ACKNOWLEDGED', accepted: true },
          })
        );

        const result = await processor.processAcknowledgementMessage(topic, ackPayload);

        expect(result.success).toBe(true);
        expect(result.reason).toContain(
          `Accepted ACK ignored because command status is '${status}'`
        );
        expect(updateCommandStatusMock).not.toHaveBeenCalled();
      }
    });
  });

  describe('Rejected ACK Processing (SENT -> FAILED only)', () => {
    it('processes rejected ACK and transitions command from SENT to FAILED with reasonCode', async () => {
      let updatedStatus: FaucetCommandStatus | null = null;
      let updateEventData: any = null;

      const mockCommand = {
        id: 'cmd-uuid-2',
        commandId: 'cmd-01JXYZ456',
        deviceId: 'water-tank-001',
        status: FaucetCommandStatus.SENT,
        events: [],
      };

      const mockFaucetCommandRepo = {
        getCommandById: async (id: string) =>
          id === 'cmd-01JXYZ456' ? (mockCommand as any) : null,
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
          return { id: 'alert-fail-001', ...input };
        },
      };

      const processor = new AcknowledgementProcessor({
        env,
        faucetCommandRepo: mockFaucetCommandRepo as any,
        deviceRepo: mockDeviceRepo as any,
        alertRepo: mockAlertRepo as any,
      });

      const topic = 'agriculture/development/site-01/water-tank-001/ack/faucet';
      const rejectionPayload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          messageId: 'ack-msg-002',
          commandId: 'cmd-01JXYZ456',
          deviceId: 'water-tank-001',
          recordedAt: '2026-08-03T10:00:00.000Z',
          data: {
            status: 'REJECTED',
            accepted: false,
            reasonCode: 'DEVICE_BUSY',
          },
        })
      );

      const result = await processor.processAcknowledgementMessage(topic, rejectionPayload);

      expect(result.success).toBe(true);
      expect(updatedStatus).toBe(FaucetCommandStatus.FAILED);
      expect(updateEventData).toMatchObject({
        messageId: 'ack-msg-002',
        reasonCode: 'DEVICE_BUSY',
      });
      expect(createdAlertInput).toMatchObject({
        deviceId: mockWaterNodeDevice.id,
        commandId: mockCommand.id,
        reasonCode: 'DEVICE_BUSY',
      });
    });

    it('ignores rejected ACK if command status is QUEUED, ACKNOWLEDGED, IN_PROGRESS, or FAILED', async () => {
      const statusesToTest = [
        FaucetCommandStatus.QUEUED,
        FaucetCommandStatus.ACKNOWLEDGED,
        FaucetCommandStatus.IN_PROGRESS,
        FaucetCommandStatus.FAILED,
        FaucetCommandStatus.COMPLETED,
      ];

      for (const status of statusesToTest) {
        const updateCommandStatusMock = vi.fn();
        const mockCommand = {
          id: 'cmd-uuid-test-rej',
          commandId: 'cmd-test-rej',
          deviceId: 'water-tank-001',
          status,
          events: [],
        };

        const processor = new AcknowledgementProcessor({
          env,
          faucetCommandRepo: {
            getCommandById: async () => mockCommand as any,
            updateCommandStatus: updateCommandStatusMock,
          } as any,
          deviceRepo: {
            getDeviceByCanonicalId: async () => mockWaterNodeDevice as any,
          } as any,
        });

        const topic = 'agriculture/development/site-01/water-tank-001/ack/faucet';
        const rejectionPayload = Buffer.from(
          JSON.stringify({
            schemaVersion: '1.0',
            messageId: `ack-rej-msg-${status}`,
            commandId: 'cmd-test-rej',
            deviceId: 'water-tank-001',
            data: { status: 'REJECTED', accepted: false, reasonCode: 'DEVICE_BUSY' },
          })
        );

        const result = await processor.processAcknowledgementMessage(topic, rejectionPayload);

        expect(result.success).toBe(true);
        expect(result.reason).toContain(
          `Rejected ACK ignored because command status is '${status}'`
        );
        expect(updateCommandStatusMock).not.toHaveBeenCalled();
      }
    });
  });

  describe('Duplicate messageId Idempotency', () => {
    it('handles duplicate messageId idempotently without throwing or regressing DB state', async () => {
      let updateCallCount = 0;

      const mockCommand = {
        id: 'cmd-uuid-3',
        commandId: 'cmd-01JXYZ789',
        deviceId: 'water-tank-001',
        status: FaucetCommandStatus.ACKNOWLEDGED,
        events: [
          {
            id: 'evt-1',
            messageId: 'ack-msg-duplicate',
            eventStatus: FaucetCommandStatus.ACKNOWLEDGED,
          },
        ],
      };

      const mockFaucetCommandRepo = {
        getCommandById: async () => mockCommand as any,
        updateCommandStatus: async () => {
          updateCallCount++;
        },
      };

      const mockDeviceRepo = {
        getDeviceByCanonicalId: async () => mockWaterNodeDevice as any,
      };

      const processor = new AcknowledgementProcessor({
        env,
        faucetCommandRepo: mockFaucetCommandRepo as any,
        deviceRepo: mockDeviceRepo as any,
      });

      const topic = 'agriculture/development/site-01/water-tank-001/ack/faucet';
      const duplicatePayload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          messageId: 'ack-msg-duplicate',
          commandId: 'cmd-01JXYZ789',
          deviceId: 'water-tank-001',
          data: {
            status: 'ACKNOWLEDGED',
            accepted: true,
          },
        })
      );

      const result = await processor.processAcknowledgementMessage(topic, duplicatePayload);

      expect(result.success).toBe(true);
      expect(result.reason).toContain('Duplicate messageId handled idempotently');
      expect(updateCallCount).toBe(0);
    });
  });

  describe('Validation Safeguards & Edge Cases', () => {
    it('rejects topic deviceId vs payload deviceId mismatch without crashing', async () => {
      const processor = new AcknowledgementProcessor({ env });
      const topic = 'agriculture/development/site-01/water-tank-001/ack/faucet';
      const mismatchedPayload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          messageId: 'ack-msg-004',
          commandId: 'cmd-01JXYZ123',
          deviceId: 'water-tank-999', // Mismatched deviceId
          data: { status: 'ACKNOWLEDGED', accepted: true },
        })
      );

      const result = await processor.processAcknowledgementMessage(topic, mismatchedPayload);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('Topic and payload deviceId mismatch');
    });

    it('rejects unknown commandId gracefully without crashing', async () => {
      const mockFaucetCommandRepo = {
        getCommandById: async () => null,
      };

      const processor = new AcknowledgementProcessor({
        env,
        faucetCommandRepo: mockFaucetCommandRepo as any,
        deviceRepo: {
          getDeviceByCanonicalId: async () => mockWaterNodeDevice as any,
        } as any,
      });

      const topic = 'agriculture/development/site-01/water-tank-001/ack/faucet';
      const unknownCmdPayload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          messageId: 'ack-msg-005',
          commandId: 'cmd-non-existent',
          deviceId: 'water-tank-001',
          data: { status: 'ACKNOWLEDGED', accepted: true },
        })
      );

      const result = await processor.processAcknowledgementMessage(topic, unknownCmdPayload);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Unknown commandId');
    });

    it('rejects non-WATER_TANK_NODE device type without modifying command', async () => {
      const mockCommand = {
        id: 'cmd-uuid-6',
        commandId: 'cmd-soil-123',
        deviceId: 'soil-node-001',
        status: FaucetCommandStatus.SENT,
        events: [],
      };

      const mockFaucetCommandRepo = {
        getCommandById: async () => mockCommand as any,
      };

      const mockDeviceRepo = {
        getDeviceByCanonicalId: async () => mockSoilNodeDevice as any, // SOIL_NODE
      };

      const processor = new AcknowledgementProcessor({
        env,
        faucetCommandRepo: mockFaucetCommandRepo as any,
        deviceRepo: mockDeviceRepo as any,
      });

      const topic = 'agriculture/development/site-01/soil-node-001/ack/faucet';
      const soilAckPayload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          messageId: 'ack-msg-006',
          commandId: 'cmd-soil-123',
          deviceId: 'soil-node-001',
          data: { status: 'ACKNOWLEDGED', accepted: true },
        })
      );

      const result = await processor.processAcknowledgementMessage(topic, soilAckPayload);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('Device is not a WATER_TANK_NODE');
    });
  });
});
