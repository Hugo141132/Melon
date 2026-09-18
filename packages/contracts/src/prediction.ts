import { z } from 'zod';

/**
 * Soil features used for ML prediction
 */
export const SoilPredictionFeaturesSchema = z.object({
  n: z.number().nullable().optional(),
  p: z.number().nullable().optional(),
  k: z.number().nullable().optional(),
  temp: z.number().nullable().optional(),
  moisture: z.number().nullable().optional(),
  ph: z.number().nullable().optional(),
  ec: z.number().nullable().optional(),
});

export type SoilPredictionFeatures = z.infer<typeof SoilPredictionFeaturesSchema>;

/**
 * Soil actions / recommendations
 */
export const SoilPredictionActionsSchema = z.record(z.unknown()).nullable().optional();
export type SoilPredictionActions = z.infer<typeof SoilPredictionActionsSchema>;

/**
 * Detailed issue diagnosed by external ML pipeline
 */
export const PredictionIssueSchema = z.object({
  parameter: z.string().optional(),
  value: z.number().nullable().optional(),
  problem: z.string().optional(),
  impact: z.string().optional(),
});

export type PredictionIssue = z.infer<typeof PredictionIssueSchema>;

/**
 * SoilPredictionDto Schema & Type
 * Canonical representation of a single soil ML prediction record
 * Source of truth: TASKS.md TASK-0413, docs/DECISIONS.md DEC-MON-090
 */
export const SoilPredictionDtoSchema = z.object({
  id: z.string().nullable().optional(),
  deviceId: z.string().min(1),
  readingId: z.string().nullable().optional(),
  predictedClass: z.string().min(1),
  confidence: z.number().finite().nullable().optional(),
  features: SoilPredictionFeaturesSchema.nullable().optional(),
  actions: SoilPredictionActionsSchema,
  summary: z.string().nullable().optional().default(''),
  farmerAction: z.array(z.string()).nullable().optional(),
  issues: z.array(PredictionIssueSchema).nullable().optional(),
  rawRecommendation: z.string().nullable().optional(),
  modelVersion: z.string().nullable().optional(),
  createdAt: z.string(),
});

export type SoilPredictionDto = z.infer<typeof SoilPredictionDtoSchema>;

/**
 * Water features used for ML prediction
 */
export const WaterPredictionFeaturesSchema = z.object({
  ph: z.number().nullable().optional(),
  tds: z.number().nullable().optional(),
  ec: z.number().nullable().optional(),
});

export type WaterPredictionFeatures = z.infer<typeof WaterPredictionFeaturesSchema>;

/**
 * Water actions / recommendations
 */
export const WaterPredictionActionsSchema = z.record(z.unknown()).nullable().optional();
export type WaterPredictionActions = z.infer<typeof WaterPredictionActionsSchema>;

/**
 * WaterPredictionDto Schema & Type
 * Canonical representation of a single water quality ML prediction record
 * Source of truth: TASKS.md TASK-0413, docs/DECISIONS.md DEC-MON-090
 */
export const WaterPredictionDtoSchema = z.object({
  id: z.string().nullable().optional(),
  deviceId: z.string().min(1),
  readingId: z.string().nullable().optional(),
  predictedClass: z.string().min(1),
  confidence: z.number().finite().nullable().optional(),
  features: WaterPredictionFeaturesSchema.nullable().optional(),
  actions: WaterPredictionActionsSchema,
  summary: z.string().nullable().optional().default(''),
  farmerAction: z.array(z.string()).nullable().optional(),
  issues: z.array(PredictionIssueSchema).nullable().optional(),
  rawRecommendation: z.string().nullable().optional(),
  modelVersion: z.string().nullable().optional(),
  createdAt: z.string(),
});

export type WaterPredictionDto = z.infer<typeof WaterPredictionDtoSchema>;

/**
 * OutboundRecommendationPayload Schema & Type
 * Hybrid payload dispatched over MQTT to ESP32 field microcontrollers
 * Reference: TASKS.md TASK-0413, docs/DECISIONS.md DEC-MON-090
 */
export const OutboundRecommendationPayloadSchema = z.object({
  messageId: z.string().min(1),
  predictionId: z.string().nullable().optional(),
  clientId: z.string().min(1),
  deviceId: z.string().min(1),
  timestamp: z.string(),
  domain: z.enum(['SOIL', 'WATER']),
  status: z.string().nullable().optional(),
  predictedClass: z.string().min(1),
  confidence: z.number().finite().nullable().optional(),
  actions: z.record(z.unknown()).nullable().optional(),
  farmerAction: z.array(z.string()).nullable().optional(),
  issues: z.array(PredictionIssueSchema).nullable().optional(),
  summary: z.string(),
  modelVersion: z.string().nullable().optional(),
});

export type OutboundRecommendationPayload = z.infer<typeof OutboundRecommendationPayloadSchema>;
