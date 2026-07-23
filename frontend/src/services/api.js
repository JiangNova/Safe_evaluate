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
