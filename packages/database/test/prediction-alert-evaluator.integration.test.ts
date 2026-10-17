import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient, AlertSeverity, AlertStatus } from '@prisma/client';
import { evaluatePredictionAlerts } from '../src/prediction-alert-evaluator';
import { SoilPredictionDto } from '@kebun-melon/contracts';

/**
 * Real-Database Integration Test: Concurrency and Advisory Locks
 *
 * This test is prepared for manual execution by WOOIII against a real PostgreSQL instance:
 *   npx vitest run test/prediction-alert-evaluator.integration.test.ts
 *
 * It verifies:
 * 1. Two concurrent evaluation requests against the same device and domain
 *    acquire the PostgreSQL transaction advisory lock (SELECT pg_advisory_xact_lock(...)).
 * 2. Simultaneous executions are serialized by PostgreSQL.
 * 3. Exactly ONE alert record is created with distinct persisted alertType,
 *    preventing duplicate open episodes without requiring DDL schema migrations.
 */
describe('PredictionAlertEvaluator Real-Database Concurrency (Integration)', () => {
  let prisma: PrismaClient;
  let testDeviceId: string;

  beforeAll(async () => {
    // Requires DATABASE_URL pointing to a running PostgreSQL instance
    if (!process.env.DATABASE_URL) {
      console.warn('Skipping integration test: DATABASE_URL not set.');
      return;
    }

    prisma = new PrismaClient();
    await prisma.$connect();

    // Find an active device for integration testing
    const device = await prisma.device.findFirst({
      where: { accountStatus: 'ACTIVE' },
      select: { id: true, deviceId: true, name: true },
    });

    if (device) {
      testDeviceId = device.id;
    }
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  it('serializes concurrent evaluations via transaction advisory lock and creates exactly one alert episode', async () => {
    if (!prisma || !testDeviceId) {
      // Integration test skipped when database connection or device is not available
      return;
    }

    const testDevice = {
      id: testDeviceId,
      deviceId: 'test-concurrency-dev',
      name: 'Test Concurrency Device',
    };

    const prediction: SoilPredictionDto = {
      id: `pred-concurrent-${Date.now()}`,
      deviceId: testDevice.deviceId,
      predictedClass: 'PERINGATAN',
      summary: 'Concurrent test evaluation',
      issues: [
        {
          parameter: 'pH',
          problem: 'Terlalu Tinggi',
          impact: 'Nutrient lockout',
        },
      ],
      createdAt: new Date().toISOString(),
    };

    // Run two evaluations simultaneously to simulate race condition between Web Route and IoT Gateway
    const [result1, result2] = await Promise.all([
      evaluatePredictionAlerts({
        prisma,
        device: testDevice,
        domain: 'SOIL',
        prediction,
      }),
      evaluatePredictionAlerts({
        prisma,
        device: testDevice,
        domain: 'SOIL',
        prediction,
      }),
    ]);

    // One evaluation must create the alert, the other must see the created alert and update/skip
    const totalCreated = result1.createdAlertIds.length + result2.createdAlertIds.length;
    expect(totalCreated).toBe(1);

    // Verify persisted alert count in database for this specific issue
    const openAlerts = await prisma.alert.findMany({
      where: {
        deviceId: testDeviceId,
        alertType: 'REC_SOIL_PH_TERLALU_TINGGI',
        status: AlertStatus.OPEN,
      },
    });

    expect(openAlerts.length).toBe(1);

    // Cleanup created test alert
    if (openAlerts.length > 0) {
      await prisma.alert.deleteMany({
        where: { id: { in: openAlerts.map((a) => a.id) } },
      });
    }
  });
});
