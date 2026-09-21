// @vitest-environment jsdom
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import idMessages from '@/messages/id.json';
import enMessages from '@/messages/en.json';
import RegisterView from '@/app/(auth)/register/register-view';
import SettingPage from '@/app/setting/page';
import AccountStatusPage from '@/app/(auth)/status/page';
import { UserRole } from '@kebun-melon/contracts';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/register',
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'usr-1',
      fullName: 'Test User',
      email: 'test@example.com',
      accountStatus: 'ACTIVE',
      activeRoles: [UserRole.ADMIN],
    },
    role: UserRole.ADMIN,
    isAuthenticated: true,
  }),
  AuthProvider: ({ children }: any) => <>{children}</>,
}));

describe('Branding Cleanup: Visible UI text verification', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ownerAvailable: false }),
    });
  });

  it('preserves the exact subtitle "Manage your melon farm with ease" and Indonesian equivalent', () => {
    expect(enMessages.auth.loginSubtitle).toBe('Manage your melon farm with ease');
    expect(idMessages.auth.loginSubtitle).toBe('Kelola lahan melon Anda dengan lebih mudah');
  });

  it('removes "Kebun Melon" from registration messages in Indonesian', () => {
    expect(idMessages.auth.chooseRoleSubtitle).not.toContain('Kebun Melon');
    expect(idMessages.auth.firstOwnerDesc).not.toContain('Kebun Melon');
    expect(idMessages.auth.adminRegistrationDesc).not.toContain('Kebun Melon');
    expect((idMessages as any).devices.mainSiteDefault).not.toContain('Kebun Melon');
  });

  it('removes "Kebun Melon" from registration messages in English', () => {
    expect(enMessages.auth.chooseRoleSubtitle).not.toContain('Kebun Melon');
    expect(enMessages.auth.firstOwnerDesc).not.toContain('Kebun Melon');
    expect(enMessages.auth.adminRegistrationDesc).not.toContain('Kebun Melon');
    expect(enMessages.settings.languageModalDesc).not.toContain('Kebun Melon');
  });

  it('renders RegisterView in Indonesian without any visible "Kebun Melon" text and exact OWNER / PIC role label', async () => {
    const { container } = render(
      <NextIntlClientProvider locale="id" messages={idMessages}>
        <RegisterView />
      </NextIntlClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('OWNER / PIC')).toBeInTheDocument();
    });

    expect(container.textContent).not.toContain('Kebun Melon');
    expect(screen.queryByText(/OWNER \/ PIC \(Owner\)/i)).not.toBeInTheDocument();
    const images = container.querySelectorAll('img');
    images.forEach((img) => {
      expect(img.getAttribute('alt')).not.toContain('Kebun Melon');
    });
  });

  it('renders RegisterView in English without any visible "Kebun Melon" text and exact OWNER / PIC role label', async () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <RegisterView />
      </NextIntlClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('OWNER / PIC')).toBeInTheDocument();
    });

    expect(container.textContent).not.toContain('Kebun Melon');
    expect(screen.queryByText(/OWNER \/ PIC \(Owner\)/i)).not.toBeInTheDocument();
    const images = container.querySelectorAll('img');
    images.forEach((img) => {
      expect(img.getAttribute('alt')).not.toContain('Kebun Melon');
    });
  });

  it('renders SettingPage without "Kebun Melon" in version text', () => {
    const { container } = render(
      <NextIntlClientProvider locale="id" messages={idMessages}>
        <SettingPage />
      </NextIntlClientProvider>
    );

    expect(container.textContent).not.toContain('Kebun Melon');
    expect(screen.getByText('v1.0.0')).toBeInTheDocument();
  });

  it('renders AccountStatusPage without "Kebun Melon" in footer', () => {
    const { container } = render(
      <NextIntlClientProvider locale="id" messages={idMessages}>
        <AccountStatusPage />
      </NextIntlClientProvider>
    );

    expect(container.textContent).not.toContain('Kebun Melon');
    expect(screen.getByText('Secure Account Access Guard')).toBeInTheDocument();
  });
});
