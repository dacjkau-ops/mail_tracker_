import api from './api';

const mailService = {
  /**
   * Get all mails (filtered by user permissions on backend)
   * @param {Object} filters - Query parameters for filtering
   * @returns {Promise}
   */
  async getAllMails(filters = {}) {
    const params = new URLSearchParams();

    if (filters.status) params.append('status', filters.status);
    if (filters.section) params.append('section', filters.section);
    if (filters.assigned_to) params.append('assigned_to', filters.assigned_to);
    if (filters.search) params.append('search', filters.search);

    const response = await api.get(`/records/?${params.toString()}`);
    // Handle paginated response
    return response.data.results || response.data;
  },

  /**
   * Get single mail by ID
   * @param {string} id - Mail ID
   * @returns {Promise}
   */
  async getMailById(id) {
    const response = await api.get(`/records/${id}/`);
    return response.data;
  },

  /**
   * Create new mail
   * @param {Object} mailData
   * @returns {Promise}
   */
  async createMail(mailData) {
    const response = await api.post('/records/', mailData);
    return response.data;
  },

  /**
   * Update mail remarks
   * @param {string} id - Mail ID
   * @param {string} remarks
   * @returns {Promise}
   */
  async updateRemarks(id, remarks) {
    const response = await api.patch(`/records/${id}/`, { remarks });
    return response.data;
  },

  /**
   * Reassign mail
   * @param {string} id - Mail ID
   * @param {Object} data - { new_handler, remarks }
   * @returns {Promise}
   */
  async reassignMail(id, data) {
    const response = await api.post(`/records/${id}/reassign/`, data);
    return response.data;
  },

  /**
   * Close mail
   * @param {string} id - Mail ID
   * @param {string} remarks
   * @returns {Promise}
   */
  async closeMail(id, remarks) {
    const response = await api.post(`/records/${id}/close/`, { remarks });
    return response.data;
  },

  /**
   * Reopen closed mail (AG only)
   * @param {string} id - Mail ID
   * @param {string} remarks
   * @returns {Promise}
   */
  async reopenMail(id, remarks) {
    const response = await api.post(`/records/${id}/reopen/`, { remarks });
    return response.data;
  },

  /**
   * Get audit trail for a mail
   * @param {string} id - Mail ID
   * @returns {Promise}
   */
  async getAuditTrail(id) {
    const response = await api.get(`/audit/?mail_record=${id}`);
    // Handle paginated response
    return response.data.results || response.data;
  },

  /**
   * Get all sections
   * @returns {Promise<Array>}
   */
  async getSections() {
    const response = await api.get('/sections/');
    // Handle paginated response
    return response.data.results || response.data;
  },

  /**
   * Get all users (filtered by role permissions on backend)
   * @returns {Promise<Array>}
   */
  async getUsers() {
    const response = await api.get('/users/');
    // Handle paginated response
    return response.data.results || response.data;
  },
};

export default mailService;
