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
    expect(appSource).not.toMatch(/path="\/(login|history|stats|rules)/i);
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
});

