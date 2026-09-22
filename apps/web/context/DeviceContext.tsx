'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';

export interface DevicePermissions {
  canView: boolean;
  canControl: boolean;
  canAssign: boolean;
  canConfigure: boolean;
}

export interface AuthorisedDevice {
  id: string;
  deviceId?: string;
  deviceName: string;
  deviceType: string;
  siteId: string | null;
  siteName?: string | null;
  accountStatus?: string;
  connectionStatus: 'ONLINE' | 'OFFLINE' | 'STALE' | 'UNKNOWN' | 'INACTIVE';
  lastSeenAt: string | null;
  firmwareVersion: string | null;
  latitude: number | null;
  longitude: number | null;
  permissions?: DevicePermissions;
}

export interface DeviceContextType {
  devices: AuthorisedDevice[];
  selectedDevice: AuthorisedDevice | null;
  selectedDeviceId: string | null;
  isLoading: boolean;
  error: string | null;
  isRevoked: boolean;
  revokedDeviceId: string | null;
  revokedDeviceName: string | null;
  selectDevice: (deviceId: string) => boolean;
  refetchDevices: () => Promise<void>;
  clearSelectedDevice: () => void;
  dismissRevokedNotice: () => void;
  markDeviceRevoked: (deviceId: string, deviceName?: string | null) => void;
  updateDeviceStatus: (
    deviceId: string,
    status: AuthorisedDevice['connectionStatus'],
    lastSeenAt?: string | null
  ) => void;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

// Helper to extract candidate device ID from URL search query on client
function getUrlDeviceId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('deviceId');
    return id && id.trim() !== '' ? id.trim() : null;
  } catch {
    return null;
  }
}

// Helper to determine if current path is a canonical device-specific monitoring route
function isDeviceContextRoute(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const pathname = window.location.pathname || '';
    return ['/soil', '/water', '/controls'].includes(pathname);
  } catch {
    return false;
  }
}

const DEVICE_CACHE_KEY = 'kebun_melon_device_cache';

interface CachedDeviceInfo {
  deviceName: string;
  deviceType?: string;
}

function getCachedDeviceInfo(deviceId: string): CachedDeviceInfo | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(DEVICE_CACHE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw);
    return map[deviceId] || null;
  } catch {
    return null;
  }
}

