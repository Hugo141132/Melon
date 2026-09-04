import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import UsersLoading from '@/app/users/loading';
import { DeviceProvider } from '@/context/DeviceContext';
import { AuthProvider } from '@/context/AuthContext';

const mockOwnerSession = {
  id: 'user-001',
  email: 'owner@kebunmelon.com',
  name: 'Owner Kebun',
  accountStatus: 'ACTIVE',
  activeRoles: ['OWNER' as const],
  createdAt: '2026-01-01T00:00:00Z',
};

describe('Users Page Loading & Layout Stability Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders route-level instant loading shell (loading.tsx) with structural parity', () => {
    render(
      <AuthProvider initialSession={mockOwnerSession as any}>
        <DeviceProvider>
          <UsersLoading />
        </DeviceProvider>
      </AuthProvider>
    );

    // Shell container
    expect(screen.getByTestId('users-loading-shell')).toBeInTheDocument();

    // Header skeleton section
    expect(screen.getByTestId('users-loading-header')).toBeInTheDocument();

    // Filters and controls skeleton section
    expect(screen.getByTestId('users-loading-filters')).toBeInTheDocument();

    // Table skeleton section
    expect(screen.getByTestId('users-loading-table')).toBeInTheDocument();
  });
});
