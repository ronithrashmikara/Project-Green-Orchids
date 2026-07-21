'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { setAccessToken, clearAccessToken, ensureCsrfToken } from './api';

const AuthContext = createContext(null);

async function sameOriginHeaders() {
  return {
    'X-Requested-With': 'XMLHttpRequest',
    'X-CSRF-Token': await ensureCsrfToken(),
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [permissions, setPermissions] = useState([]);

  const refreshSession = useCallback(async () => {
    try {
      const res = await axios.post('/api/auth/refresh', {}, {
        withCredentials: true,
        headers: await sameOriginHeaders(),
      });
      const { accessToken, user: userData } = res.data;
      setAccessToken(accessToken);
      setUser(userData);
      setPermissions(userData.permissions || []);
      return userData;
    } catch {
      clearAccessToken();
      setUser(null);
      setPermissions([]);
      return null;
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await refreshSession();
      } catch {
        // No session
      } finally {
        setIsLoading(false);
      }
    })();
  }, [refreshSession]);

  const login = useCallback(async (email, password) => {
    const res = await axios.post(
      '/api/auth/login',
      { email, password },
      { withCredentials: true, headers: await sameOriginHeaders() }
    );
    const { accessToken, user: userData } = res.data;
    setAccessToken(accessToken);
    setUser(userData);
    setPermissions(userData.permissions || []);
    return userData;
  }, []);

  const logout = useCallback(async () => {
    try {
      await axios.post('/api/auth/logout', {}, {
        withCredentials: true,
        headers: await sameOriginHeaders(),
      });
    } catch {
      // Ignore
    }
    clearAccessToken();
    setUser(null);
    setPermissions([]);
  }, []);

  // Merges partial updates (e.g. a freshly-uploaded avatarUrl) into the current user object
  // without requiring a full refreshSession() round-trip.
  const updateUser = useCallback((updates) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : prev));
  }, []);

  const value = useMemo(
    () => ({ user, permissions, login, logout, refreshSession, updateUser, isLoading }),
    [user, permissions, login, logout, refreshSession, updateUser, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
