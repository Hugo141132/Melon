'use client';

import { useState, useEffect, useCallback } from 'react';
import TopAppBar from '@/components/navigation/TopAppBar';
import { User, ShieldAlert, CheckCircle, XCircle, RefreshCw, Search } from 'lucide-react';

interface PendingApprovalItem {
  userId: string;
  fullName: string;
  email: string;
  accountStatus: string;
  createdAt: string;
}

interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export default function PendingApprovalsPage() {
  const [items, setItems] = useState<PendingApprovalItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [search, setSearch] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<PendingApprovalItem | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [decisionNote, setDecisionNote] = useState<string>('');
  const [submittingApprove, setSubmittingApprove] = useState<boolean>(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [approveSuccess, setApproveSuccess] = useState<boolean>(false);

  const [submittingReject, setSubmittingReject] = useState<boolean>(false);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [rejectSuccess, setRejectSuccess] = useState<boolean>(false);

  const handleApprove = async (userId: string) => {
    setSubmittingApprove(true);
    setApproveError(null);
    setApproveSuccess(false);
    try {
      const res = await fetch(`/api/v1/approvals/${userId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisionNote }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setApproveError(json.error?.message || 'Gagal menyetujui pendaftaran. Silakan coba lagi.');
      } else {
        setApproveSuccess(true);
        setDecisionNote('');
        setTimeout(() => {
          setSelectedUserId(null);
          setDetailItem(null);
          setApproveSuccess(false);
          fetchApprovals(pagination?.page || 1);
        }, 1200);
      }
    } catch {
      setApproveError('Gagal terhubung ke server saat memproses persetujuan.');
    } finally {
      setSubmittingApprove(false);
    }
  };

  const handleReject = async (userId: string) => {
    setSubmittingReject(true);
    setRejectError(null);
    setRejectSuccess(false);
    try {
      const res = await fetch(`/api/v1/approvals/${userId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisionNote }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setRejectError(json.error?.message || 'Gagal menolak pendaftaran. Silakan coba lagi.');
      } else {
        setRejectSuccess(true);
        setDecisionNote('');
        setTimeout(() => {
          setSelectedUserId(null);
          setDetailItem(null);
          setRejectSuccess(false);
          fetchApprovals(pagination?.page || 1);
        }, 1200);
      }
    } catch {
      setRejectError('Gagal terhubung ke server saat memproses penolakan.');
    } finally {
      setSubmittingReject(false);
    }
  };

  const fetchApprovals = useCallback(
    async (pageToFetch = 1) => {
      setLoading(true);
      setError(null);
      try {
        const query = new URLSearchParams({
          page: pageToFetch.toString(),
          pageSize: '20',
          sort: 'createdAt:desc',
        });
        if (search.trim()) {
          query.set('search', search.trim());
        }

        const res = await fetch(`/api/v1/approvals/pending?${query.toString()}`);
        const json = await res.json();

        if (!res.ok || !json.success) {
          setError({
            code: json.error?.code || 'UNKNOWN_ERROR',
            message: json.error?.message || 'Gagal memuat daftar persetujuan pendaftaran.',
          });
          setItems([]);
          setPagination(null);
        } else {
          setItems(json.data || []);
          setPagination(json.meta?.pagination || null);
        }
      } catch (err: unknown) {
        setError({
          code: 'NETWORK_ERROR',
          message: 'Gagal terhubung ke server. Periksa koneksi jaringan Anda.',
        });
      } finally {
        setLoading(false);
      }
    },
    [search]
  );

  const fetchDetail = async (userId: string) => {
    setSelectedUserId(userId);
    setLoadingDetail(true);
    setDetailItem(null);
    try {
      const res = await fetch(`/api/v1/approvals/${userId}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setDetailItem(json.data);
      }
    } catch {
      // Handled in detail panel view
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    fetchApprovals(1);
  }, [fetchApprovals]);

  return (
    <div className="bg-app-surface text-app-on-surface min-h-dvh pb-24">
      <TopAppBar />

      <main className="pt-20 px-[1rem] max-w-4xl mx-auto w-full space-y-5">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-app-surface-container-lowest p-5 rounded-xl soft-elevation-lg border border-app-outline-variant/30">
          <div>
            <h1 className="text-[24px] leading-8 font-bold text-app-primary flex items-center gap-2">
              <User size={24} /> Permohonan Pendaftaran Admin (Owner)
            </h1>
            <p className="text-[14px] text-app-on-surface-variant">
              Daftar akun Admin baru yang memerlukan persetujuan Owner.
            </p>
          </div>
          <button
            onClick={() => fetchApprovals(pagination?.page || 1)}
            disabled={loading}
            className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 bg-app-primary/10 text-app-primary rounded-lg font-medium hover:bg-app-primary/20 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Muat Ulang
          </button>
        </header>

        {/* Search Bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-app-outline"
            />
            <input
              type="text"
              placeholder="Cari nama atau email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchApprovals(1)}
              className="w-full pl-10 pr-4 py-2.5 bg-app-surface-container-lowest border border-app-outline-variant/30 rounded-lg text-sm text-app-on-surface focus:outline-none focus:border-app-primary"
            />
          </div>
          <button
            onClick={() => fetchApprovals(1)}
            className="px-4 py-2.5 bg-app-primary text-app-on-primary rounded-lg text-sm font-medium hover:bg-app-primary/90 transition-colors"
          >
            Cari
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-app-surface-container-lowest p-12 rounded-xl border border-app-outline-variant/20 text-center space-y-3">
            <RefreshCw size={32} className="mx-auto text-app-primary animate-spin" />
            <p className="text-sm font-medium text-app-on-surface-variant">
              Memuat permohonan pendaftaran...
            </p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="bg-app-error-container/20 p-6 rounded-xl border border-app-error/30 text-app-error space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldAlert size={20} />
              <span>Akses Ditolak / Kesalahan ({error.code})</span>
            </div>
            <p className="text-sm">{error.message}</p>
            {error.code === 'FORBIDDEN' && (
              <p className="text-xs opacity-80 pt-1">
                Halaman ini khusus untuk pengguna dengan peran Owner yang aktif.
              </p>
            )}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && items.length === 0 && (
          <div className="bg-app-surface-container-lowest p-12 rounded-xl border border-app-outline-variant/20 text-center space-y-3">
            <CheckCircle size={40} className="mx-auto text-app-primary/60" />
            <h3 className="text-lg font-semibold text-app-on-surface">
              Tidak Ada Permohonan Pending
            </h3>
            <p className="text-sm text-app-on-surface-variant max-w-md mx-auto">
              Saat ini tidak ada pendaftaran Admin yang menunggu persetujuan.
            </p>
          </div>
        )}

        {/* List & Detail Grid */}
        {!loading && !error && items.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.userId}
                  onClick={() => fetchDetail(item.userId)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    selectedUserId === item.userId
                      ? 'bg-app-primary/5 border-app-primary shadow-sm'
                      : 'bg-app-surface-container-lowest border-app-outline-variant/20 hover:border-app-outline-variant/60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-app-on-surface">{item.fullName}</h4>
                      <p className="text-xs text-app-on-surface-variant">{item.email}</p>
                    </div>
                    <span className="text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20">
                      {item.accountStatus}
                    </span>
                  </div>
                  <p className="text-[11px] text-app-outline mt-2">
                    Daftar pada: {new Date(item.createdAt).toLocaleString('id-ID')}
                  </p>
                </div>
              ))}

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <button
                    disabled={pagination.page <= 1}
                    onClick={() => fetchApprovals(pagination.page - 1)}
                    className="px-3 py-1.5 text-xs bg-app-surface-container border rounded disabled:opacity-40"
                  >
                    Sebelumnya
                  </button>
                  <span className="text-xs text-app-on-surface-variant">
                    Halaman {pagination.page} dari {pagination.totalPages} ({pagination.totalItems}{' '}
                    total)
                  </span>
                  <button
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => fetchApprovals(pagination.page + 1)}
                    className="px-3 py-1.5 text-xs bg-app-surface-container border rounded disabled:opacity-40"
                  >
                    Selanjutnya
                  </button>
                </div>
              )}
            </div>

            {/* Detail View */}
            <div className="bg-app-surface-container-lowest p-5 rounded-xl border border-app-outline-variant/30 h-fit space-y-4">
              <h3 className="text-base font-semibold text-app-on-surface border-b pb-2">
                Detail Pendaftaran
              </h3>
              {loadingDetail ? (
                <div className="p-8 text-center text-sm text-app-on-surface-variant">
                  Memuat detail...
                </div>
              ) : detailItem ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <label className="text-xs text-app-outline">User ID</label>
                    <p className="font-mono text-xs text-app-on-surface break-all">
                      {detailItem.userId}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-app-outline">Nama Lengkap</label>
                    <p className="font-medium text-app-on-surface">{detailItem.fullName}</p>
                  </div>
                  <div>
                    <label className="text-xs text-app-outline">Email Registrasi</label>
                    <p className="font-medium text-app-on-surface">{detailItem.email}</p>
                  </div>
                  <div>
                    <label className="text-xs text-app-outline">Status Akun</label>
                    <p className="font-medium text-amber-600">{detailItem.accountStatus}</p>
                  </div>
                  <div>
                    <label className="text-xs text-app-outline">Tanggal Pengajuan</label>
                    <p className="text-app-on-surface">
                      {new Date(detailItem.createdAt).toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div className="pt-3 border-t border-app-outline-variant/30 space-y-3">
                    <div>
                      <label className="text-xs text-app-outline font-medium">
                        Catatan Persetujuan (Opsional)
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Contoh: Identitas terverifikasi via telepon..."
                        value={decisionNote}
                        onChange={(e) => setDecisionNote(e.target.value)}
                        className="w-full mt-1 p-2 bg-app-surface-container border border-app-outline-variant/30 rounded-lg text-xs text-app-on-surface focus:outline-none focus:border-app-primary resize-none"
                      />
                    </div>

                    {approveError && (
                      <div className="p-2 bg-app-error-container/20 border border-app-error/30 text-app-error rounded text-xs">
                        {approveError}
                      </div>
                    )}
                    {approveSuccess && (
                      <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded text-xs flex items-center gap-1.5 font-medium">
                        <CheckCircle size={14} /> Permohonan berhasil disetujui!
                      </div>
                    )}

                    {rejectError && (
                      <div className="p-2 bg-app-error-container/20 border border-app-error/30 text-app-error rounded text-xs">
                        {rejectError}
                      </div>
                    )}
                    {rejectSuccess && (
                      <div className="p-2 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 rounded text-xs flex items-center gap-1.5 font-medium">
                        <XCircle size={14} /> Permohonan berhasil ditolak!
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(detailItem.userId)}
                        disabled={submittingApprove || submittingReject}
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        {submittingApprove ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <CheckCircle size={14} />
                        )}
                        Setujui
                      </button>
                      <button
                        onClick={() => handleReject(detailItem.userId)}
                        disabled={submittingApprove || submittingReject}
                        className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        {submittingReject ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <XCircle size={14} />
                        )}
                        Tolak
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-app-on-surface-variant text-center py-6">
                  Pilih salah satu item di sebelah kiri untuk melihat detail permohonan.
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
