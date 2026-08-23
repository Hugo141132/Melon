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
  Sliders,
  RotateCcw,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

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
  const tAuth = useTranslations('auth');

  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

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

  // Check auth session
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch('/api/v1/auth/session');
        const json = await res.json();
        if (json.success && json.data?.authenticated && json.data?.user) {
          setCurrentUserRole(json.data.user.role);
        } else {
          setCurrentUserRole(null);
        }
      } catch {
        setCurrentUserRole(null);
      } finally {
        setAuthLoading(false);
      }
    };
    fetchSession();
  }, []);

  // Fetch devices
  const fetchDevices = useCallback(
    async (pageToFetch = 1) => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const queryParams = new URLSearchParams();
        queryParams.set('page', pageToFetch.toString());
        queryParams.set('pageSize', '10');
        if (search.trim()) queryParams.set('search', search.trim());
        if (typeFilter !== 'ALL') queryParams.set('deviceType', typeFilter);
        if (statusFilter !== 'ALL') queryParams.set('connectionStatus', statusFilter);

        const res = await fetch(`/api/v1/devices?${queryParams.toString()}`);
        const json = await res.json();

        if (json.success) {
          setDevices(json.data || []);
          if (json.meta?.pagination) {
            setPagination(json.meta.pagination);
          }
        } else {
          setErrorMsg(json.error?.message || 'Gagal memuat daftar perangkat.');
        }
      } catch {
        setErrorMsg('Terjadi kesalahan jaringan saat memuat daftar perangkat.');
      } finally {
        setLoading(false);
      }
    },
    [search, typeFilter, statusFilter]
  );

  useEffect(() => {
    if (!authLoading && currentUserRole) {
      fetchDevices(1);
    }
  }, [authLoading, currentUserRole, fetchDevices]);

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
        setSuccessMsg(`Perangkat '${json.data.name}' berhasil diperbarui.`);
        setEditModalOpen(false);
        setEditDevice(null);
        fetchDevices(pagination.page);
      } else {
        setErrorMsg(json.error?.message || 'Gagal memperbarui perangkat.');
      }
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan saat memperbarui perangkat.');
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
        setSuccessMsg(`Perangkat '${deactivateDevice.name}' telah dinonaktifkan.`);
        setDeactivateModalOpen(false);
        setDeactivateDevice(null);
        fetchDevices(pagination.page);
      } else {
        setErrorMsg(json.error?.message || 'Gagal menonaktifkan perangkat.');
      }
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan saat menonaktifkan perangkat.');
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
        setSuccessMsg(`Perangkat '${activateDevice.name}' telah diaktifkan kembali.`);
        setActivateModalOpen(false);
        setActivateDevice(null);
        fetchDevices(pagination.page);
      } else {
        setErrorMsg(json.error?.message || 'Gagal mengaktifkan perangkat.');
      }
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan saat mengaktifkan perangkat.');
    } finally {
      setActivateSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="bg-app-surface min-h-dvh flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-app-primary">
          <Loader2 size={24} className="animate-spin" />
          <span className="font-semibold text-[16px]">{tAuth('checkingSession')}</span>
        </div>
      </div>
    );
  }

  const isOwner = currentUserRole === 'OWNER';

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
        <div className="bg-app-surface-container-lowest p-4 rounded-xl soft-elevation border border-app-outline-variant/20 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-app-outline"
            />
            <input
              type="text"
              placeholder={tDevices('searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-app-surface border border-app-outline-variant/40 rounded-xl text-[14px] focus:outline-none focus:border-app-primary transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 bg-app-surface border border-app-outline-variant/40 rounded-xl text-[13px] font-medium text-app-on-surface focus:outline-none focus:border-app-primary"
            >
              <option value="ALL">{tDevices('allDomains')}</option>
              <option value="SOIL_NODE">Soil Monitoring</option>
              <option value="WATER_QUALITY_NODE">Water Quality</option>
              <option value="WATER_TANK_NODE">Water Tank</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-app-surface border border-app-outline-variant/40 rounded-xl text-[13px] font-medium text-app-on-surface focus:outline-none focus:border-app-primary"
            >
              <option value="ALL">{tDevices('allStatuses')}</option>
              <option value="ONLINE">ONLINE</option>
              <option value="OFFLINE">OFFLINE</option>
              <option value="STALE">STALE</option>
              <option value="UNKNOWN">UNKNOWN</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>
        </div>

        {/* Device Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-app-surface-container-lowest p-5 rounded-xl border border-app-outline-variant/20 space-y-4 animate-pulse"
              >
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-app-surface-container rounded w-28" />
                  <div className="h-5 bg-app-surface-container rounded-full w-16" />
                </div>
                <div className="h-6 bg-app-surface-container rounded w-3/4" />
                <div className="space-y-2 pt-2 border-t border-app-outline-variant/10">
                  <div className="h-3 bg-app-surface-container rounded w-1/2" />
                  <div className="h-3 bg-app-surface-container rounded w-2/3" />
                </div>
                <div className="flex gap-2 pt-2">
                  <div className="h-5 bg-app-surface-container rounded w-20" />
                  <div className="h-5 bg-app-surface-container rounded w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : devices.length === 0 ? (
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
            {devices.map((device) => {
              const isDeactivated = device.accountStatus === 'DEACTIVATED';

              return (
                <div
                  key={device.id}
                  className={`bg-app-surface-container-lowest p-5 rounded-xl soft-elevation border transition-all duration-200 ${
                    isDeactivated
                      ? 'border-gray-200 opacity-60 bg-gray-50/80'
                      : 'border-app-outline-variant/30 hover:border-app-primary/40 hover:-translate-y-0.5 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        {/* DEC-DEV-028: Canonical deviceId is visible only to OWNER, concealed from ADMIN */}
                        {isOwner && device.deviceId && (
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-app-surface-container font-semibold text-app-on-surface-variant border border-app-outline-variant/10">
                            {device.deviceId}
                          </span>
                        )}
                        <span
                          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 ${
                            device.connectionStatus === 'ONLINE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              : device.connectionStatus === 'OFFLINE'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
                                : device.connectionStatus === 'STALE'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                                  : 'bg-gray-100 text-gray-700 border border-gray-200/60'
                          }`}
                        >
                          {device.connectionStatus === 'ONLINE' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          )}
                          {device.connectionStatus}
                        </span>
                      </div>
                      <h3 className="text-[18px] font-bold text-app-primary mt-1.5 tracking-tight">
                        {device.name}
                      </h3>
                    </div>

                    {isOwner && (
                      <div className="flex items-center gap-1">
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
                            <Edit2 size={16} />
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
                            <PowerOff size={16} />
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
                            <RotateCcw size={16} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 text-[13px] text-app-on-surface-variant border-t border-app-outline-variant/20 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Sliders size={14} className="text-app-outline" />
                        {tDevices('domain')}:
                      </span>
                      <span className="font-semibold text-app-on-surface">{device.deviceType}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Clock size={14} className="text-app-outline" />
                        {tDevices('lastSeen')}:
                      </span>
                      <span>
                        {device.lastSeenAt
                          ? new Date(device.lastSeenAt).toLocaleString('id-ID')
                          : '-'}
                      </span>
                    </div>

                    {device.capabilities.length > 0 &&
                      (() => {
                        const monitoringCaps = device.capabilities.filter(
                          (c) => c !== 'FAUCET_CONTROL'
                        );
                        const controlCaps = device.capabilities.filter(
                          (c) => c === 'FAUCET_CONTROL'
                        );

                        const formatCap = (cap: string) => {
                          switch (cap) {
                            case 'FAUCET_CONTROL':
                              return 'Irrigation Valve Control';
                            case 'WATER_TANK_VOLUME':
                              return 'Water Tank Volume (L)';
                            case 'WATER_FLOW_RATE':
                              return 'Water Flow Rate (m³/h)';
                            case 'WATER_TDS':
                              return 'Water TDS (ppm)';
                            default:
                              return cap;
                          }
                        };

                        return (
                          <div className="pt-2 space-y-2.5">
                            {monitoringCaps.length > 0 && (
                              <div>
                                <span className="text-[11px] font-bold text-app-outline uppercase tracking-wider block mb-1">
                                  {tDevices('registeredMonitoringParams')}
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {monitoringCaps.map((cap) => (
                                    <span
                                      key={cap}
                                      className="text-[10px] bg-app-surface-container px-2 py-0.5 rounded-md font-mono text-app-on-surface border border-app-outline-variant/10 shadow-2xs"
                                    >
                                      {formatCap(cap)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {controlCaps.length > 0 && (
                              <div>
                                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-1">
                                  {tDevices('controlCapabilities')}
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {controlCaps.map((cap) => (
                                    <span
                                      key={cap}
                                      className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-2.5 py-0.5 rounded-md font-mono font-bold flex items-center gap-1 shadow-2xs"
                                    >
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                      {formatCap(cap)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
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
                  title="Gunakan huruf kecil, angka, tanda hubung (-), atau garis bawah (_)"
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
              <strong className="text-app-on-surface">{deactivateDevice.name}</strong>
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
              <strong className="text-app-on-surface">{activateDevice.name}</strong>
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
