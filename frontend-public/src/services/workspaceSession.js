const SESSION_PREFIX = 'safe-evaluate-workspace:';
const CURRENT_KEY = 'safe-evaluate-current-workspace';

export function saveWorkspaceSession(workspaceId, token, name = '', confirmed = false) {
  if (!confirmed) return false;
  localStorage.setItem(
    `${SESSION_PREFIX}${workspaceId}`,
    JSON.stringify({ token, name, savedAt: new Date().toISOString() }),
  );
  localStorage.setItem(CURRENT_KEY, workspaceId);
  return true;
}

export function getWorkspaceSession(workspaceId) {
  const raw = localStorage.getItem(`${SESSION_PREFIX}${workspaceId}`);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw);
    return session?.token ? session : null;
  } catch {
    clearWorkspaceSession(workspaceId);
    return null;
  }
}

export function getWorkspaceToken(workspaceId) {
  return getWorkspaceSession(workspaceId)?.token || '';
}

export function getCurrentWorkspaceId() {
  return localStorage.getItem(CURRENT_KEY) || '';
}

export function clearWorkspaceSession(workspaceId) {
  localStorage.removeItem(`${SESSION_PREFIX}${workspaceId}`);
  if (localStorage.getItem(CURRENT_KEY) === workspaceId) {
    localStorage.removeItem(CURRENT_KEY);
  }
}
