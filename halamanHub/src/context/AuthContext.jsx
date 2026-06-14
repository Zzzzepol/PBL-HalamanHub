// ============================================================
// HalamanHub — Auth Context
// Manages JWT token + user state, persisted in localStorage.
// ============================================================
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, ApiError } from '../api/client';

const AuthContext = createContext(null);
const TOKEN_KEY = 'halamanhub_token';
const USER_KEY = 'halamanhub_user';

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(true);

  // On mount, verify any stored token is still valid
  useEffect(() => {
    let active = true;
    const verify = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const data = await authApi.verify(token);
        if (active) setUser(data.user);
      } catch {
        if (active) logout();
      } finally {
        if (active) setLoading(false);
      }
    };
    verify();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await authApi.login(username, password);
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data.user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  const value = {
    token,
    user,
    isAuthenticated: !!token && !!user,
    loading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export { ApiError };
