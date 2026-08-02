const SESSION_PREFIX = 'safe-evaluate-job:';

export function saveJobSession(jobId, token, expiresAt) {
  sessionStorage.setItem(
    `${SESSION_PREFIX}${jobId}`,
    JSON.stringify({ token, expiresAt }),
  );
}

export function getJobSession(jobId) {
  const raw = sessionStorage.getItem(`${SESSION_PREFIX}${jobId}`);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw);
    if (!session.token) return null;
    if (session.expiresAt && Date.parse(session.expiresAt) <= Date.now()) {
      clearJobSession(jobId);
      return null;
    }
    return session;
  } catch {
    clearJobSession(jobId);
    return null;
  }
}

export function getJobToken(jobId) {
  return getJobSession(jobId)?.token || '';
}

export function clearJobSession(jobId) {
  sessionStorage.removeItem(`${SESSION_PREFIX}${jobId}`);
}

