import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsNotificationPreferences } from '@/components/settings/notification-preferences';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const dict: Record<string, string> = {
      notificationsTitle: 'Notifikasi & Lansiran',
      notificationsSubtitle: 'Atur preferensi notifikasi',
      emailAlertsLabel: 'Notifikasi Email Peringatan',
      emailAlertsDesc: 'Terima email saat perangkat mengalami peringatan',
      emailAlertsEnabled: 'Aktif',
      emailAlertsDisabled: 'Nonaktif',
      savingPreferences: 'Memperbarui preferensi...',
      savePreferencesFailed: 'Gagal memperbarui preferensi notifikasi.',
      preferencesSaved: 'Preferensi berhasil disimpan',
      close: 'Tutup',
    };
    return dict[key] || key;
  },
  useLocale: () => 'id',
}));

describe('SettingsNotificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('renders trigger button with initial active status', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { emailAlertsEnabled: true },
      }),
    });

    render(<SettingsNotificationPreferences />);

    const trigger = screen.getByTestId('settings-notifications-trigger');
    expect(trigger).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('Notifikasi Email Peringatan: Aktif')).toBeDefined();
    });
  });

  it('opens modal on click and allows toggling email alert preference', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { emailAlertsEnabled: true },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { emailAlertsEnabled: false },
        }),
      });

    render(<SettingsNotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByText('Notifikasi Email Peringatan: Aktif')).toBeDefined();
    });

    const trigger = screen.getByTestId('settings-notifications-trigger');
    fireEvent.click(trigger);

    expect(screen.getByRole('dialog')).toBeDefined();
    const toggle = screen.getByTestId('email-alerts-toggle');
    expect(toggle.getAttribute('aria-checked')).toBe('true');

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/me/preferences',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ emailAlertsEnabled: false }),
        })
      );
    });

    await waitFor(() => {
      expect(toggle.getAttribute('aria-checked')).toBe('false');
      expect(screen.getByText('Preferensi berhasil disimpan')).toBeDefined();
    });
  });
});
