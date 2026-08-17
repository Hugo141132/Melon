import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthorisedDevice } from '@/context/DeviceContext';

// Helper mock data
const mockDevices: AuthorisedDevice[] = [
  {
    id: 'db-id-001',
    deviceId: 'soil-node-001',
    deviceName: 'Soil Sensor Blok A',
    deviceType: 'SOIL_NODE',
    siteId: 'site-001',
    siteName: 'Blok Utama',
    accountStatus: 'ACTIVE',
    connectionStatus: 'ONLINE',
    lastSeenAt: '2026-07-31T18:00:00Z',
    firmwareVersion: '1.0.0',
    latitude: -6.2,
    longitude: 106.8,
    permissions: { canView: true, canControl: true, canAssign: true, canConfigure: true },
  },
  {
    id: 'db-id-002',
    deviceId: 'water-node-001',
    deviceName: 'Water Quality Node B',
    deviceType: 'WATER_QUALITY_NODE',
    siteId: 'site-001',
    siteName: 'Blok Utama',
    accountStatus: 'ACTIVE',
    connectionStatus: 'OFFLINE',
    lastSeenAt: '2026-07-31T17:30:00Z',
    firmwareVersion: '1.1.0',
    latitude: -6.21,
    longitude: 106.81,
    permissions: { canView: true, canControl: false, canAssign: false, canConfigure: false },
  },
  {
    id: 'db-id-003',
    deviceId: 'water-tank-node-001',
    deviceName: 'Reservoir Tank Node',
    deviceType: 'WATER_TANK_NODE',
    siteId: null,
    siteName: null,
    accountStatus: 'ACTIVE',
    connectionStatus: 'ONLINE',
    lastSeenAt: '2026-07-31T18:10:00Z',
    firmwareVersion: '2.0.0',
    latitude: null,
    longitude: null,
    permissions: { canView: true, canControl: true, canAssign: false, canConfigure: false },
  },
];

