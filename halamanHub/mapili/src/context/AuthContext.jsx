import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { customerAuthApi, ApiError, setSessionExpiredHandler } from '../api/client';

const AuthContext = createContext(null);
const TOKEN_KEY = 'mapili_token';
const USER_KEY  = 'mapili_user';

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user,  setUser]  = useState(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const verify = async () => {
      if (!token) { setLoading(false); return; }
      try {
        const data = await customerAuthApi.verify(token);
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

  const login = useCallback(async (email, password) => {
    const data = await customerAuthApi.login({ email, password });
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data.user;
  }, []);

  // Shared by Google sign-in and onboarding completion — both hand back a
  // {token, user} pair from the backend the same way login()/register() do.
  const setSession = useCallback((data) => {
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data.user;
  }, []);

  const loginWithGoogle = useCallback(async (credential) => {
    const data = await customerAuthApi.google(credential);
    return setSession(data);
  }, [setSession]);

  const completeProfile = useCallback(async (formData) => {
    const data = await customerAuthApi.completeProfile(formData, token);
    return setSession(data);
  }, [setSession, token]);

  const register = useCallback(async (formData) => {
    const data = await customerAuthApi.register(formData);
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

  // Any API call anywhere in the app that gets a 401 with a token attached
  // (i.e. an expired/invalid session, not just a failed login attempt)
  // routes through here — one place to log out and let ProtectedRoute's
  // existing redirect-to-/login handle the rest.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      logout();
    });
    return () => setSessionExpiredHandler(null);
  }, [logout]);

  const updateUser = useCallback((updated) => {
    setUser(updated);
    localStorage.setItem(USER_KEY, JSON.stringify(updated));
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, isAuthenticated: !!token && !!user, loading, login, register, loginWithGoogle, completeProfile, logout, updateUser, ApiError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
