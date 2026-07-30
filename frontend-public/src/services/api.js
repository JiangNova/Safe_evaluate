import axios from 'axios';

const api = axios.create({
  baseURL: '/api/public',
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export function submitEvaluation(formData) {
  return api.post('/evaluate', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000,
  });
}

export function getReport(id) {
  return api.get(`/reports/${id}`);
}

export function getRules() {
  return api.get('/rules');
}

