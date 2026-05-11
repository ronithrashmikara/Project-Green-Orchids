'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { setAccessToken, clearAccessToken, getAccessToken } from './api';

const AuthContext = createContext(null);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [permissions, setPermissions] = useState([]);

  const refreshSession = useCallback(async () => {
    try {
      const res = await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true });
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
      `${API_URL}/auth/login`,
      { email, password },
      { withCredentials: true }
    );
    const { accessToken, user: userData } = res.data;
    setAccessToken(accessToken);
    setUser(userData);
    setPermissions(userData.permissions || []);
    return userData;
  }, []);

  const logout = useCallback(async () => {
    try {
      await axios.post(`${API_URL}/auth/logout`, {}, { withCredentials: true });
    } catch {
      // Ignore
    }
    clearAccessToken();
    setUser(null);
    setPermissions([]);
  }, []);

  const value = useMemo(
    () => ({ user, permissions, login, logout, refreshSession, isLoading }),
    [user, permissions, login, logout, refreshSession, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
