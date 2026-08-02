import { beforeEach, describe, expect, it } from 'vitest';
import {
  STORAGE_KEYS,
  listDocuments,
  listProfiles,
  loadDraft,
  saveDocument,
  saveDraft,
  saveProfile,
} from './leaderStorage';

function createMemoryStorage() {
  const values = new Map();

  return {
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  };
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: createMemoryStorage(),
  });
});

describe('领导文稿助手本地存储', () => {
  it('保存文稿时冻结身份快照，不受后续身份档案变更影响', () => {
    const originalProfile = saveProfile({
      name: '化学学院书记',
      organization: '化学学院',
      focusAreas: '实验室危化品安全',
    });
    saveDocument({
      title: '安全工作部署',
      contentMarkdown: '# 安全工作部署',
      profileSnapshot: originalProfile,
    });

    saveProfile({
      ...originalProfile,
      focusAreas: '计算机房与网络安全',
    });

    expect(listProfiles()[0].focusAreas).toBe('计算机房与网络安全');
    expect(listDocuments()[0].profileSnapshot.focusAreas).toBe('实验室危化品安全');
  });

  it('在本地数据损坏时返回空默认值', () => {
    localStorage.setItem(STORAGE_KEYS.profiles, '{not-json');
    localStorage.setItem(STORAGE_KEYS.draft, '[]');
    localStorage.setItem(STORAGE_KEYS.documents, '{not-json');

    expect(listProfiles()).toEqual([]);
    expect(loadDraft()).toEqual({});
    expect(listDocuments()).toEqual([]);
  });

  it('只保留最近 50 篇文稿', () => {
    for (let index = 0; index < 51; index += 1) {
      saveDocument({
        id: `document-${index}`,
        title: `文稿 ${index}`,
        contentMarkdown: `# 文稿 ${index}`,
      });
    }

    expect(listDocuments()).toHaveLength(50);
    expect(listDocuments()[0].title).toBe('文稿 50');
    expect(listDocuments().some((document) => document.title === '文稿 0')).toBe(false);
  });

  it('仅持久化可 JSON 序列化的草稿值', () => {
    const savedDraft = saveDraft({ taskType: 'summary', ignored: undefined });

    expect(savedDraft).toEqual({ taskType: 'summary' });
    expect(loadDraft()).toEqual({ taskType: 'summary' });
  });
});
