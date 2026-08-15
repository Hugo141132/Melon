import { z } from 'zod';

export const LivenessResponseSchema = z.object({
  status: z.literal('ok'),
});

export type LivenessResponseDto = z.infer<typeof LivenessResponseSchema>;

export const DependencyStatusSchema = z.enum(['up', 'down']);
export type DependencyStatus = z.infer<typeof DependencyStatusSchema>;

export const ReadinessStatusSchema = z.enum(['ready', 'degraded', 'down']);
export type ReadinessStatus = z.infer<typeof ReadinessStatusSchema>;

export const GatewayReadinessDependenciesSchema = z.object({
  database: DependencyStatusSchema,
  broker: DependencyStatusSchema,
});

export type GatewayReadinessDependenciesDto = z.infer<typeof GatewayReadinessDependenciesSchema>;

export const GatewayReadinessResponseSchema = z.object({
  status: ReadinessStatusSchema,
  dependencies: GatewayReadinessDependenciesSchema,
});

export type GatewayReadinessResponseDto = z.infer<typeof GatewayReadinessResponseSchema>;

export const WebReadinessDependenciesSchema = z.object({
  database: DependencyStatusSchema,
  gateway: DependencyStatusSchema,
  broker: DependencyStatusSchema,
});

export type WebReadinessDependenciesDto = z.infer<typeof WebReadinessDependenciesSchema>;

export const WebReadinessResponseSchema = z.object({
  status: ReadinessStatusSchema,
  dependencies: WebReadinessDependenciesSchema,
});

export type WebReadinessResponseDto = z.infer<typeof WebReadinessResponseSchema>;
