'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

import Link from 'next/link';
import TopAppBar from '@/components/navigation/TopAppBar';
import {
  Users as UsersIcon,
  ShieldAlert,
  Search,
  RefreshCw,
  Edit2,
  Eye,
  UserX,
  UserCheck,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
  AlertTriangle,
  Cpu,
} from 'lucide-react';

interface UserDto {
  id: string;
  fullName: string;
  email: string;
  username: string | null;
  accountStatus:
    'PENDING_APPROVAL' | 'APPROVED' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED' | 'DEACTIVATED';
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  suspendedAt: string | null;
  deactivatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  activeRoles: ('OWNER' | 'ADMIN')[];
}

interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

import { useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthContext';

export default function UserManagementPage() {
  const tUsers = useTranslations('users');
  const tCommon = useTranslations('common');
  const tAuth = useTranslations('auth');

  const { role } = useAuth();
  const isOwner = role === 'OWNER';

  // List state
  const [users, setUsers] = useState<UserDto[]>([]);
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
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Modals
  const [selectedUser, setSelectedUser] = useState<UserDto | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Lifecycle Confirm Modal State (suspend, deactivate=Delete Account, activate)
  const [confirmAction, setConfirmAction] = useState<'suspend' | 'deactivate' | 'activate' | null>(
    null
  );
  const [actionReason, setActionReason] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // Device Access Modal State
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [userAssignments, setUserAssignments] = useState<any[]>([]);
  const [availableDevices, setAvailableDevices] = useState<any[]>([]);
  const [deviceModalLoading, setDeviceModalLoading] = useState(false);
  const [selectedAssignDeviceId, setSelectedAssignDeviceId] = useState('');
  const [assigningDevice, setAssigningDevice] = useState(false);
  const [revokingDeviceId, setRevokingDeviceId] = useState<string | null>(null);

  const fetchUserDeviceAssignments = useCallback(
    async (userId: string) => {
      setDeviceModalLoading(true);
      try {
        const [assignRes, devRes] = await Promise.all([
          fetch(`/api/v1/users/${userId}/devices`),
          fetch(`/api/v1/devices`),
        ]);
        const assignJson = await assignRes.json();
        const devJson = await devRes.json();

        if (assignJson.success) {
          const activeOnly = (assignJson.data.assignments || []).filter(
            (a: any) => a.revokedAt === null
          );
          setUserAssignments(activeOnly);
        }
        if (devJson.success) {
          const rawDevices = Array.isArray(devJson.data)
            ? devJson.data
            : devJson.data?.devices || [];
          setAvailableDevices(rawDevices);
        }
      } catch {
        setErrorMsg(tUsers('deviceAccessLoadFailed'));
      } finally {
        setDeviceModalLoading(false);
      }
    },
    [tUsers]
  );

  const handleAssignDevice = async () => {
    if (!selectedUser || !selectedAssignDeviceId) return;
    setAssigningDevice(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/users/${selectedUser.id}/devices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: selectedAssignDeviceId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || tUsers('deviceAssignFailed'));
      }
      setSuccessMsg(tUsers('deviceAssignSuccess'));
      setSelectedAssignDeviceId('');
      await fetchUserDeviceAssignments(selectedUser.id);
    } catch (err: any) {
      setErrorMsg(err.message || tUsers('deviceAssignFailed'));
    } finally {
      setAssigningDevice(false);
    }
  };

  const handleRevokeDevice = async (canonicalDeviceId: string) => {
    if (!selectedUser) return;
    setRevokingDeviceId(canonicalDeviceId);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/users/${selectedUser.id}/devices/${canonicalDeviceId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error?.message || tUsers('deviceRevokeFailed'));
      }
      setSuccessMsg(tUsers('deviceRevokeSuccess'));
      setUserAssignments((prev) =>
        prev.filter(
          (a) => a.canonicalDeviceId !== canonicalDeviceId && a.deviceId !== canonicalDeviceId
        )
      );
      await fetchUserDeviceAssignments(selectedUser.id);
    } catch (err: any) {
      setErrorMsg(err.message || tUsers('deviceRevokeFailed'));
    } finally {
      setRevokingDeviceId(null);
    }
  };

  const unassignedAvailableDevices = useMemo(() => {
    const activeAssignedIds = new Set(
      userAssignments
        .filter((a) => !a.revokedAt)
        .flatMap((a) => [a.deviceId, a.canonicalDeviceId].filter(Boolean))
    );

    return availableDevices.filter((dev) => {
      if (dev.accountStatus && dev.accountStatus !== 'ACTIVE') {
        return false;
      }
      const canonicalId = dev.deviceId || dev.canonicalDeviceId;
      const isAssigned = activeAssignedIds.has(dev.id) || activeAssignedIds.has(canonicalId);
      return !isAssigned;
    });
  }, [availableDevices, userAssignments]);

  // Fetch users list
  const fetchUsers = useCallback(
    async (pageNum = 1) => {
      if (!isOwner) return;
      setLoading(true);
      setErrorMsg(null);

      try {
        const params = new URLSearchParams();
        params.set('page', String(pageNum));
        params.set('pageSize', '10');
        if (search.trim()) params.set('search', search.trim());
        if (statusFilter !== 'ALL') params.set('accountStatus', statusFilter);
        if (roleFilter !== 'ALL') params.set('role', roleFilter);

        const res = await fetch(`/api/v1/users?${params.toString()}`);
        const json = await res.json();

        if (json.success) {
          setUsers(json.data || []);
          if (json.meta?.pagination) {
            setPagination(json.meta.pagination);
          }
        } else {
          setErrorMsg(json.error?.message || tUsers('usersLoadFailed'));
        }
      } catch {
        setErrorMsg(tUsers('networkErrorLoadUsers'));
      } finally {
        setLoading(false);
      }
    },
    [isOwner, search, statusFilter, roleFilter, tUsers]
  );

  useEffect(() => {
    if (isOwner) {
      fetchUsers(1);
    }
  }, [isOwner, fetchUsers]);

  // Handle Edit Submission
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setEditSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/v1/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: editFullName.trim(),
          username: editUsername.trim() ? editUsername.trim() : null,
        }),
      });
      const json = await res.json();

      if (json.success) {
        setSuccessMsg(tUsers('profileUpdateSuccess', { name: json.data.fullName }));
        setEditModalOpen(false);
        fetchUsers(pagination.page);
      } else {
        setErrorMsg(json.error?.message || tUsers('profileUpdateFailed'));
      }
    } catch {
      setErrorMsg(tUsers('networkErrorUpdateProfile'));
    } finally {
      setEditSubmitting(false);
    }
  };

  // Handle Lifecycle Action Execution (Delete Account / Suspend / Activate)
  const handleExecuteLifecycleAction = async () => {
    if (!selectedUser || !confirmAction) return;

    setActionSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const isDelete = confirmAction === 'deactivate';
      const endpoint = isDelete
        ? `/api/v1/users/${selectedUser.id}`
        : `/api/v1/users/${selectedUser.id}/${confirmAction}`;
      const method = isDelete ? 'DELETE' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: actionReason.trim() || undefined }),
      });
      const json = await res.json();

      if (json.success) {
        if (isDelete) {
          // Immediately remove deleted account from visible list
          setUsers((prev) => prev.filter((u) => u.id !== selectedUser.id));
          setSuccessMsg(tUsers('accountDeletedSuccess', { name: selectedUser.fullName }));
        } else {
          const actionLabel =
            confirmAction === 'suspend' ? tUsers('actionSuspended') : tUsers('actionReactivated');
          setSuccessMsg(
            tUsers('accountActionSuccess', {
              name: selectedUser.fullName,
              action: actionLabel,
            })
          );
          fetchUsers(pagination.page);
        }
        setConfirmAction(null);
        setActionReason('');
      } else {
        setErrorMsg(json.error?.message || tUsers('actionProcessFailed'));
      }
    } catch {
      setErrorMsg(tUsers('networkErrorAction'));
    } finally {
      setActionSubmitting(false);
    }
  };

  // Status Badge Component Helper
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="px-2.5 py-1 text-[12px] font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 w-fit">
            <CheckCircle2 size={13} /> {tAuth('active')}
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="px-2.5 py-1 text-[12px] font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 w-fit">
            <AlertTriangle size={13} /> {tAuth('suspendedBadge')}
          </span>
        );
      case 'DEACTIVATED':
        return (
          <span className="px-2.5 py-1 text-[12px] font-semibold rounded-full bg-red-100 text-red-800 border border-red-300 flex items-center gap-1 w-fit">
            {tAuth('deactivatedBadge')}
          </span>
        );
      case 'PENDING_APPROVAL':
        return (
          <span className="px-2.5 py-1 text-[12px] font-semibold rounded-full bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1 w-fit">
            <RefreshCw size={13} className="animate-spin" /> {tAuth('pendingApprovalBadge')}
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-2.5 py-1 text-[12px] font-semibold rounded-full bg-gray-100 text-gray-800 border border-gray-300 flex items-center gap-1 w-fit">
            {tAuth('rejectedBadge')}
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-[12px] font-semibold rounded-full bg-gray-100 text-gray-700 w-fit">
            {status}
          </span>
        );
    }
  };

  // 403 Forbidden view if not OWNER
  if (!isOwner) {
    return (
      <div className="bg-app-surface text-app-on-surface min-h-dvh pb-24">
        <TopAppBar />
        <main className="pt-24 px-4 max-w-xl mx-auto text-center">
          <div className="bg-red-50 border border-red-200 p-8 rounded-2xl shadow-sm space-y-4">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600">
              <ShieldAlert size={32} />
            </div>
            <h1 className="text-[20px] font-bold text-red-900">{tUsers('forbiddenTitle')}</h1>
            <p className="text-[14px] text-red-700">{tUsers('forbiddenDesc')}</p>
            <Link
              href="/setting"
              className="inline-block px-5 py-2.5 bg-red-700 text-white rounded-xl text-[14px] font-semibold hover:bg-red-800 transition-colors"
            >
              {tCommon('back')}
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-app-surface text-app-on-surface min-h-dvh pb-24">
      <TopAppBar />

      <main className="pt-20 px-4 max-w-5xl mx-auto w-full space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-app-surface-container-lowest p-5 rounded-2xl border border-app-outline-variant/30 soft-elevation">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 flex-shrink-0">
              <UsersIcon size={24} />
            </div>
            <div>
              <h1 className="text-[22px] font-bold text-app-primary">{tUsers('title')}</h1>
              <p className="text-[13px] text-app-on-surface-variant">{tUsers('subtitle')}</p>
            </div>
          </div>
          <button
            onClick={() => fetchUsers(pagination.page)}
            disabled={loading}
            className="self-start sm:self-auto px-4 py-2 bg-app-surface-container hover:bg-app-surface-container-high text-app-on-surface text-[13px] font-medium rounded-xl border border-app-outline-variant/40 flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            {tCommon('refresh')}
          </button>
        </div>

        {/* Global Notifications */}
        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-[14px] flex items-start justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="flex-shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-700">
              <X size={16} />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-[14px] flex items-start justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="flex-shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
            <button
              onClick={() => setSuccessMsg(null)}
              className="text-emerald-500 hover:text-emerald-700"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="bg-app-surface-container-lowest p-4 rounded-2xl border border-app-outline-variant/30 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-app-outline"
              />
              <input
                type="text"
                placeholder={tUsers('searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-app-surface-container-low border border-app-outline-variant/40 rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-app-primary/30"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2.5 bg-app-surface-container-low border border-app-outline-variant/40 rounded-xl text-[13px] font-medium text-app-on-surface focus:outline-none"
              >
                <option value="ALL">{tUsers('allStatuses')}</option>
                <option value="PENDING_APPROVAL">{tAuth('pendingApprovalBadge')}</option>
                <option value="ACTIVE">{tAuth('active')}</option>
                <option value="SUSPENDED">{tAuth('suspendedBadge')}</option>
                <option value="REJECTED">{tAuth('rejectedBadge')}</option>
              </select>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2.5 bg-app-surface-container-low border border-app-outline-variant/40 rounded-xl text-[13px] font-medium text-app-on-surface focus:outline-none"
              >
                <option value="ALL">{tUsers('allRoles')}</option>
                <option value="OWNER">{tUsers('roleOwnerLabel')} (OWNER)</option>
                <option value="ADMIN">{tUsers('roleAdminLabel')} (ADMIN)</option>
              </select>
            </div>
          </div>
        </div>

        {/* User List Table / Cards */}
        <div className="bg-app-surface-container-lowest rounded-2xl border border-app-outline-variant/30 overflow-hidden soft-elevation">
          {loading ? (
            <div className="p-12 text-center text-app-on-surface-variant flex flex-col items-center gap-2">
              <Loader2 size={28} className="animate-spin text-app-primary" />
              <p className="text-[14px]">{tUsers('loadingUsers')}</p>
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center text-app-on-surface-variant space-y-2">
              <UsersIcon size={40} className="mx-auto opacity-40 text-app-outline" />
              <p className="text-[16px] font-semibold text-app-on-surface">
                {tUsers('noUsersFound')}
              </p>
              <p className="text-[13px]">{tUsers('noUsersSubtitle')}</p>
            </div>
          ) : (
            <div className="divide-y divide-app-outline-variant/20">
              {users.map((u) => {
                const isTargetOwner = u.activeRoles.includes('OWNER');

                return (
                  <div
                    key={u.id}
                    className="p-4 sm:p-5 hover:bg-app-surface-container-low/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-[16px] font-bold text-app-on-surface">{u.fullName}</h3>
                        {isTargetOwner ? (
                          <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-purple-100 text-purple-900 border border-purple-300">
                            {tUsers('roleOwnerLabel')}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-blue-50 text-blue-800 border border-blue-200">
                            {tUsers('roleAdminLabel')}
                          </span>
                        )}
                        {renderStatusBadge(u.accountStatus)}
                      </div>
                      <p className="text-[13px] text-app-on-surface-variant font-mono">
                        {u.email} {u.username && `(@${u.username})`}
                      </p>
                      <p className="text-[12px] text-app-outline">
                        {tUsers('registeredDate', {
                          date: new Date(u.createdAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          }),
                        })}
                      </p>
                    </div>

                    {/* Actions Toolbar */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => {
                          setSelectedUser(u);
                          setDetailModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-app-surface-container border border-app-outline-variant/30 text-app-on-surface text-[12px] font-medium rounded-lg hover:bg-app-surface-container-high transition-colors flex items-center gap-1.5"
                      >
                        <Eye size={14} /> {tCommon('viewDetails')}
                      </button>

                      {!isTargetOwner && (
                        <>
                          {isOwner && (
                            <button
                              onClick={() => {
                                setSelectedUser(u);
                                setDeviceModalOpen(true);
                                fetchUserDeviceAssignments(u.id);
                              }}
                              className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[12px] font-medium rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
                            >
                              <Cpu size={14} /> {tUsers('assignDevice')}
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setSelectedUser(u);
                              setEditFullName(u.fullName);
                              setEditUsername(u.username || '');
                              setEditModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 text-[12px] font-medium rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1.5"
                          >
                            <Edit2 size={14} /> {tCommon('edit')}
                          </button>

                          {/* Suspend Action (For ACTIVE) */}
                          {u.accountStatus === 'ACTIVE' && (
                            <button
                              onClick={() => {
                                setSelectedUser(u);
                                setConfirmAction('suspend');
                              }}
                              className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-[12px] font-medium rounded-lg hover:bg-amber-100 transition-colors flex items-center gap-1.5"
                            >
                              <UserX size={14} /> {tUsers('suspendUser')}
                            </button>
                          )}

                          {/* Activate Action (For SUSPENDED) */}
                          {u.accountStatus === 'SUSPENDED' && (
                            <button
                              onClick={() => {
                                setSelectedUser(u);
                                setConfirmAction('activate');
                              }}
                              className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[12px] font-medium rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
                            >
                              <UserCheck size={14} /> {tUsers('reactivateUser')}
                            </button>
                          )}

                          {/* Delete Account Destructive Checkbox Action (All ADMIN except PENDING_APPROVAL) */}
                          {u.accountStatus !== 'PENDING_APPROVAL' && (
                            <label className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-800 text-[12px] font-medium rounded-lg cursor-pointer transition-colors">
                              <input
                                type="checkbox"
                                checked={false}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedUser(u);
                                    setConfirmAction('deactivate');
                                  }
                                }}
                                className="rounded text-red-600 focus:ring-red-500 cursor-pointer"
                              />
                              <span>{tUsers('deleteAccount')}</span>
                            </label>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Footer */}
          {pagination.totalPages > 1 && (
            <div className="p-4 bg-app-surface-container-low border-t border-app-outline-variant/30 flex items-center justify-between">
              <span className="text-[13px] text-app-on-surface-variant">
                {tUsers('paginationUsers', {
                  page: pagination.page,
                  totalPages: pagination.totalPages,
                  total: pagination.totalItems,
                })}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={pagination.page <= 1 || loading}
                  onClick={() => fetchUsers(pagination.page - 1)}
                  className="px-3 py-1.5 bg-app-surface-container border border-app-outline-variant/30 text-app-on-surface text-[12px] font-medium rounded-lg hover:bg-app-surface-container-high transition-colors disabled:opacity-40 flex items-center gap-1"
                >
                  <ChevronLeft size={14} /> {tUsers('previousPage')}
                </button>
                <button
                  disabled={pagination.page >= pagination.totalPages || loading}
                  onClick={() => fetchUsers(pagination.page + 1)}
                  className="px-3 py-1.5 bg-app-surface-container border border-app-outline-variant/30 text-app-on-surface text-[12px] font-medium rounded-lg hover:bg-app-surface-container-high transition-colors disabled:opacity-40 flex items-center gap-1"
                >
                  {tUsers('nextPage')} <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* User Detail Modal */}
      {detailModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-app-surface-container-lowest rounded-2xl max-w-lg w-full p-6 space-y-5 border border-app-outline-variant/30 soft-elevation-lg">
            <div className="flex items-center justify-between border-b border-app-outline-variant/20 pb-3">
              <h2 className="text-[18px] font-bold text-app-on-surface">
                {tUsers('userDetailTitle')}
              </h2>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="text-app-outline hover:text-app-on-surface"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-[14px]">
              <div className="grid grid-cols-3 gap-2 py-1 border-b border-app-outline-variant/10">
                <span className="text-app-on-surface-variant font-medium">{tUsers('userId')}</span>
                <span className="col-span-2 font-mono text-[12px] text-app-on-surface break-all">
                  {selectedUser.id}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1 border-b border-app-outline-variant/10">
                <span className="text-app-on-surface-variant font-medium">
                  {tUsers('userFullName')}
                </span>
                <span className="col-span-2 font-bold text-app-on-surface">
                  {selectedUser.fullName}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1 border-b border-app-outline-variant/10">
                <span className="text-app-on-surface-variant font-medium">
                  {tUsers('userEmail')}
                </span>
                <span className="col-span-2 font-mono text-app-on-surface">
                  {selectedUser.email} {tUsers('readOnlySuffix')}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1 border-b border-app-outline-variant/10">
                <span className="text-app-on-surface-variant font-medium">
                  {tUsers('username')}
                </span>
                <span className="col-span-2 text-app-on-surface">
                  {selectedUser.username || '-'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1 border-b border-app-outline-variant/10">
                <span className="text-app-on-surface-variant font-medium">{tCommon('role')}</span>
                <span className="col-span-2 text-app-on-surface">
                  {selectedUser.activeRoles.join(', ')}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1 border-b border-app-outline-variant/10">
                <span className="text-app-on-surface-variant font-medium">{tCommon('status')}</span>
                <span className="col-span-2">{renderStatusBadge(selectedUser.accountStatus)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1 border-b border-app-outline-variant/10">
                <span className="text-app-on-surface-variant font-medium">
                  {tUsers('creationDate')}
                </span>
                <span className="col-span-2 text-app-on-surface">
                  {new Date(selectedUser.createdAt).toLocaleString('id-ID')}
                </span>
              </div>
              {selectedUser.suspendedAt && (
                <div className="grid grid-cols-3 gap-2 py-1 border-b border-app-outline-variant/10 text-amber-800">
                  <span className="font-medium">{tUsers('suspensionDate')}</span>
                  <span className="col-span-2">
                    {new Date(selectedUser.suspendedAt).toLocaleString('id-ID')}
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 bg-app-surface-container text-app-on-surface text-[13px] font-medium rounded-xl border border-app-outline-variant/30 hover:bg-app-surface-container-high transition-colors"
              >
                {tCommon('close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {editModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <form
            onSubmit={handleSaveEdit}
            className="bg-app-surface-container-lowest rounded-2xl max-w-md w-full p-6 space-y-5 border border-app-outline-variant/30 soft-elevation-lg"
          >
            <div className="flex items-center justify-between border-b border-app-outline-variant/20 pb-3">
              <h2 className="text-[18px] font-bold text-app-on-surface">
                {tUsers('editProfileTitle')}
              </h2>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="text-app-outline hover:text-app-on-surface"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-app-on-surface mb-1">
                  {tUsers('userFullName')}
                </label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-app-surface-container-low border border-app-outline-variant/40 rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-app-primary/30"
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-app-on-surface mb-1">
                  {tUsers('username')} {tUsers('optional')}
                </label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-app-surface-container-low border border-app-outline-variant/40 rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-app-primary/30"
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-app-on-surface-variant mb-1">
                  {tUsers('userEmail')} {tUsers('readOnlySuffix')}
                </label>
                <input
                  type="text"
                  disabled
                  value={selectedUser.email}
                  className="w-full px-3.5 py-2.5 bg-app-surface-container/60 border border-app-outline-variant/20 rounded-xl text-[14px] text-app-on-surface-variant cursor-not-allowed font-mono"
                />
                <p className="text-[11px] text-app-outline mt-1">{tUsers('emailOwnerNotice')}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={editSubmitting}
                onClick={() => setEditModalOpen(false)}
                className="px-4 py-2 bg-app-surface-container text-app-on-surface text-[13px] font-medium rounded-xl border border-app-outline-variant/30 hover:bg-app-surface-container-high transition-colors"
              >
                {tCommon('cancel')}
              </button>
              <button
                type="submit"
                disabled={editSubmitting}
                className="px-5 py-2 bg-app-primary text-app-on-primary text-[13px] font-bold rounded-xl hover:bg-app-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {editSubmitting && <Loader2 size={15} className="animate-spin" />}
                {tCommon('saveChanges')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lifecycle Action Confirmation Modal (Delete Account / Suspend / Activate) */}
      {confirmAction && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-app-surface-container-lowest rounded-2xl max-w-md w-full p-6 space-y-5 border border-app-outline-variant/30 soft-elevation-lg">
            <div className="flex items-center gap-3 border-b border-app-outline-variant/20 pb-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  confirmAction === 'suspend'
                    ? 'bg-amber-100 text-amber-800'
                    : confirmAction === 'deactivate'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {confirmAction === 'suspend' ? (
                  <UserX size={20} />
                ) : confirmAction === 'deactivate' ? (
                  <Trash2 size={20} />
                ) : (
                  <UserCheck size={20} />
                )}
              </div>
              <div>
                <h2 className="text-[18px] font-bold text-app-on-surface">
                  {confirmAction === 'suspend'
                    ? tUsers('confirmSuspendTitle')
                    : confirmAction === 'deactivate'
                      ? tUsers('confirmDeleteAccountTitle')
                      : tUsers('confirmActivationTitle')}
                </h2>
                <p className="text-[12px] text-app-on-surface-variant">
                  {tUsers('userLabel', {
                    name: selectedUser.fullName,
                    email: selectedUser.email,
                  })}
                </p>
              </div>
            </div>

            <div className="text-[14px] text-app-on-surface space-y-3">
              {confirmAction === 'suspend' && (
                <p className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[13px]">
                  {tUsers('suspendNotice')}
                </p>
              )}
              {confirmAction === 'deactivate' && (
                <p className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-900 text-[13px]">
                  {tUsers('deleteAccountNotice')}
                </p>
              )}
              {confirmAction === 'activate' && (
                <p className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-[13px]">
                  {tUsers('activateNotice')}
                </p>
              )}

              <div>
                <label className="block text-[13px] font-semibold text-app-on-surface mb-1">
                  {tUsers('reasonLabel')}
                </label>
                <textarea
                  rows={2}
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder={tUsers('reasonPlaceholder')}
                  className="w-full px-3.5 py-2 bg-app-surface-container-low border border-app-outline-variant/40 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-app-primary/30 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={actionSubmitting}
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 bg-app-surface-container text-app-on-surface text-[13px] font-medium rounded-xl border border-app-outline-variant/30 hover:bg-app-surface-container-high transition-colors"
              >
                {tCommon('cancel')}
              </button>
              <button
                type="button"
                disabled={actionSubmitting}
                onClick={handleExecuteLifecycleAction}
                className={`px-5 py-2 text-[13px] font-bold rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 ${
                  confirmAction === 'suspend'
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : confirmAction === 'deactivate'
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {actionSubmitting && <Loader2 size={15} className="animate-spin" />}
                {confirmAction === 'deactivate'
                  ? tUsers('confirmDeleteAccountBtn')
                  : confirmAction === 'suspend'
                    ? tUsers('confirmSuspendBtn')
                    : tUsers('confirmActivateBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Device Access Management Modal */}
      {deviceModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-app-surface-container-lowest border border-app-outline-variant/30 rounded-2xl p-6 max-w-lg w-full soft-elevation space-y-5">
            <div className="flex items-center justify-between border-b border-app-outline-variant/20 pb-4">
              <div>
                <h2 className="text-[18px] font-bold text-app-on-surface flex items-center gap-2">
                  <Cpu size={20} className="text-app-primary" /> {tUsers('manageAdminDevices')}
                </h2>
                <p className="text-[13px] text-app-on-surface-variant font-medium">
                  {selectedUser.fullName} ({selectedUser.email})
                </p>
              </div>
              <button
                onClick={() => setDeviceModalOpen(false)}
                className="text-app-outline hover:text-app-on-surface"
              >
                <X size={20} />
              </button>
            </div>

            {selectedUser.accountStatus !== 'ACTIVE' && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-[13px] rounded-xl flex items-center gap-2">
                <AlertTriangle size={16} className="flex-shrink-0" />
                <span>{tUsers('activeOnlyDeviceNotice')}</span>
              </div>
            )}

            {/* Assign Device Form */}
            {selectedUser.accountStatus === 'ACTIVE' && (
              <div className="space-y-2 bg-app-surface-container-low p-4 rounded-xl border border-app-outline-variant/30">
                <label className="text-[13px] font-bold text-app-on-surface block">
                  {tUsers('assignNewDevice')}
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedAssignDeviceId}
                    onChange={(e) => setSelectedAssignDeviceId(e.target.value)}
                    className="flex-1 px-3 py-2 bg-app-surface-container border border-app-outline-variant/40 rounded-xl text-[13px] focus:outline-none"
                  >
                    <option value="">{tUsers('selectDeviceOption')}</option>
                    {unassignedAvailableDevices.map((dev: any) => {
                      const canonicalId = dev.deviceId || dev.canonicalDeviceId;
                      const name = dev.name || dev.deviceName;
                      return (
                        <option key={dev.id || canonicalId} value={canonicalId}>
                          {name} ({canonicalId})
                        </option>
                      );
                    })}
                  </select>

                  <button
                    type="button"
                    disabled={!selectedAssignDeviceId || assigningDevice}
                    onClick={handleAssignDevice}
                    className="px-4 py-2 bg-app-primary text-app-on-primary text-[13px] font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {assigningDevice && <Loader2 size={14} className="animate-spin" />}{' '}
                    {tUsers('assignBtn')}
                  </button>
                </div>
              </div>
            )}

            {/* Active Assigned Devices List */}
            <div className="space-y-3">
              <h3 className="text-[14px] font-bold text-app-on-surface">
                {tUsers('userActiveDevices', { count: userAssignments.length })}
              </h3>
              {deviceModalLoading ? (
                <div className="p-6 text-center text-app-on-surface-variant flex items-center justify-center gap-2">
                  <Loader2 size={18} className="animate-spin text-app-primary" />
                  <span className="text-[13px]">{tCommon('loading')}</span>
                </div>
              ) : userAssignments.length === 0 ? (
                <p className="text-[13px] text-app-outline italic text-center p-4">
                  {tUsers('noAssignedDevices')}
                </p>
              ) : (
                <div className="divide-y divide-app-outline-variant/20 max-h-60 overflow-y-auto pr-1">
                  {userAssignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="py-3 flex items-center justify-between gap-3 text-[13px]"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-app-on-surface">
                            {assignment.deviceName || assignment.canonicalDeviceId}
                          </span>
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {tUsers('activeBadge')}
                          </span>
                        </div>
                        <p className="text-[11px] text-app-outline font-mono">
                          ID: {assignment.canonicalDeviceId}
                        </p>
                        <p className="text-[11px] text-app-outline">
                          {tUsers('assignedDate', {
                            date: new Date(assignment.assignedAt).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            }),
                          })}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={revokingDeviceId === assignment.canonicalDeviceId}
                        onClick={() => handleRevokeDevice(assignment.canonicalDeviceId)}
                        className="px-3 py-1 bg-red-50 text-red-700 border border-red-200 text-[12px] font-medium rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1 disabled:opacity-50"
                      >
                        {revokingDeviceId === assignment.canonicalDeviceId ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          tUsers('revokeAccess')
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-app-outline-variant/20">
              <button
                type="button"
                onClick={() => setDeviceModalOpen(false)}
                className="px-4 py-2 bg-app-surface-container text-app-on-surface text-[13px] font-medium rounded-xl border border-app-outline-variant/30 hover:bg-app-surface-container-high transition-colors"
              >
                {tCommon('close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
