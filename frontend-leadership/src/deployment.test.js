import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const frontendRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const repositoryRoot = resolve(frontendRoot, '..');

async function readSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = await Promise.all(entries.map(async (entry) => {
    const entryPath = resolve(directory, entry.name);
    return entry.isDirectory()
      ? readSourceFiles(entryPath)
      : readFile(entryPath, 'utf8');
  }));

  return contents.flat();
}

describe('AI写作助手私有部署', () => {
  it('以固定子路径构建，并由 nginx 提供资源、跳转与 SPA 回退', async () => {
    const [viteConfig, nginxConfig, composeConfig, indexHtml] = await Promise.all([
      readFile(resolve(frontendRoot, 'vite.config.js'), 'utf8'),
      readFile(resolve(repositoryRoot, 'nginx.conf'), 'utf8'),
      readFile(resolve(repositoryRoot, 'docker-compose.yml'), 'utf8'),
      readFile(resolve(frontendRoot, 'index.html'), 'utf8'),
    ]);

    expect(viteConfig).toContain("base: '/ai-writing/'");
    expect(nginxConfig).toContain('location = /ai-writing {');
    expect(nginxConfig).toContain('location ^~ /ai-writing/assets/ {');
    expect(nginxConfig).toContain('location ^~ /ai-writing/ {');
    expect(nginxConfig).toContain('try_files $uri $uri/ /ai-writing/index.html;');
    expect(nginxConfig).toContain('location = /leader-assistant {');
    expect(nginxConfig).toContain('return 302 /ai-writing/;');
    expect(composeConfig).toContain('./frontend-leadership/dist:/usr/share/nginx/html/ai-writing:ro');
    expect(indexHtml).toContain('<title>AI写作助手</title>');
  });

  it('官网源码不含领导文稿助手入口', async () => {
    const websiteSources = await readSourceFiles(resolve(repositoryRoot, 'website', 'src'));

    expect(websiteSources.join('\n')).not.toContain('leader-assistant');
  });
});
