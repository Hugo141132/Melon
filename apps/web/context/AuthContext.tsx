'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import type { AuthenticatedUserSession } from '@/lib/auth/rbac';
import { UserRole } from '@kebun-melon/contracts';

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthenticatedUserSession | null;
  role: UserRole | null;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({
  children,
  initialSession,
}: {
  children: ReactNode;
  initialSession: AuthenticatedUserSession | null;
}) {
  const value: AuthState = {
    isAuthenticated: !!initialSession,
    user: initialSession,
    role: initialSession?.activeRoles?.[0] ?? null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
