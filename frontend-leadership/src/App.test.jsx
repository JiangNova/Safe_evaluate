import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { profileForGeneration, profileForRevision } from './pages/WorkbenchPage';

const pagePath = fileURLToPath(new URL('./pages/WorkbenchPage.jsx', import.meta.url));
const componentDir = fileURLToPath(new URL('./components/', import.meta.url));
const apiPath = fileURLToPath(new URL('./services/leaderApi.js', import.meta.url));

describe('领导文稿助手工作台', () => {
  it('提供登录入口、身份档案、六类任务与生成入口', () => {
    const source = [
      readFileSync(pagePath, 'utf8'),
      readFileSync(`${componentDir}ProfileLibrary.jsx`, 'utf8'),
      readFileSync(`${componentDir}TaskComposer.jsx`, 'utf8'),
      readFileSync(`${componentDir}DocumentEditor.jsx`, 'utf8'),
      readFileSync(fileURLToPath(new URL('./pages/LoginPage.jsx', import.meta.url)), 'utf8'),
    ].join('\n');

    expect(source).toContain('我的身份档案');
    ['文件贯彻落实报告', '安全工作部署', '领导讲话稿', '工作总结', '通知/函件', '自定义任务'].forEach((label) => expect(source).toContain(label));
    expect(source).toContain('生成文稿初稿');
    expect(source).toContain('登录');
    expect(source).toContain('退出登录');
    expect(readFileSync(apiPath, 'utf8')).toContain('Authorization');
    expect(readFileSync(apiPath, 'utf8')).toContain('clearLeadershipSession');
  });

  it('改写请求保持与匿名文稿接口的字段合同一致', () => {
    const source = readFileSync(apiPath, 'utf8');
    ['requirement', 'title', 'warnings', 'revision_instruction'].forEach((field) => expect(source).toContain(field));
    expect(source).not.toMatch(/\binstruction\s*:/);
  });

  it('改写历史文稿时始终读取冻结的身份快照', () => {
    const savedProfile = { id: 'chemistry-secretary', name: '化学学院书记', focusAreas: '危化品安全' };
    const currentProfile = { id: 'computer-secretary', name: '计算机学院书记', focusAreas: '机房安全' };

    expect(profileForRevision({ profileSnapshot: savedProfile })).toEqual(savedProfile);
    expect(profileForRevision({ profileSnapshot: savedProfile })).not.toEqual(currentProfile);
    expect(profileForRevision({})).toBeNull();
  });

  it('重新生成历史文稿时优先使用冻结的身份快照', () => {
    const savedProfile = { id: 'chemistry-secretary', name: '化学学院书记' };
    const selectedProfile = { id: 'computer-secretary', name: '计算机学院书记' };

    expect(profileForGeneration({ profileSnapshot: savedProfile }, selectedProfile)).toEqual(savedProfile);
    expect(profileForGeneration(null, selectedProfile)).toEqual(selectedProfile);
  });
});
