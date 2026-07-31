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

  // Helper to read candidate device ID from URL search params or localStorage
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

    // 2. Priority: localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && stored.trim().length > 0) {
        return stored.trim();
      }
    } catch {
      // Ignore localStorage errors
    }

    return null;
  }, []);

  // Sync selection with localStorage and URL without triggering page reload
  const syncSelection = useCallback((device: AuthorisedDevice | null) => {
    if (typeof window === 'undefined') return;

    if (device) {
      try {
        localStorage.setItem(STORAGE_KEY, device.deviceId);
      } catch {
        // Ignore localStorage write failure
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
      } catch {
        // Ignore localStorage remove failure
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
          // Candidate ID was supplied (URL or localStorage) but is NOT in server-authorised list!
          // Tampered URL or revoked access detected!
          setIsRevoked(true);
          setRevokedDeviceId(candidateId);
          // Fallback to first authorised device
          const fallback = fetchedDevices[0];
          setSelectedDevice(fallback);
          syncSelection(fallback);
          return;
        }
      }

      // Default selection: first authorised device
      const defaultDevice = fetchedDevices[0];
      setSelectedDevice(defaultDevice);
      syncSelection(defaultDevice);
    },
    [getCandidateDeviceId, syncSelection]
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
        // Attempted selection of non-authorised device (tampering or invalid ID)
        setError('Perangkat tidak diizinkan atau tidak ditemukan.');
        return false;
      }

      // Clear stale state and select target device
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
