import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import DevicesLoading from '@/app/devices/loading';
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

describe('Devices Page Loading & Layout Stability Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders route-level instant loading shell (loading.tsx) with structural parity', () => {
    render(
      <AuthProvider initialSession={mockOwnerSession as any}>
        <DeviceProvider>
          <DevicesLoading />
        </DeviceProvider>
      </AuthProvider>
    );

    // Shell container
    expect(screen.getByTestId('devices-loading-shell')).toBeInTheDocument();

    // Header skeleton section
    expect(screen.getByTestId('devices-loading-header')).toBeInTheDocument();

    // Filters and controls skeleton section
    expect(screen.getByTestId('devices-loading-filters')).toBeInTheDocument();

    // Grid skeleton section with 4 placeholder cards
    const grid = screen.getByTestId('devices-loading-grid');
    expect(grid).toBeInTheDocument();
    expect(grid.children).toHaveLength(4);
  });
});
