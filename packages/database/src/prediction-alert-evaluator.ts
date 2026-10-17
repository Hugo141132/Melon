import crypto from 'crypto';
import { PrismaClient, AlertSeverity, AlertStatus } from '@prisma/client';
import { SoilPredictionDto, WaterPredictionDto, PredictionIssue } from '@kebun-melon/contracts';

export interface EvaluatePredictionAlertsParams {
  prisma: PrismaClient;
  device: {
    id: string;
    deviceId: string;
    name?: string | null;
  };
  domain: 'SOIL' | 'WATER';
  prediction: SoilPredictionDto | WaterPredictionDto | null;
  /** Max allowed age in milliseconds before prediction is considered stale (default 300,000ms = 5m) */
  maxStalenessMs?: number;
}

export interface EvaluatePredictionAlertsResult {
  evaluated: boolean;
  reason?: string;
  createdAlertIds: string[];
  escalatedAlertIds: string[];
  updatedAlertIds: string[];
  resolvedAlertIds: string[];
}

/**
 * Derives a stable semantic issue code from an issue or general prediction state.
 * Examples: SOIL_NITROGEN_LOW, WATER_PH_HIGH, SOIL_GENERAL_ANOMALY
 */
export function deriveIssueCode(domain: 'SOIL' | 'WATER', issue?: PredictionIssue | null): string {
  if (!issue) {
    return `${domain}_GENERAL_ANOMALY`;
  }

  const rawParam = (issue.parameter || 'GENERAL').trim();
  const rawProblem = (issue.problem || 'ANOMALY').trim();

  // Normalize parameter to stable identifier
  const cleanParam = rawParam
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/g, '');

  // Normalize problem to stable identifier
  const cleanProblem = rawProblem
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/g, '');

  return `${domain}_${cleanParam || 'GENERAL'}_${cleanProblem || 'ANOMALY'}`;
}

/**
 * Computes deterministic fingerprint for a prediction payload to eliminate duplicate processing.
 */
export function getPredictionFingerprint(
  deviceId: string,
  domain: 'SOIL' | 'WATER',
  prediction: SoilPredictionDto | WaterPredictionDto
): string {
  if (prediction.id && typeof prediction.id === 'string' && prediction.id.trim().length > 0) {
    return prediction.id.trim();
  }

  const payload = JSON.stringify({
    deviceId,
    domain,
    createdAt: prediction.createdAt,
    predictedClass: prediction.predictedClass,
    issues: prediction.issues || [],
    summary: prediction.summary || '',
  });

  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 32);
}

/**
 * Maps prediction predictedClass to AlertSeverity or null (optimal).
 * Authoritative mapping matches RecommendationCard.tsx:
 * - 'optimal' / 'baik' -> null (optimal / normal)
 * - 'kritis' / 'critical' -> CRITICAL
 * - otherwise -> WARNING
 */
export function mapPredictedClassToSeverity(predictedClass?: string | null): AlertSeverity | null {
  const norm = (predictedClass || '').toLowerCase().trim();
  if (norm === 'optimal' || norm === 'baik') {
    return null;
  }
  if (norm === 'kritis' || norm === 'critical') {
    return AlertSeverity.CRITICAL;
  }
  return AlertSeverity.WARNING;
}

/**
 * Idempotently evaluates AI recommendation predictions and manages in-app alerts.
 *
 * Invariants:
 * 1. Read-only on external ML source.
 * 2. Deduplicates repeated pulls/cache hits of the SAME prediction using stable fingerprint.
 * 3. Enforces one active alert episode per (device, domain, stable issue code).
 * 4. Creates on Warning/Critical; updates evidence without duplicate notifications; notifies on Warning -> Critical escalation.
 * 5. Ordinary evidence updates NEVER reset user acknowledgements.
 * 6. Recovery occurs only on distinct fresh predictions (newer than openedAt). Stale or invalid results never imply recovery.
 * 7. Strictly restricted to in-app alerts (no external email dispatch, no hardware actuation).
 */
