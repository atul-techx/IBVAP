import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginUser, fetchAuthConfig, setAuthToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authDisabled, setAuthDisabled] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Check system authentication configuration on mount & restore session
  useEffect(() => {
    let isMounted = true;
    async function checkConfig() {
      try {
        // Restore session from sessionStorage if present
        const savedToken = sessionStorage.getItem('ibvap_token');
        const savedUserStr = sessionStorage.getItem('ibvap_user');
        if (savedToken && savedUserStr) {
          try {
            const savedUser = JSON.parse(savedUserStr);
            setAuthToken(savedToken);
            setToken(savedToken);
            setUser(savedUser);
          } catch (_) {}
        }

        const config = await fetchAuthConfig();
        if (isMounted) {
          if (config.auth_disabled) {
            setAuthDisabled(true);
            setUser({
              username: 'demo_admin',
              role: 'admin',
              full_name: 'Demo Admin (Bypass Mode)',
              auth_disabled: true,
            });
          }
        }
      } catch (err) {
        console.warn('[AUTH] Could not query auth config, assuming standard login active:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    checkConfig();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (username, password) => {
    setAuthError(null);
    try {
      const data = await loginUser(username, password);
      setUser(data.user);
      setToken(data.access_token);
      setAuthToken(data.access_token);
      try {
        sessionStorage.setItem('ibvap_token', data.access_token);
        sessionStorage.setItem('ibvap_user', JSON.stringify(data.user));
      } catch (_) {}
      return data.user;
    } catch (err) {
      setAuthError(err.message || 'Authentication failed');
      throw err;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setAuthToken(null);
    setAuthError(null);
    try {
      sessionStorage.removeItem('ibvap_token');
      sessionStorage.removeItem('ibvap_user');
    } catch (_) {}
  };

  const value = {
    user,
    token,
    isLoading,
    authDisabled,
    authError,
    isAuthenticated: Boolean(user || authDisabled),
    isAdmin: user?.role === 'admin' || authDisabled,
    isOperator: user?.role === 'operator',
    login,
    logout,
    clearError: () => setAuthError(null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
