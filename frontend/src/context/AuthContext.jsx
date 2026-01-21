import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Clear auth state - exposed for api interceptor
  const clearAuth = useCallback(() => {
    authService.logout();
    setUser(null);
  }, []);

  useEffect(() => {
    // Initialize auth state from localStorage
    const currentUser = authService.getCurrentUser();
    const hasToken = authService.isAuthenticated();

    if (currentUser && hasToken) {
      setUser(currentUser);
    }
    // Always set loading to false immediately
    setLoading(false);
  }, []);

  // Listen for storage events (logout from another tab)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'access_token' && !e.newValue) {
        setUser(null);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const login = async (username, password) => {
    try {
      const { user: userData } = await authService.login(username, password);
      setUser(userData);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Login failed. Please check your credentials.',
      };
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  const hasRole = (role) => {
    return user?.role === role;
  };

  const canCreateMail = () => {
    return user?.role === 'AG' || user?.role === 'DAG';
  };

  const canViewAllMails = () => {
    return user?.role === 'AG';
  };

  const canReopen = () => {
    return user?.role === 'AG';
  };

  const value = {
    user,
    loading,
    login,
    logout,
    hasRole,
    canCreateMail,
    canViewAllMails,
    canReopen,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
