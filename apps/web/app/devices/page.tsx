'use client';

import { useState, useEffect, useCallback } from 'react';
import TopAppBar from '@/components/navigation/TopAppBar';
import {
  Cpu,
  Search,
  Edit2,
  PowerOff,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Radio,
  RotateCcw,
} from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { useAuth } from '@/context/AuthContext';

interface PublicSafeDeviceDto {
  id: string;
  deviceId?: string;
  siteId: string | null;
  name: string;
  deviceType: 'SOIL_NODE' | 'WATER_QUALITY_NODE' | 'WATER_TANK_NODE';
  accountStatus: 'ACTIVE' | 'INACTIVE' | 'DEACTIVATED';
  connectionStatus: 'ONLINE' | 'OFFLINE' | 'STALE' | 'UNKNOWN' | 'INACTIVE';
  firmwareVersion: string | null;
  hardwareRevision: string | null;
  schemaVersion: string | null;
  lastSeenAt: string | null;
  lastMessageAt: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  updatedAt: string;
  deactivatedAt: string | null;
  capabilities: string[];
}

interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export default function DeviceRegistryPage() {
  const tDevices = useTranslations('devices');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { role, setUser, invalidateSession } = useAuth();
  const isOwner = role === 'OWNER';

  // List state
  const [devices, setDevices] = useState<PublicSafeDeviceDto[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Edit Modal State (Owner Only)
  const [editDevice, setEditDevice] = useState<PublicSafeDeviceDto | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editDeviceId, setEditDeviceId] = useState('');
  const [editName, setEditName] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Deactivate Modal State
  const [deactivateDevice, setDeactivateDevice] = useState<PublicSafeDeviceDto | null>(null);
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [deactivateSubmitting, setDeactivateSubmitting] = useState(false);

  // Activate Modal State
  const [activateDevice, setActivateDevice] = useState<PublicSafeDeviceDto | null>(null);
  const [activateModalOpen, setActivateModalOpen] = useState(false);
  const [activateSubmitting, setActivateSubmitting] = useState(false);

  // Fetch devices (supports silent refetch to prevent skeleton flicker)
  const fetchDevices = useCallback(
    async (pageToFetch = 1, silent = false) => {
      if (!silent) setLoading(true);
      setErrorMsg(null);
      try {
        const queryParams = new URLSearchParams();
        queryParams.set('page', pageToFetch.toString());
        queryParams.set('pageSize', '50');
        if (search.trim()) queryParams.set('search', search.trim());
        if (typeFilter !== 'ALL') queryParams.set('deviceType', typeFilter);

        const res = await fetch(`/api/v1/devices?${queryParams.toString()}`);
        if (res.status === 401) {
          setUser?.(null);
          invalidateSession?.();
          window.location.href = '/login?redirect=/devices';
          return;
        }
        const json = await res.json();

        if (json.success) {
          setDevices(json.data || []);
          if (json.meta?.pagination) {
            setPagination(json.meta.pagination);
          }
        } else {
          setErrorMsg(json.error?.message || tDevices('loadFailed'));
        }
      } catch {
        setErrorMsg(tDevices('networkErrorLoad'));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [search, typeFilter, tDevices]
  );

  useEffect(() => {
    fetchDevices(1);
  }, [fetchDevices]);

  // Handle Edit Device (Owner Only)
  const handleUpdateDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDevice || !editName.trim()) return;

    setEditSubmitting(true);
    setErrorMsg(null);

    try {
      const payload: { name: string; deviceId?: string } = {
        name: editName.trim(),
      };
      if (editDeviceId.trim() && editDeviceId.trim() !== editDevice.deviceId) {
        payload.deviceId = editDeviceId.trim();
      }

      const targetIdentifier = editDevice.deviceId || editDevice.id;
      const res = await fetch(`/api/v1/devices/${targetIdentifier}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        setSuccessMsg(tDevices('updateSuccess', { name: json.data.name }));
        setEditModalOpen(false);
        setEditDevice(null);
        setDevices((prev) =>
          prev.map((d) => (d.id === editDevice.id ? { ...d, ...json.data } : d))
        );
        fetchDevices(pagination.page, true);
      } else {
        setErrorMsg(json.error?.message || tDevices('updateFailed'));
      }
    } catch {
      setErrorMsg(tDevices('networkErrorUpdate'));
    } finally {
      setEditSubmitting(false);
    }
  };

  // Handle Deactivate Device
  const handleDeactivate = async () => {
    if (!deactivateDevice) return;

    setDeactivateSubmitting(true);
    setErrorMsg(null);

    try {
      const targetIdentifier = deactivateDevice.deviceId || deactivateDevice.id;
      const res = await fetch(`/api/v1/devices/${targetIdentifier}/deactivate`, {
        method: 'POST',
      });

      const json = await res.json();
      if (json.success) {
        setSuccessMsg(tDevices('deactivateSuccess', { name: deactivateDevice.name }));
        setDeactivateModalOpen(false);
        const targetId = deactivateDevice.id;
        setDeactivateDevice(null);
        setDevices((prev) =>
          prev.map((d) =>
            d.id === targetId
              ? { ...d, accountStatus: 'DEACTIVATED', connectionStatus: 'INACTIVE' }
              : d
          )
        );
        fetchDevices(pagination.page, true);
      } else {
        setErrorMsg(json.error?.message || tDevices('deactivateFailed'));
      }
    } catch {
      setErrorMsg(tDevices('networkErrorDeactivate'));
    } finally {
      setDeactivateSubmitting(false);
    }
  };

  // Handle Activate Device
  const handleActivate = async () => {
    if (!activateDevice) return;

    setActivateSubmitting(true);
    setErrorMsg(null);

    try {
      const targetIdentifier = activateDevice.deviceId || activateDevice.id;
      const res = await fetch(`/api/v1/devices/${targetIdentifier}/activate`, {
        method: 'POST',
      });

      const json = await res.json();
      if (json.success) {
        setSuccessMsg(tDevices('activateSuccess', { name: activateDevice.name }));
        setActivateModalOpen(false);
        const targetId = activateDevice.id;
        setActivateDevice(null);
        setDevices((prev) =>
          prev.map((d) =>
            d.id === targetId ? { ...d, accountStatus: 'ACTIVE', connectionStatus: 'UNKNOWN' } : d
          )
        );
        fetchDevices(pagination.page, true);
      } else {
        setErrorMsg(json.error?.message || tDevices('activateFailed'));
      }
    } catch {
      setErrorMsg(tDevices('networkErrorActivate'));
    } finally {
      setActivateSubmitting(false);
    }
  };

  // User-facing device status simplification: Connected, Disconnected, Inactive
  const displayedDevices = devices.filter((device) => {
    const isOnline = device.accountStatus !== 'DEACTIVATED' && device.connectionStatus === 'ONLINE';
    const isInactive =
      device.accountStatus === 'DEACTIVATED' || device.connectionStatus === 'INACTIVE';
    const isDisconnected = !isOnline && !isInactive;

    if (statusFilter === 'CONNECTED') return isOnline;
    if (statusFilter === 'DISCONNECTED') return isDisconnected;
    if (statusFilter === 'INACTIVE') return isInactive;
    return true;
  });

  return (
    <div className="bg-app-surface text-app-on-surface min-h-dvh pb-24">
      <TopAppBar />

      <main className="pt-20 px-[1rem] max-w-4xl mx-auto w-full space-y-5">
        {/* Header */}
        <section className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-app-surface-container-lowest p-5 rounded-xl soft-elevation-lg border border-app-outline-variant/30">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-app-primary/10 flex items-center justify-center text-app-primary">
              <Cpu size={26} />
            </div>
            <div>
              <h1 className="text-[22px] leading-7 font-bold text-app-primary">
                {tDevices('title')}
              </h1>
              <p className="text-[14px] text-app-on-surface-variant">{tDevices('subtitle')}</p>
            </div>
          </div>
        </section>

        {/* Feedback Banners */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-3 animate-fade-in">
            <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-[14px] leading-relaxed">{errorMsg}</div>
            <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-700">
              <X size={18} />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-3 animate-fade-in">
            <CheckCircle2 size={20} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-[14px] leading-relaxed">{successMsg}</div>
            <button
              onClick={() => setSuccessMsg(null)}
              className="text-emerald-600 hover:text-emerald-800"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Controls & Filters */}
        <div className="bg-app-surface-container-lowest p-4 rounded-xl soft-elevation border border-app-outline-variant/20 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 min-w-0">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-app-outline"
            />
            <input
              type="text"
              placeholder={tDevices('searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-app-surface border border-app-outline-variant/40 rounded-xl text-[14px] focus:outline-none focus:border-app-primary transition-colors min-w-0 truncate placeholder:truncate"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2.5 bg-app-surface border border-app-outline-variant/40 rounded-xl text-[13px] font-medium text-app-on-surface focus:outline-none focus:border-app-primary truncate"
            >
              <option value="ALL">{tDevices('allDomains')}</option>
              <option value="SOIL_NODE">{tDevices('domainSoilLabel')}</option>
              <option value="WATER_QUALITY_NODE">{tDevices('domainWaterLabel')}</option>
              <option value="WATER_TANK_NODE">{tDevices('domainTankLabel')}</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2.5 bg-app-surface border border-app-outline-variant/40 rounded-xl text-[13px] font-medium text-app-on-surface focus:outline-none focus:border-app-primary truncate"
            >
              <option value="ALL">{tDevices('allStatuses')}</option>
              <option value="CONNECTED">{tDevices('connected')}</option>
              <option value="DISCONNECTED">{tDevices('disconnected')}</option>
              <option value="INACTIVE">{tDevices('inactive')}</option>
            </select>
          </div>
        </div>

        {/* Device Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-app-surface-container-lowest p-4 sm:p-5 rounded-xl border border-app-outline-variant/20 space-y-3.5 animate-pulse"
              >
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-app-surface-container rounded w-24" />
                  <div className="h-5 bg-app-surface-container rounded-full w-16" />
                </div>
                <div className="h-5 bg-app-surface-container rounded w-2/3" />
                <div className="flex justify-between pt-2 border-t border-app-outline-variant/10">
                  <div className="h-3 bg-app-surface-container rounded w-1/3" />
                  <div className="h-3 bg-app-surface-container rounded w-1/4" />
                </div>
                <div className="flex gap-1.5 pt-2">
                  <div className="h-6 bg-app-surface-container rounded w-20" />
                  <div className="h-6 bg-app-surface-container rounded w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : displayedDevices.length === 0 ? (
          <div className="p-12 bg-app-surface-container-lowest rounded-xl border border-app-outline-variant/20 text-center space-y-3">
            <Radio size={40} className="mx-auto text-app-outline" />
            <h3 className="text-[16px] font-semibold text-app-on-surface">
              {tDevices('noDevicesFound')}
            </h3>
            <p className="text-[14px] text-app-on-surface-variant max-w-md mx-auto">
              {tDevices('noDevicesSubtitle')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedDevices.map((device) => {
              const isDeactivated = device.accountStatus === 'DEACTIVATED';

              // Helper to resolve user-friendly parameter items with proper measurement names and units
              const resolveParameters = () => {
                const rawCaps = device.capabilities || [];
                const monitoringItems: { key: string; label: string; unit?: string }[] = [];
                const controlItems: { key: string; label: string; detail?: string }[] = [];

                const paramMeta: Record<string, { label: string; unit?: string }> = {
                  SOIL_NITROGEN: { label: tDevices('paramNitrogen'), unit: 'mg/kg' },
                  SOIL_PHOSPHORUS: { label: tDevices('paramPhosphorus'), unit: 'mg/kg' },
                  SOIL_POTASSIUM: { label: tDevices('paramPotassium'), unit: 'mg/kg' },
                  SOIL_TEMPERATURE: { label: tDevices('paramSoilTemperature'), unit: '°C' },
                  SOIL_MOISTURE: { label: tDevices('paramSoilMoisture'), unit: '%' },
                  SOIL_PH: { label: tDevices('paramSoilPh'), unit: 'pH' },
                  SOIL_EC: { label: tDevices('paramSoilEc'), unit: 'µS/cm' },
                  SOIL_NPK: { label: tDevices('paramSoilNpk'), unit: 'mg/kg' },
                  WATER_PH: { label: tDevices('paramWaterPh'), unit: 'pH' },
                  WATER_TDS: { label: tDevices('paramWaterTds'), unit: 'ppm' },
                  WATER_EC: { label: tDevices('paramWaterEc'), unit: 'µS/cm' },
                  WATER_TANK_VOLUME: { label: tDevices('paramWaterTankVolume'), unit: 'L' },
                };

                const addedKeys = new Set<string>();
                const addMonitoringItem = (key: string, label: string, unit?: string) => {
                  if (!addedKeys.has(key)) {
                    addedKeys.add(key);
                    monitoringItems.push({ key, label, unit });
                  }
                };

                // Domain-strict parameter resolution:
                // 1. SOIL_NODE strictly shows soil monitoring parameters; never FAUCET_CONTROL
                if (device.deviceType === 'SOIL_NODE') {
                  if (rawCaps.includes('SOIL_TELEMETRY') || rawCaps.length === 0) {
                    addMonitoringItem('SOIL_NITROGEN', tDevices('paramNitrogen'), 'mg/kg');
                    addMonitoringItem('SOIL_PHOSPHORUS', tDevices('paramPhosphorus'), 'mg/kg');
                    addMonitoringItem('SOIL_POTASSIUM', tDevices('paramPotassium'), 'mg/kg');
                    addMonitoringItem('SOIL_TEMPERATURE', tDevices('paramSoilTemperature'), '°C');
                    addMonitoringItem('SOIL_MOISTURE', tDevices('paramSoilMoisture'), '%');
                    addMonitoringItem('SOIL_PH', tDevices('paramSoilPh'), 'pH');
                    addMonitoringItem('SOIL_EC', tDevices('paramSoilEc'), 'µS/cm');
                  }
                  for (const cap of rawCaps) {
                    if (cap === 'SOIL_TELEMETRY' || cap === 'FAUCET_CONTROL') continue;
                    if (paramMeta[cap] && cap.startsWith('SOIL_')) {
                      addMonitoringItem(cap, paramMeta[cap].label, paramMeta[cap].unit);
                    } else if (cap.startsWith('SOIL_')) {
                      addMonitoringItem(
                        cap,
                        cap
                          .replace(/_/g, ' ')
                          .toLowerCase()
                          .replace(/\b\w/g, (l) => l.toUpperCase())
                      );
                    }
                  }
                }
                // 2. WATER_QUALITY_NODE strictly shows water quality parameters; never FAUCET_CONTROL
                else if (device.deviceType === 'WATER_QUALITY_NODE') {
                  if (rawCaps.includes('WATER_TELEMETRY') || rawCaps.length === 0) {
                    addMonitoringItem('WATER_PH', tDevices('paramWaterPh'), 'pH');
                    addMonitoringItem('WATER_TDS', tDevices('paramWaterTds'), 'ppm');
                    addMonitoringItem('WATER_EC', tDevices('paramWaterEc'), 'µS/cm');
                  }
                  for (const cap of rawCaps) {
                    if (cap === 'WATER_TELEMETRY' || cap === 'FAUCET_CONTROL') continue;
                    if (paramMeta[cap] && cap.startsWith('WATER_') && cap !== 'WATER_TANK_VOLUME') {
                      addMonitoringItem(cap, paramMeta[cap].label, paramMeta[cap].unit);
                    } else if (cap.startsWith('WATER_') && cap !== 'WATER_TANK_VOLUME') {
                      addMonitoringItem(
                        cap,
                        cap
                          .replace(/_/g, ' ')
                          .toLowerCase()
                          .replace(/\b\w/g, (l) => l.toUpperCase())
                      );
                    }
                  }
                }
                // 3. WATER_TANK_NODE shows tank volume monitoring and faucet control if supported
                else if (device.deviceType === 'WATER_TANK_NODE') {
                  if (rawCaps.includes('WATER_TANK_VOLUME') || rawCaps.length === 0) {
                    addMonitoringItem('WATER_TANK_VOLUME', tDevices('paramWaterTankVolume'), 'L');
                  }
                  for (const cap of rawCaps) {
                    if (cap === 'WATER_TANK_VOLUME') {
                      addMonitoringItem(cap, tDevices('paramWaterTankVolume'), 'L');
                    }
                  }
                  if (rawCaps.includes('FAUCET_CONTROL') || rawCaps.length === 0) {
                    controlItems.push({
                      key: 'FAUCET_CONTROL',
                      label: tDevices('paramFaucetControl'),
                      detail: tDevices('faucetPresets'),
                    });
                  }
                }

                return { monitoringItems, controlItems };
              };

              const { monitoringItems, controlItems } = resolveParameters();

              const getDomainLabel = (type: string) => {
                switch (type) {
                  case 'SOIL_NODE':
                    return tDevices('domainSoilLabel');
                  case 'WATER_QUALITY_NODE':
                    return tDevices('domainWaterLabel');
                  case 'WATER_TANK_NODE':
                    return tDevices('domainTankLabel');
                  default:
                    return type;
                }
              };

              const isOnline =
                device.accountStatus !== 'DEACTIVATED' && device.connectionStatus === 'ONLINE';
              const isInactive =
                device.accountStatus === 'DEACTIVATED' || device.connectionStatus === 'INACTIVE';

              const getConnectionStatusLabel = () => {
                if (isInactive) {
                  return tDevices('inactive');
                }
                if (isOnline) {
                  return tDevices('connected');
                }
                return tDevices('disconnected');
              };

              return (
                <div
                  key={device.id}
                  className={`bg-app-surface-container-lowest p-4 sm:p-5 rounded-xl soft-elevation border transition-all duration-200 flex flex-col justify-between ${
                    isDeactivated
                      ? 'border-gray-200 opacity-60 bg-gray-50/80'
                      : 'border-app-outline-variant/30 hover:border-app-primary/40 hover:-translate-y-0.5 hover:shadow-md'
                  }`}
                >
                  <div>
                    {/* Top Row: Connection Status & Domain Badge on left, Owner actions on right */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center flex-wrap gap-1.5 min-w-0">
                        <span
                          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 ${
                            isOnline
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              : isInactive
                                ? 'bg-gray-100 text-gray-700 border border-gray-200/60'
                                : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                          }`}
                        >
                          {isOnline && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          )}
                          {getConnectionStatusLabel()}
                        </span>

                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-app-surface-container text-app-on-surface-variant border border-app-outline-variant/15">
                          {getDomainLabel(device.deviceType)}
                        </span>
                      </div>

                      {isOwner && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {!isDeactivated && (
                            <button
                              onClick={() => {
                                setEditDevice(device);
                                setEditDeviceId(device.deviceId || '');
                                setEditName(device.name);
                                setEditModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg hover:bg-app-surface-container text-app-on-surface-variant transition-colors active:scale-95"
                              title={tCommon('edit')}
                            >
                              <Edit2 size={15} />
                            </button>
                          )}
                          {!isDeactivated && (
                            <button
                              onClick={() => {
                                setDeactivateDevice(device);
                                setDeactivateModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-700 transition-colors active:scale-95"
                              title={tDevices('deactivateConfirmTitle')}
                            >
                              <PowerOff size={15} />
                            </button>
                          )}
                          {isDeactivated && (
                            <button
                              onClick={() => {
                                setActivateDevice(device);
                                setActivateModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors active:scale-95"
                              title={tDevices('activateConfirmTitle')}
                            >
                              <RotateCcw size={15} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Device Identity */}
                    <div className="mb-2.5">
                      <h3 className="text-[16px] sm:text-[17px] font-bold text-app-primary tracking-tight truncate">
                        {device.name}
                      </h3>
                      {/* DEC-DEV-028: Canonical deviceId is visible only to OWNER, concealed from ADMIN */}
                      {isOwner && device.deviceId && (
                        <div className="mt-1">
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-app-surface-container font-semibold text-app-on-surface-variant border border-app-outline-variant/10 inline-block">
                            {device.deviceId}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Compact Metadata Row */}
                    <div className="text-[12px] text-app-on-surface-variant border-t border-app-outline-variant/15 py-2 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 truncate">
                        <Clock size={13} className="text-app-outline flex-shrink-0" />
                        <span className="text-app-outline">{tDevices('lastSeen')}:</span>
                        <span className="text-app-on-surface truncate">
                          {device.lastSeenAt
                            ? new Date(device.lastSeenAt).toLocaleString(
                                locale === 'id' ? 'id-ID' : 'en-US',
                                {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                }
                              )
                            : '-'}
                        </span>
                      </span>

                      <span className="text-[11px] font-mono text-app-outline flex-shrink-0">
                        {device.deviceType}
                      </span>
                    </div>

                    {/* Parameters & Capabilities Section */}
                    <div className="border-t border-app-outline-variant/15 pt-2.5 space-y-2">
                      {monitoringItems.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-semibold text-app-outline uppercase tracking-wider">
                              {tDevices('monitoringParamsHeading')}
                            </span>
                            <span className="text-[10px] text-app-outline font-medium">
                              {tDevices('paramCount', { count: monitoringItems.length })}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {monitoringItems.map((param) => (
                              <span
                                key={param.key}
                                className="inline-flex items-center gap-1.5 text-[11px] bg-app-surface-container/70 px-2 py-1 rounded-md text-app-on-surface border border-app-outline-variant/15"
                              >
                                <span className="font-medium">{param.label}</span>
                                {param.unit && (
                                  <span className="text-[10px] font-mono font-semibold px-1 py-0.2 rounded bg-app-surface text-app-on-surface-variant border border-app-outline-variant/15">
                                    {param.unit}
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {controlItems.length > 0 && (
                        <div>
                          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-1.5">
                            {tDevices('controlCapsHeading')}
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {controlItems.map((ctrl) => (
                              <span
                                key={ctrl.key}
                                className="inline-flex items-center gap-1.5 text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-2.5 py-1 rounded-md font-medium"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span>{ctrl.label}</span>
                                {ctrl.detail && (
                                  <span className="text-[10px] font-mono text-emerald-700 bg-white/80 px-1 py-0.2 rounded border border-emerald-200">
                                    {ctrl.detail}
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between bg-app-surface-container-lowest p-4 rounded-xl border border-app-outline-variant/20 text-[14px]">
            <span className="text-app-on-surface-variant">
              {tDevices('paginationDevices', {
                page: pagination.page,
                totalPages: pagination.totalPages,
                total: pagination.totalItems,
              })}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchDevices(pagination.page - 1)}
                className="p-2 rounded-lg border border-app-outline-variant/40 hover:bg-app-surface-container disabled:opacity-40 transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchDevices(pagination.page + 1)}
                className="p-2 rounded-lg border border-app-outline-variant/40 hover:bg-app-surface-container disabled:opacity-40 transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Edit Device Modal (Owner Only - Name & Canonical deviceId rename) */}
      {editModalOpen && editDevice && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-app-surface-container-lowest rounded-2xl max-w-md w-full p-6 space-y-5 soft-elevation-lg animate-scale-up">
            <div className="flex items-center justify-between border-b border-app-outline-variant/20 pb-3">
              <h3 className="text-[18px] font-bold text-app-primary">
                {tDevices('editDeviceModalTitle')}
              </h3>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-app-outline hover:text-app-on-surface"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateDevice} className="space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-app-on-surface mb-1">
                  {tDevices('deviceId')} *
                </label>
                <input
                  type="text"
                  required
                  value={editDeviceId}
                  onChange={(e) => setEditDeviceId(e.target.value)}
                  pattern="^[a-z0-9-_]+$"
                  title={tDevices('deviceIdPatternHint')}
                  className="w-full px-3.5 py-2 bg-app-surface border border-app-outline-variant/40 rounded-xl text-[14px] font-mono focus:outline-none focus:border-app-primary"
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-app-on-surface mb-1">
                  {tDevices('deviceName')} *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-app-surface border border-app-outline-variant/40 rounded-xl text-[14px] focus:outline-none focus:border-app-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-app-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 text-[14px] font-semibold text-app-on-surface-variant hover:bg-app-surface-container rounded-xl"
                >
                  {tCommon('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2 text-[14px] font-semibold bg-app-primary text-white rounded-xl hover:bg-app-primary-container disabled:opacity-50"
                >
                  {editSubmitting && <Loader2 size={16} className="animate-spin" />}
                  <span>{tCommon('save')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate Device Confirm Modal */}
      {deactivateModalOpen && deactivateDevice && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-app-surface-container-lowest rounded-2xl max-w-md w-full p-6 space-y-5 soft-elevation-lg animate-scale-up">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle size={24} />
              <h3 className="text-[18px] font-bold">{tDevices('deactivateConfirmTitle')}</h3>
            </div>

            <p className="text-[14px] text-app-on-surface-variant leading-relaxed">
              {tDevices('deactivatePrompt', { name: deactivateDevice.name })}
              <br />
              <br />
              <span className="text-amber-700 font-medium">{tDevices('deactivateWarning')}</span>
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-app-outline-variant/20">
              <button
                type="button"
                onClick={() => setDeactivateModalOpen(false)}
                className="px-4 py-2 text-[14px] font-semibold text-app-on-surface-variant hover:bg-app-surface-container rounded-xl"
              >
                {tCommon('cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeactivate}
                disabled={deactivateSubmitting}
                className="inline-flex items-center gap-2 px-5 py-2 text-[14px] font-semibold bg-amber-600 text-white rounded-xl hover:bg-amber-700 disabled:opacity-50"
              >
                {deactivateSubmitting && <Loader2 size={16} className="animate-spin" />}
                <span>{tDevices('deactivateConfirmBtn')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activate Confirm Modal */}
      {activateModalOpen && activateDevice && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-app-surface-container-lowest rounded-2xl max-w-md w-full p-6 space-y-5 soft-elevation-lg animate-scale-up border border-emerald-200">
            <div className="flex items-center gap-3 text-emerald-600">
              <CheckCircle2 size={24} />
              <h3 className="text-[18px] font-bold">{tDevices('activateConfirmTitle')}</h3>
            </div>

            <p className="text-[14px] text-app-on-surface-variant leading-relaxed">
              {tDevices('activatePrompt', { name: activateDevice.name })}
              <br />
              <br />
              <span className="text-emerald-700 font-medium block bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                {tDevices('activateWarning')}
              </span>
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-app-outline-variant/20">
              <button
                type="button"
                onClick={() => setActivateModalOpen(false)}
                className="px-4 py-2 text-[14px] font-semibold text-app-on-surface-variant hover:bg-app-surface-container rounded-xl"
              >
                {tCommon('cancel')}
              </button>
              <button
                type="button"
                onClick={handleActivate}
                disabled={activateSubmitting}
                className="inline-flex items-center gap-2 px-5 py-2 text-[14px] font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {activateSubmitting && <Loader2 size={16} className="animate-spin" />}
                <span>{tDevices('activateConfirmBtn')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
