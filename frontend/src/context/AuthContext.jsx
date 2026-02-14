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
    const initializeAuth = async () => {
      try {
        const hasToken = authService.isAuthenticated();

        if (hasToken) {
          try {
            const currentUser = await authService.fetchMe();
            if (currentUser?.id && currentUser?.username && currentUser?.role) {
              setUser(currentUser);
            } else {
              authService.clearAuth();
            }
          } catch (fetchError) {
            console.warn('Token exists but profile fetch failed, clearing auth');
            authService.clearAuth();
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        authService.clearAuth();
      }
      setLoading(false);
    };

    initializeAuth();
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
      const { user: loginUser } = await authService.login(username, password);
      if (loginUser?.id && loginUser?.username && loginUser?.role) {
        setUser(loginUser);
      } else {
        const refreshedUser = await authService.fetchMe();
        setUser(refreshedUser);
      }
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);

      // Handle different error scenarios
      let errorMessage = 'Login failed. Please check your credentials.';

      if (error.response) {
        // Server responded with error
        const status = error.response.status;
        const data = error.response.data;

        if (status === 401) {
          errorMessage = data?.detail || 'Invalid username or password.';
        } else if (status === 400) {
          errorMessage = data?.detail || 'Invalid login request.';
        } else if (status === 500) {
          errorMessage = 'Server error. Please try again later.';
        } else {
          errorMessage = data?.detail || `Error: ${status}`;
        }
      } else if (error.request) {
        // No response received
        errorMessage = 'Cannot connect to server. Please check your connection.';
      }

      return { success: false, error: errorMessage };
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
    // Only AG can create mails (DAG permission removed as per requirements)
    return user?.role === 'AG';
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