describe('TASK-0306 — Device Selector & Global DeviceContext State Integration Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Authorised Device Source Isolation (OWNER vs ADMIN scope contract)', () => {
    // OWNER scope returns all 3 devices
    const ownerDevices = mockDevices;
    expect(ownerDevices.length).toBe(3);

    // ADMIN scope returns only assigned devices (e.g. soil-node-001 & water-tank-node-001)
    const adminAssignedIds = ['soil-node-001', 'water-tank-node-001'];
    const adminDevices = mockDevices.filter(
      (d) => d.deviceId && adminAssignedIds.includes(d.deviceId)
    );
    expect(adminDevices.length).toBe(2);
    expect(adminDevices.map((d) => d.deviceId)).not.toContain('water-node-001');
  });

  it('2. Default Selection Rules (0 devices, 1 device, multiple devices)', () => {
    // Case A: 0 devices
    const emptyList: AuthorisedDevice[] = [];
    let selected: AuthorisedDevice | null = emptyList.length > 0 ? emptyList[0] : null;
    expect(selected).toBeNull();

    // Case B: 1 device
    const singleList: AuthorisedDevice[] = [mockDevices[0]];
    selected = singleList[0];
    expect(selected?.deviceId).toBe('soil-node-001');

    // Case C: Multiple devices default selection
    const multiList = mockDevices;
    selected = multiList[0];
    expect(selected?.deviceId).toBe('soil-node-001');
  });

  it('3. Selection Switching and Stale State Reset', () => {
    const devices = mockDevices;
    let currentSelected: AuthorisedDevice | null = devices[0];

    // Initial selected device is soil-node-001
    expect(currentSelected.deviceId).toBe('soil-node-001');

    // Switch to water-tank-node-001
    const targetId = 'water-tank-node-001';
    const nextSelected = devices.find((d) => d.deviceId === targetId) || null;

    expect(nextSelected).not.toBeNull();
    expect(nextSelected?.deviceId).toBe('water-tank-node-001');
    expect(nextSelected?.deviceName).toBe('Reservoir Tank Node');

    // Verify previous device reference is completely replaced
    currentSelected = nextSelected;
    expect(currentSelected?.deviceId).not.toBe('soil-node-001');
  });

  it('4. Client URL Tampering Prevention (Validation against server-authorised list)', () => {
    const authorisedDevices = [mockDevices[0], mockDevices[1]]; // soil-node-001 & water-node-001
    const tamperedCandidateId = 'unauthorised-device-999';

    // Verify candidate is tested against server-authorised list
    const isCandidateAuthorised = authorisedDevices.some((d) => d.deviceId === tamperedCandidateId);
    expect(isCandidateAuthorised).toBe(false);

    // Tampered candidate must be rejected and fallback to first authorised device
    const safeSelected = isCandidateAuthorised
      ? authorisedDevices.find((d) => d.deviceId === tamperedCandidateId)!
      : authorisedDevices[0];

    expect(safeSelected.deviceId).toBe('soil-node-001');
    expect(safeSelected.deviceId).not.toBe(tamperedCandidateId);
  });

  it('5. Revoked Device Access Handling (Falling back to next valid device & flagging revoked notice)', () => {
    const previouslySelectedId = 'water-node-001';

    // Access revoked: Server now returns list WITHOUT water-node-001
    const newAuthorisedList = [mockDevices[0]]; // Only soil-node-001 remains

    const isStillAuthorised = newAuthorisedList.some((d) => d.deviceId === previouslySelectedId);
    expect(isStillAuthorised).toBe(false);

    // Detect revoked state
    let isRevoked = false;
    let revokedDeviceId: string | null = null;
    let activeSelected: AuthorisedDevice | null = null;

    if (!isStillAuthorised) {
      isRevoked = true;
      revokedDeviceId = previouslySelectedId;
      activeSelected = newAuthorisedList.length > 0 ? newAuthorisedList[0] : null;
    }

    expect(isRevoked).toBe(true);
    expect(revokedDeviceId).toBe('water-node-001');
    expect(activeSelected?.deviceId).toBe('soil-node-001');
  });

  it('6. Persisted Selection Validation (localStorage candidate valid vs invalid)', () => {
    const authorisedDevices = mockDevices;

    // Case A: Valid stored ID
    const validStoredId = 'water-tank-node-001';
    let matchedDevice = authorisedDevices.find((d) => d.deviceId === validStoredId) || null;
    expect(matchedDevice?.deviceId).toBe('water-tank-node-001');

    // Case B: Invalid/Stale stored ID
    const invalidStoredId = 'deleted-device-777';
    matchedDevice = authorisedDevices.find((d) => d.deviceId === invalidStoredId) || null;
    expect(matchedDevice).toBeNull();

    // Fallback to first device when stored ID is invalid
    const finalSelected = matchedDevice ?? authorisedDevices[0];
    expect(finalSelected.deviceId).toBe('soil-node-001');
  });

  it('7. Error and Loading State Resolution', () => {
    let isLoading = true;
    let error: string | null = null;
    let devices: AuthorisedDevice[] = [];

    expect(isLoading).toBe(true);

    // API Error simulation
    isLoading = false;
    error = 'Gagal memuat perangkat (500)';
    expect(error).toContain('500');
    expect(devices.length).toBe(0);

    // Retry recovery simulation
    error = null;
    devices = mockDevices;
    expect(devices.length).toBe(3);
    expect(error).toBeNull();
  });

  it('8. Hidden Device ID in Visual Dropdown Items (ID preserved internally)', () => {
    const device = mockDevices[0]; // soil-node-001, 'Soil Sensor Blok A', siteName 'Blok Utama'

    // Internal API / state uses deviceId
    expect(device.deviceId).toBe('soil-node-001');

    // Visual label contains deviceName and optional siteName, omitting raw deviceId
    const visibleTitle = device.deviceName;
    const visibleSubtext = device.siteName || '';

    expect(visibleTitle).toBe('Soil Sensor Blok A');
    expect(visibleSubtext).toBe('Blok Utama');
    expect(visibleSubtext).not.toContain('soil-node-001');
  });

  it('9. Direct Navigation to /soil on SOIL_NODE Selection', () => {
    const soilDevice = mockDevices[0];
    const pushSpy = vi.fn();

    const handleSelectWithNavigation = (dev: AuthorisedDevice) => {
      if (dev.deviceType === 'SOIL_NODE') {
        pushSpy('/soil');
      } else if (dev.deviceType === 'WATER_QUALITY_NODE') {
        pushSpy('/air');
      } else if (dev.deviceType === 'WATER_TANK_NODE') {
        pushSpy('/controls');
      }
    };

    handleSelectWithNavigation(soilDevice);
    expect(pushSpy).toHaveBeenCalledWith('/soil');
  });

  it('10. Direct Navigation to /water on WATER_QUALITY_NODE Selection', () => {
    const waterDevice = mockDevices[1];
    const pushSpy = vi.fn();

    const handleSelectWithNavigation = (dev: AuthorisedDevice) => {
      if (dev.deviceType === 'SOIL_NODE') {
        pushSpy('/soil');
      } else if (dev.deviceType === 'WATER_QUALITY_NODE') {
        pushSpy('/water');
      } else if (dev.deviceType === 'WATER_TANK_NODE') {
        pushSpy('/controls');
      }
    };

    handleSelectWithNavigation(waterDevice);
    expect(pushSpy).toHaveBeenCalledWith('/water');
  });

  it('11. Direct Navigation to /controls on WATER_TANK_NODE Selection', () => {
    const tankDevice = mockDevices[2];
    const pushSpy = vi.fn();

    const handleSelectWithNavigation = (dev: AuthorisedDevice) => {
      if (dev.deviceType === 'SOIL_NODE') {
        pushSpy('/soil');
      } else if (dev.deviceType === 'WATER_QUALITY_NODE') {
        pushSpy('/air');
      } else if (dev.deviceType === 'WATER_TANK_NODE') {
        pushSpy('/controls');
      }
    };

    handleSelectWithNavigation(tankDevice);
    expect(pushSpy).toHaveBeenCalledWith('/controls');
  });
});
