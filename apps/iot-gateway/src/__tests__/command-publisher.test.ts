import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommandPublisher } from '../commands/publisher';
import { GatewayMqttClient } from '../mqtt/client';
import { validateGatewayEnv } from '../config/env';
import { metricsCollector } from '../observability/metrics';
import {
  FaucetCommandStatus,
  DeviceType,
  DeviceAccountStatus,
  UserRole,
} from '@kebun-melon/contracts';

describe('TASK-0804: CommandPublisher (Gateway Command Publisher)', () => {
  const env = validateGatewayEnv({
    NODE_ENV: 'test',
    APP_ENV: 'development',
  });

  beforeEach(() => {
    metricsCollector.reset();
  });

  describe('publishCommand direct invocation', () => {
    it('publishes command to canonical topic with QoS 1 and retain=false', async () => {
      let publishedTopic = '';
      let publishedPayload: any = null;
      let publishedQos = -1;
      let publishedRetain = true;

      const mockMqttClient = {
        isConnected: () => true,
        publish: async (topic: string, message: Buffer, qos: number, retain: boolean) => {
          publishedTopic = topic;
          publishedPayload = JSON.parse(message.toString());
          publishedQos = qos;
          publishedRetain = retain;
        },
      } as unknown as GatewayMqttClient;

      const publisher = new CommandPublisher({ env, mqttClient: mockMqttClient });

      const res = await publisher.publishCommand(
        mockMqttClient,
        'water-tank-001',
        'cmd-uuid-123',
        {
          phase: 1,
          targetVolumeMl: 300,
          requestedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 60000).toISOString(),
        },
        'site-01'
      );

      expect(res.published).toBe(true);
      expect(publishedTopic).toBe('agriculture/development/site-01/water-tank-001/command/faucet');
      expect(publishedQos).toBe(1);
      expect(publishedRetain).toBe(false);
      expect(publishedPayload).toMatchObject({
        schemaVersion: '1.0',
        commandId: 'cmd-uuid-123',
        deviceId: 'water-tank-001',
        siteId: 'site-01',
        action: 'DISPENSE',
        phase: 1,
        targetVolumeMl: 300,
      });
      expect(metricsCollector.getSnapshot().commands.publishedTotal).toBe(1);
    });

    it('fails gracefully and increments failure metric when MQTT client is disconnected', async () => {
      const mockDisconnectedClient = {
        isConnected: () => false,
        publish: vi.fn(),
      } as unknown as GatewayMqttClient;

      const publisher = new CommandPublisher({ env, mqttClient: mockDisconnectedClient });

      const res = await publisher.publishCommand(
        mockDisconnectedClient,
        'water-tank-001',
        'cmd-123',
        { phase: 1, targetVolumeMl: 300 }
      );

      expect(res.published).toBe(false);
      expect(mockDisconnectedClient.publish).not.toHaveBeenCalled();
      expect(metricsCollector.getSnapshot().commands.failuresTotal).toBe(1);
    });
  });

  describe('processQueuedCommands DB lifecycle processing', () => {
    it('marks expired QUEUED commands as EXPIRED without publishing to MQTT', async () => {
      const mockMqttClient = {
        isConnected: () => true,
        publish: vi.fn(),
      } as unknown as GatewayMqttClient;

      const expiredCommand = {
        id: 'cmd-db-uuid-1',
        commandId: 'cmd-exp-100',
        deviceId: 'dev-db-uuid-1',
        initiatedByUserId: 'user-1',
        initiatedByRole: UserRole.ADMIN,
        phase: 1,
        targetVolumeMl: 300,
        actualVolumeMl: null,
        status: FaucetCommandStatus.QUEUED,
        requestedAt: new Date(Date.now() - 600000),
        queuedAt: new Date(Date.now() - 600000),
        sentAt: null,
        acknowledgedAt: null,
        startedAt: null,
        completedAt: null,
        failedAt: null,
        cancelledAt: null,
        expiresAt: new Date(Date.now() - 300000), // Expired 5 mins ago
        failureReasonCode: null,
        idempotencyKey: 'idemp-exp-1',
        createdAt: new Date(Date.now() - 600000),
        updatedAt: new Date(Date.now() - 600000),
      };

      const mockFaucetCommandRepo = {
        getCommands: vi.fn().mockResolvedValue({
          items: [expiredCommand],
          pagination: { page: 1, pageSize: 50, totalItems: 1, totalPages: 1 },
        }),
        updateCommandStatus: vi.fn().mockResolvedValue({
          ...expiredCommand,
          status: FaucetCommandStatus.EXPIRED,
        }),
      } as any;

      const mockDeviceRepo = {
        getDeviceByCanonicalId: vi.fn(),
      } as any;

      const publisher = new CommandPublisher({
        env,
        mqttClient: mockMqttClient,
        faucetCommandRepo: mockFaucetCommandRepo,
        deviceRepo: mockDeviceRepo,
      });

      const result = await publisher.processQueuedCommands();

      expect(result.expiredCount).toBe(1);
      expect(result.publishedCount).toBe(0);
      expect(mockFaucetCommandRepo.updateCommandStatus).toHaveBeenCalledWith(
        'cmd-db-uuid-1',
        FaucetCommandStatus.EXPIRED,
        { reasonCode: 'EXPIRED_COMMAND' }
      );
      expect(mockMqttClient.publish).not.toHaveBeenCalled();
    });

    it('publishes eligible unexpired QUEUED command for WATER_TANK_NODE, marks SENT, and updates metrics', async () => {
      let publishedTopic = '';
      let publishedPayloadBuffer: Buffer | null = null;
      let publishedQos = -1;
      let publishedRetain = true;

      const mockMqttClient = {
        isConnected: () => true,
        publish: async (topic: string, message: Buffer, qos: number, retain: boolean) => {
          publishedTopic = topic;
          publishedPayloadBuffer = message;
          publishedQos = qos;
          publishedRetain = retain;
        },
      } as unknown as GatewayMqttClient;

      const validCommand = {
        id: 'cmd-db-uuid-2',
        commandId: 'cmd-valid-200',
        deviceId: 'water-tank-node-ryd0at',
        initiatedByUserId: 'user-1',
        initiatedByRole: UserRole.ADMIN,
        phase: 2,
        targetVolumeMl: 1000,
        actualVolumeMl: null,
        status: FaucetCommandStatus.QUEUED,
        requestedAt: new Date(),
        queuedAt: new Date(),
        sentAt: null,
        acknowledgedAt: null,
        startedAt: null,
        completedAt: null,
        failedAt: null,
        cancelledAt: null,
        expiresAt: new Date(Date.now() + 300000), // Expires in 5 mins
        failureReasonCode: null,
        idempotencyKey: 'idemp-valid-2',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const validDevice = {
        id: 'dev-db-uuid-2',
        deviceId: 'water-tank-node-ryd0at',
        siteId: 'site-kebun-01',
        name: 'Water Tank Node 1',
        deviceType: DeviceType.WATER_TANK_NODE,
        accountStatus: DeviceAccountStatus.ACTIVE,
        connectionStatus: 'ONLINE',
        firmwareVersion: '1.0.0',
        hardwareRevision: 'v1',
        schemaVersion: '1.0',
        lastSeenAt: new Date(),
        lastMessageAt: new Date(),
        latitude: -6.2,
        longitude: 106.8,
        createdAt: new Date(),
        updatedAt: new Date(),
        deactivatedAt: null,
        capabilities: ['TANK_MONITORING', 'FAUCET_CONTROL'],
      };

      const mockFaucetCommandRepo = {
        getCommands: vi.fn().mockResolvedValue({
          items: [validCommand],
          pagination: { page: 1, pageSize: 50, totalItems: 1, totalPages: 1 },
        }),
        updateCommandStatus: vi.fn().mockResolvedValue({
          ...validCommand,
          status: FaucetCommandStatus.SENT,
        }),
      } as any;

      const mockDeviceRepo = {
        getDeviceByCanonicalId: vi.fn().mockResolvedValue(validDevice),
      } as any;

      const publisher = new CommandPublisher({
        env,
        mqttClient: mockMqttClient,
        faucetCommandRepo: mockFaucetCommandRepo,
        deviceRepo: mockDeviceRepo,
      });

      const result = await publisher.processQueuedCommands();

      expect(result.publishedCount).toBe(1);
      expect(result.expiredCount).toBe(0);
      expect(result.failedCount).toBe(0);
      expect(result.skippedCount).toBe(0);

      expect(publishedTopic).toBe(
        'agriculture/development/site-kebun-01/water-tank-node-ryd0at/command/faucet'
      );
      expect(publishedQos).toBe(1);
      expect(publishedRetain).toBe(false);

      const parsedPayload = JSON.parse(publishedPayloadBuffer!.toString());
      expect(parsedPayload).toEqual({
        schemaVersion: '1.0',
        commandId: 'cmd-valid-200',
        deviceId: 'water-tank-node-ryd0at',
        siteId: 'site-kebun-01',
        action: 'DISPENSE',
        phase: 2,
        targetVolumeMl: 1000,
        requestedAt: validCommand.requestedAt.toISOString(),
        expiresAt: validCommand.expiresAt.toISOString(),
      });

      expect(mockFaucetCommandRepo.updateCommandStatus).toHaveBeenCalledWith(
        'cmd-db-uuid-2',
        FaucetCommandStatus.SENT,
        expect.objectContaining({
          messageId: expect.stringMatching(/^msg-[a-f0-9-]+$/),
          metadata: expect.objectContaining({ topic: publishedTopic }),
        })
      );

      expect(metricsCollector.getSnapshot().commands.publishedTotal).toBe(1);
    });

    it('skips command if target device is non-WATER_TANK_NODE or missing siteId', async () => {
      const mockMqttClient = {
        isConnected: () => true,
        publish: vi.fn(),
      } as unknown as GatewayMqttClient;

      const queuedCmd = {
        id: 'cmd-db-uuid-3',
        commandId: 'cmd-skip-300',
        deviceId: 'soil-node-001',
        phase: 1,
        targetVolumeMl: 300,
        status: FaucetCommandStatus.QUEUED,
        expiresAt: new Date(Date.now() + 300000),
        requestedAt: new Date(),
      };

      const soilDevice = {
        id: 'dev-soil-1',
        deviceId: 'soil-node-001',
        siteId: 'site-01',
        deviceType: DeviceType.SOIL_NODE, // NOT WATER_TANK_NODE
        accountStatus: DeviceAccountStatus.ACTIVE,
      };

      const mockFaucetCommandRepo = {
        getCommands: vi.fn().mockResolvedValue({
          items: [queuedCmd],
          pagination: { page: 1, pageSize: 50, totalItems: 1, totalPages: 1 },
        }),
        updateCommandStatus: vi.fn(),
      } as any;

      const mockDeviceRepo = {
        getDeviceByCanonicalId: vi.fn().mockResolvedValue(soilDevice),
      } as any;

      const publisher = new CommandPublisher({
        env,
        mqttClient: mockMqttClient,
        faucetCommandRepo: mockFaucetCommandRepo,
        deviceRepo: mockDeviceRepo,
      });

      const result = await publisher.processQueuedCommands();

      expect(result.skippedCount).toBe(1);
      expect(result.publishedCount).toBe(0);
      expect(mockMqttClient.publish).not.toHaveBeenCalled();
      expect(mockFaucetCommandRepo.updateCommandStatus).not.toHaveBeenCalled();
    });

    it('skips command and does NOT invent a missing siteId if device siteId is null/empty', async () => {
      const mockMqttClient = {
        isConnected: () => true,
        publish: vi.fn(),
      } as unknown as GatewayMqttClient;

      const queuedCmd = {
        id: 'cmd-db-uuid-4',
        commandId: 'cmd-nosite-400',
        deviceId: 'water-tank-no-site',
        phase: 3,
        targetVolumeMl: 1500,
        status: FaucetCommandStatus.QUEUED,
        expiresAt: new Date(Date.now() + 300000),
        requestedAt: new Date(),
      };

      const noSiteDevice = {
        id: 'dev-nosite-1',
        deviceId: 'water-tank-no-site',
        siteId: null, // MISSING siteId
        deviceType: DeviceType.WATER_TANK_NODE,
        accountStatus: DeviceAccountStatus.ACTIVE,
      };

      const mockFaucetCommandRepo = {
        getCommands: vi.fn().mockResolvedValue({
          items: [queuedCmd],
          pagination: { page: 1, pageSize: 50, totalItems: 1, totalPages: 1 },
        }),
        updateCommandStatus: vi.fn(),
      } as any;

      const mockDeviceRepo = {
        getDeviceByCanonicalId: vi.fn().mockResolvedValue(noSiteDevice),
      } as any;

      const publisher = new CommandPublisher({
        env,
        mqttClient: mockMqttClient,
        faucetCommandRepo: mockFaucetCommandRepo,
        deviceRepo: mockDeviceRepo,
      });

      const result = await publisher.processQueuedCommands();

      expect(result.skippedCount).toBe(1);
      expect(result.publishedCount).toBe(0);
      expect(mockMqttClient.publish).not.toHaveBeenCalled();
      expect(mockFaucetCommandRepo.updateCommandStatus).not.toHaveBeenCalled();
    });

    it('leaves command QUEUED when MQTT publish throws an error', async () => {
      const mockMqttClient = {
        isConnected: () => true,
        publish: vi.fn().mockRejectedValue(new Error('Broker connection failure')),
      } as unknown as GatewayMqttClient;

      const validCommand = {
        id: 'cmd-db-uuid-5',
        commandId: 'cmd-err-500',
        deviceId: 'water-tank-node-ryd0at',
        phase: 1,
        targetVolumeMl: 300,
        status: FaucetCommandStatus.QUEUED,
        requestedAt: new Date(),
        expiresAt: new Date(Date.now() + 300000),
      };

      const validDevice = {
        id: 'dev-db-uuid-2',
        deviceId: 'water-tank-node-ryd0at',
        siteId: 'site-kebun-01',
        deviceType: DeviceType.WATER_TANK_NODE,
        accountStatus: DeviceAccountStatus.ACTIVE,
      };

      const mockFaucetCommandRepo = {
        getCommands: vi.fn().mockResolvedValue({
          items: [validCommand],
          pagination: { page: 1, pageSize: 50, totalItems: 1, totalPages: 1 },
        }),
        updateCommandStatus: vi.fn(),
      } as any;

      const mockDeviceRepo = {
        getDeviceByCanonicalId: vi.fn().mockResolvedValue(validDevice),
      } as any;

      const publisher = new CommandPublisher({
        env,
        mqttClient: mockMqttClient,
        faucetCommandRepo: mockFaucetCommandRepo,
        deviceRepo: mockDeviceRepo,
      });

      const result = await publisher.processQueuedCommands();

      expect(result.failedCount).toBe(1);
      expect(result.publishedCount).toBe(0);

      // Verify updateCommandStatus to SENT was NOT called (remains QUEUED in DB)
      expect(mockFaucetCommandRepo.updateCommandStatus).not.toHaveBeenCalled();
      expect(metricsCollector.getSnapshot().commands.failuresTotal).toBe(1);
    });
  });
});
