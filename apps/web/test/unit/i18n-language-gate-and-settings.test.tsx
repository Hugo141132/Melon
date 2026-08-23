import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LanguageGate } from '@/components/auth/language-gate';
import { SettingsLocaleSwitcher } from '@/components/settings/locale-switcher';
import { UserPreferenceUpdateInputSchema } from '@kebun-melon/contracts';
import { isSupportedLocale, resolveLocale, LOCALE_COOKIE_NAME } from '@/lib/i18n/config';
import nextConfig from '../../next.config.mjs';

const mockRefresh = vi.fn();
const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

describe('TASK-0604 — Mandatory Initial Language Gate & Settings Locale Change Flow', () => {
  let originalCookie: string;

  beforeEach(() => {
    vi.clearAllMocks();
    originalCookie = document.cookie;
    // Clear cookies in jsdom
    document.cookie.split(';').forEach((c) => {
      document.cookie = c
        .replace(/^ +/, '')
        .replace(/=.*/, `=;expires=${new Date(0).toUTCString()};path=/`);
    });
  });

  afterEach(() => {
    document.cookie = originalCookie;
  });

  describe('1. Language Gate Component (Unauthenticated Flow)', () => {
    it('renders language selection gate with bilingual header and accessible buttons', () => {
      render(<LanguageGate />);

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        'Select Language / Pilih Bahasa'
      );
      expect(screen.getByRole('button', { name: /Select English/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Pilih Bahasa Indonesia/i })).toBeInTheDocument();
    });

    it('sets locale=en cookie and triggers router.refresh() when English is selected', () => {
      render(<LanguageGate />);

      const enBtn = screen.getByRole('button', { name: /Select English/i });
      fireEvent.click(enBtn);

      expect(document.cookie).toContain(`${LOCALE_COOKIE_NAME}=en`);
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });

    it('sets locale=id cookie and triggers router.refresh() when Bahasa Indonesia is selected', () => {
      render(<LanguageGate />);

      const idBtn = screen.getByRole('button', { name: /Pilih Bahasa Indonesia/i });
      fireEvent.click(idBtn);

      expect(document.cookie).toContain(`${LOCALE_COOKIE_NAME}=id`);
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });
  });

  describe('2. Locale Validation & Gate Decision Logic', () => {
    it('correctly distinguishes valid vs missing vs invalid locale cookies', () => {
      // Missing cookie
      expect(isSupportedLocale(undefined)).toBe(false);
      expect(isSupportedLocale(null)).toBe(false);
      expect(isSupportedLocale('')).toBe(false);

      // Invalid locale cookie
      expect(isSupportedLocale('fr')).toBe(false);
      expect(isSupportedLocale('de')).toBe(false);
      expect(isSupportedLocale('invalid')).toBe(false);

      // Valid locales
      expect(isSupportedLocale('id')).toBe(true);
      expect(isSupportedLocale('en')).toBe(true);
    });

    it('resolves valid locales or falls back to default id without crash', () => {
      expect(resolveLocale('en')).toBe('en');
      expect(resolveLocale('id')).toBe('id');
      expect(resolveLocale('invalid')).toBe('id');
      expect(resolveLocale(null)).toBe('id');
      expect(resolveLocale(undefined)).toBe('id');
    });
  });

  describe('3. Settings Locale Switcher Component (Authenticated Flow)', () => {
    it('renders current language row trigger button', () => {
      render(<SettingsLocaleSwitcher />);

      expect(screen.getByRole('button', { name: 'Preferensi Bahasa' })).toBeInTheDocument();
      expect(screen.getByText('Bahasa Indonesia')).toBeInTheDocument();
      expect(screen.queryByTestId('settings-language-modal')).not.toBeInTheDocument();
    });

    it('opens accessible modal dialog showing language options on click', () => {
      render(<SettingsLocaleSwitcher />);

      const trigger = screen.getByRole('button', { name: 'Preferensi Bahasa' });
      fireEvent.click(trigger);

      expect(screen.getByTestId('settings-language-modal')).toBeInTheDocument();
      expect(screen.getByRole('radiogroup', { name: 'Pilih Bahasa' })).toBeInTheDocument();
      expect(screen.getByTestId('language-option-id')).toBeInTheDocument();
      expect(screen.getByTestId('language-option-en')).toBeInTheDocument();
      expect(screen.getByText('Bahasa Aktif')).toBeInTheDocument();
    });

    it('persists preference via PATCH /api/v1/me/preferences, updates cookie and html lang, closes modal, and refreshes', async () => {
      const globalFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { preferredLocale: 'en', timezone: 'Asia/Jakarta', defaultDeviceId: null },
        }),
      });
      global.fetch = globalFetch;

      render(<SettingsLocaleSwitcher />);

      // Open modal
      fireEvent.click(screen.getByRole('button', { name: 'Preferensi Bahasa' }));
      expect(screen.getByTestId('settings-language-modal')).toBeInTheDocument();

      // Select English
      fireEvent.click(screen.getByTestId('language-option-en'));

      await waitFor(() => {
        expect(globalFetch).toHaveBeenCalledWith('/api/v1/me/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preferredLocale: 'en' }),
        });
        expect(document.cookie).toContain(`${LOCALE_COOKIE_NAME}=en`);
        expect(document.documentElement.lang).toBe('en');
        expect(mockRefresh).toHaveBeenCalled();
        expect(screen.queryByTestId('settings-language-modal')).not.toBeInTheDocument();
      });
    });

    it('displays error message inside modal on save failure and keeps modal usable', async () => {
      const globalFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Database failure' },
        }),
      });
      global.fetch = globalFetch;

      render(<SettingsLocaleSwitcher />);

      // Open modal
      fireEvent.click(screen.getByRole('button', { name: 'Preferensi Bahasa' }));

      // Select English
      fireEvent.click(screen.getByTestId('language-option-en'));

      await waitFor(() => {
        expect(screen.getByTestId('language-modal-error')).toBeInTheDocument();
        expect(screen.getByText('Database failure')).toBeInTheDocument();
        expect(screen.getByTestId('settings-language-modal')).toBeInTheDocument();
      });
    });

    it('closes modal on cancel button or close button click', () => {
      render(<SettingsLocaleSwitcher />);

      // Open modal
      fireEvent.click(screen.getByRole('button', { name: 'Preferensi Bahasa' }));
      expect(screen.getByTestId('settings-language-modal')).toBeInTheDocument();

      // Click close button
      fireEvent.click(screen.getByTestId('btn-close-language-modal'));
      expect(screen.queryByTestId('settings-language-modal')).not.toBeInTheDocument();
    });
  });

  describe('4. Contracts & Validation Schema for Preferences', () => {
    it('validates valid preferredLocale inputs (id and en)', () => {
      const validId = UserPreferenceUpdateInputSchema.safeParse({ preferredLocale: 'id' });
      expect(validId.success).toBe(true);

      const validEn = UserPreferenceUpdateInputSchema.safeParse({ preferredLocale: 'en' });
      expect(validEn.success).toBe(true);
    });

    it('accepts optional timezone and defaultDeviceId per API.md 11.3', () => {
      const validFull = UserPreferenceUpdateInputSchema.safeParse({
        preferredLocale: 'id',
        timezone: 'Asia/Jakarta',
        defaultDeviceId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      });
      expect(validFull.success).toBe(true);
    });

    it('rejects unsupported locales and unapproved extra attributes strictly', () => {
      const invalidLocale = UserPreferenceUpdateInputSchema.safeParse({
        preferredLocale: 'fr',
      });
      expect(invalidLocale.success).toBe(false);

      const invalidExtraField = UserPreferenceUpdateInputSchema.safeParse({
        preferredLocale: 'en',
        role: 'OWNER',
      });
      expect(invalidExtraField.success).toBe(false);
    });
  });

  describe('5. Next.js Routing Compatibility & Settings Redirect', () => {
    it('has permanent redirect from /settings to /setting in nextConfig', async () => {
      expect(typeof nextConfig.redirects).toBe('function');
      const redirects = await nextConfig.redirects!();
      const settingsRedirect = redirects.find(
        (r: { source: string; destination: string }) => r.source === '/settings'
      );

      expect(settingsRedirect).toBeDefined();
      expect(settingsRedirect?.destination).toBe('/setting');
      expect(settingsRedirect?.permanent).toBe(true);
    });
  });
});
