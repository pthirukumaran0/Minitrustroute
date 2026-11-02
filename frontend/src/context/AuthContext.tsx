'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { UserRole } from '@/src/types/frontend';

export interface UserState {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organization: string;
  canSwitchRoles?: boolean;
}

interface AuthContextType {
  user: UserState | null;
  role: UserRole;
  token: string | null;
  loading: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (payload: { name: string; email: string; password: string; mobileNumber?: string }) => Promise<{ success: boolean; error?: string }>;
  switchPersona: (role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const DEFAULT_PERSONAS: Record<UserRole, UserState> = {
  sender: {
    id: 'sender-sarah-jenkins',
    name: 'Sarah Jenkins',
    email: 'sender@trustroute.com',
    role: 'sender',
    organization: 'Starlight Global Logistics LLC',
    canSwitchRoles: true,
  },
  analyst: {
    id: 'analyst-alex-rivera',
    name: 'Alex Rivera',
    email: 'analyst@trustroute.com',
    role: 'analyst',
    organization: 'TrustRoute Fraud Ops',
    canSwitchRoles: true,
  },
  admin: {
    id: 'admin-elena-rostova',
    name: 'Elena Rostova',
    email: 'admin@trustroute.com',
    role: 'admin',
    organization: 'TrustRoute Core Infrastructure',
    canSwitchRoles: true,
  },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>('sender');
  const [user, setUser] = useState<UserState | null>(DEFAULT_PERSONAS.sender);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Initialize session from localStorage and verify
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const savedToken = localStorage.getItem('trustroute_token');
        const savedRole = localStorage.getItem('trustroute_role') as UserRole | null;

        if (savedToken) {
          setToken(savedToken);
          // Verify with /api/auth/me
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${savedToken}` },
          });

          if (res.ok) {
            const data = await res.json();
            if (mounted && data.user) {
              const u: UserState = {
                id: data.user.id || data.user._id,
                name: data.user.name,
                email: data.user.email,
                role: data.user.role,
                organization: data.user.organization,
                canSwitchRoles: data.user.canSwitchRoles ?? true,
              };
              setUser(u);
              setRole(u.role);
              localStorage.setItem('trustroute_role', u.role);
              return;
            }
          }
        }

        // If no token or token expired/invalid, default to sender demo persona
        if (mounted) {
          const defaultRole: UserRole = savedRole && ['sender', 'analyst', 'admin'].includes(savedRole) ? savedRole : 'sender';
          setRole(defaultRole);
          setUser(DEFAULT_PERSONAS[defaultRole]);
        }
      } catch {
        if (mounted) {
          setRole('sender');
          setUser(DEFAULT_PERSONAS.sender);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initAuth();

    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.message || data.error || 'Authentication failed' };
      }

      const u: UserState = {
        id: data.user.id || data.user._id,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role,
        organization: data.user.organization,
        canSwitchRoles: Boolean(data.user.canSwitchRoles),
      };

      setToken(data.token);
      setUser(u);
      setRole(u.role);
      localStorage.setItem('trustroute_token', data.token);
      localStorage.setItem('trustroute_role', u.role);

      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  }, []);

  const register = useCallback(async (payload: { name: string; email: string; password: string; mobileNumber?: string }) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.message || data.error || 'Registration failed' };
      }

      const u: UserState = {
        id: data.user.id || data.user._id,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role,
        organization: data.user.organization,
        canSwitchRoles: Boolean(data.user.canSwitchRoles),
      };

      setToken(data.token);
      setUser(u);
      setRole(u.role);
      localStorage.setItem('trustroute_token', data.token);
      localStorage.setItem('trustroute_role', u.role);

      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  }, []);

  const switchPersona = useCallback(async (newRole: UserRole) => {
    try {
      setRole(newRole);
      const persona = DEFAULT_PERSONAS[newRole];
      setUser(persona);
      localStorage.setItem('trustroute_role', newRole);

      const res = await fetch('/api/auth/quick-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          setToken(data.token);
          localStorage.setItem('trustroute_token', data.token);
        }
        if (data.user) {
          setUser({
            id: data.user.id || data.user._id,
            name: data.user.name,
            email: data.user.email,
            role: data.user.role,
            organization: data.user.organization,
            canSwitchRoles: true,
          });
        }
      }
    } catch {
      // Offline fallback: state already updated
    }
  }, []);

  const logout = useCallback(async () => {
    const currentToken = token;
    setToken(null);
    setUser(null);
    localStorage.removeItem('trustroute_token');
    localStorage.removeItem('trustroute_role');

    if (currentToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentToken}`,
          },
        });
      } catch {
        // Continue logout even if server fails
      }
    }

    router.replace('/login');
  }, [token, router]);

  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      const headers = new Headers(options.headers || {});
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return fetch(url, { ...options, headers });
    },
    [token]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        token,
        loading,
        isLoading: loading,
        isAuthenticated: Boolean(token && user),
        login,
        register,
        switchPersona,
        logout,
        authFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
