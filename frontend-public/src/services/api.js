import axios from 'axios';
import { getJobToken } from './jobSession';
import { getWorkspaceToken } from './workspaceSession';

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

function workspaceHeaders(workspaceId) {
  const token = getWorkspaceToken(workspaceId);
  if (!token) throw new Error('工作区访问凭证已丢失，请使用恢复码重新进入');
  return { 'X-Workspace-Token': token };
}

export function createWorkspace(name) {
  return api.post('/workspaces', { name });
}

export function recoverWorkspace(workspaceId, recoverySecret) {
  return api.post('/workspaces/recover', {
    workspace_id: workspaceId,
    recovery_secret: recoverySecret,
  });
}

export function getWorkspace(workspaceId) {
  return api.get(`/workspaces/${workspaceId}`, { headers: workspaceHeaders(workspaceId) });
}

export function listWorkspaceAssets(workspaceId, assetType) {
  return api.get(`/workspaces/${workspaceId}/assets`, {
    headers: workspaceHeaders(workspaceId),
    params: assetType ? { asset_type: assetType } : {},
  });
}

export function createWorkspaceAsset(workspaceId, payload) {
  return api.post(`/workspaces/${workspaceId}/assets`, payload, { headers: workspaceHeaders(workspaceId) });
}

export function deleteWorkspaceAsset(workspaceId, assetId) {
  return api.delete(`/workspaces/${workspaceId}/assets/${assetId}`, { headers: workspaceHeaders(workspaceId) });
}

export function listAssetVersions(workspaceId, assetId) {
  return api.get(`/workspaces/${workspaceId}/assets/${assetId}/versions`, { headers: workspaceHeaders(workspaceId) });
}

export function createAssetTextVersion(workspaceId, assetId, payload) {
  return api.post(`/workspaces/${workspaceId}/assets/${assetId}/versions/text`, payload, { headers: workspaceHeaders(workspaceId) });
}

export function createAssetFileVersion(workspaceId, assetId, file) {
  const formData = new FormData();
  formData.append('file', file);
  return api.post(`/workspaces/${workspaceId}/assets/${assetId}/versions/file`, formData, {
    headers: { ...workspaceHeaders(workspaceId), 'Content-Type': 'multipart/form-data' },
    timeout: 300000,
  });
}

export function listWorkspaceScenarios(workspaceId) {
  return api.get(`/workspaces/${workspaceId}/scenarios`, { headers: workspaceHeaders(workspaceId) });
}

export function createWorkspaceScenario(workspaceId, payload) {
  return api.post(`/workspaces/${workspaceId}/scenarios`, payload, { headers: workspaceHeaders(workspaceId) });
}

export function deleteWorkspaceScenario(workspaceId, scenarioId) {
  return api.delete(`/workspaces/${workspaceId}/scenarios/${scenarioId}`, { headers: workspaceHeaders(workspaceId) });
}

export function createScenarioJob(workspaceId, scenarioId) {
  return api.post(`/workspaces/${workspaceId}/scenarios/${scenarioId}/jobs`, null, { headers: workspaceHeaders(workspaceId) });
}

export function createCustomWorkspaceJob(workspaceId, goal, basisVersionIds, templateVersionIds) {
  return api.post(`/workspaces/${workspaceId}/jobs`, {
    goal,
    basis_version_ids: basisVersionIds,
    template_version_ids: templateVersionIds,
  }, { headers: workspaceHeaders(workspaceId) });
}

export function addJobTextResource(jobId, resourceKind, sourceText, name) {
  return api.post(`/jobs/${jobId}/resources/text`, {
    resource_kind: resourceKind,
    source_text: sourceText,
    name,
  }, { headers: jobHeaders(jobId) });
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
