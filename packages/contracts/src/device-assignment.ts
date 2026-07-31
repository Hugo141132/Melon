import { z } from 'zod';

/**
 * Single User Device Assignment DTO
 */
export const UserDeviceAccessDtoSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  deviceId: z.string().uuid(),
  canonicalDeviceId: z.string(),
  deviceName: z.string(),
  assignedByUserId: z.string().uuid(),
  assignedByUserName: z.string().optional(),
  assignedAt: z.coerce.date(),
  revokedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type UserDeviceAccessDto = z.infer<typeof UserDeviceAccessDtoSchema>;

/**
 * Assign Device Input Request Contract
 * Client provides only target device identification (canonical deviceId or DB UUID).
 * All timestamps and assignedByUserId are strictly server-managed.
 */
export const AssignDeviceInputSchema = z
  .object({
    deviceId: z.string().min(1, 'DeviceId or device UUID is required'),
  })
  .strict();

export type AssignDeviceInput = z.infer<typeof AssignDeviceInputSchema>;

/**
 * Query filter schema for listing user device assignments
 */
export const ListUserDeviceAccessQuerySchema = z.object({
  includeRevoked: z
    .union([z.boolean(), z.string().transform((val) => val === 'true' || val === '1')])
    .optional(),
});

export type ListUserDeviceAccessQuery = z.infer<typeof ListUserDeviceAccessQuerySchema>;

/**
 * Response payload envelope for user device assignments list
 */
export const UserDeviceAccessListResponseSchema = z.object({
  assignments: z.array(UserDeviceAccessDtoSchema),
  totalCount: z.number().int().min(0),
});

export type UserDeviceAccessListResponse = z.infer<typeof UserDeviceAccessListResponseSchema>;
