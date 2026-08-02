const STORAGE_PREFIX = 'leadership-assistant:v1';

export const STORAGE_KEYS = {
  profiles: `${STORAGE_PREFIX}:profiles`,
  draft: `${STORAGE_PREFIX}:draft`,
  documents: `${STORAGE_PREFIX}:documents`,
};

const EMPTY_DRAFT = {};
const MAX_DOCUMENTS = 50;

function cloneJson(value, fallback) {
  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? fallback : JSON.parse(serialized);
  } catch {
    return fallback;
  }
}

function readJson(key, fallback, isValid) {
  try {
    const rawValue = globalThis.localStorage?.getItem(key);
    if (!rawValue) return cloneJson(fallback, fallback);

    const value = JSON.parse(rawValue);
    return isValid(value) ? value : cloneJson(fallback, fallback);
  } catch {
    return cloneJson(fallback, fallback);
  }
}

function writeJson(key, value) {
  const jsonValue = cloneJson(value, null);
  if (jsonValue === null) return null;

  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(jsonValue));
    return jsonValue;
  } catch {
    return null;
  }
}

function createId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function timestamp() {
  return new Date().toISOString();
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function listProfiles() {
  return readJson(STORAGE_KEYS.profiles, [], Array.isArray);
}

export function saveProfile(profile) {
  const incoming = cloneJson(profile, {});
  const profiles = listProfiles();
  const existing = profiles.find((item) => item.id === incoming.id);
  const now = timestamp();
  const savedProfile = {
    ...incoming,
    id: existing?.id ?? createId(),
    createdAt: existing?.createdAt ?? incoming.createdAt ?? now,
    updatedAt: now,
  };
  const nextProfiles = existing
    ? profiles.map((item) => (item.id === existing.id ? savedProfile : item))
    : [savedProfile, ...profiles];

  writeJson(STORAGE_KEYS.profiles, nextProfiles);
  return cloneJson(savedProfile, {});
}

export function deleteProfile(profileId) {
  const nextProfiles = listProfiles().filter((profile) => profile.id !== profileId);
  writeJson(STORAGE_KEYS.profiles, nextProfiles);
  return nextProfiles;
}

export function loadDraft() {
  return readJson(STORAGE_KEYS.draft, EMPTY_DRAFT, isObject);
}

export function saveDraft(draft) {
  const savedDraft = cloneJson(draft, EMPTY_DRAFT);
  writeJson(STORAGE_KEYS.draft, savedDraft);
  return savedDraft;
}

export function listDocuments() {
  return readJson(STORAGE_KEYS.documents, [], Array.isArray);
}

export function saveDocument(document) {
  const incoming = cloneJson(document, {});
  const documents = listDocuments();
  const existing = documents.find((item) => item.id === incoming.id);
  const now = timestamp();
  const savedDocument = {
    ...incoming,
    id: existing?.id ?? createId(),
    createdAt: existing?.createdAt ?? incoming.createdAt ?? now,
    updatedAt: now,
  };
  const nextDocuments = [
    savedDocument,
    ...documents.filter((item) => item.id !== savedDocument.id),
  ].slice(0, MAX_DOCUMENTS);

  writeJson(STORAGE_KEYS.documents, nextDocuments);
  return cloneJson(savedDocument, {});
}

export function deleteDocument(documentId) {
  const nextDocuments = listDocuments().filter((document) => document.id !== documentId);
  writeJson(STORAGE_KEYS.documents, nextDocuments);
  return nextDocuments;
}