export async function evaluatePredictionAlerts(
  params: EvaluatePredictionAlertsParams
): Promise<EvaluatePredictionAlertsResult> {
  const { prisma, device, domain, prediction, maxStalenessMs = 300_000 } = params;

  const result: EvaluatePredictionAlertsResult = {
    evaluated: false,
    createdAlertIds: [],
    escalatedAlertIds: [],
    updatedAlertIds: [],
    resolvedAlertIds: [],
  };

  if (!prediction) {
    result.reason = 'PREDICTION_NULL';
    return result;
  }

  // 1. Validate source timestamp freshness
  const predCreatedAt = new Date(prediction.createdAt).getTime();
  if (isNaN(predCreatedAt)) {
    result.reason = 'INVALID_TIMESTAMP';
    return result;
  }

  const ageMs = Date.now() - predCreatedAt;
  if (ageMs > maxStalenessMs) {
    result.reason = 'PREDICTION_STALE';
    return result;
  }

  const fingerprint = getPredictionFingerprint(device.deviceId, domain, prediction);
  const targetSeverity = mapPredictedClassToSeverity(prediction.predictedClass);
  const isOptimal = targetSeverity === null;

  // 2. Wrap state evaluation in transaction with PostgreSQL advisory lock for cross-process concurrency safety
  const runTx =
    typeof (prisma as any).$transaction === 'function'
      ? (cb: (tx: any) => Promise<any>) => (prisma as any).$transaction(cb)
      : (cb: (tx: any) => Promise<any>) => cb(prisma);

  return await runTx(async (tx: any) => {
    // Acquire PostgreSQL advisory transaction lock on hash of device + domain
    if (typeof tx.$executeRaw === 'function') {
      try {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'prediction_alert_' + device.id + '_' + domain}))`;
      } catch {
        // Safe fallback in test environments/mocks where raw SQL is not supported
      }
    }

    // Query all existing OPEN prediction alerts for this device inside locked transaction
    const openAlerts = await tx.alert.findMany({
      where: {
        deviceId: device.id,
        sourceType: 'ml_prediction',
        status: AlertStatus.OPEN,
      },
    });

    // 3. Scenario A: Prediction is Optimal
    // PENDING APPROVAL: Auto-recovery policy is pending approval.
    // We do NOT automatically resolve alerts without approved policy to prevent premature closure.
    if (isOptimal) {
      result.evaluated = true;
      return result;
    }

    // 4. Scenario B: Prediction has Issues (Warning or Critical)
    const isUuid = (val?: string | null) =>
      Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

    const validIssues =
      Array.isArray(prediction.issues) && prediction.issues.length > 0 ? prediction.issues : [null]; // Fallback to single general issue if array empty but status not optimal

    for (const issue of validIssues) {
      const issueCode = deriveIssueCode(domain, issue);
      // Persisted exact episode identity in first-class DB column alert_type (clamped to 80 chars)
      const alertType = `REC_${issueCode}`.slice(0, 80);

      // Find existing open alert for this exact persistent episode identity
      const existing = openAlerts.find((a: any) => a.alertType === alertType);

      const issueLabel =
        issue?.problem ||
        (issue?.parameter ? `${issue.parameter} Anomaly` : prediction.predictedClass);
      const summary = prediction.summary || '';
      const problem = issue?.problem || prediction.predictedClass || 'Anomaly detected';
      const impact = issue?.impact || '';

      const messageParams: Record<string, any> = {
        domain,
        issueCode,
        issueLabel,
        deviceName: device.name || device.deviceId,
        parameter: issue?.parameter || null,
        value: issue?.value ?? null,
        problem,
        impact,
        summary,
        farmerAction: prediction.farmerAction || null,
        predictedClass: prediction.predictedClass,
        lastPredictionId: fingerprint,
        sourceReadingId: prediction.readingId ?? null,
        predictionCreatedAt: prediction.createdAt,
      };

      if (!existing) {
        // Create new Alert record with exact persisted identity in alertType
        const created = await tx.alert.create({
          data: {
            deviceId: device.id,
            alertType,
            severity: targetSeverity,
            status: AlertStatus.OPEN,
            sourceType: 'ml_prediction',
            sourceId: isUuid(prediction.id) ? prediction.id : null,
            titleKey: 'alerts.recommendationAlertTitle',
            messageKey: 'alerts.recommendationAlertMessage',
            messageParams,
            openedAt: new Date(prediction.createdAt),
          },
        });
        result.createdAlertIds.push(created.id);
      } else {
        const existingParams = (existing.messageParams as Record<string, any> | null) || {};

        // Anti-spam: repeated pulls of the exact same prediction ID are ignored
        if (existingParams.lastPredictionId === fingerprint) {
          continue;
        }

        // Check severity escalation: WARNING -> CRITICAL
        if (
          existing.severity === AlertSeverity.WARNING &&
          targetSeverity === AlertSeverity.CRITICAL
        ) {
          // Explicit escalation without silently deleting historical acknowledgements
          await tx.alert.update({
            where: { id: existing.id },
            data: {
              severity: AlertSeverity.CRITICAL,
              messageParams: {
                ...existingParams,
                ...messageParams,
                escalatedAt: new Date().toISOString(),
                escalatedFromSeverity: AlertSeverity.WARNING,
              },
              updatedAt: new Date(),
            },
          });
          result.escalatedAlertIds.push(existing.id);
        } else {
          // Ordinary evidence update: update parameters without changing status or resetting user acknowledgements
          await tx.alert.update({
            where: { id: existing.id },
            data: {
              severity: targetSeverity,
              messageParams: {
                ...existingParams,
                ...messageParams,
              },
              updatedAt: new Date(),
            },
          });
          result.updatedAlertIds.push(existing.id);
        }
      }
    }

    result.evaluated = true;
    return result;
  });
}
