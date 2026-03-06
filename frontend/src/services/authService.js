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

    // Store tokens only (user profile is fetched from /users/me when needed)
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    }

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
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
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
   * Fetch current user profile from backend
   * @returns {Promise<Object>}
   */
  async fetchMe() {
    const response = await api.get('/users/me/');
    if (response.data) {
      localStorage.setItem('user', JSON.stringify(response.data));
    }
    return response.data;
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

  /**
   * Change user password (no JWT required — authenticates via username + current password)
   * @param {string} username
   * @param {string} currentPassword
   * @param {string} newPassword
   * @param {string} confirmPassword
   * @returns {Promise<{message: string}>}
   */
  async changePassword(username, currentPassword, newPassword, confirmPassword) {
    const response = await api.post('/auth/change-password/', {
      username,
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    });
    return response.data;
  },

  /**
   * Get signup metadata (roles + sections + subsections)
   * @returns {Promise<{roles: Array, sections: Array}>}
   */
  async getSignupMetadata() {
    const response = await api.get('/auth/signup-metadata/');
    return response.data;
  },

  /**
   * Submit signup request for superuser approval
   * @param {Object} payload
   * @returns {Promise<{message: string, status: string}>}
   */
  async signup(payload) {
    const response = await api.post('/auth/signup/', payload);
    return response.data;
  },
};

export default authService;
