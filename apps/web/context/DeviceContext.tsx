'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface DevicePermissions {
  canView: boolean;
  canControl: boolean;
  canAssign: boolean;
  canConfigure: boolean;
}

export interface AuthorisedDevice {
  id: string;
  deviceId: string;
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

const STORAGE_KEY = 'kebun_melon_selected_device_id';

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export function DeviceProvider({
  children,
  initialDevices,
}: {
  children: React.ReactNode;
  initialDevices?: AuthorisedDevice[];
}) {
  const [devices, setDevices] = useState<AuthorisedDevice[]>(initialDevices || []);
  const [selectedDevice, setSelectedDevice] = useState<AuthorisedDevice | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!initialDevices);
  const [error, setError] = useState<string | null>(null);
  const [isRevoked, setIsRevoked] = useState<boolean>(false);
  const [revokedDeviceId, setRevokedDeviceId] = useState<string | null>(null);

  // Helper to read candidate device ID from URL search params, sessionStorage, or localStorage
  const getCandidateDeviceId = useCallback((): string | null => {
    if (typeof window === 'undefined') return null;

    // 1. Priority: URL query parameter `?deviceId=...`
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlDeviceId = urlParams.get('deviceId');
      if (urlDeviceId && urlDeviceId.trim().length > 0) {
        return urlDeviceId.trim();
      }
    } catch {
      // Ignore URL parsing errors
    }

    // 2. Priority: sessionStorage
    try {
      const sessionStored = sessionStorage.getItem(STORAGE_KEY);
      if (sessionStored && sessionStored.trim().length > 0) {
        return sessionStored.trim();
      }
    } catch {
      // Ignore sessionStorage errors
    }

    // 3. Priority: localStorage
    try {
      const localStored = localStorage.getItem(STORAGE_KEY);
      if (localStored && localStored.trim().length > 0) {
        return localStored.trim();
      }
    } catch {
      // Ignore localStorage errors
    }

    return null;
  }, []);

  // Helper to determine preferred deviceType based on current route path
  const getRoutePreferredDeviceType = useCallback((): string | null => {
    if (typeof window === 'undefined') return null;
    const path = window.location.pathname;
    if (path === '/soil' || path === '/tanah') return 'SOIL_NODE';
    if (path === '/water' || path === '/air') return 'WATER_QUALITY_NODE';
    if (path === '/controls') return 'WATER_TANK_NODE';
    return null;
  }, []);

  // Sync selection with sessionStorage, localStorage and URL without triggering page reload
  const syncSelection = useCallback((device: AuthorisedDevice | null) => {
    if (typeof window === 'undefined') return;

    if (device) {
      try {
        localStorage.setItem(STORAGE_KEY, device.deviceId);
        sessionStorage.setItem(STORAGE_KEY, device.deviceId);
      } catch {
        // Ignore storage write failure
      }

      try {
        const url = new URL(window.location.href);
        if (url.searchParams.get('deviceId') !== device.deviceId) {
          url.searchParams.set('deviceId', device.deviceId);
          window.history.replaceState({}, '', url.toString());
        }
      } catch {
        // Ignore URL update failure
      }
    } else {
      try {
        localStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore storage remove failure
      }

      try {
        const url = new URL(window.location.href);
        if (url.searchParams.has('deviceId')) {
          url.searchParams.delete('deviceId');
          window.history.replaceState({}, '', url.toString());
        }
      } catch {
        // Ignore URL update failure
      }
    }
  }, []);

  // Process a list of authorised devices against candidate selection
  const processDeviceList = useCallback(
    (fetchedDevices: AuthorisedDevice[], currentSelectedId?: string | null) => {
      setDevices(fetchedDevices);

      if (fetchedDevices.length === 0) {
        setSelectedDevice(null);
        syncSelection(null);
        return;
      }

      // Candidate selection ID
      const candidateId = currentSelectedId ?? getCandidateDeviceId();

      if (candidateId) {
        const matched = fetchedDevices.find((d) => d.deviceId === candidateId);
        if (matched) {
          setSelectedDevice(matched);
          syncSelection(matched);
          setIsRevoked(false);
          setRevokedDeviceId(null);
          return;
        } else {
          // Candidate ID was supplied (URL, session, or localStorage) but is NOT in server-authorised list!
          setIsRevoked(true);
          setRevokedDeviceId(candidateId);
          // Fallback to route-matching or first device
          const routePreferredType = getRoutePreferredDeviceType();
          const routeMatch = routePreferredType
            ? fetchedDevices.find((d) => d.deviceType === routePreferredType)
            : null;
          const fallback = routeMatch || fetchedDevices[0];
          setSelectedDevice(fallback);
          syncSelection(fallback);
          return;
        }
      }

      // Default selection: route-matching device or first authorised device
      const routePreferredType = getRoutePreferredDeviceType();
      const routeMatch = routePreferredType
        ? fetchedDevices.find((d) => d.deviceType === routePreferredType)
        : null;
      const defaultDevice = routeMatch || fetchedDevices[0];
      setSelectedDevice(defaultDevice);
      syncSelection(defaultDevice);
    },
    [getCandidateDeviceId, getRoutePreferredDeviceType, syncSelection]
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
        processDeviceList(json.data, selectedDevice?.deviceId || null);
      } else {
        setError(json.error?.message || 'Format data perangkat tidak valid.');
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal terhubung ke server.');
    } finally {
      setIsLoading(false);
    }
  }, [processDeviceList, selectedDevice?.deviceId]);

  useEffect(() => {
    if (initialDevices) {
      processDeviceList(initialDevices);
    } else {
      refetchDevices();
    }
    // eslint-disable-next-deps
  }, []);

  const selectDevice = useCallback(
    (deviceId: string): boolean => {
      const target = devices.find((d) => d.deviceId === deviceId);
      if (!target) {
        setError('Perangkat tidak diizinkan atau tidak ditemukan.');
        return false;
      }

      setSelectedDevice(target);
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
    syncSelection(null);
  }, [syncSelection]);

  const dismissRevokedNotice = useCallback(() => {
    setIsRevoked(false);
    setRevokedDeviceId(null);
  }, []);

  return (
    <DeviceContext.Provider
      value={{
        devices,
        selectedDevice,
        selectedDeviceId: selectedDevice?.deviceId || null,
        isLoading,
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
