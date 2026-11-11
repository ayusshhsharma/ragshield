import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearStoredToken,
  getStoredToken,
  redirectToLogin,
  setStoredToken,
  setUnauthorizedHandler,
} from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getStoredToken());
  const [user, setUser] = useState(null);
  const [loading] = useState(false);

  const logout = useCallback(() => {
    clearStoredToken();
    setToken(null);
    setUser(null);
    redirectToLogin();
  }, []);

  const setSession = useCallback((nextToken, nextUser = null) => {
    setStoredToken(nextToken);
    setToken(nextToken || null);
    setUser(nextUser);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearStoredToken();
      setToken(null);
      setUser(null);
      redirectToLogin();
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token),
      loading,
      setSession,
      logout,
    }),
    [user, token, loading, setSession, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
