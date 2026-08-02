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

describe('领导文稿助手私有部署', () => {
  it('以固定子路径构建，并由 nginx 提供资源、跳转与 SPA 回退', async () => {
    const [viteConfig, nginxConfig] = await Promise.all([
      readFile(resolve(frontendRoot, 'vite.config.js'), 'utf8'),
      readFile(resolve(repositoryRoot, 'nginx.conf'), 'utf8'),
    ]);

    expect(viteConfig).toContain("base: '/leader-assistant/'");
    expect(nginxConfig).toContain('location = /leader-assistant {');
    expect(nginxConfig).toContain('return 302 /leader-assistant/;');
    expect(nginxConfig).toContain('location ^~ /leader-assistant/assets/ {');
    expect(nginxConfig).toContain('location ^~ /leader-assistant/ {');
    expect(nginxConfig).toContain('try_files $uri $uri/ /leader-assistant/index.html;');
  });

  it('官网源码不含领导文稿助手入口', async () => {
    const websiteSources = await readSourceFiles(resolve(repositoryRoot, 'website', 'src'));

    expect(websiteSources.join('\n')).not.toContain('leader-assistant');
  });
});
