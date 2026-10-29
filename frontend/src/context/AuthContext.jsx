import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const AuthContext = createContext(null);

const STORAGE_KEY = 'veritas_auth';

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveStored(data) {
  try {
    if (data) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

// Decode JWT payload without verification (client-side only — just for expiry check)
function jwtExpiry(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000; // ms
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => loadStored());
  const refreshTimerRef = useRef(null);

  const clearAuth = useCallback(() => {
    setAuth(null);
    saveStored(null);
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
  }, []);

  const setAuthData = useCallback((data) => {
    setAuth(data);
    saveStored(data);
  }, []);

  // Auto-refresh the access token 60 s before expiry
  const scheduleRefresh = useCallback((accessToken, refreshToken) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const exp = jwtExpiry(accessToken);
    if (!exp) return;
    const delay = Math.max(0, exp - Date.now() - 60_000);
    refreshTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!res.ok) { clearAuth(); return; }
        const data = await res.json();
        setAuth(prev => {
          if (!prev) return prev;
          const next = { ...prev, access_token: data.access_token };
          saveStored(next);
          scheduleRefresh(data.access_token, prev.refresh_token);
          return next;
        });
      } catch {
        clearAuth();
      }
    }, delay);
  }, [clearAuth]);

  useEffect(() => {
    if (auth?.access_token) {
      scheduleRefresh(auth.access_token, auth.refresh_token);
    }
    return () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (email, password) => {
    const res = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.detail || 'Login failed');
    // Decode role from token payload
    const payload = JSON.parse(atob(body.access_token.split('.')[1]));
    const data = { ...body, user_id: payload.sub, email: payload.email, role: payload.role };
    setAuthData(data);
    scheduleRefresh(body.access_token, body.refresh_token);
    return data;
  }, [setAuthData, scheduleRefresh]);

  const register = useCallback(async (email, username, password) => {
    const res = await fetch('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.detail || 'Registration failed');
    const payload = JSON.parse(atob(body.access_token.split('.')[1]));
    const data = { ...body, user_id: payload.sub, email: payload.email, role: payload.role };
    setAuthData(data);
    scheduleRefresh(body.access_token, body.refresh_token);
    return data;
  }, [setAuthData, scheduleRefresh]);

  const logout = useCallback(async () => {
    if (auth?.refresh_token) {
      try {
        await fetch('/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: auth.refresh_token }),
        });
      } catch {}
    }
    clearAuth();
  }, [auth, clearAuth]);

  return (
    <AuthContext.Provider value={{
      user: auth ? { user_id: auth.user_id, email: auth.email, role: auth.role } : null,
      token: auth?.access_token ?? null,
      isAuthenticated: !!auth?.access_token,
      login,
      register,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
