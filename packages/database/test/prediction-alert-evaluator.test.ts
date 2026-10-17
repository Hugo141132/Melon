import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AlertSeverity, AlertStatus } from '@prisma/client';
import {
  deriveIssueCode,
  getPredictionFingerprint,
  mapPredictedClassToSeverity,
  evaluatePredictionAlerts,
} from '../src/prediction-alert-evaluator';
import { SoilPredictionDto } from '@kebun-melon/contracts';

describe('prediction-alert-evaluator', () => {
  describe('deriveIssueCode', () => {
    it('derives stable uppercase alphanumeric code for issue', () => {
      const code = deriveIssueCode('SOIL', {
        parameter: 'Nitrogen',
        problem: 'Terlalu Rendah',
        impact: 'Pertumbuhan lambat',
      });
      expect(code).toBe('SOIL_NITROGEN_TERLALU_RENDAH');
    });

    it('falls back to domain general anomaly if issue is null or undefined', () => {
      expect(deriveIssueCode('SOIL', null)).toBe('SOIL_GENERAL_ANOMALY');
      expect(deriveIssueCode('WATER', undefined)).toBe('WATER_GENERAL_ANOMALY');
    });
  });

  describe('mapPredictedClassToSeverity', () => {
    it('returns null for optimal / baik conditions', () => {
      expect(mapPredictedClassToSeverity('optimal')).toBeNull();
      expect(mapPredictedClassToSeverity('OPTIMAL')).toBeNull();
      expect(mapPredictedClassToSeverity('baik')).toBeNull();
      expect(mapPredictedClassToSeverity('BAIK')).toBeNull();
    });

    it('returns CRITICAL for kritis / critical conditions', () => {
      expect(mapPredictedClassToSeverity('kritis')).toBe(AlertSeverity.CRITICAL);
      expect(mapPredictedClassToSeverity('CRITICAL')).toBe(AlertSeverity.CRITICAL);
    });

    it('returns WARNING for other non-optimal conditions', () => {
      expect(mapPredictedClassToSeverity('perhatian')).toBe(AlertSeverity.WARNING);
      expect(mapPredictedClassToSeverity('anomali')).toBe(AlertSeverity.WARNING);
      expect(mapPredictedClassToSeverity('UNKNOWN')).toBe(AlertSeverity.WARNING);
    });
  });

  describe('getPredictionFingerprint', () => {
    it('uses prediction.id if provided', () => {
      const fp = getPredictionFingerprint('dev-1', 'SOIL', {
        id: 'pred-uuid-1234',
        deviceId: 'dev-1',
        predictedClass: 'WARNING',
        summary: 'summary',
        createdAt: '2026-10-17T10:00:00Z',
      });
      expect(fp).toBe('pred-uuid-1234');
    });

    it('generates deterministic SHA-256 hash when prediction.id is null or empty', () => {
      const pred = {
        id: null,
        deviceId: 'dev-1',
        predictedClass: 'WARNING',
        summary: 'summary',
        createdAt: '2026-10-17T10:00:00Z',
      };
      const fp1 = getPredictionFingerprint('dev-1', 'SOIL', pred);
      const fp2 = getPredictionFingerprint('dev-1', 'SOIL', pred);
      expect(fp1).toBe(fp2);
      expect(fp1.length).toBe(32);
    });
  });

  describe('evaluatePredictionAlerts', () => {
    let mockPrisma: any;
    const device = {
      id: '11111111-1111-1111-1111-111111111111',
      deviceId: 'soil-dev-01',
      name: 'Bed A Soil Node',
    };

    beforeEach(() => {
      mockPrisma = {
        alert: {
          findMany: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
        },
        alertAcknowledgement: {
          deleteMany: vi.fn(),
        },
      };
    });

    it('rejects stale prediction without evaluating or resolving alerts', async () => {
      const staleDate = new Date(Date.now() - 600_000).toISOString(); // 10 minutes ago
      const prediction: SoilPredictionDto = {
        id: 'pred-stale',
        deviceId: 'soil-dev-01',
        predictedClass: 'OPTIMAL',
        summary: 'Kondisi baik',
        createdAt: staleDate,
      };

      const res = await evaluatePredictionAlerts({
        prisma: mockPrisma,
        device,
        domain: 'SOIL',
        prediction,
        maxStalenessMs: 300_000,
      });

      expect(res.evaluated).toBe(false);
      expect(res.reason).toBe('PREDICTION_STALE');
      expect(mockPrisma.alert.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.alert.create).not.toHaveBeenCalled();
      expect(mockPrisma.alert.update).not.toHaveBeenCalled();
    });

    it('creates initial in-app alert on Warning entry', async () => {
      mockPrisma.alert.findMany.mockResolvedValue([]);
      mockPrisma.alert.create.mockResolvedValue({ id: 'alert-new-1' });

      const prediction: SoilPredictionDto = {
        id: 'pred-warn-1',
        deviceId: 'soil-dev-01',
        predictedClass: 'PERINGATAN',
        summary: 'Nitrogen rendah',
        issues: [
          {
            parameter: 'Nitrogen',
            problem: 'Terlalu Rendah',
            impact: 'Pertumbuhan terhambat',
          },
        ],
        createdAt: new Date().toISOString(),
      };

      const res = await evaluatePredictionAlerts({
        prisma: mockPrisma,
        device,
        domain: 'SOIL',
        prediction,
      });

      expect(res.evaluated).toBe(true);
      expect(res.createdAlertIds).toEqual(['alert-new-1']);
      expect(mockPrisma.alert.create).toHaveBeenCalledTimes(1);
      const createData = mockPrisma.alert.create.mock.calls[0][0].data;
      expect(createData.severity).toBe(AlertSeverity.WARNING);
      expect(createData.alertType).toBe('REC_SOIL_NITROGEN_TERLALU_RENDAH');
      expect(createData.messageParams.issueCode).toBe('SOIL_NITROGEN_TERLALU_RENDAH');
    });

    it('simultaneous distinct issues persist separately under unique alertTypes without overwriting', async () => {
      mockPrisma.alert.findMany.mockResolvedValue([]);
      mockPrisma.alert.create
        .mockResolvedValueOnce({ id: 'alert-ph-1' })
        .mockResolvedValueOnce({ id: 'alert-ec-2' });

      const prediction: SoilPredictionDto = {
        id: 'pred-multi-1',
        deviceId: 'soil-dev-01',
        predictedClass: 'PERINGATAN',
        summary: 'pH dan EC bermasalah',
        issues: [
          {
            parameter: 'pH',
            problem: 'Terlalu Tinggi',
          },
          {
            parameter: 'EC',
            problem: 'Terlalu Rendah',
          },
        ],
        createdAt: new Date().toISOString(),
      };

      const res = await evaluatePredictionAlerts({
        prisma: mockPrisma,
        device,
        domain: 'SOIL',
        prediction,
      });

      expect(res.evaluated).toBe(true);
      expect(res.createdAlertIds).toEqual(['alert-ph-1', 'alert-ec-2']);
      expect(mockPrisma.alert.create).toHaveBeenCalledTimes(2);

      const alert1 = mockPrisma.alert.create.mock.calls[0][0].data;
      const alert2 = mockPrisma.alert.create.mock.calls[1][0].data;

      expect(alert1.alertType).toBe('REC_SOIL_PH_TERLALU_TINGGI');
      expect(alert2.alertType).toBe('REC_SOIL_EC_TERLALU_RENDAH');
      expect(alert1.alertType).not.toBe(alert2.alertType);
    });

    it('anti-spam: does not duplicate alert when identical prediction fingerprint is pulled again', async () => {
      const existingAlert = {
        id: 'alert-existing-1',
        alertType: 'REC_SOIL_NITROGEN_TERLALU_RENDAH',
        severity: AlertSeverity.WARNING,
        status: AlertStatus.OPEN,
        openedAt: new Date(Date.now() - 60_000),
        messageParams: {
          domain: 'SOIL',
          issueCode: 'SOIL_NITROGEN_TERLALU_RENDAH',
          lastPredictionId: 'pred-warn-1',
        },
      };

      mockPrisma.alert.findMany.mockResolvedValue([existingAlert]);

      const prediction: SoilPredictionDto = {
        id: 'pred-warn-1',
        deviceId: 'soil-dev-01',
        predictedClass: 'PERINGATAN',
        summary: 'Nitrogen rendah',
        issues: [
          {
            parameter: 'Nitrogen',
            problem: 'Terlalu Rendah',
          },
        ],
        createdAt: new Date().toISOString(),
      };

      const res = await evaluatePredictionAlerts({
        prisma: mockPrisma,
        device,
        domain: 'SOIL',
        prediction,
      });

      expect(res.evaluated).toBe(true);
      expect(res.createdAlertIds).toHaveLength(0);
      expect(res.updatedAlertIds).toHaveLength(0);
      expect(mockPrisma.alert.create).not.toHaveBeenCalled();
      expect(mockPrisma.alert.update).not.toHaveBeenCalled();
    });

    it('escalates WARNING to CRITICAL on distinct critical prediction while preserving acknowledgement history', async () => {
      const existingAlert = {
        id: 'alert-existing-1',
        alertType: 'REC_SOIL_NITROGEN_TERLALU_RENDAH',
        severity: AlertSeverity.WARNING,
        status: AlertStatus.OPEN,
        openedAt: new Date(Date.now() - 60_000),
        messageParams: {
          domain: 'SOIL',
          issueCode: 'SOIL_NITROGEN_TERLALU_RENDAH',
          lastPredictionId: 'pred-warn-1',
        },
      };

      mockPrisma.alert.findMany.mockResolvedValue([existingAlert]);
      mockPrisma.alert.update.mockResolvedValue({});

      const prediction: SoilPredictionDto = {
        id: 'pred-crit-2',
        deviceId: 'soil-dev-01',
        predictedClass: 'KRITIS',
        summary: 'Nitrogen kritis',
        issues: [
          {
            parameter: 'Nitrogen',
            problem: 'Terlalu Rendah',
          },
        ],
        createdAt: new Date().toISOString(),
      };

      const res = await evaluatePredictionAlerts({
        prisma: mockPrisma,
        device,
        domain: 'SOIL',
        prediction,
      });

      expect(res.evaluated).toBe(true);
      expect(res.escalatedAlertIds).toEqual(['alert-existing-1']);
      expect(mockPrisma.alert.update).toHaveBeenCalledTimes(1);
      // Historical acknowledgements are NOT deleted
      expect(mockPrisma.alertAcknowledgement.deleteMany).not.toHaveBeenCalled();

      const updateData = mockPrisma.alert.update.mock.calls[0][0].data;
      expect(updateData.severity).toBe(AlertSeverity.CRITICAL);
      expect(updateData.messageParams.lastPredictionId).toBe('pred-crit-2');
      expect(updateData.messageParams.escalatedFromSeverity).toBe(AlertSeverity.WARNING);
      expect(typeof updateData.messageParams.escalatedAt).toBe('string');
    });

    it('leaves auto-recovery pending approval when receiving fresh OPTIMAL prediction', async () => {
      const existingAlert = {
        id: 'alert-existing-1',
        alertType: 'REC_SOIL_NITROGEN_TERLALU_RENDAH',
        severity: AlertSeverity.WARNING,
        status: AlertStatus.OPEN,
        openedAt: new Date(Date.now() - 60_000),
        messageParams: {
          domain: 'SOIL',
          issueCode: 'SOIL_NITROGEN_TERLALU_RENDAH',
          lastPredictionId: 'pred-warn-1',
        },
      };

      mockPrisma.alert.findMany.mockResolvedValue([existingAlert]);

      const prediction: SoilPredictionDto = {
        id: 'pred-opt-3',
        deviceId: 'soil-dev-01',
        predictedClass: 'OPTIMAL',
        summary: 'Kondisi tanah optimal',
        issues: [],
        createdAt: new Date().toISOString(),
      };

      const res = await evaluatePredictionAlerts({
        prisma: mockPrisma,
        device,
        domain: 'SOIL',
        prediction,
      });

      expect(res.evaluated).toBe(true);
      // Recovery is not automatically performed without approved policy
      expect(res.resolvedAlertIds).toEqual([]);
      expect(mockPrisma.alert.update).not.toHaveBeenCalled();
    });
  });
});