function saveDevicesToCache(devices: AuthorisedDevice[]) {
  if (typeof window === 'undefined' || !devices.length) return;
  try {
    const raw = sessionStorage.getItem(DEVICE_CACHE_KEY);
    const map: Record<string, CachedDeviceInfo> = raw ? JSON.parse(raw) : {};
    for (const d of devices) {
      const info: CachedDeviceInfo = {
        deviceName: d.deviceName,
        deviceType: d.deviceType,
      };
      if (d.id) map[d.id] = info;
      if (d.deviceId) map[d.deviceId] = info;
    }
    sessionStorage.setItem(DEVICE_CACHE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage errors
  }
}

export function DeviceProvider({
  children,
  initialDevices,
  initialSelectedDeviceId,
}: {
  children: React.ReactNode;
  initialDevices?: AuthorisedDevice[];
  initialSelectedDeviceId?: string;
}) {
  const pathname = usePathname();
  const [hasFetched, setHasFetched] = useState<boolean>(!!initialDevices);
  const [devices, setDevices] = useState<AuthorisedDevice[]>(initialDevices || []);
  const [selectedDevice, setSelectedDevice] = useState<AuthorisedDevice | null>(() => {
    if (initialDevices) {
      const candidateId = initialSelectedDeviceId ?? getUrlDeviceId();
      if (candidateId) {
        return (
          initialDevices.find(
            (d) => (d.deviceId && d.deviceId === candidateId) || d.id === candidateId
          ) || null
        );
      }
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(!initialDevices);
  const [error, setError] = useState<string | null>(null);
  const [isRevoked, setIsRevoked] = useState<boolean>(() => {
    if (initialDevices) {
      const candidateId = initialSelectedDeviceId ?? getUrlDeviceId();
      if (candidateId) {
        const matched = initialDevices.find(
          (d) => (d.deviceId && d.deviceId === candidateId) || d.id === candidateId
        );
        return !matched;
      }
    }
    return false;
  });
  const [revokedDeviceId, setRevokedDeviceId] = useState<string | null>(() => {
    if (initialDevices) {
      const candidateId = initialSelectedDeviceId ?? getUrlDeviceId();
      if (candidateId) {
        const matched = initialDevices.find(
          (d) => (d.deviceId && d.deviceId === candidateId) || d.id === candidateId
        );
        return !matched ? candidateId : null;
      }
    }
    return null;
  });
  const [revokedDeviceName, setRevokedDeviceName] = useState<string | null>(() => {
    if (initialDevices) {
      const candidateId = initialSelectedDeviceId ?? getUrlDeviceId();
      if (candidateId) {
        const matched = initialDevices.find(
          (d) => (d.deviceId && d.deviceId === candidateId) || d.id === candidateId
        );
        if (!matched) {
          const cached = getCachedDeviceInfo(candidateId);
          return cached?.deviceName || null;
        }
      }
    }
    return null;
  });

  // Keep a ref to avoid stale closure state during async in-flight fetch
  const selectedDeviceRef = React.useRef<AuthorisedDevice | null>(selectedDevice);
  React.useEffect(() => {
    selectedDeviceRef.current = selectedDevice;
  }, [selectedDevice]);

  // Sync selection with URL without triggering page reload
  const syncSelection = useCallback((device: AuthorisedDevice | null) => {
    if (typeof window === 'undefined') return;

    if (device) {
      const activeId = device.id;
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.get('deviceId') !== activeId) {
          url.searchParams.set('deviceId', activeId);
          window.history.replaceState(window.history.state, '', url.toString());
        }
      } catch {
        // Ignore URL update failure
      }
    } else {
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.has('deviceId')) {
          url.searchParams.delete('deviceId');
          window.history.replaceState(window.history.state, '', url.toString());
        }
      } catch {
        // Ignore URL update failure
      }
    }
  }, []);

  // Process a list of authorised devices against candidate selection
  const processDeviceList = useCallback(
    (fetchedDevices: AuthorisedDevice[], explicitCandidateId?: string | null) => {
      setDevices(fetchedDevices);
      saveDevicesToCache(fetchedDevices);

      const urlCandidateId = getUrlDeviceId();
      const onDeviceRoute = isDeviceContextRoute();

      // Candidate resolution priority:
      // 1. Explicit candidate passed directly (e.g. from an explicit caller)
      // 2. initialSelectedDeviceId (from props/tests)
      // 3. URL search parameter (?deviceId=...) - the active route context always takes precedence over stale in-memory state
      // 4. In-memory current selection ONLY if currently on a device-context route and no conflicting URL candidate
      let candidateId: string | null = null;
      if (explicitCandidateId !== undefined) {
        candidateId = explicitCandidateId;
      } else if (initialSelectedDeviceId) {
        candidateId = initialSelectedDeviceId;
      } else if (urlCandidateId) {
        candidateId = urlCandidateId;
      } else if (onDeviceRoute && selectedDeviceRef.current) {
        candidateId = selectedDeviceRef.current.id;
      }

      if (candidateId) {
        const matched = fetchedDevices.find(
          (d) => (d.deviceId && d.deviceId === candidateId) || d.id === candidateId
        );
        if (matched) {
          setSelectedDevice(matched);
          selectedDeviceRef.current = matched;
          syncSelection(matched);
          setIsRevoked(false);
          setRevokedDeviceId(null);
          setRevokedDeviceName(null);
          return;
        } else {
          // Candidate ID was explicitly requested (via URL or context) but is NOT in server-authorised list (revoked/unassigned/invalid)
          const cached = getCachedDeviceInfo(candidateId);
          const friendlyName =
            cached?.deviceName ||
            (selectedDeviceRef.current?.id === candidateId ||
            selectedDeviceRef.current?.deviceId === candidateId
              ? selectedDeviceRef.current?.deviceName
              : null);

          setIsRevoked(true);
          setRevokedDeviceId(candidateId);
          setRevokedDeviceName(friendlyName || null);
          setSelectedDevice(null);
          selectedDeviceRef.current = null;
          // Do not delete deviceId from URL so the revoked context is deterministic upon refresh
          return;
        }
      }

      // Neutral top-level route (/, /sensor, /devices, /users) or bare route without deviceId: neutral state (null)
      setSelectedDevice(null);
      selectedDeviceRef.current = null;
      syncSelection(null);
      setIsRevoked(false);
      setRevokedDeviceId(null);
      setRevokedDeviceName(null);
    },
    [initialSelectedDeviceId, syncSelection]
  );

  const refetchDevices = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/devices');
      if (!response.ok) {
        if (response.status === 401) {
          setError('Sesi berakhir. Silakan login kembali.');
        } else {
          setError(`Gagal memuat perangkat (${response.status})`);
        }
        setIsLoading(false);
        return;
      }

      const json = await response.json();
      if (json.success && Array.isArray(json.data)) {
        processDeviceList(json.data);
      } else {
        setError(json.error?.message || 'Format data perangkat tidak valid.');
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal terhubung ke server.');
    } finally {
      setIsLoading(false);
    }
  }, [processDeviceList]);

  useEffect(() => {
    if (initialDevices) {
      processDeviceList(initialDevices);
      setHasFetched(true);
      return;
    }

    const currentPath = pathname || (typeof window !== 'undefined' ? window.location.pathname : '');
    const isAuthRoute = ['/login', '/register', '/forgot-password', '/status'].includes(
      currentPath
    );

    if (isAuthRoute) {
      setIsLoading(false);
      return;
    }

    if (!hasFetched) {
      setHasFetched(true);
      refetchDevices();
    }
  }, [pathname, initialDevices, processDeviceList, refetchDevices, hasFetched]);

  // Listen for browser history navigation (popstate) to synchronize route context
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = () => {
      if (devices.length > 0) {
        processDeviceList(devices);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [devices, processDeviceList]);

  const selectDevice = useCallback(
    (deviceId: string): boolean => {
      const target = devices.find(
        (d) => (d.deviceId && d.deviceId === deviceId) || d.id === deviceId
      );
      if (!target) {
        setError('Perangkat tidak diizinkan atau tidak ditemukan.');
        return false;
      }

      setSelectedDevice(target);
      selectedDeviceRef.current = target;
      syncSelection(target);
      setIsRevoked(false);
      setRevokedDeviceId(null);
      setRevokedDeviceName(null);
      setError(null);
      return true;
    },
    [devices, syncSelection]
  );

  const clearSelectedDevice = useCallback(() => {
    setSelectedDevice(null);
    selectedDeviceRef.current = null;
    syncSelection(null);
  }, [syncSelection]);

  const dismissRevokedNotice = useCallback(() => {
    setIsRevoked(false);
    setRevokedDeviceId(null);
    setRevokedDeviceName(null);
  }, []);

  const markDeviceRevoked = useCallback((deviceId: string, deviceName?: string | null) => {
    const cached = getCachedDeviceInfo(deviceId);
    const resolvedName =
      deviceName ||
      cached?.deviceName ||
      (selectedDeviceRef.current?.id === deviceId ||
      selectedDeviceRef.current?.deviceId === deviceId
        ? selectedDeviceRef.current?.deviceName
        : null);

    setIsRevoked(true);
    setRevokedDeviceId(deviceId);
    setRevokedDeviceName(resolvedName || null);
    setSelectedDevice(null);
    selectedDeviceRef.current = null;
  }, []);

  const updateDeviceStatus = useCallback(
    (
      deviceId: string,
      status: AuthorisedDevice['connectionStatus'],
      lastSeenAt?: string | null
    ) => {
      setDevices((prevDevices) =>
        prevDevices.map((d) => {
          if (d.id === deviceId || d.deviceId === deviceId) {
            if (
              d.connectionStatus === status &&
              (lastSeenAt === undefined || d.lastSeenAt === lastSeenAt)
            ) {
              return d;
            }
            return {
              ...d,
              connectionStatus: status,
              lastSeenAt: lastSeenAt !== undefined ? lastSeenAt : d.lastSeenAt,
            };
          }
          return d;
        })
      );

      setSelectedDevice((prevSelected) => {
        if (prevSelected && (prevSelected.id === deviceId || prevSelected.deviceId === deviceId)) {
          if (
            prevSelected.connectionStatus === status &&
            (lastSeenAt === undefined || prevSelected.lastSeenAt === lastSeenAt)
          ) {
            return prevSelected;
          }
          const updated = {
            ...prevSelected,
            connectionStatus: status,
            lastSeenAt: lastSeenAt !== undefined ? lastSeenAt : prevSelected.lastSeenAt,
          };
          selectedDeviceRef.current = updated;
          return updated;
        }
        return prevSelected;
      });
    },
    []
  );

  const currentPath = pathname || (typeof window !== 'undefined' ? window.location.pathname : '');
  const isAuthRoute = ['/login', '/register', '/forgot-password', '/status'].includes(currentPath);
  const effectiveIsLoading = isLoading || (!hasFetched && !isAuthRoute && !initialDevices);

  return (
    <DeviceContext.Provider
      value={{
        devices,
        selectedDevice,
        selectedDeviceId: selectedDevice?.id || null,
        isLoading: effectiveIsLoading,
        error,
        isRevoked,
        revokedDeviceId,
        revokedDeviceName,
        selectDevice,
        refetchDevices,
        clearSelectedDevice,
        dismissRevokedNotice,
        markDeviceRevoked,
        updateDeviceStatus,
      }}
    >
      {children}
    </DeviceContext.Provider>
  );
}

export function useDeviceContext(): DeviceContextType {
  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error('useDeviceContext must be used within a DeviceProvider');
  }
  return context;
}
