import { describe, it, expect } from 'vitest';
import { DeviceAccountStatus, DeviceConnectionStatus } from '@kebun-melon/contracts';

/**
 * Pure regression helper simulating the available devices filtering logic used in /users UI modal
 */
export function filterUnassignedAvailableDevices(
  availableDevices: any[],
  userAssignments: any[]
): any[] {
  const activeAssignedIds = new Set(
    userAssignments
      .filter((a) => !a.revokedAt)
      .flatMap((a) => [a.deviceId, a.canonicalDeviceId].filter(Boolean))
  );

  return availableDevices.filter((dev) => {
    if (dev.accountStatus && dev.accountStatus !== DeviceAccountStatus.ACTIVE) {
      return false;
    }
    const canonicalId = dev.deviceId || dev.canonicalDeviceId;
    const isAssigned = activeAssignedIds.has(dev.id) || activeAssignedIds.has(canonicalId);
    return !isAssigned;
  });
}

describe('TASK-0304 User Device Assignment UI & Available Devices Filtering Regression Tests', () => {
  const mockUuid1 = '11111111-1111-1111-1111-111111111111';
  const mockUuid2 = '22222222-2222-2222-2222-222222222222';
  const mockUuid3 = '33333333-3333-3333-3333-333333333333';

  const mockRegisteredDevices = [
    {
      id: mockUuid1,
      deviceId: 'SOIL-001',
      name: 'Soil Monitor Unit 1',
      accountStatus: DeviceAccountStatus.ACTIVE,
      connectionStatus: DeviceConnectionStatus.UNKNOWN,
    },
    {
      id: mockUuid2,
      deviceId: 'WATER-001',
      name: 'Water Monitor Unit 1',
      accountStatus: DeviceAccountStatus.ACTIVE,
      connectionStatus: DeviceConnectionStatus.OFFLINE,
    },
    {
      id: mockUuid3,
      deviceId: 'RESERVOIR-001',
      name: 'Reservoir Monitor Unit 1',
      accountStatus: DeviceAccountStatus.ACTIVE,
      connectionStatus: DeviceConnectionStatus.ONLINE,
    },
  ];

  it('1. Parses /api/v1/devices API response format correctly (direct array or nested devices object)', () => {
    const apiResponseDataArray = mockRegisteredDevices;
    const rawDevicesArray = Array.isArray(apiResponseDataArray)
      ? apiResponseDataArray
      : (apiResponseDataArray as any)?.devices || [];
    expect(rawDevicesArray).toHaveLength(3);

    const apiResponseDataObject = { devices: mockRegisteredDevices };
    const rawDevicesObj = Array.isArray(apiResponseDataObject)
      ? apiResponseDataObject
      : (apiResponseDataObject as any)?.devices || [];
    expect(rawDevicesObj).toHaveLength(3);
  });

  it('2. Device created through /devices appears as available for Owner assignment', () => {
    const newCreatedDevice = {
      id: '44444444-4444-4444-4444-444444444444',
      deviceId: 'SOIL-NEW-99',
      name: 'Newly Created Soil Sensor',
      accountStatus: DeviceAccountStatus.ACTIVE,
      connectionStatus: DeviceConnectionStatus.UNKNOWN,
    };
    const allDevices = [...mockRegisteredDevices, newCreatedDevice];
    const userAssignments: any[] = [];

    const available = filterUnassignedAvailableDevices(allDevices, userAssignments);
    expect(available).toHaveLength(4);
    expect(available.map((d) => d.deviceId)).toContain('SOIL-NEW-99');
  });

  it('3. Unassigned device appears as available in dropdown selection', () => {
    const userAssignments: any[] = [];
    const available = filterUnassignedAvailableDevices(mockRegisteredDevices, userAssignments);
    expect(available).toHaveLength(3);
    expect(available.map((d) => d.deviceId)).toEqual(['SOIL-001', 'WATER-001', 'RESERVOIR-001']);
  });

  it('4. Assigned device moves to assigned state and is excluded from available dropdown', () => {
    const userAssignments = [
      {
        id: 'assign-uuid-1',
        userId: 'admin-user-uuid',
        deviceId: mockUuid1,
        canonicalDeviceId: 'SOIL-001',
        deviceName: 'Soil Monitor Unit 1',
        assignedByUserId: 'owner-user-uuid',
        assignedAt: new Date(),
        revokedAt: null,
      },
    ];

    const available = filterUnassignedAvailableDevices(mockRegisteredDevices, userAssignments);
    expect(available).toHaveLength(2);
    expect(available.map((d) => d.deviceId)).toEqual(['WATER-001', 'RESERVOIR-001']);
    expect(available.map((d) => d.deviceId)).not.toContain('SOIL-001');
  });

  it('5. Revoked device becomes available again for reassignment', () => {
    const userAssignments = [
      {
        id: 'assign-uuid-1',
        userId: 'admin-user-uuid',
        deviceId: mockUuid1,
        canonicalDeviceId: 'SOIL-001',
        deviceName: 'Soil Monitor Unit 1',
        assignedByUserId: 'owner-user-uuid',
        assignedAt: new Date('2026-01-01'),
        revokedAt: new Date('2026-02-01'),
      },
    ];

    const available = filterUnassignedAvailableDevices(mockRegisteredDevices, userAssignments);
    expect(available).toHaveLength(3);
    expect(available.map((d) => d.deviceId)).toContain('SOIL-001');
  });

  it('6. OFFLINE and UNKNOWN connectivity statuses do NOT incorrectly hide eligible devices', () => {
    const devicesWithVariousConnectivity = [
      {
        id: mockUuid1,
        deviceId: 'SOIL-001',
        name: 'Soil 1',
        accountStatus: DeviceAccountStatus.ACTIVE,
        connectionStatus: DeviceConnectionStatus.UNKNOWN,
      },
      {
        id: mockUuid2,
        deviceId: 'WATER-001',
        name: 'Water 1',
        accountStatus: DeviceAccountStatus.ACTIVE,
        connectionStatus: DeviceConnectionStatus.OFFLINE,
      },
      {
        id: mockUuid3,
        deviceId: 'RESERVOIR-001',
        name: 'Reservoir 1',
        accountStatus: DeviceAccountStatus.ACTIVE,
        connectionStatus: DeviceConnectionStatus.STALE,
      },
    ];

    const available = filterUnassignedAvailableDevices(devicesWithVariousConnectivity, []);
    expect(available).toHaveLength(3);
  });

  it('7. Internal UUID vs canonical deviceId cannot cause filtering mismatches', () => {
    // Test UUID match
    const assignmentsByUuid = [
      {
        id: 'assign-1',
        deviceId: mockUuid1, // DB UUID
        canonicalDeviceId: 'SOIL-001',
        revokedAt: null,
      },
    ];
    const availableByUuid = filterUnassignedAvailableDevices(
      mockRegisteredDevices,
      assignmentsByUuid
    );
    expect(availableByUuid.find((d) => d.id === mockUuid1)).toBeUndefined();

    // Test Canonical ID match
    const assignmentsByCanonical = [
      {
        id: 'assign-2',
        deviceId: 'some-other-uuid',
        canonicalDeviceId: 'WATER-001', // Canonical ID match
        revokedAt: null,
      },
    ];
    const availableByCanonical = filterUnassignedAvailableDevices(
      mockRegisteredDevices,
      assignmentsByCanonical
    );
    expect(availableByCanonical.find((d) => d.deviceId === 'WATER-001')).toBeUndefined();
  });

  it('8. Reopening or refreshing assignment modal preserves assigned devices list display', () => {
    const userAssignmentsFromApi = [
      {
        id: 'assign-100',
        userId: 'admin-uuid-1',
        deviceId: mockUuid2,
        canonicalDeviceId: 'WATER-001',
        deviceName: 'Water Monitor Unit 1',
        assignedByUserId: 'owner-uuid-1',
        assignedAt: new Date().toISOString(),
        revokedAt: null,
      },
    ];

    // Active assignment has revokedAt === null
    const activeAssignments = userAssignmentsFromApi.filter((a) => a.revokedAt === null);
    expect(activeAssignments).toHaveLength(1);
    expect(activeAssignments[0].canonicalDeviceId).toBe('WATER-001');

    // Available devices excludes WATER-001
    const available = filterUnassignedAvailableDevices(
      mockRegisteredDevices,
      userAssignmentsFromApi
    );
    expect(available.map((d) => d.deviceId)).toEqual(['SOIL-001', 'RESERVOIR-001']);
  });

  it('9. Revocation causes device to immediately disappear from assigned list and return to available devices without deleting historical DB row', () => {
    let assignments: any[] = [
      {
        id: 'row-active-1',
        userId: 'admin-1',
        deviceId: mockUuid1,
        canonicalDeviceId: 'SOIL-001',
        deviceName: 'Soil 1',
        assignedAt: new Date('2026-01-01'),
        revokedAt: null,
      },
    ];

    // 1. Initial state: SOIL-001 is active
    let activeAssignments = assignments.filter((a) => a.revokedAt === null);
    expect(activeAssignments).toHaveLength(1);
    expect(
      filterUnassignedAvailableDevices(mockRegisteredDevices, assignments).map((d) => d.deviceId)
    ).not.toContain('SOIL-001');

    // 2. Revoke action sets revokedAt timestamp (DB retains historical row)
    const revokedRow = { ...assignments[0], revokedAt: new Date('2026-02-01') };
    assignments = [revokedRow];

    // Active list filters out revokedAt !== null -> SOIL-001 immediately disappears from active list
    activeAssignments = assignments.filter((a) => a.revokedAt === null);
    expect(activeAssignments).toHaveLength(0);

    // Historical row remains retained
    expect(assignments[0].revokedAt).not.toBeNull();

    // Available list now includes SOIL-001 again
    expect(
      filterUnassignedAvailableDevices(mockRegisteredDevices, assignments).map((d) => d.deviceId)
    ).toContain('SOIL-001');

    // 3. Reassign creates a NEW row
    const newReassignmentRow = {
      id: 'row-active-2',
      userId: 'admin-1',
      deviceId: mockUuid1,
      canonicalDeviceId: 'SOIL-001',
      deviceName: 'Soil 1',
      assignedAt: new Date('2026-03-01'),
      revokedAt: null,
    };
    assignments.push(newReassignmentRow);

    // Active assignments list now has ONLY the new row (1 active)
    activeAssignments = assignments.filter((a) => a.revokedAt === null);
    expect(activeAssignments).toHaveLength(1);
    expect(activeAssignments[0].id).toBe('row-active-2');
  });
});
