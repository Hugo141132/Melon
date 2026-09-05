'use client';

import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import type { AuthenticatedUserSession } from '@/lib/auth/rbac';
import { UserRole } from '@kebun-melon/contracts';

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthenticatedUserSession | null;
  role: UserRole | null;
  setUser?: (user: AuthenticatedUserSession | null) => void;
  updateUser?: (fields: Partial<AuthenticatedUserSession>) => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({
  children,
  initialSession,
}: {
  children: ReactNode;
  initialSession: AuthenticatedUserSession | null;
}) {
  const [session, setSession] = useState<AuthenticatedUserSession | null>(initialSession);

  useEffect(() => {
    // Only synchronize if initialSession is provided;
    // do not allow stale initialSession=null from background layout passes
    // to overwrite an already authenticated client state.
    if (initialSession !== null) {
      setSession(initialSession);
    }
  }, [initialSession]);

  const setUser = (newUser: AuthenticatedUserSession | null) => {
    setSession(newUser);
  };

  const updateUser = (fields: Partial<AuthenticatedUserSession>) => {
    setSession((prev) => (prev ? { ...prev, ...fields } : null));
  };

  const value: AuthState = {
    isAuthenticated: !!session,
    user: session,
    role: session?.activeRoles?.[0] ?? null,
    setUser,
    updateUser,
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
