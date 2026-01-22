import api from './api';

const authService = {
  /**
   * Login user
   * @param {string} username
   * @param {string} password
   * @returns {Promise} User data and tokens
   */
  async login(username, password) {
    const response = await api.post('/auth/login/', { username, password });
    const { access, refresh, user } = response.data;

    // Store tokens and user data
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    localStorage.setItem('user', JSON.stringify(user));

    return { user, access, refresh };
  },

  /**
   * Logout user
   */
  logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
  },

  /**
   * Get current user from localStorage
   * @returns {Object|null}
   */
  getCurrentUser() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch (error) {
        console.error('Error parsing user data:', error);
        return null;
      }
    }
    return null;
  },

  /**
   * Check if user is authenticated
   * @returns {boolean}
   */
  isAuthenticated() {
    const token = localStorage.getItem('access_token');
    if (!token) return false;

    // Basic token validation (check if it looks like a JWT)
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        // Invalid token format, clear it
        this.logout();
        return false;
      }
      return true;
    } catch {
      this.logout();
      return false;
    }
  },

  /**
   * Clear all auth data (used when tokens are invalid)
   */
  clearAuth() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
  },

  /**
   * Refresh access token
   * @returns {Promise}
   */
  async refreshToken() {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await api.post('/auth/refresh/', {
      refresh: refreshToken,
    });

    const { access } = response.data;
    localStorage.setItem('access_token', access);

    return access;
  },
};

export default authService;
