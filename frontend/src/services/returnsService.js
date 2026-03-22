import api from './api';

const returnsService = {
  async getDashboard({ year, month, section } = {}) {
    const params = new URLSearchParams();
    if (year) params.append('year', year);
    if (month) params.append('month', month);
    if (section) params.append('section', section);

    const response = await api.get(`/returns/?${params.toString()}`);
    return response.data;
  },

  async getHistory({ year, month, section } = {}) {
    const params = new URLSearchParams();
    if (year) params.append('year', year);
    if (month) params.append('month', month);
    if (section) params.append('section', section);

    const response = await api.get(`/returns/history/?${params.toString()}`);
    return response.data;
  },

  async getDelaySummary({ year, month, section, months = 6 } = {}) {
    const params = new URLSearchParams();
    if (year) params.append('year', year);
    if (month) params.append('month', month);
    if (section) params.append('section', section);
    if (months) params.append('months', months);

    const response = await api.get(`/returns/delay-summary/?${params.toString()}`);
    return response.data;
  },

  async submitReturnEntry(id) {
    const response = await api.post(`/returns/${id}/submit/`);
    return response.data;
  },
};

export default returnsService;

