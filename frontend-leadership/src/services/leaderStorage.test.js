import { beforeEach, describe, expect, it } from 'vitest';
import {
  STORAGE_KEYS,
  clearStorageAccount,
  deleteProfile,
  listDocuments,
  listProfiles,
  loadDraft,
  saveDocument,
  saveDraft,
  saveProfile,
  setStorageAccount,
} from './leaderStorage';
import { ensureDefaultProfiles, restoreDefaultProfile } from './defaultProfiles';

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
  it('按登录账号隔离身份档案、草稿和历史文稿', () => {
    setStorageAccount('wanxin');
    saveProfile({ name: '党委书记' });
    saveDraft({ requirement: '党委工作' });
    saveDocument({ title: '书记文稿', contentMarkdown: '正文' });

    setStorageAccount('wanqin');
    expect(listProfiles()).toEqual([]);
    expect(loadDraft()).toEqual({});
    expect(listDocuments()).toEqual([]);

    saveProfile({ name: '院长' });
    expect(listProfiles()[0].name).toBe('院长');

    setStorageAccount('wanxin');
    expect(listProfiles()[0].name).toBe('党委书记');
    expect(listDocuments()[0].title).toBe('书记文稿');
    clearStorageAccount();
  });

  it('首次登录预置账号默认身份，删除后可恢复且不覆盖已编辑身份', () => {
    setStorageAccount('wanxin');
    const profiles = ensureDefaultProfiles('wanxin');
    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toMatchObject({ name: 'wanxin1', title: '党委书记', organization: '长沙理工大学人工智能学院' });
    const edited = saveProfile({ ...profiles[0], focusAreas: '自定义重点' });
    expect(restoreDefaultProfile('wanxin')).toEqual(edited);
    deleteProfile(edited.id);
    expect(restoreDefaultProfile('wanxin')).toMatchObject({ name: 'wanxin1', title: '党委书记' });

    setStorageAccount('wanqin');
    expect(ensureDefaultProfiles('wanqin')[0]).toMatchObject({ name: 'wanqin1', title: '院长' });
    clearStorageAccount();
  });

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
