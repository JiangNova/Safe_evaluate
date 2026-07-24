import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// ===== Auth APIs =====
export function loginApi(username, password) {
  return api.post('/auth/login', { username, password });
}

// ===== Evaluate APIs =====
export function submitEvaluation(formData) {
  return api.post('/evaluate', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000,  // 5 min — covers retry + fallback cycles
  });
}

// ===== Report APIs =====
export function getReport(id) {
  return api.get(`/reports/${id}`);
}

// ===== History APIs =====
export function getHistoryList(page = 1, pageSize = 10) {
  return api.get('/reports', { params: { page, page_size: pageSize } });
}

// ===== Rules APIs =====
export function getRules(category = '') {
  return api.get('/rules', { params: { category } });
}

export function createRule(data) {
  return api.post('/rules', data);
}

export function updateRule(id, data) {
  return api.put(`/rules/${id}`, data);
}

export function deleteRule(id) {
  return api.delete(`/rules/${id}`);
}

export function parseRulePdf(file) {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/rules/parse-pdf', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  });
}

// ===== Stats APIs =====
export function getStats() {
  return api.get('/stats');
}
