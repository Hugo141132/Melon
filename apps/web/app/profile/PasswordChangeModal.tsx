'use client';

import { useState } from 'react';
import { X, Loader2, AlertCircle, Lock, Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface PasswordChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PasswordChangeModal({ isOpen, onClose }: PasswordChangeModalProps) {
  const tProfile = useTranslations('profile');
  const tCommon = useTranslations('common');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !newPasswordConfirmation) {
      setErrorMsg(tProfile('allFieldsRequired'));
      return;
    }
    if (newPassword !== newPasswordConfirmation) {
      setErrorMsg(tProfile('passwordMismatch'));
      return;
    }
    if (newPassword.length < 8) {
      setErrorMsg(tProfile('passwordTooShort'));
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/v1/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, newPasswordConfirmation }),
      });

      if (res.status === 204) {
        // Success -> Redirect to /login with message
        window.location.href = '/login?message=PASSWORD_CHANGED';
        return;
      }

      const json = await res.json().catch(() => ({}));
      setErrorMsg(json.error?.message || tProfile('changePasswordFailed'));
    } catch {
      setErrorMsg(tProfile('changePasswordConnectionError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-app-surface-variant/80 backdrop-blur-sm"
        onClick={!loading ? onClose : undefined}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-slide-up flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-app-surface-container-low">
          <div className="flex items-center gap-3 text-app-on-surface">
            <div className="w-10 h-10 rounded-full bg-app-surface-container-low flex items-center justify-center text-app-primary">
              <Lock size={18} />
            </div>
            <h2 className="text-xl font-bold">{tProfile('changePassword')}</h2>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 text-app-on-surface-variant hover:bg-app-surface-container rounded-full transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">
          {errorMsg && (
            <div className="mb-6 bg-app-error-container/20 border border-app-error text-app-error px-4 py-3 rounded-xl flex items-start gap-3 text-[14px] font-medium leading-tight">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Current Password */}
            <div className="space-y-1.5">
              <label className="text-[14px] font-semibold text-app-on-surface-variant px-1 block">
                {tProfile('currentPassword')}
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={loading}
                  className="w-full h-[52px] pl-4 pr-12 bg-app-surface-container-lowest border-[1.5px] border-app-outline-variant rounded-xl focus:border-app-primary focus:ring-1 focus:ring-app-primary outline-none transition-all text-[16px]"
                  placeholder={tProfile('currentPasswordPlaceholder')}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-app-on-surface-variant hover:text-app-primary transition-colors"
                >
                  {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <label className="text-[14px] font-semibold text-app-on-surface-variant px-1 block">
                {tProfile('newPassword')}
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading}
                  className="w-full h-[52px] pl-4 pr-12 bg-app-surface-container-lowest border-[1.5px] border-app-outline-variant rounded-xl focus:border-app-primary focus:ring-1 focus:ring-app-primary outline-none transition-all text-[16px]"
                  placeholder={tProfile('newPasswordPlaceholder')}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-app-on-surface-variant hover:text-app-primary transition-colors"
                >
                  {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div className="space-y-1.5">
              <label className="text-[14px] font-semibold text-app-on-surface-variant px-1 block">
                {tProfile('confirmNewPassword')}
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={newPasswordConfirmation}
                  onChange={(e) => setNewPasswordConfirmation(e.target.value)}
                  disabled={loading}
                  className="w-full h-[52px] pl-4 pr-12 bg-app-surface-container-lowest border-[1.5px] border-app-outline-variant rounded-xl focus:border-app-primary focus:ring-1 focus:ring-app-primary outline-none transition-all text-[16px]"
                  placeholder={tProfile('confirmNewPasswordPlaceholder')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-app-on-surface-variant hover:text-app-primary transition-colors"
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-[52px] mt-2 bg-app-primary text-white rounded-xl text-[16px] font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-app-primary/20 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {tCommon('processing')}
                </>
              ) : (
                tProfile('saveAndLogout')
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
