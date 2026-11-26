'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import type { ApiOptions } from '@/lib/api';
import type { AuthResponse, User } from '@/lib/types';

interface AuthContextValue {
  user: User | null;
  reason: 'expired' | null;
  signIn: (response: AuthResponse) => void;
  logout: () => void;
  request: <T>(path: string, options?: Omit<ApiOptions, 'token'>) => Promise<T>;
}

interface Session {
  token: string;
  user: User;
  expiresAt: number;
}
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [reason, setReason] = useState<'expired' | null>(null);
  const current = useRef<Session | null>(null);

  const expire = useCallback((token: string) => {
    // A delayed 401 from an old request must not sign out a newer session.
    if (current.current?.token !== token) return;
    current.current = null;
    setSession(null);
    setReason('expired');
  }, []);

  const signIn = useCallback((response: AuthResponse) => {
    if (
      !response.accessToken ||
      !response.user?.id ||
      !Number.isFinite(response.expiresIn) ||
      response.expiresIn <= 0
    ) {
      throw new Error('Invalid authentication response');
    }
    const next = {
      token: response.accessToken,
      user: {
        id: response.user.id,
        email: response.user.email,
        createdAt: response.user.createdAt,
      },
      expiresAt: Date.now() + response.expiresIn * 1000,
    };
    current.current = next;
    setSession(next);
    setReason(null);
  }, []);

  const logout = useCallback(() => {
    current.current = null;
    setSession(null);
    setReason(null);
  }, []);

  const request = useCallback(
    async <T,>(
      path: string,
      options: Omit<ApiOptions, 'token'> = {},
    ): Promise<T> => {
      const active = current.current;
      if (!active) throw new ApiError(401, 'Silakan masuk untuk melanjutkan.');
      try {
        return await apiFetch<T>(path, { ...options, token: active.token });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401)
          expire(active.token);
        throw error;
      }
    },
    [expire],
  );

  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(
      () => expire(session.token),
      Math.max(0, session.expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [session, expire]);

  const value = useMemo(
    () => ({ user: session?.user ?? null, reason, signIn, logout, request }),
    [session, reason, signIn, logout, request],
  );
  // Deliberately no cookies, localStorage, sessionStorage or server session.
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
