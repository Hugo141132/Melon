import { describe, it, expect } from 'vitest';
import {
  AssignDeviceInputSchema,
  ListUserDeviceAccessQuerySchema,
  UserDeviceAccessDtoSchema,
} from '../device-assignment';

describe('Device Assignment Contracts', () => {
  describe('AssignDeviceInputSchema', () => {
    it('validates valid assign device input', () => {
      const parsed = AssignDeviceInputSchema.parse({
        deviceId: 'water-node-001',
      });
      expect(parsed.deviceId).toBe('water-node-001');
    });

    it('rejects empty deviceId', () => {
      const result = AssignDeviceInputSchema.safeParse({ deviceId: '' });
      expect(result.success).toBe(false);
    });

    it('strips or rejects extra client-controlled fields via strict schema', () => {
      const result = AssignDeviceInputSchema.safeParse({
        deviceId: 'water-node-001',
        assignedByUserId: '00000000-0000-0000-0000-000000000000',
        revokedAt: null,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ListUserDeviceAccessQuerySchema', () => {
    it('transforms includeRevoked string to boolean', () => {
      expect(ListUserDeviceAccessQuerySchema.parse({ includeRevoked: 'true' }).includeRevoked).toBe(
        true
      );
      expect(
        ListUserDeviceAccessQuerySchema.parse({ includeRevoked: 'false' }).includeRevoked
      ).toBe(false);
      expect(ListUserDeviceAccessQuerySchema.parse({}).includeRevoked).toBeUndefined();
    });
  });

  describe('UserDeviceAccessDtoSchema', () => {
    it('validates UserDeviceAccessDto object structure', () => {
      const dto = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        deviceId: '123e4567-e89b-12d3-a456-426614174002',
        canonicalDeviceId: 'water-node-001',
        deviceName: 'Water Node 1',
        assignedByUserId: '123e4567-e89b-12d3-a456-426614174003',
        assignedAt: new Date(),
        revokedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const parsed = UserDeviceAccessDtoSchema.parse(dto);
      expect(parsed.canonicalDeviceId).toBe('water-node-001');
    });
  });
});
