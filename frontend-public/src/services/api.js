import axios from 'axios';
import { getJobToken } from './jobSession';

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

function jobHeaders(jobId) {
  const token = getJobToken(jobId);
  if (!token) {
    throw new Error('任务访问凭证已丢失，请重新创建评估');
  }
  return { 'X-Job-Token': token };
}

export function createPublicJob(goal) {
  return api.post('/jobs', { goal });
}

export function uploadJobFiles(jobId, kind, files) {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  return api.post(`/jobs/${jobId}/files/${kind}`, formData, {
    headers: { ...jobHeaders(jobId), 'Content-Type': 'multipart/form-data' },
    timeout: 300000,
  });
}

export function uploadJobTemplates(jobId, files) {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  return api.post(`/jobs/${jobId}/templates`, formData, {
    headers: { ...jobHeaders(jobId), 'Content-Type': 'multipart/form-data' },
    timeout: 300000,
  });
}

export function getPublicJob(jobId) {
  return api.get(`/jobs/${jobId}`, { headers: jobHeaders(jobId) });
}

export function getTemplateParseResult(jobId, templateId) {
  return api.get(`/jobs/${jobId}/templates/${templateId}/parse-result`, {
    headers: jobHeaders(jobId),
  });
}

export function confirmTemplateFields(jobId, templateId, fields, previewMetadata) {
  return api.put(
    `/jobs/${jobId}/templates/${templateId}/fields`,
    { fields, preview_metadata: previewMetadata },
    { headers: jobHeaders(jobId) },
  );
}

export function startPublicEvaluation(jobId) {
  return api.post(`/jobs/${jobId}/evaluate`, null, {
    headers: jobHeaders(jobId),
  });
}

export function updateDocumentFields(jobId, documentId, fields) {
  return api.put(
    `/jobs/${jobId}/documents/${documentId}/fields`,
    { fields },
    { headers: jobHeaders(jobId) },
  );
}

export function regenerateDocumentField(jobId, documentId, fieldKey, instruction = '') {
  return api.post(
    `/jobs/${jobId}/documents/${documentId}/fields/${fieldKey}/regenerate`,
    { instruction },
    { headers: jobHeaders(jobId), timeout: 300000 },
  );
}

export function finalizeDocument(jobId, documentId) {
  return api.post(`/jobs/${jobId}/documents/${documentId}/finalize`, null, {
    headers: jobHeaders(jobId),
    timeout: 300000,
  });
}

export function downloadArtifact(jobId, fileId) {
  return api.get(`/jobs/${jobId}/artifacts/${fileId}`, {
    headers: jobHeaders(jobId),
    responseType: 'blob',
  });
}

export function downloadArtifactArchive(jobId) {
  return api.post(`/jobs/${jobId}/artifacts/archive`, null, {
    headers: jobHeaders(jobId),
    responseType: 'blob',
  });
}
