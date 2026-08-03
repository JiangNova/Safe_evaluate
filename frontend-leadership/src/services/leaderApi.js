import axios from 'axios';

const SESSION_KEY = 'leadership-assistant:v2:session';

export function getLeadershipSession() {
  try {
    const value = JSON.parse(globalThis.localStorage?.getItem(SESSION_KEY) || 'null');
    return value?.token && value?.username ? value : null;
  } catch {
    return null;
  }
}

export function saveLeadershipSession(session) {
  const saved = { token: session.token, username: session.user.username, role: session.user.role };
  globalThis.localStorage?.setItem(SESSION_KEY, JSON.stringify(saved));
  return saved;
}

export function clearLeadershipSession() {
  globalThis.localStorage?.removeItem(SESSION_KEY);
}

const client = axios.create({
  baseURL: '/api/ai-writing',
  timeout: 300000,
});

client.interceptors.request.use((config) => {
  const session = getLeadershipSession();
  if (session?.token) config.headers.Authorization = `Bearer ${session.token}`;
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && !error?.config?.url?.includes('/auth/login')) {
      clearLeadershipSession();
      globalThis.location?.assign?.('/ai-writing/');
    }
    return Promise.reject(error);
  },
);

export async function loginLeadershipUser({ username, password }) {
  const response = await client.post('/auth/login', { username, password });
  return saveLeadershipSession(response.data);
}

function appendFiles(formData, files = []) {
  Array.from(files).forEach((file) => formData.append('files', file));
}

export async function generateDocument({ profile, taskType, requirement, files = [] }) {
  const formData = new FormData();
  formData.append('profile', JSON.stringify(profile));
  formData.append('task_type', taskType);
  formData.append('requirement', requirement);
  appendFiles(formData, files);

  const response = await client.post('/generate', formData);
  return response.data;
}

export async function reviseDocument({
  profile,
  taskType,
  requirement,
  title,
  contentMarkdown,
  warnings = [],
  revisionInstruction,
}) {
  const response = await client.post('/revise', {
    profile,
    task_type: taskType,
    requirement,
    title,
    content_markdown: contentMarkdown,
    warnings,
    revision_instruction: revisionInstruction,
  });
  return response.data;
}

function filenameFromDisposition(contentDisposition) {
  const encodedMatch = contentDisposition?.match(/filename\*=UTF-8''([^;]+)/i);
  if (encodedMatch) return decodeURIComponent(encodedMatch[1]);

  const filenameMatch = contentDisposition?.match(/filename="?([^";]+)"?/i);
  return filenameMatch?.[1] ?? '领导文稿.docx';
}

export async function downloadDocument({ title, contentMarkdown }) {
  const response = await client.post(
    '/export/docx',
    { title, content_markdown: contentMarkdown },
    { responseType: 'blob' },
  );
  const blob = new Blob([response.data], {
    type: response.headers['content-type'] ?? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filenameFromDisposition(response.headers['content-disposition']);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
