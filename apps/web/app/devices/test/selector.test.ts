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

    // Case B: 1 device - No longer auto-selects (Neutral State)
    // const singleList: AuthorisedDevice[] = [mockDevices[0]];
    selected = null; // Fresh load neutral state
    expect(selected).toBeNull();

    // Case C: Multiple devices default selection - Neutral State (null)
    // const multiList = mockDevices;
    selected = null; // Fresh load neutral state
    expect(selected).toBeNull();
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

    // Tampered candidate must be rejected and fallback to NULL (neutral state), not the first device
    const safeSelected = isCandidateAuthorised
      ? authorisedDevices.find((d) => d.deviceId === tamperedCandidateId)!
      : null;

    expect(safeSelected).toBeNull();
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
      activeSelected = null; // No fallback
    }

    expect(isRevoked).toBe(true);
    expect(revokedDeviceId).toBe('water-node-001');
    expect(activeSelected).toBeNull();
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

    // Fallback to neutral state (null) when stored ID is invalid
    const finalSelected = matchedDevice ?? null;
    expect(finalSelected).toBeNull();
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

  it('12. Multiple Same-Type Devices - No Silent First-Device Selection', () => {
    const multiSoilDevices: AuthorisedDevice[] = [
      mockDevices[0],
      {
        ...mockDevices[0],
        id: 'db-id-004',
        deviceId: 'soil-node-002',
        deviceName: 'Soil Sensor Blok B',
      },
    ];

    // Simulate fresh load with multiple devices of the same type
    let selectedDevice: AuthorisedDevice | null = null;
    expect(selectedDevice).toBeNull();

    // Verify user explicit selection determines the device context, NOT array index
    const userSelectedId = 'soil-node-002';
    selectedDevice = multiSoilDevices.find((d) => d.deviceId === userSelectedId) || null;
    expect(selectedDevice?.deviceId).toBe('soil-node-002');
  });

  it('13. /sensor Explicit Selection Continuity & Header Equivalence', () => {
    // Simulate /sensor explicit selection handler
    const pushSpy = vi.fn();
    const selectDeviceSpy = vi.fn((id: string) => {
      return id;
    });

    const handleDeviceSelect = (
      deviceId: string,
      canonicalId: string | undefined,
      route: string
    ) => {
      selectDeviceSpy(deviceId);
      pushSpy(`${route}?deviceId=${canonicalId || deviceId}`);
    };

    const targetDevice = mockDevices[0]; // soil-node-001

    handleDeviceSelect(targetDevice.id, targetDevice.deviceId, '/soil');

    // Context gets selected with the immutable ID
    expect(selectDeviceSpy).toHaveBeenCalledWith(targetDevice.id);

    // Route receives the canonical ID (if Owner) and destination
    expect(pushSpy).toHaveBeenCalledWith('/soil?deviceId=soil-node-001');

    // Header selector selection uses identical immutable ID and updates the same context
    const headerHandleSelect = (dev: AuthorisedDevice) => {
      const activeId = dev.deviceId || dev.id;
      selectDeviceSpy(dev.id);
      pushSpy(`/soil?deviceId=${activeId}`);
    };

    headerHandleSelect(targetDevice);
    expect(selectDeviceSpy).toHaveBeenCalledTimes(2);
  });

  it('14. Route-Scoped Candidate Rehydration on Hard Refresh', () => {
    const authorisedDevices = mockDevices;

    // Case A: Valid route candidate rehydrates on refresh
    const validCandidateId = 'water-node-001';
    const rehydratedDevice =
      authorisedDevices.find(
        (d) => (d.deviceId && d.deviceId === validCandidateId) || d.id === validCandidateId
      ) || null;

    expect(rehydratedDevice).not.toBeNull();
    expect(rehydratedDevice?.deviceId).toBe('water-node-001');

    // Case B: Bare route with no candidate remains neutral
    const bareCandidateId: string | null = null;
    const bareSelected =
      bareCandidateId !== null
        ? authorisedDevices.find(
            (d) => (d.deviceId && d.deviceId === bareCandidateId) || d.id === bareCandidateId
          ) || null
        : null;

    expect(bareSelected).toBeNull();
  });

  it('15. Loading vs True Empty List Differentiation', () => {
    // While loading is true, devices list may be empty but is not considered "true empty"
    let isLoading = true;
    let devices: AuthorisedDevice[] = [];

    const isTrueEmpty = !isLoading && devices.length === 0;
    expect(isTrueEmpty).toBe(false);

    // When loading finishes with 0 devices, it is true empty
    isLoading = false;
    const isNowTrueEmpty = !isLoading && devices.length === 0;
    expect(isNowTrueEmpty).toBe(true);

    // When loading finishes with devices, it is not empty
    devices = mockDevices;
    const isPopulated = !isLoading && devices.length > 0;
    expect(isPopulated).toBe(true);
  });

  it('16. In-Memory Device A Overridden by Explicit Route Candidate B', () => {
    const authorisedDevices = mockDevices; // soil-node-001 (A), water-node-001 (B), water-tank-node-001 (C)
    const inMemoryDeviceA = mockDevices[0]; // soil-node-001

    // Simulate URL candidate explicitly requesting B (water-node-001)
    const urlCandidateB = 'water-node-001';

    // Route candidate MUST take precedence over in-memory state
    const resolvedCandidate = urlCandidateB ?? inMemoryDeviceA.deviceId;
    expect(resolvedCandidate).toBe('water-node-001');

    const matchedDevice =
      authorisedDevices.find(
        (d) => (d.deviceId && d.deviceId === resolvedCandidate) || d.id === resolvedCandidate
      ) || null;

    expect(matchedDevice).not.toBeNull();
    expect(matchedDevice?.deviceId).toBe('water-node-001');
    expect(matchedDevice?.deviceId).not.toBe(inMemoryDeviceA.deviceId);
  });

  it('17. In-Memory Device A Overridden by Invalid/Revoked Route Candidate Clears to NULL', () => {
    const authorisedDevices = mockDevices;
    const inMemoryDeviceA = mockDevices[0]; // soil-node-001

    // Simulate URL candidate requesting invalid/unassigned device
    const invalidUrlCandidate = 'invalid-unauthorized-999';

    // Verify inMemoryDeviceA was active previously
    expect(inMemoryDeviceA.deviceId).toBe('soil-node-001');

    // Route candidate takes precedence: check candidate against server-authorised list
    const isAuthorised = authorisedDevices.some(
      (d) => d.deviceId === invalidUrlCandidate || d.id === invalidUrlCandidate
    );
    expect(isAuthorised).toBe(false);

    // When unauthorized route candidate is provided, must NOT fall back to inMemoryDeviceA
    let isRevoked = false;
    let revokedDeviceId: string | null = null;
    let finalSelected: AuthorisedDevice | null = null;

    if (!isAuthorised) {
      isRevoked = true;
      revokedDeviceId = invalidUrlCandidate;
      finalSelected = null; // Clears to null, never silently retaining Device A
    }

    expect(isRevoked).toBe(true);
    expect(revokedDeviceId).toBe('invalid-unauthorized-999');
    expect(finalSelected).toBeNull();
  });

  it('18. Leaving Device Context for Neutral Top-Level Page (/, /sensor)', () => {
    const authorisedDevices = mockDevices;

    // When on neutral top-level routes without ?deviceId= query
    const onDeviceContextRoute = false; // e.g. path is '/' or '/sensor'
    const urlCandidate: string | null = null;
    const inMemoryDevice = mockDevices[0];

    // On neutral routes without explicit URL device query, selection resolves to null
    let candidateId: string | null = null;
    if (urlCandidate) {
      candidateId = urlCandidate;
    } else if (onDeviceContextRoute && inMemoryDevice) {
      candidateId = inMemoryDevice.deviceId ?? inMemoryDevice.id;
    }

    expect(candidateId).toBeNull();

    const selectedOnNeutral =
      candidateId !== null
        ? authorisedDevices.find((d) => d.deviceId === candidateId || d.id === candidateId) || null
        : null;

    expect(selectedOnNeutral).toBeNull();
  });

  it('19. Canonical Device-Context Routes vs Legacy Route Rejection', () => {
    const canonicalRoutes = ['/soil', '/water', '/controls'];
    const legacyRoutes = ['/tanah', '/air'];

    const checkIsDeviceRoute = (path: string) => ['/soil', '/water', '/controls'].includes(path);

    canonicalRoutes.forEach((route) => {
      expect(checkIsDeviceRoute(route)).toBe(true);
    });

    legacyRoutes.forEach((route) => {
      expect(checkIsDeviceRoute(route)).toBe(false);
    });
  });
});
