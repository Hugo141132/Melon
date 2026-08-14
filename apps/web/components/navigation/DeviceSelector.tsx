'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useDeviceContext, AuthorisedDevice } from '@/context/DeviceContext';
import { useRouter } from 'next/navigation';
import { ChevronDown, Search, Check, AlertTriangle, Cpu, RefreshCw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn, formatDeviceDisplayName } from '@/lib/utils';

export interface DeviceSelectorProps {
  className?: string;
}

export default function DeviceSelector({ className }: DeviceSelectorProps) {
  const router = useRouter();
  const tDevices = useTranslations('devices');
  const tCommon = useTranslations('common');
  const tAccessibility = useTranslations('accessibility');

  const {
    devices,
    selectedDevice,
    selectDevice,
    isLoading,
    error,
    isRevoked,
    revokedDeviceId,
    refetchDevices,
    dismissRevokedNotice,
  } = useDeviceContext();

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ONLINE' | 'OFFLINE'>('ALL');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Prefetch target routes for instant seamless client navigation
  useEffect(() => {
    router.prefetch('/soil');
    router.prefetch('/water');
    router.prefetch('/controls');
  }, [router]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Filtered devices list for dropdown
  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        d.deviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.deviceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.siteName && d.siteName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ONLINE' && d.connectionStatus === 'ONLINE') ||
        (statusFilter === 'OFFLINE' && d.connectionStatus !== 'ONLINE');

      return matchesSearch && matchesStatus;
    });
  }, [devices, searchQuery, statusFilter]);

  // Handle item selection
  const handleSelect = (device: AuthorisedDevice) => {
    selectDevice(device.deviceId);
    setIsOpen(false);
    setSearchQuery('');
    if (device.deviceType === 'SOIL_NODE') {
      router.push('/soil');
    } else if (device.deviceType === 'WATER_QUALITY_NODE') {
      router.push('/water');
    } else if (device.deviceType === 'WATER_TANK_NODE') {
      router.push('/controls');
    }
  };

  // Keyboard navigation inside dropdown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // Status Dot Color helper
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ONLINE':
        return 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]';
      case 'OFFLINE':
        return 'bg-amber-500';
      case 'STALE':
        return 'bg-amber-400';
      case 'INACTIVE':
        return 'bg-gray-400';
      default:
        return 'bg-gray-400';
    }
  };

  // 1. Loading State (Skeleton loading)
  if (isLoading) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 bg-app-surface-container/60 px-3 py-1.5 rounded-xl animate-pulse border border-app-outline-variant/20',
          className
        )}
        data-testid="device-selector-loading"
      >
        <div className="w-2.5 h-2.5 rounded-full bg-app-outline-variant/40" />
        <div className="h-4 w-24 bg-app-outline-variant/40 rounded" />
      </div>
    );
  }

  // 2. API Error State
  if (error && devices.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center gap-1.5 bg-app-error/10 text-app-error border border-app-error/20 px-2.5 py-1 rounded-xl text-xs font-medium',
          className
        )}
        data-testid="device-selector-error"
      >
        <AlertTriangle size={14} className="flex-shrink-0" />
        <span className="truncate max-w-[140px]">{error}</span>
        <button
          onClick={() => refetchDevices()}
          className="p-0.5 hover:bg-app-error/20 rounded transition-colors"
          title={tCommon('retry')}
        >
          <RefreshCw size={12} />
        </button>
      </div>
    );
  }

  // 3. 0 Devices State (No assigned devices)
  if (devices.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 bg-app-surface-container-high/80 border border-app-outline-variant/30 text-app-on-surface-variant px-3 py-1.5 rounded-xl text-xs font-medium',
          className
        )}
        data-testid="device-selector-zero"
      >
        <Cpu size={14} className="text-app-on-surface-variant/70" />
        <span>{tDevices('noDevices')}</span>
      </div>
    );
  }

  // 4. Single Device State (1 device authorised)
  if (devices.length === 1 && selectedDevice) {
    return (
      <div
        className={cn('relative inline-flex items-center justify-center max-w-full', className)}
        data-testid="device-selector-single"
      >
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 bg-app-surface-container-lowest border border-app-outline-variant/30 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold text-app-on-surface shadow-xs max-w-full">
          <span
            className={cn(
              'w-2 h-2 rounded-full flex-shrink-0',
              getStatusColor(selectedDevice.connectionStatus)
            )}
          />
          <span
            className="truncate max-w-[95px] xs:max-w-[130px] sm:max-w-[160px]"
            title={formatDeviceDisplayName(selectedDevice, tDevices)}
          >
            {formatDeviceDisplayName(selectedDevice, tDevices)}
          </span>
          <span className="text-[10px] text-app-on-surface-variant bg-app-surface-container px-1.5 py-0.5 rounded font-mono">
            {selectedDevice.deviceType.replace('_NODE', '')}
          </span>
        </div>
      </div>
    );
  }

  // 5. Multiple Devices State (>1 devices authorised)
  return (
    <div
      ref={dropdownRef}
      className={cn(
        'relative inline-flex items-center justify-center text-left max-w-full',
        className
      )}
      data-testid="device-selector-multiple"
      onKeyDown={handleKeyDown}
    >
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center justify-center gap-1.5 sm:gap-2 bg-app-surface-container-lowest hover:bg-app-surface-container-low border border-app-outline-variant/40 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold text-app-on-surface transition-all active:scale-[0.98] shadow-xs cursor-pointer max-w-full',
          isOpen && 'ring-2 ring-app-primary/20 border-app-primary/40'
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={tAccessibility('deviceSelector')}
        data-testid="device-selector-trigger"
      >
        <span
          className={cn(
            'w-2 h-2 rounded-full flex-shrink-0',
            getStatusColor(selectedDevice?.connectionStatus || 'UNKNOWN')
          )}
        />
        <span
          className="truncate max-w-[95px] xs:max-w-[130px] sm:max-w-[160px]"
          title={formatDeviceDisplayName(selectedDevice, tDevices)}
        >
          {formatDeviceDisplayName(selectedDevice, tDevices) || tDevices('selectDevice')}
        </span>
        <ChevronDown
          size={14}
          className={cn(
            'text-app-on-surface-variant transition-transform duration-200 flex-shrink-0',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Revoked Access Alert Notice */}
      {isRevoked && (
        <div
          className="absolute left-1/2 -translate-x-1/2 sm:left-auto sm:right-0 sm:translate-x-0 top-full mt-2 w-[calc(100vw-2rem)] max-w-xs sm:w-72 z-50 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 shadow-lg flex items-start gap-2.5 text-xs animate-fade-in"
          data-testid="revoked-access-banner"
        >
          <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-amber-900 mb-0.5">
              {tDevices('accessRedirectedTitle')}
            </p>
            <p className="text-amber-800 text-[11px] leading-4">
              {tDevices('accessRedirectedDesc', { deviceId: revokedDeviceId || '' })}
            </p>
          </div>
          <button
            onClick={dismissRevokedNotice}
            className="text-amber-700 hover:text-amber-900 p-0.5 rounded cursor-pointer"
            aria-label={tCommon('close')}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Dropdown Menu Overlay */}
      {isOpen && (
        <div
          className="absolute left-1/2 -translate-x-1/2 sm:left-auto sm:right-0 sm:translate-x-0 top-full mt-2 w-[calc(100vw-2rem)] max-w-xs sm:w-80 z-50 bg-app-surface-container-lowest border border-app-outline-variant/30 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
          role="listbox"
          data-testid="device-selector-menu"
        >
          {/* Search & Filter Header */}
          <div className="p-3 border-b border-app-outline-variant/20 bg-app-surface-container-low/30 space-y-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-on-surface-variant/60"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tDevices('searchPlaceholder')}
                className="w-full bg-app-surface-container-lowest border border-app-outline-variant/30 rounded-lg pl-8 pr-3 py-1.5 text-xs text-app-on-surface placeholder:text-app-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-app-primary"
                data-testid="device-search-input"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-app-on-surface-variant hover:text-app-on-surface"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Quick Status Tabs */}
            <div className="flex items-center gap-1">
              {[
                { key: 'ALL', label: tCommon('all') },
                { key: 'ONLINE', label: tDevices('online') },
                { key: 'OFFLINE', label: tDevices('offline') },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key as any)}
                  className={cn(
                    'px-2 py-0.5 text-[11px] font-medium rounded-md transition-colors cursor-pointer',
                    statusFilter === tab.key
                      ? 'bg-app-primary text-white font-semibold'
                      : 'text-app-on-surface-variant hover:bg-app-surface-container-high'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Device Items List */}
          <div className="max-h-60 overflow-y-auto p-1 divide-y divide-app-outline-variant/10">
            {filteredDevices.length === 0 ? (
              <div className="p-4 text-center text-xs text-app-on-surface-variant">
                {tDevices('noDevicesFound')}
              </div>
            ) : (
              filteredDevices.map((device) => {
                const isSelected = selectedDevice?.deviceId === device.deviceId;
                return (
                  <button
                    key={device.deviceId}
                    type="button"
                    onClick={() => handleSelect(device)}
                    className={cn(
                      'w-full flex items-start justify-between p-2.5 rounded-xl text-left transition-colors cursor-pointer group',
                      isSelected
                        ? 'bg-app-primary/10 text-app-primary font-semibold'
                        : 'hover:bg-app-surface-container-low text-app-on-surface'
                    )}
                    role="option"
                    aria-selected={isSelected}
                    data-testid={`device-option-${device.deviceId}`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span
                        className={cn(
                          'w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1',
                          getStatusColor(device.connectionStatus)
                        )}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold truncate">
                            {formatDeviceDisplayName(device, tDevices)}
                          </p>
                          <span className="text-[10px] text-app-on-surface-variant/80 font-mono bg-app-surface-container/60 px-1 py-0.2 rounded">
                            {device.deviceType.replace('_NODE', '')}
                          </span>
                        </div>
                        {device.siteName && (
                          <p className="text-[11px] text-app-on-surface-variant truncate">
                            {device.siteName}
                          </p>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Check size={16} className="text-app-primary flex-shrink-0 mt-0.5 ml-2" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer Info */}
          <div className="px-3 py-2 bg-app-surface-container-low/50 border-t border-app-outline-variant/10 flex items-center justify-between text-[10px] text-app-on-surface-variant">
            <span>{tDevices('totalDevicesCount', { count: devices.length })}</span>
            <button
              onClick={() => {
                refetchDevices();
                setIsOpen(false);
              }}
              className="flex items-center gap-1 text-app-primary font-medium hover:underline cursor-pointer"
            >
              <RefreshCw size={10} /> {tCommon('refresh')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
