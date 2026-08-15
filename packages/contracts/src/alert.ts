import { z } from 'zod';
import { AlertSeverity, AlertStatus, AlertType } from './enums';

export { AlertSeverity, AlertStatus, AlertType };

export const AlertSeveritySchema = z.nativeEnum(AlertSeverity);
export const AlertStatusSchema = z.nativeEnum(AlertStatus);
export const AlertTypeSchema = z.nativeEnum(AlertType);

export const AlertDtoSchema = z.object({
  id: z.string().uuid(),
  deviceId: z.string().uuid().nullable(),
  userId: z.string().uuid().nullable(),
  alertType: z.string(),
  severity: AlertSeveritySchema,
  status: AlertStatusSchema,
  sourceType: z.string(),
  sourceId: z.string().uuid().nullable(),
  titleKey: z.string().nullable(),
  messageKey: z.string().nullable(),
  messageParams: z.record(z.unknown()).nullable(),
  openedAt: z.union([z.date(), z.string()]),
  resolvedAt: z.union([z.date(), z.string()]).nullable(),
  createdAt: z.union([z.date(), z.string()]),
  updatedAt: z.union([z.date(), z.string()]),
});

export type AlertDto = z.infer<typeof AlertDtoSchema>;

export const AlertQueryInputSchema = z.object({
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(100).optional().default(20),
  deviceId: z.string().uuid().optional(),
  severity: AlertSeveritySchema.optional(),
  status: AlertStatusSchema.optional(),
  alertType: z.string().trim().min(1).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  sort: z.string().optional().default('openedAt:desc'),
});

export type AlertQueryInput = z.input<typeof AlertQueryInputSchema>;

export const CreateAlertInputSchema = z.object({
  deviceId: z.string().uuid().optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
  alertType: z.string().trim().min(1),
  severity: AlertSeveritySchema,
  status: AlertStatusSchema.optional().default(AlertStatus.OPEN),
  sourceType: z.string().trim().min(1).optional().default('device'),
  sourceId: z.string().uuid().optional().nullable(),
  titleKey: z.string().trim().optional().nullable(),
  messageKey: z.string().trim().optional().nullable(),
  messageParams: z.record(z.unknown()).optional().nullable(),
  openedAt: z.union([z.date(), z.string()]).optional(),
});

export type CreateAlertInput = z.input<typeof CreateAlertInputSchema>;

export interface PaginatedAlertsDto {
  items: AlertDto[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export const AcknowledgeAlertInputSchema = z.object({
  note: z.string().trim().max(500).optional().nullable(),
});

export type AcknowledgeAlertInput = z.input<typeof AcknowledgeAlertInputSchema>;

export const AlertAcknowledgementDtoSchema = z.object({
  id: z.string().uuid(),
  alertId: z.string().uuid(),
  acknowledgedByUserId: z.string().uuid(),
  note: z.string().nullable(),
  acknowledgedAt: z.union([z.date(), z.string()]),
});

export type AlertAcknowledgementDto = z.infer<typeof AlertAcknowledgementDtoSchema>;
