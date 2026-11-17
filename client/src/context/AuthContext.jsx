import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, {
  clearStoredToken,
  getStoredToken,
  setStoredToken,
  setUnauthorizedHandler,
} from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children, initialUser = null, initialToken = null }) {
  const [token, setToken] = useState(() => initialToken || getStoredToken());
  const [user, setUser] = useState(initialUser);
  const [loading, setLoading] = useState(() => (initialUser ? false : Boolean(getStoredToken())));

  // Bootstrap user profile via GET /api/auth/me if token exists in localStorage
  useEffect(() => {
    let isMounted = true;
    if (initialUser) return undefined;

    async function bootstrap() {
      const stored = getStoredToken();
      if (!stored) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const res = await api.get('/auth/me');
        if (isMounted) {
          setUser(res.data.user);
          setToken(stored);
        }
      } catch {
        if (isMounted) {
          clearStoredToken();
          setToken(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, [initialUser]);

  const login = useCallback(async ({ email, password }) => {
    const res = await api.post('/auth/login', { email, password });
    const { token: nextToken, user: nextUser } = res.data;
    setStoredToken(nextToken);
    setToken(nextToken);
    setUser(nextUser);
    return res.data;
  }, []);

  const register = useCallback(async ({ name, email, password }) => {
    const res = await api.post('/auth/register', { name, email, password });
    const { token: nextToken, user: nextUser } = res.data;
    setStoredToken(nextToken);
    setToken(nextToken);
    setUser(nextUser);
    return res.data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore network errors on stateless logout
    } finally {
      clearStoredToken();
      setToken(null);
      setUser(null);
    }
  }, []);

  const setSession = useCallback((nextToken, nextUser = null) => {
    setStoredToken(nextToken);
    setToken(nextToken || null);
    setUser(nextUser);
  }, []);

  // Wire 401 interceptor to immediately clear state in React
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearStoredToken();
      setToken(null);
      setUser(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token && user),
      loading,
      login,
      register,
      logout,
      setSession,
    }),
    [user, token, loading, login, register, logout, setSession],
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
