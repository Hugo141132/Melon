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
  CheckSquare,
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

  const { role, user: currentUser } = useAuth();
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

  // Bulk Selection State
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [bulkDeleteReason, setBulkDeleteReason] = useState('');
  const [bulkDeleteSubmitting, setBulkDeleteSubmitting] = useState(false);

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

  // Eligibility helper for account deletion
  // Owner accounts and pending approval accounts are NEVER selectable/deletable
  const isEligibleForDeletion = useCallback(
    (u: UserDto) => {
      if (u.activeRoles.includes('OWNER')) return false;
      if (currentUser?.id && u.id === currentUser.id) return false;
      if (u.accountStatus === 'PENDING_APPROVAL') return false;
      return true;
    },
    [currentUser?.id]
  );

  const eligibleUsersOnPage = useMemo(() => {
    return users.filter(isEligibleForDeletion);
  }, [users, isEligibleForDeletion]);

  const isAllSelected =
    eligibleUsersOnPage.length > 0 && eligibleUsersOnPage.every((u) => selectedUserIds.has(u.id));

  const isSomeSelected =
    eligibleUsersOnPage.some((u) => selectedUserIds.has(u.id)) && !isAllSelected;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedUserIds(new Set());
    } else {
      const next = new Set(selectedUserIds);
      eligibleUsersOnPage.forEach((u) => next.add(u.id));
      setSelectedUserIds(next);
    }
  };

  const toggleSelectUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

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
          setSelectedUserIds((prev) => {
            if (!prev.has(selectedUser.id)) return prev;
            const next = new Set(prev);
            next.delete(selectedUser.id);
            return next;
          });
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

  // Handle Bulk Permanent Account Deletion
  const handleExecuteBulkDelete = async () => {
    if (selectedUserIds.size === 0) return;

    setBulkDeleteSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/v1/users/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: Array.from(selectedUserIds),
          reason: bulkDeleteReason.trim() || undefined,
        }),
      });
      const json = await res.json();

      if (json.success) {
        const count = json.data?.deletedCount ?? selectedUserIds.size;
        setSuccessMsg(tUsers('bulkDeleteSuccess', { count }));
        // Remove deleted accounts from view
        setUsers((prev) => prev.filter((u) => !selectedUserIds.has(u.id)));
        setSelectedUserIds(new Set());
        setBulkDeleteModalOpen(false);
        setBulkDeleteReason('');
        // Refresh page to keep pagination synced
        fetchUsers(pagination.page);
      } else {
        setErrorMsg(json.error?.message || tUsers('actionProcessFailed'));
      }
    } catch {
      setErrorMsg(tUsers('networkErrorAction'));
    } finally {
      setBulkDeleteSubmitting(false);
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-auto px-3 py-2.5 bg-app-surface-container-low border border-app-outline-variant/40 rounded-xl text-[13px] font-medium text-app-on-surface focus:outline-none truncate"
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
                className="w-full sm:w-auto px-3 py-2.5 bg-app-surface-container-low border border-app-outline-variant/40 rounded-xl text-[13px] font-medium text-app-on-surface focus:outline-none truncate"
              >
                <option value="ALL">{tUsers('allRoles')}</option>
                <option value="OWNER">{tUsers('roleOwnerLabel')}</option>
                <option value="ADMIN">{tUsers('roleAdminLabel')}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bulk Actions Banner */}
        {selectedUserIds.size > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in soft-elevation">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-700 flex-shrink-0">
                <CheckSquare size={18} />
              </div>
              <div>
                <span className="text-[14px] font-bold text-red-900 block">
                  {tUsers('selectedAccountsCount', { count: selectedUserIds.size })}
                </span>
                <span className="text-[12px] text-red-700">{tUsers('bulkDeleteWarning')}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
              <button
                type="button"
                onClick={() => setSelectedUserIds(new Set())}
                className="flex-1 sm:flex-initial px-3.5 py-2 bg-white hover:bg-red-50 border border-red-200 text-red-800 text-[13px] font-medium rounded-xl transition-colors text-center"
              >
                {tUsers('deselectAll')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setBulkDeleteReason('');
                  setBulkDeleteModalOpen(true);
                }}
                className="flex-1 sm:flex-initial px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-[13px] font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Trash2 size={15} />
                <span>{tUsers('deleteSelected')}</span>
              </button>
            </div>
          </div>
        )}

        {/* User List Table / Cards */}
        <div className="bg-app-surface-container-lowest rounded-2xl border border-app-outline-variant/30 overflow-hidden soft-elevation">
          {/* Table Sub-header with Select All (when eligible users exist on page) */}
          {!loading && users.length > 0 && eligibleUsersOnPage.length > 0 && (
            <div className="px-4 sm:px-5 py-2.5 bg-app-surface-container-low border-b border-app-outline-variant/20 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer text-[13px] font-medium text-app-on-surface-variant hover:text-app-on-surface select-none">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = isSomeSelected;
                  }}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded text-red-600 border-app-outline-variant/50 focus:ring-red-500 cursor-pointer"
                />
                <span>{tUsers('selectAllEligible')}</span>
              </label>
              <span className="text-[12px] text-app-outline">
                {selectedUserIds.size > 0 &&
                  tUsers('selectedAccountsCount', { count: selectedUserIds.size })}
              </span>
            </div>
          )}

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
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {/* Selection Checkbox for Owner Deletion */}
                      {isEligibleForDeletion(u) ? (
                        <div className="pt-1 flex-shrink-0">
                          <input
                            type="checkbox"
                            aria-label={tUsers('selectUserCheckboxLabel', { name: u.fullName })}
                            checked={selectedUserIds.has(u.id)}
                            onChange={() => toggleSelectUser(u.id)}
                            className="w-4 h-4 rounded text-red-600 border-app-outline-variant/50 focus:ring-red-500 cursor-pointer"
                          />
                        </div>
                      ) : (
                        <div
                          className="pt-1 flex-shrink-0"
                          title={
                            isTargetOwner
                              ? tUsers('ownerProtectedTooltip')
                              : tUsers('pendingProtectedTooltip')
                          }
                        >
                          <input
                            type="checkbox"
                            disabled
                            className="w-4 h-4 rounded text-gray-300 border-gray-200 cursor-not-allowed opacity-40"
                          />
                        </div>
                      )}

                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-[16px] font-bold text-app-on-surface break-words">
                            {u.fullName}
                          </h3>
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
                        <p className="text-[13px] text-app-on-surface-variant font-mono break-all sm:break-normal">
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
                    </div>

                    {/* Actions Toolbar */}
                    <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-app-outline-variant/20">
                      <button
                        onClick={() => {
                          setSelectedUser(u);
                          setDetailModalOpen(true);
                        }}
                        className="flex-1 sm:flex-initial min-w-[calc(50%-0.5rem)] sm:min-w-0 justify-center px-3 py-2 sm:py-1.5 bg-app-surface-container border border-app-outline-variant/30 text-app-on-surface text-[12px] font-medium rounded-lg hover:bg-app-surface-container-high transition-colors flex items-center gap-1.5"
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
                              className="flex-1 sm:flex-initial min-w-[calc(50%-0.5rem)] sm:min-w-0 justify-center px-3 py-2 sm:py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[12px] font-medium rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
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
                            className="flex-1 sm:flex-initial min-w-[calc(50%-0.5rem)] sm:min-w-0 justify-center px-3 py-2 sm:py-1.5 bg-blue-50 border border-blue-200 text-blue-700 text-[12px] font-medium rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1.5"
                          >
                            <Edit2 size={14} /> {tCommon('edit')}
                          </button>

                          {/* Suspend Action (For ACTIVE) */}
                          {u.accountStatus === 'ACTIVE' && (
                            <button
                              onClick={() => {
                                setSelectedUser(u);
                                setActionReason('');
                                setConfirmAction('suspend');
                              }}
                              className="flex-1 sm:flex-initial min-w-[calc(50%-0.5rem)] sm:min-w-0 justify-center px-3 py-2 sm:py-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-[12px] font-medium rounded-lg hover:bg-amber-100 transition-colors flex items-center gap-1.5"
                            >
                              <UserX size={14} /> {tUsers('suspendUser')}
                            </button>
                          )}

                          {/* Activate Action (For SUSPENDED) */}
                          {u.accountStatus === 'SUSPENDED' && (
                            <button
                              onClick={() => {
                                setSelectedUser(u);
                                setActionReason('');
                                setConfirmAction('activate');
                              }}
                              className="flex-1 sm:flex-initial min-w-[calc(50%-0.5rem)] sm:min-w-0 justify-center px-3 py-2 sm:py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[12px] font-medium rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
                            >
                              <UserCheck size={14} /> {tUsers('reactivateUser')}
                            </button>
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
            <div className="p-4 bg-app-surface-container-low border-t border-app-outline-variant/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-center sm:text-left">
              <span className="text-[13px] text-app-on-surface-variant">
                {tUsers('paginationUsers', {
                  page: pagination.page,
                  totalPages: pagination.totalPages,
                  total: pagination.totalItems,
                })}
              </span>
              <div className="flex items-center justify-center sm:justify-end gap-2 w-full sm:w-auto">
                <button
                  disabled={pagination.page <= 1 || loading}
                  onClick={() => fetchUsers(pagination.page - 1)}
                  className="flex-1 sm:flex-initial justify-center px-3 py-2 sm:py-1.5 bg-app-surface-container border border-app-outline-variant/30 text-app-on-surface text-[12px] font-medium rounded-lg hover:bg-app-surface-container-high transition-colors disabled:opacity-40 flex items-center gap-1"
                >
                  <ChevronLeft size={14} /> {tUsers('previousPage')}
                </button>
                <button
                  disabled={pagination.page >= pagination.totalPages || loading}
                  onClick={() => fetchUsers(pagination.page + 1)}
                  className="flex-1 sm:flex-initial justify-center px-3 py-2 sm:py-1.5 bg-app-surface-container border border-app-outline-variant/30 text-app-on-surface text-[12px] font-medium rounded-lg hover:bg-app-surface-container-high transition-colors disabled:opacity-40 flex items-center gap-1"
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-app-surface-container-lowest rounded-2xl max-w-lg w-full max-h-[90dvh] overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5 border border-app-outline-variant/30 soft-elevation-lg">
            <div className="flex items-center justify-between border-b border-app-outline-variant/20 pb-3">
              <h2 className="text-[17px] sm:text-[18px] font-bold text-app-on-surface">
                {tUsers('userDetailTitle')}
              </h2>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="text-app-outline hover:text-app-on-surface p-1"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-2 sm:space-y-3 text-[13px] sm:text-[14px]">
              <div className="flex flex-col sm:grid sm:grid-cols-3 gap-1 sm:gap-2 py-1.5 sm:py-1 border-b border-app-outline-variant/10">
                <span className="text-app-on-surface-variant font-medium">{tUsers('userId')}</span>
                <span className="sm:col-span-2 font-mono text-[12px] text-app-on-surface break-all">
                  {selectedUser.id}
                </span>
              </div>
              <div className="flex flex-col sm:grid sm:grid-cols-3 gap-1 sm:gap-2 py-1.5 sm:py-1 border-b border-app-outline-variant/10">
                <span className="text-app-on-surface-variant font-medium">
                  {tUsers('userFullName')}
                </span>
                <span className="sm:col-span-2 font-bold text-app-on-surface break-words">
                  {selectedUser.fullName}
                </span>
              </div>
              <div className="flex flex-col sm:grid sm:grid-cols-3 gap-1 sm:gap-2 py-1.5 sm:py-1 border-b border-app-outline-variant/10">
                <span className="text-app-on-surface-variant font-medium">
                  {tUsers('userEmail')}
                </span>
                <span className="sm:col-span-2 font-mono text-app-on-surface break-all">
                  {selectedUser.email} {tUsers('readOnlySuffix')}
                </span>
              </div>
              <div className="flex flex-col sm:grid sm:grid-cols-3 gap-1 sm:gap-2 py-1.5 sm:py-1 border-b border-app-outline-variant/10">
                <span className="text-app-on-surface-variant font-medium">
                  {tUsers('username')}
                </span>
                <span className="sm:col-span-2 text-app-on-surface break-words">
                  {selectedUser.username || '-'}
                </span>
              </div>
              <div className="flex flex-col sm:grid sm:grid-cols-3 gap-1 sm:gap-2 py-1.5 sm:py-1 border-b border-app-outline-variant/10">
                <span className="text-app-on-surface-variant font-medium">{tCommon('role')}</span>
                <span className="sm:col-span-2 text-app-on-surface">
                  {selectedUser.activeRoles
                    .map((r) =>
                      r === 'OWNER'
                        ? tUsers('roleOwnerLabel')
                        : r === 'ADMIN'
                          ? tUsers('roleAdminLabel')
                          : r
                    )
                    .join(', ')}
                </span>
              </div>
              <div className="flex flex-col sm:grid sm:grid-cols-3 gap-1 sm:gap-2 py-1.5 sm:py-1 border-b border-app-outline-variant/10">
                <span className="text-app-on-surface-variant font-medium">{tCommon('status')}</span>
                <span className="sm:col-span-2">
                  {renderStatusBadge(selectedUser.accountStatus)}
                </span>
              </div>
              <div className="flex flex-col sm:grid sm:grid-cols-3 gap-1 sm:gap-2 py-1.5 sm:py-1 border-b border-app-outline-variant/10">
                <span className="text-app-on-surface-variant font-medium">
                  {tUsers('creationDate')}
                </span>
                <span className="sm:col-span-2 text-app-on-surface">
                  {new Date(selectedUser.createdAt).toLocaleString('id-ID')}
                </span>
              </div>
              {selectedUser.suspendedAt && (
                <div className="flex flex-col sm:grid sm:grid-cols-3 gap-1 sm:gap-2 py-1.5 sm:py-1 border-b border-app-outline-variant/10 text-amber-800">
                  <span className="font-medium">{tUsers('suspensionDate')}</span>
                  <span className="sm:col-span-2">
                    {new Date(selectedUser.suspendedAt).toLocaleString('id-ID')}
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setDetailModalOpen(false)}
                className="w-full sm:w-auto px-4 py-2 bg-app-surface-container text-app-on-surface text-[13px] font-medium rounded-xl border border-app-outline-variant/30 hover:bg-app-surface-container-high transition-colors text-center"
              >
                {tCommon('close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {editModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <form
            onSubmit={handleSaveEdit}
            className="bg-app-surface-container-lowest rounded-2xl max-w-md w-full max-h-[90dvh] overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5 border border-app-outline-variant/30 soft-elevation-lg"
          >
            <div className="flex items-center justify-between border-b border-app-outline-variant/20 pb-3">
              <h2 className="text-[17px] sm:text-[18px] font-bold text-app-on-surface">
                {tUsers('editProfileTitle')}
              </h2>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="text-app-outline hover:text-app-on-surface p-1"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 sm:space-y-4">
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
                  className="w-full px-3.5 py-2.5 bg-app-surface-container/60 border border-app-outline-variant/20 rounded-xl text-[14px] text-app-on-surface-variant cursor-not-allowed font-mono break-all"
                />
                <p className="text-[11px] text-app-outline mt-1">{tUsers('emailOwnerNotice')}</p>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-2">
              <button
                type="button"
                disabled={editSubmitting}
                onClick={() => setEditModalOpen(false)}
                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-app-surface-container text-app-on-surface text-[13px] font-medium rounded-xl border border-app-outline-variant/30 hover:bg-app-surface-container-high transition-colors text-center"
              >
                {tCommon('cancel')}
              </button>
              <button
                type="submit"
                disabled={editSubmitting}
                className="w-full sm:w-auto px-5 py-2.5 sm:py-2 bg-app-primary text-app-on-primary text-[13px] font-bold rounded-xl hover:bg-app-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-app-surface-container-lowest rounded-2xl max-w-md w-full max-h-[90dvh] overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5 border border-app-outline-variant/30 soft-elevation-lg">
            <div className="flex items-start sm:items-center gap-3 border-b border-app-outline-variant/20 pb-3">
              <div
                className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center ${
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
              <div className="min-w-0 flex-1">
                <h2 className="text-[17px] sm:text-[18px] font-bold text-app-on-surface">
                  {confirmAction === 'suspend'
                    ? tUsers('confirmSuspendTitle')
                    : confirmAction === 'deactivate'
                      ? tUsers('confirmDeleteAccountTitle')
                      : tUsers('confirmActivationTitle')}
                </h2>
                <p className="text-[12px] text-app-on-surface-variant break-all sm:break-normal">
                  {tUsers('userLabel', {
                    name: selectedUser.fullName,
                    email: selectedUser.email,
                  })}
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[13px] font-semibold text-app-on-surface">
                  {tUsers('reasonLabel')}
                </label>
                <span className="text-[11px] text-app-outline">
                  {actionReason.trim().length}/500
                </span>
              </div>
              <textarea
                rows={3}
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder={tUsers('reasonPlaceholder')}
                maxLength={500}
                className="w-full px-3.5 py-2 bg-app-surface-container-low border border-app-outline-variant/40 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-app-primary/30 resize-none"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-2">
              <button
                type="button"
                disabled={actionSubmitting}
                onClick={() => setConfirmAction(null)}
                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-app-surface-container text-app-on-surface text-[13px] font-medium rounded-xl border border-app-outline-variant/30 hover:bg-app-surface-container-high transition-colors text-center"
              >
                {tCommon('cancel')}
              </button>
              <button
                type="button"
                disabled={actionSubmitting}
                onClick={handleExecuteLifecycleAction}
                className={`w-full sm:w-auto px-5 py-2.5 sm:py-2 text-[13px] font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
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

      {/* Bulk Permanent Deletion Modal */}
      {bulkDeleteModalOpen && selectedUserIds.size > 0 && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-app-surface-container-lowest rounded-2xl max-w-lg w-full max-h-[90dvh] overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5 border border-app-outline-variant/30 soft-elevation-lg">
            <div className="flex items-start gap-3 border-b border-app-outline-variant/20 pb-3">
              <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-red-100 text-red-800">
                <Trash2 size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-[17px] sm:text-[18px] font-bold text-red-900">
                  {tUsers('bulkDeleteTitle')}
                </h2>
              </div>
              <button
                onClick={() => setBulkDeleteModalOpen(false)}
                className="text-app-outline hover:text-app-on-surface p-1"
              >
                <X size={20} />
              </button>
            </div>

            {/* List of accounts to be deleted */}
            <div className="space-y-2">
              <label className="block text-[13px] font-semibold text-app-on-surface">
                {tUsers('selectedUsersList')} ({selectedUserIds.size})
              </label>
              <div className="max-h-36 overflow-y-auto divide-y divide-app-outline-variant/20 border border-app-outline-variant/30 rounded-xl bg-app-surface-container-low/50 px-3">
                {users
                  .filter((u) => selectedUserIds.has(u.id))
                  .map((u) => (
                    <div
                      key={u.id}
                      className="py-2 flex items-center justify-between gap-2 text-[12px]"
                    >
                      <span className="font-semibold text-app-on-surface truncate">
                        {u.fullName}
                      </span>
                      <span className="font-mono text-app-outline truncate">{u.email}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Deletion Reason (Optional) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[13px] font-semibold text-app-on-surface">
                  {tUsers('reasonLabel')}
                </label>
                <span className="text-[11px] text-app-outline">
                  {bulkDeleteReason.trim().length}/500
                </span>
              </div>
              <textarea
                rows={3}
                value={bulkDeleteReason}
                onChange={(e) => setBulkDeleteReason(e.target.value)}
                placeholder={tUsers('reasonPlaceholder')}
                maxLength={500}
                className="w-full px-3.5 py-2 bg-app-surface-container-low border border-app-outline-variant/40 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-app-primary/30 resize-none"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-2">
              <button
                type="button"
                disabled={bulkDeleteSubmitting}
                onClick={() => setBulkDeleteModalOpen(false)}
                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-app-surface-container text-app-on-surface text-[13px] font-medium rounded-xl border border-app-outline-variant/30 hover:bg-app-surface-container-high transition-colors text-center"
              >
                {tCommon('cancel')}
              </button>
              <button
                type="button"
                disabled={bulkDeleteSubmitting}
                onClick={handleExecuteBulkDelete}
                className="w-full sm:w-auto px-5 py-2.5 sm:py-2 bg-red-600 hover:bg-red-700 text-white text-[13px] font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {bulkDeleteSubmitting && <Loader2 size={15} className="animate-spin" />}
                {tUsers('bulkDeleteConfirmBtn', { count: selectedUserIds.size })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Device Access Management Modal */}
      {deviceModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-app-surface-container-lowest border border-app-outline-variant/30 rounded-2xl p-4 sm:p-6 max-w-lg w-full max-h-[90dvh] overflow-y-auto soft-elevation space-y-4 sm:space-y-5">
            <div className="flex items-start sm:items-center justify-between border-b border-app-outline-variant/20 pb-3 sm:pb-4 gap-2">
              <div className="min-w-0 flex-1">
                <h2 className="text-[17px] sm:text-[18px] font-bold text-app-on-surface flex items-center gap-2">
                  <Cpu size={20} className="text-app-primary flex-shrink-0" />{' '}
                  <span className="truncate">{tUsers('manageAdminDevices')}</span>
                </h2>
                <p className="text-[12px] sm:text-[13px] text-app-on-surface-variant font-medium break-all sm:break-normal">
                  {selectedUser.fullName} ({selectedUser.email})
                </p>
              </div>
              <button
                onClick={() => setDeviceModalOpen(false)}
                className="text-app-outline hover:text-app-on-surface p-1 flex-shrink-0"
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
              <div className="space-y-2.5 bg-app-surface-container-low p-3.5 sm:p-4 rounded-xl border border-app-outline-variant/30">
                <label className="text-[13px] font-bold text-app-on-surface block">
                  {tUsers('assignNewDevice')}
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={selectedAssignDeviceId}
                    onChange={(e) => setSelectedAssignDeviceId(e.target.value)}
                    className="w-full sm:flex-1 px-3 py-2.5 sm:py-2 bg-app-surface-container border border-app-outline-variant/40 rounded-xl text-[13px] focus:outline-none truncate"
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
                    className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-app-primary text-app-on-primary text-[13px] font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-1.5 flex-shrink-0"
                  >
                    {assigningDevice && <Loader2 size={14} className="animate-spin" />}
                    {tUsers('assignBtn')}
                  </button>
                </div>
              </div>
            )}

            {/* Active Assigned Devices List */}
            <div className="space-y-2.5 sm:space-y-3">
              <h3 className="text-[13px] sm:text-[14px] font-bold text-app-on-surface">
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
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 text-[13px]"
                    >
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-app-on-surface break-words">
                            {assignment.deviceName || assignment.canonicalDeviceId}
                          </span>
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {tUsers('activeBadge')}
                          </span>
                        </div>
                        <p className="text-[11px] text-app-outline font-mono truncate">
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
                        className="w-full sm:w-auto px-3 py-1.5 sm:py-1 bg-red-50 text-red-700 border border-red-200 text-[12px] font-medium rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-1 disabled:opacity-50 self-start sm:self-auto flex-shrink-0"
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
                className="w-full sm:w-auto px-4 py-2 bg-app-surface-container text-app-on-surface text-[13px] font-medium rounded-xl border border-app-outline-variant/30 hover:bg-app-surface-container-high transition-colors text-center"
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
