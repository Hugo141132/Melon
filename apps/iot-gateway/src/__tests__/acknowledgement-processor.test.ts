import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AcknowledgementProcessor } from '../acknowledgements/processor';
import { GatewayMqttClient } from '../mqtt/client';
import { validateGatewayEnv } from '../config/env';
import { metricsCollector } from '../observability/metrics';
import {
  FaucetCommandStatus,
  FaucetCommandAction,
  DeviceType,
  DeviceAccountStatus,
  FAUCET_ACK_REASON_CODES,
} from '@kebun-melon/contracts';

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

    it('handles stop and unsubscription gracefully', async () => {
      let unsubscribeCalled = false;
      const mockMqttClient = {
        subscribe: async () => {},
        onMessage: () => {
          return () => {
            unsubscribeCalled = true;
          };
        },
      } as unknown as GatewayMqttClient;

      const processor = new AcknowledgementProcessor({ env, mqttClient: mockMqttClient });
      await processor.subscribeToAcknowledgements();
      processor.stop();

      expect(unsubscribeCalled).toBe(true);
    });
  });

  describe('Accepted ACK Processing (SENT -> ACKNOWLEDGED only)', () => {
    it('processes accepted ACK for DISPENSE action and transitions command from SENT to ACKNOWLEDGED', async () => {
      let updatedStatus: FaucetCommandStatus | null = null;
      let updateEventData: any = null;

      const mockCommand = {
        id: 'cmd-uuid-dispense-1',
        commandId: 'cmd-01JXYZ123',
        deviceId: 'water-tank-001',
        action: FaucetCommandAction.DISPENSE,
        phase: 1,
        plantCount: 5,
        targetVolumeMl: 1500,
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
          messageId: 'ack-msg-dispense-001',
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
        messageId: 'ack-msg-dispense-001',
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

    it('processes accepted ACK for OPEN action and transitions command from SENT to ACKNOWLEDGED', async () => {
      let updatedStatus: FaucetCommandStatus | null = null;
      let updateEventData: any = null;

      const mockCommand = {
        id: 'cmd-uuid-open-1',
        commandId: 'cmd-01JOPEN123',
        deviceId: 'water-tank-001',
        action: FaucetCommandAction.OPEN,
        status: FaucetCommandStatus.SENT,
        events: [],
      };

      const mockFaucetCommandRepo = {
        getCommandById: async (id: string) =>
          id === 'cmd-01JOPEN123' ? (mockCommand as any) : null,
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
          messageId: 'ack-msg-open-001',
          commandId: 'cmd-01JOPEN123',
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
        messageId: 'ack-msg-open-001',
        metadata: {
          ackData: {
            status: 'ACKNOWLEDGED',
            accepted: true,
          },
        },
      });
      // Verification: Never transitions to COMPLETED or infers physical state
      expect(updatedStatus).not.toBe(FaucetCommandStatus.COMPLETED);
    });

    it('processes accepted ACK for CLOSE action and transitions command from SENT to ACKNOWLEDGED', async () => {
      let updatedStatus: FaucetCommandStatus | null = null;
      let updateEventData: any = null;

      const mockCommand = {
        id: 'cmd-uuid-close-1',
        commandId: 'cmd-01JCLOSE123',
        deviceId: 'water-tank-001',
        action: FaucetCommandAction.CLOSE,
        status: FaucetCommandStatus.SENT,
        events: [],
      };

      const mockFaucetCommandRepo = {
        getCommandById: async (id: string) =>
          id === 'cmd-01JCLOSE123' ? (mockCommand as any) : null,
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
          messageId: 'ack-msg-close-001',
          commandId: 'cmd-01JCLOSE123',
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
        messageId: 'ack-msg-close-001',
        metadata: {
          ackData: {
            status: 'ACKNOWLEDGED',
            accepted: true,
          },
        },
      });
      // Verification: Never transitions to COMPLETED or infers physical state
      expect(updatedStatus).not.toBe(FaucetCommandStatus.COMPLETED);
    });

    it('resolves external deviceId to internal Device.id UUID for command device matching', async () => {
      let updatedStatus: FaucetCommandStatus | null = null;

      // Command stores internal Device.id UUID in FaucetCommand.deviceId
      const mockCommand = {
        id: 'cmd-uuid-uuid-test',
        commandId: 'cmd-uuid-match-001',
        deviceId: 'device-uuid-001', // Internal UUID stored in DB
        action: FaucetCommandAction.DISPENSE,
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
        action: FaucetCommandAction.DISPENSE,
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

    it('ignores accepted ACK if command status is QUEUED, ACKNOWLEDGED, IN_PROGRESS, or final states without regression', async () => {
      const nonSentStatuses = [
        FaucetCommandStatus.QUEUED,
        FaucetCommandStatus.ACKNOWLEDGED,
        FaucetCommandStatus.IN_PROGRESS,
        FaucetCommandStatus.COMPLETED,
        FaucetCommandStatus.FAILED,
        FaucetCommandStatus.CANCELLED,
        FaucetCommandStatus.TIMEOUT,
        FaucetCommandStatus.EXPIRED,
      ];

      const actionsToTest = [
        FaucetCommandAction.DISPENSE,
        FaucetCommandAction.OPEN,
        FaucetCommandAction.CLOSE,
      ];

      for (const action of actionsToTest) {
        for (const status of nonSentStatuses) {
          const updateCommandStatusMock = vi.fn();
          const mockCommand = {
            id: `cmd-uuid-${action}-${status}`,
            commandId: `cmd-${action}-${status}`,
            deviceId: 'water-tank-001',
            action,
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
              messageId: `ack-msg-${action}-${status}`,
              commandId: `cmd-${action}-${status}`,
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
      }
    });
  });

  describe('Rejected ACK Processing (SENT -> FAILED only)', () => {
    it('processes rejected ACK for DISPENSE action and transitions command from SENT to FAILED with reasonCode', async () => {
      let updatedStatus: FaucetCommandStatus | null = null;
      let updateEventData: any = null;

      const mockCommand = {
        id: 'cmd-uuid-2',
        commandId: 'cmd-01JXYZ456',
        deviceId: 'water-tank-001',
        action: FaucetCommandAction.DISPENSE,
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

    it('processes rejected ACK for OPEN action and transitions command from SENT to FAILED with reasonCode', async () => {
      let updatedStatus: FaucetCommandStatus | null = null;
      let updateEventData: any = null;

      const mockCommand = {
        id: 'cmd-uuid-open-rej',
        commandId: 'cmd-01JOPENREJ',
        deviceId: 'water-tank-001',
        action: FaucetCommandAction.OPEN,
        status: FaucetCommandStatus.SENT,
        events: [],
      };

      const mockFaucetCommandRepo = {
        getCommandById: async (id: string) =>
          id === 'cmd-01JOPENREJ' ? (mockCommand as any) : null,
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
          return { id: 'alert-fail-open-001', ...input };
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
          messageId: 'ack-msg-open-rej-001',
          commandId: 'cmd-01JOPENREJ',
          deviceId: 'water-tank-001',
          recordedAt: '2026-08-03T10:00:00.000Z',
          data: {
            status: 'REJECTED',
            accepted: false,
            reasonCode: 'DEVICE_NOT_READY',
          },
        })
      );

      const result = await processor.processAcknowledgementMessage(topic, rejectionPayload);

      expect(result.success).toBe(true);
      expect(updatedStatus).toBe(FaucetCommandStatus.FAILED);
      expect(updateEventData).toMatchObject({
        messageId: 'ack-msg-open-rej-001',
        reasonCode: 'DEVICE_NOT_READY',
      });
      expect(createdAlertInput).toMatchObject({
        deviceId: mockWaterNodeDevice.id,
        commandId: mockCommand.id,
        reasonCode: 'DEVICE_NOT_READY',
      });
    });

    it('processes rejected ACK for CLOSE action and transitions command from SENT to FAILED with reasonCode', async () => {
      let updatedStatus: FaucetCommandStatus | null = null;
      let updateEventData: any = null;

      const mockCommand = {
        id: 'cmd-uuid-close-rej',
        commandId: 'cmd-01JCLOSEREJ',
        deviceId: 'water-tank-001',
        action: FaucetCommandAction.CLOSE,
        status: FaucetCommandStatus.SENT,
        events: [],
      };

      const mockFaucetCommandRepo = {
        getCommandById: async (id: string) =>
          id === 'cmd-01JCLOSEREJ' ? (mockCommand as any) : null,
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
          return { id: 'alert-fail-close-001', ...input };
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
          messageId: 'ack-msg-close-rej-001',
          commandId: 'cmd-01JCLOSEREJ',
          deviceId: 'water-tank-001',
          recordedAt: '2026-08-03T10:00:00.000Z',
          data: {
            status: 'REJECTED',
            accepted: false,
            reasonCode: 'INTERNAL_ERROR',
          },
        })
      );

      const result = await processor.processAcknowledgementMessage(topic, rejectionPayload);

      expect(result.success).toBe(true);
      expect(updatedStatus).toBe(FaucetCommandStatus.FAILED);
      expect(updateEventData).toMatchObject({
        messageId: 'ack-msg-close-rej-001',
        reasonCode: 'INTERNAL_ERROR',
      });
      expect(createdAlertInput).toMatchObject({
        deviceId: mockWaterNodeDevice.id,
        commandId: mockCommand.id,
        reasonCode: 'INTERNAL_ERROR',
      });
    });

    it('correctly maps all canonical FAUCET_ACK_REASON_CODES upon rejection', async () => {
      for (const reasonCode of FAUCET_ACK_REASON_CODES) {
        let recordedReason: string | null = null;
        const mockCommand = {
          id: `cmd-uuid-reason-${reasonCode}`,
          commandId: `cmd-reason-${reasonCode}`,
          deviceId: 'water-tank-001',
          action: FaucetCommandAction.DISPENSE,
          status: FaucetCommandStatus.SENT,
          events: [],
        };

        const processor = new AcknowledgementProcessor({
          env,
          faucetCommandRepo: {
            getCommandById: async () => mockCommand as any,
            updateCommandStatus: async (
              _id: string,
              _status: FaucetCommandStatus,
              eventData: any
            ) => {
              recordedReason = eventData.reasonCode;
              return { ...mockCommand, status: FaucetCommandStatus.FAILED };
            },
          } as any,
          deviceRepo: {
            getDeviceByCanonicalId: async () => mockWaterNodeDevice as any,
          } as any,
          alertRepo: {
            createCommandFailureAlert: async () => ({ id: 'alert-1' }),
          } as any,
        });

        const topic = 'agriculture/development/site-01/water-tank-001/ack/faucet';
        const rejectionPayload = Buffer.from(
          JSON.stringify({
            schemaVersion: '1.0',
            messageId: `ack-msg-reason-${reasonCode}`,
            commandId: `cmd-reason-${reasonCode}`,
            deviceId: 'water-tank-001',
            data: { status: 'REJECTED', accepted: false, reasonCode },
          })
        );

        const result = await processor.processAcknowledgementMessage(topic, rejectionPayload);

        expect(result.success).toBe(true);
        expect(recordedReason).toBe(reasonCode);
      }
    });

    it('ignores rejected ACK if command status is QUEUED, ACKNOWLEDGED, IN_PROGRESS, or final states without regression', async () => {
      const nonSentStatuses = [
        FaucetCommandStatus.QUEUED,
        FaucetCommandStatus.ACKNOWLEDGED,
        FaucetCommandStatus.IN_PROGRESS,
        FaucetCommandStatus.FAILED,
        FaucetCommandStatus.COMPLETED,
        FaucetCommandStatus.CANCELLED,
        FaucetCommandStatus.TIMEOUT,
        FaucetCommandStatus.EXPIRED,
      ];

      for (const status of nonSentStatuses) {
        const updateCommandStatusMock = vi.fn();
        const mockCommand = {
          id: 'cmd-uuid-test-rej',
          commandId: 'cmd-test-rej',
          deviceId: 'water-tank-001',
          action: FaucetCommandAction.DISPENSE,
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

    it('handles alert repository failure during rejected ACK without crashing processor', async () => {
      const mockCommand = {
        id: 'cmd-uuid-alert-fail',
        commandId: 'cmd-01JALERTFAIL',
        deviceId: 'water-tank-001',
        action: FaucetCommandAction.DISPENSE,
        status: FaucetCommandStatus.SENT,
        events: [],
      };

      const processor = new AcknowledgementProcessor({
        env,
        faucetCommandRepo: {
          getCommandById: async () => mockCommand as any,
          updateCommandStatus: async () => ({
            ...mockCommand,
            status: FaucetCommandStatus.FAILED,
          }),
        } as any,
        deviceRepo: {
          getDeviceByCanonicalId: async () => mockWaterNodeDevice as any,
        } as any,
        alertRepo: {
          createCommandFailureAlert: async () => {
            throw new Error('Database connection failed');
          },
        } as any,
      });

      const topic = 'agriculture/development/site-01/water-tank-001/ack/faucet';
      const rejectionPayload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          messageId: 'ack-msg-alert-fail-001',
          commandId: 'cmd-01JALERTFAIL',
          deviceId: 'water-tank-001',
          data: {
            status: 'REJECTED',
            accepted: false,
            reasonCode: 'DEVICE_BUSY',
          },
        })
      );

      const result = await processor.processAcknowledgementMessage(topic, rejectionPayload);

      expect(result.success).toBe(true);
    });
  });

  describe('Persisted Command Action Validation', () => {
    it('rejects ACK when persisted command action is unknown or unsupported', async () => {
      const updateCommandStatusMock = vi.fn();
      const mockCommand = {
        id: 'cmd-uuid-unsupported-act',
        commandId: 'cmd-unsupported-001',
        deviceId: 'water-tank-001',
        action: 'PURGE_SYSTEM' as any, // Invalid/unsupported action
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
          getDeviceByCanonicalId: async () => mockWaterNodeDevice as any,
        } as any,
      });

      const topic = 'agriculture/development/site-01/water-tank-001/ack/faucet';
      const ackPayload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          messageId: 'ack-msg-unsupported-001',
          commandId: 'cmd-unsupported-001',
          deviceId: 'water-tank-001',
          data: { status: 'ACKNOWLEDGED', accepted: true },
        })
      );

      const result = await processor.processAcknowledgementMessage(topic, ackPayload);

      expect(result.success).toBe(false);
      expect(result.reason).toContain("Unsupported or invalid command action 'PURGE_SYSTEM'");
      expect(updateCommandStatusMock).not.toHaveBeenCalled();
    });
  });

  describe('Duplicate messageId Idempotency', () => {
    it('handles duplicate messageId idempotently without throwing or regressing DB state', async () => {
      let updateCallCount = 0;

      const mockCommand = {
        id: 'cmd-uuid-3',
        commandId: 'cmd-01JXYZ789',
        deviceId: 'water-tank-001',
        action: FaucetCommandAction.DISPENSE,
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

    it('rejects invalid topic string', async () => {
      const processor = new AcknowledgementProcessor({ env });
      const invalidTopic = 'invalid/topic/format';
      const payload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          messageId: 'ack-msg-001',
          commandId: 'cmd-1',
          deviceId: 'water-tank-001',
          data: { status: 'ACKNOWLEDGED', accepted: true },
        })
      );

      const result = await processor.processAcknowledgementMessage(invalidTopic, payload);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('Invalid topic');
    });

    it('rejects topic when category/subtype is not ack/faucet', async () => {
      const processor = new AcknowledgementProcessor({ env });
      const wrongCategoryTopic =
        'agriculture/development/site-01/water-tank-001/telemetry/reservoir';
      const payload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          messageId: 'ack-msg-001',
          commandId: 'cmd-1',
          deviceId: 'water-tank-001',
          data: { status: 'ACKNOWLEDGED', accepted: true },
        })
      );

      const result = await processor.processAcknowledgementMessage(wrongCategoryTopic, payload);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('Topic is not a faucet acknowledgement topic');
    });

    it('rejects invalid JSON payload gracefully', async () => {
      const processor = new AcknowledgementProcessor({ env });
      const topic = 'agriculture/development/site-01/water-tank-001/ack/faucet';
      const invalidJson = Buffer.from('NOT_VALID_JSON{');

      const result = await processor.processAcknowledgementMessage(topic, invalidJson);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('Invalid JSON payload');
    });

    it('rejects payload that fails schema validation', async () => {
      const processor = new AcknowledgementProcessor({ env });
      const topic = 'agriculture/development/site-01/water-tank-001/ack/faucet';
      const invalidSchemaPayload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          // missing messageId, commandId, deviceId
          data: { status: 'UNKNOWN_STATUS' },
        })
      );

      const result = await processor.processAcknowledgementMessage(topic, invalidSchemaPayload);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('Payload schema validation failed');
    });

    it('rejects unknown device without crashing', async () => {
      const processor = new AcknowledgementProcessor({
        env,
        faucetCommandRepo: { getCommandById: async () => null } as any,
        deviceRepo: { getDeviceByCanonicalId: async () => null } as any,
      });

      const topic = 'agriculture/development/site-01/unknown-device/ack/faucet';
      const payload = Buffer.from(
        JSON.stringify({
          schemaVersion: '1.0',
          messageId: 'ack-msg-unknown-dev',
          commandId: 'cmd-1',
          deviceId: 'unknown-device',
          data: { status: 'ACKNOWLEDGED', accepted: true },
        })
      );

      const result = await processor.processAcknowledgementMessage(topic, payload);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('Device not found');
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
        action: FaucetCommandAction.DISPENSE,
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

    it('executes legacy processAcknowledgement method safely', async () => {
      const processor = new AcknowledgementProcessor({ env });
      await expect(
        processor.processAcknowledgement('water-tank-001', 'cmd-1', 'ACKNOWLEDGED', { test: true })
      ).resolves.not.toThrow();
    });
  });
});
