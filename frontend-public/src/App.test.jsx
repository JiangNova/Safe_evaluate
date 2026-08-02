import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const srcRoot = path.resolve(import.meta.dirname);

function readSource(relativePath) {
  return fs.readFileSync(path.join(srcRoot, relativePath), 'utf8');
}

function readRuntimeSources() {
  const files = [];

  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
      } else if (
        /\.(js|jsx)$/.test(entry.name) &&
        !entry.name.endsWith('.test.js') &&
        !entry.name.endsWith('.test.jsx')
      ) {
        files.push(fs.readFileSync(absolute, 'utf8'));
      }
    }
  }

  visit(srcRoot);
  return files.join('\n');
}

describe('public evaluation application', () => {
  it('defines only the new-evaluation, summary, and report routes', () => {
    const appSource = readSource('App.jsx');

    expect(appSource).toContain('path="/"');
    expect(appSource).toContain('path="/summary"');
    expect(appSource).toContain('path="/report/:id"');
    expect(appSource).toContain('path="/jobs/:jobId/templates"');
    expect(appSource).toContain('path="/jobs/:jobId/workspace"');
    expect(appSource).not.toMatch(/path="\/(login|history|stats|rules)/i);
  });

  it('keeps material, basis, and template uploads separate', () => {
    const wizardSource = readSource('pages/JobWizardPage.jsx');

    for (const kind of ['material', 'basis', 'template']) {
      expect(wizardSource).toContain(`kind="${kind}"`);
    }
    expect(wizardSource).toContain('评估目标');
    expect(wizardSource).toContain('评估依据');
    expect(wizardSource).toContain('输出模板');
  });

  it('supports both an explicit file picker and drag-and-drop uploads', () => {
    const source = readSource('components/FileSection.jsx');

    expect(source).toContain('inputRef.current?.click()');
    expect(source).toContain('onDrop={dropFiles}');
    expect(source).toContain('event.dataTransfer.files');
    expect(source).toContain('选择文件');
  });

  it('requires explicit field confirmation before evaluation', () => {
    const source = [
      readSource('pages/TemplateConfirmPage.jsx'),
      readSource('components/TemplateFieldEditor.jsx'),
    ].join('\n');

    expect(source).toContain('确认字段并开始评估');
    expect(source).toContain('confidence');
    expect(source).toContain('confirmTemplateFields');
  });

  it('supports field edit, regeneration, finalization, and archive download', () => {
    const source = [
      readSource('pages/JobWorkspacePage.jsx'),
      readSource('components/DocumentFieldEditor.jsx'),
    ].join('\n');

    for (const text of ['重新生成此字段', '恢复 AI 初稿', '确认定稿', '下载全部文书']) {
      expect(source).toContain(text);
    }
  });

  it.each(['天心区', '公安分局', '派出所', '历史记录', '统计分析', '规则管理'])(
    'does not expose restricted public copy: %s',
    (restrictedText) => {
      expect(readRuntimeSources()).not.toContain(restrictedText);
    },
  );

  it('returns from a report to a new evaluation', () => {
    const reportSource = readSource('pages/ReportPage.jsx');

    expect(reportSource).toContain("navigate('/')");
    expect(reportSource).toContain('返回继续评估');
  });

  it('supports creating and recovering an anonymous workspace', () => {
    const source = readSource('pages/WorkspaceEntryPage.jsx');

    expect(source).toContain('创建长期工作区');
    expect(source).toContain('使用恢复码进入');
    expect(source).toContain('RecoverySecretDialog');
  });

  it('provides reusable standard, template, and scenario libraries', () => {
    const source = readSource('pages/WorkspaceLibraryPage.jsx');

    for (const label of ['评估标准', '输出模板', '固定场景', '版本记录', '开始评估']) {
      expect(source).toContain(label);
    }
  });

  it('allows saved, uploaded, and text resources in a new evaluation', () => {
    const source = readSource('components/ResourcePicker.jsx');

    for (const label of ['从工作区选择', '临时上传', '文字输入', '保存到工作区']) {
      expect(source).toContain(label);
    }
  });

  it('starts from either a fixed scenario or a custom evaluation', () => {
    const source = readSource('pages/WorkspaceNewJobPage.jsx');

    expect(source).toContain('使用固定场景');
    expect(source).toContain('自定义新评估');
    expect(source).toContain('ResourcePicker');
  });

  it('shows placement, applicability, and blocking quality states', () => {
    const runtime = readRuntimeSources();
    for (const text of ['填写位置', '文书适用性', '待人工补充', '暂不能生成', '阻止定稿']) {
      expect(runtime).toContain(text);
    }
  });
});
