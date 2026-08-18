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
  selectDevice: (deviceId: string) => boolean;
  refetchDevices: () => Promise<void>;
  clearSelectedDevice: () => void;
  dismissRevokedNotice: () => void;
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
  const [isRevoked, setIsRevoked] = useState<boolean>(false);
  const [revokedDeviceId, setRevokedDeviceId] = useState<string | null>(null);

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

      if (fetchedDevices.length === 0) {
        setSelectedDevice(null);
        selectedDeviceRef.current = null;
        syncSelection(null);
        return;
      }

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
          return;
        } else {
          // Candidate ID was explicitly requested (via URL or context) but is NOT in server-authorised list (revoked/unassigned/invalid)
          setIsRevoked(true);
          setRevokedDeviceId(candidateId);
          setSelectedDevice(null);
          selectedDeviceRef.current = null;
          syncSelection(null);
          return;
        }
      }

      // Neutral top-level route (/, /sensor, /devices, /users) or bare route without deviceId: neutral state (null)
      setSelectedDevice(null);
      selectedDeviceRef.current = null;
      syncSelection(null);
      setIsRevoked(false);
      setRevokedDeviceId(null);
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
  }, []);

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
        selectDevice,
        refetchDevices,
        clearSelectedDevice,
        dismissRevokedNotice,
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
