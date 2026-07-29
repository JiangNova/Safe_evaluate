# AGULAB 与 SafeEvaluate 同域整合 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在同一个 Nginx 服务中以 `/` 提供 AGULAB 官网、以 `/evaluate` 等路径提供 SafeEvaluate，并保留 `/api/*` 后端和全部现有数据。

**Architecture:** `website/` 与 `frontend/` 保持两个独立 Vite 应用，分别构建到各自的 `dist/`。Nginx 根据路由将官网路径送到 `website/dist/index.html`，将风险评估路径送到 `frontend/dist/index.html`，并通过 `/website-static/*` 与 `/assets/*` 隔离静态资源。FastAPI、SQLite、报告和上传图片的目录及挂载保持不变。

**Tech Stack:** React 19 + TypeScript + Vite 8（官网）、React 18 + React Router 6 + Vite 5（平台）、FastAPI、Docker Compose、Nginx。

## Global Constraints

- 线上服务器在用户明确确认“可以更新服务器”之前不得修改。
- 不读取、复制、记录或提交真实 `.env` 内容。
- 不删除、覆盖或迁移 `backend/data/` 与 `requirement/`。
- 保留 SafeEvaluate 当前未提交代码；仅在任务列出的文件中做范围明确的修改。
- 官网公开根路径为 `/`，平台入口为 `/evaluate`，API 为 `/api/*`。
- 未登录用户访问 `/evaluate` 时进入 `/login`，成功登录后返回原目标路径。
- 官网和平台不得使用 iframe，也不得合并为一个 React 工程。
- 官网资源使用 `/website-static/*`，平台资源保留 `/assets/*`。
- 每个任务只暂存并提交自己列出的文件，不使用 `git add .`。

---

## File Map

### 新增

- `website/`：从 `D:\AGULAB\agu_website` 导入的官网独立工程。
- `website/vite.config.ts`：将官网构建资源基路径设为 `/website-static/`。
- `website/src/lib/external-link.ts`：根据开发/生产环境生成平台入口 URL。
- `scripts/build-frontends.ps1`：可重复构建两个前端。
- `scripts/verify-integration.ps1`：验证 Nginx 路由、API 和静态资源。

### 修改

- `website/src/components/DualSceneHero.tsx`：增加直达 `/evaluate` 的风险评估入口。
- `website/src/pages/HomePage.tsx`：在 AI 赋能卡片中增加风险评估平台入口。
- `website/index.html`：确保 favicon 使用 Vite 基路径。
- `frontend/src/components/ProtectedRoute.jsx`：记录未登录前的目标路径。
- `frontend/src/pages/login/LoginForm.jsx`：登录后返回原目标路径。
- `frontend/src/pages/login/LoginPage.jsx`：已登录用户访问登录页时返回目标路径或 `/evaluate`。
- `nginx.conf`：双前端静态资源和 SPA 路由分发。
- `docker-compose.yml`：分别挂载官网和平台构建目录。
- `backend/config.py`：移除可预测的生产账号与 JWT 固定回退。
- `.env.example`：补充 `APP_ENV` 和生产必填说明。
- `.gitignore`：忽略官网依赖、构建、部署包和本地调试文件。
- `README.md`、`DEPLOY.md`：更新本地运行、构建、上线与回滚说明。

---

### Task 1: 导入并隔离 AGULAB 官网工程

**Files:**
- Create: `website/package.json`
- Create: `website/package-lock.json`
- Create: `website/index.html`
- Create: `website/vite.config.ts`
- Create: `website/tsconfig.json`
- Create: `website/tsconfig.app.json`
- Create: `website/tsconfig.node.json`
- Create: `website/eslint.config.js`
- Create: `website/public/favicon.svg`
- Create: `website/src/assets/agulab-hero-dual-scene-v1.webp`
- Create: `website/src/**`
- Create: `website/src/lib/external-link.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `D:\AGULAB\agu_website` 已通过 lint、build 和浏览器验收的提交 `47cbdeb`。
- Produces: 独立可构建的 `website/dist/`，其中静态资源 URL 均以 `/website-static/` 开头；`getPlatformUrl()` 返回开发或生产平台入口。

- [ ] **Step 1: 编写平台入口 URL 单元测试**

创建 `website/src/lib/external-link.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { getPlatformUrl } from './external-link'

describe('getPlatformUrl', () => {
  it('uses the standalone platform dev server during development', () => {
    expect(getPlatformUrl(true)).toBe('http://127.0.0.1:3000/evaluate')
  })

  it('uses the same-origin route in production', () => {
    expect(getPlatformUrl(false)).toBe('/evaluate')
  })
})
```

- [ ] **Step 2: 运行测试并确认失败**

运行：

```powershell
cd D:\myself\Safe_evaluate\website
npm test -- --run
```

预期：失败，因为 `website/` 和 `getPlatformUrl` 尚不存在。

- [ ] **Step 3: 导入官网源码**

从 `D:\AGULAB\agu_website` 复制以下内容到 `website/`：

```text
src/
public/
index.html
package.json
package-lock.json
vite.config.ts
tsconfig.json
tsconfig.app.json
tsconfig.node.json
eslint.config.js
README.md
```

不得复制：

```text
.git/
node_modules/
dist/
output/
.playwright-cli/
.superpowers/
docs/
```

- [ ] **Step 4: 配置官网资源基路径与测试脚本**

将 `website/vite.config.ts` 攱为：

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/website-static/',
  plugins: [react()],
})
```

在 `website/package.json` 中增加：

```json
"test": "vitest"
```

并在 `devDependencies` 中增加 `"vitest": "^4.1.10"`。

- [ ] **Step 5: 实现环境相关的平台入口**

创建 `website/src/lib/external-link.ts`：

```ts
export function getPlatformUrl(isDevelopment = import.meta.env.DEV) {
  return isDevelopment ? 'http://127.0.0.1:3000/evaluate' : '/evaluate'
}
```

- [ ] **Step 6: 修正 favicon 和官网内部资源**

`website/index.html` 使用：

```html
<link rel="icon" href="%BASE_URL%favicon.svg" type="image/svg+xml" />
```

将 `website/public/images/agulab-hero-dual-scene-v1.webp` 移至
`website/src/assets/agulab-hero-dual-scene-v1.webp`，并将
`website/src/components/DualSceneHero.module.css` 中的绝对引用改为：

```css
url('../assets/agulab-hero-dual-scene-v1.webp')
```

生产构建不得请求 `/images/*`。

- [ ] **Step 7: 更新忽略规则**

在根 `.gitignore` 增加：

```gitignore
website/node_modules/
website/dist/
safe-evaluate.tar.gz
update.tar.gz
debug_ai_response.txt
backend_stderr.log
```

- [ ] **Step 8: 安装依赖并验证**

运行：

```powershell
cd D:\myself\Safe_evaluate\website
npm install
npm test -- --run
npm run lint
npm run build
npm audit
```

预期：测试、lint、build 通过，审计为 0 已知漏洞；`website/dist/index.html` 中资源路径以 `/website-static/` 开头。

- [ ] **Step 9: 提交**

仅暂存：

```powershell
git add website .gitignore
git commit -m "feat: add AGULAB website application"
```

提交前确认 `git diff --cached --name-only` 不含原有脏文件。

---

### Task 2: 从官网进入风险评估平台

**Files:**
- Modify: `website/src/components/DualSceneHero.tsx`
- Modify: `website/src/pages/HomePage.tsx`
- Test: `website/src/lib/external-link.test.ts`

**Interfaces:**
- Consumes: `getPlatformUrl(isDevelopment?: boolean): string`。
- Produces: 首屏和 AI 赋能模块中可访问的“进入风险评估平台”链接。

- [ ] **Step 1: 扩展入口 URL 测试**

在 `external-link.test.ts` 增加：

```ts
it('never exposes the platform dev port in production', () => {
  expect(getPlatformUrl(false)).not.toContain(':3000')
})
```

- [ ] **Step 2: 运行测试**

运行：

```powershell
cd D:\myself\Safe_evaluate\website
npm test -- --run
```

预期：全部通过。

- [ ] **Step 3: 添加外部应用链接组件**

在 `DualSceneHero.tsx` 中导入 `getPlatformUrl`，添加：

```tsx
<a className="button button--glass" href={getPlatformUrl()}>
  进入风险评估平台
  <span aria-hidden="true">↗</span>
</a>
```

保留“探索自动驾驶赛车”和“合作共赢”，避免把所有 CTA 都指向平台。

- [ ] **Step 4: 在 AI 赋能卡片中增加平台入口**

AI 赋能卡片的主入口仍进入 `/ai-empowerment`，在卡片底部增加第二入口：

```tsx
<a href={getPlatformUrl()} className={styles.platformEntry}>
  体验消防安全风险评估
  <span aria-hidden="true">↗</span>
</a>
```

`HomePage.module.css` 中为 `.platformEntry` 提供键盘焦点可见、移动端不溢出的样式。

- [ ] **Step 5: 验证与提交**

运行：

```powershell
npm test -- --run
npm run lint
npm run build
```

用浏览器确认开发环境链接为 `http://127.0.0.1:3000/evaluate`。

仅暂存并提交：

```powershell
git add website/src/components/DualSceneHero.tsx website/src/pages/HomePage.tsx website/src/pages/HomePage.module.css website/src/lib/external-link.test.ts
git commit -m "feat: link homepage to risk evaluation"
```

---

### Task 3: 保留登录前目标路径

**Files:**
- Modify: `frontend/src/components/ProtectedRoute.jsx`
- Modify: `frontend/src/pages/login/LoginForm.jsx`
- Modify: `frontend/src/pages/login/LoginPage.jsx`
- Create: `frontend/src/utils/safeRedirect.js`
- Create: `frontend/src/utils/safeRedirect.test.js`
- Modify: `frontend/package.json`

**Interfaces:**
- Consumes: React Router `location.state.from`。
- Produces: `getSafeRedirect(from): string`，只允许本域绝对路径并默认返回 `/evaluate`。

- [ ] **Step 1: 写重定向安全测试**

创建 `frontend/src/utils/safeRedirect.test.js`：

```js
import { describe, expect, it } from 'vitest';
import { getSafeRedirect } from './safeRedirect';

describe('getSafeRedirect', () => {
  it('keeps an internal platform route', () => {
    expect(getSafeRedirect('/report/abc?tab=detail')).toBe('/report/abc?tab=detail');
  });

  it('rejects protocol-relative redirects', () => {
    expect(getSafeRedirect('//evil.example')).toBe('/evaluate');
  });

  it('rejects absolute external redirects', () => {
    expect(getSafeRedirect('https://evil.example')).toBe('/evaluate');
  });

  it('uses evaluate when no target exists', () => {
    expect(getSafeRedirect()).toBe('/evaluate');
  });
});
```

- [ ] **Step 2: 安装 Vitest 并确认测试失败**

在 `frontend/package.json` 增加：

```json
"test": "vitest"
```

安装与 Vite 5 兼容的 `"vitest": "^2.1.9"` 后运行：

```powershell
cd D:\myself\Safe_evaluate\frontend
npm test -- --run
```

预期：失败，因为 `getSafeRedirect` 尚不存在。

- [ ] **Step 3: 实现安全重定向**

创建 `frontend/src/utils/safeRedirect.js`：

```js
const PLATFORM_PATH =
  /^\/(?:evaluate|history|rules|stats)(?:[/?#]|$)|^\/report(?:\/|[?#]|$)/;

export function getSafeRedirect(from) {
  if (typeof from !== 'string') return '/evaluate';
  if (!from.startsWith('/') || from.startsWith('//')) return '/evaluate';
  return PLATFORM_PATH.test(from) ? from : '/evaluate';
}
```

- [ ] **Step 4: 在保护路由记录来源**

`ProtectedRoute.jsx` 使用 `useLocation()`：

```jsx
const location = useLocation();
const from = `${location.pathname}${location.search}${location.hash}`;

return <Navigate to="/login" replace state={{ from }} />;
```

- [ ] **Step 5: 登录后返回安全目标**

`LoginForm.jsx` 使用 `useLocation()` 和 `getSafeRedirect()`：

```jsx
const location = useLocation();
const redirectTo = getSafeRedirect(location.state?.from);
// login success
navigate(redirectTo, { replace: true });
```

`LoginPage.jsx` 对已登录用户使用同一规则。

- [ ] **Step 6: 验证与提交**

运行：

```powershell
npm test -- --run
npm run build
npm audit
```

浏览器验证：

1. 清除登录信息；
2. 打开 `/evaluate`；
3. 确认进入 `/login`；
4. 登录；
5. 确认返回 `/evaluate`。

仅暂存并提交：

```powershell
git add frontend/package.json frontend/package-lock.json frontend/src/components/ProtectedRoute.jsx frontend/src/pages/login/LoginForm.jsx frontend/src/pages/login/LoginPage.jsx frontend/src/utils
git commit -m "fix: return users to requested platform route"
```

---

### Task 4: 配置 Nginx 与 Docker 双前端分发

**Files:**
- Create: `scripts/verify-integration.ps1`
- Modify: `nginx.conf`
- Modify: `docker-compose.yml`

**Interfaces:**
- Consumes: `website/dist/`、`frontend/dist/`、后端容器 `backend:8000`。
- Produces: 单一 HTTP 入口，按路径服务官网、平台和 API。

- [ ] **Step 1: 编写失败的路由验证脚本**

创建 `scripts/verify-integration.ps1`：

```powershell
param([string]$BaseUrl = 'http://127.0.0.1')

$checks = @(
  @{ Path = '/'; Contains = '<title>AGULAB' },
  @{ Path = '/evaluate'; Contains = '场所安全多模态智能研判平台' },
  @{ Path = '/login'; Contains = '场所安全多模态智能研判平台' },
  @{ Path = '/history'; Contains = '场所安全多模态智能研判平台' },
  @{ Path = '/report/test-id'; Contains = '场所安全多模态智能研判平台' }
)

foreach ($check in $checks) {
  $response = Invoke-WebRequest -Uri "$BaseUrl$($check.Path)" -UseBasicParsing
  if ($response.StatusCode -ne 200 -or $response.Content -notmatch [regex]::Escape($check.Contains)) {
    throw "Integration check failed: $($check.Path)"
  }
}

$health = Invoke-RestMethod -Uri "$BaseUrl/api/health"
if ($health.status -ne 'ok') {
  throw 'Integration check failed: /api/health'
}

Write-Host 'All integration routes passed.'
```

- [ ] **Step 2: 运行脚本并确认失败**

在当前旧部署或尚未启动的本地环境运行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\verify-integration.ps1
```

预期：官网根路径检查失败，证明旧配置尚未提供 AGULAB。

- [ ] **Step 3: 修改 Docker 挂载**

Nginx 服务使用：

```yaml
volumes:
  - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
  - ./website/dist:/usr/share/nginx/website:ro
  - ./frontend/dist:/usr/share/nginx/platform:ro
```

后端卷保持：

```yaml
- ./backend/data:/app/backend/data
- ./requirement:/app/requirement:ro
```

- [ ] **Step 4: 实现 Nginx 分发**

`nginx.conf` 必须包含：

```nginx
root /usr/share/nginx/website;
index index.html;

location ^~ /api/ {
    proxy_pass http://backend:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 50m;
    proxy_read_timeout 300s;
    proxy_connect_timeout 15s;
    proxy_send_timeout 60s;
}

location ^~ /website-static/ {
    alias /usr/share/nginx/website/;
    expires 1y;
    add_header Cache-Control "public, immutable";
}

location ^~ /assets/ {
    alias /usr/share/nginx/platform/assets/;
    expires 1y;
    add_header Cache-Control "public, immutable";
}

location ~ ^/(?:login|evaluate|history|rules|stats)(?:/.*)?$ {
    root /usr/share/nginx/platform;
    rewrite ^ /index.html break;
    add_header Cache-Control "no-cache";
}

location ^~ /report/ {
    root /usr/share/nginx/platform;
    rewrite ^ /index.html break;
    add_header Cache-Control "no-cache";
}

location / {
    root /usr/share/nginx/website;
    rewrite ^ /index.html break;
    add_header Cache-Control "no-cache";
}
```

- [ ] **Step 5: 验证配置语法**

运行：

```powershell
docker run --rm -v "${PWD}\nginx.conf:/etc/nginx/conf.d/default.conf:ro" nginx:alpine nginx -t
```

预期：`syntax is ok` 和 `test is successful`。

- [ ] **Step 6: 启动并验证**

运行：

```powershell
docker compose up -d --build
powershell -ExecutionPolicy Bypass -File scripts\verify-integration.ps1
docker compose ps
```

预期：验证脚本通过，backend 与 nginx 健康运行。

- [ ] **Step 7: 提交**

仅暂存：

```powershell
git add nginx.conf docker-compose.yml scripts/verify-integration.ps1
git commit -m "feat: route website and platform through nginx"
```

---

### Task 5: 移除生产默认凭据

**Files:**
- Modify: `backend/config.py`
- Modify: `docker-compose.yml`
- Modify: `.env.example`
- Create: `backend/test_config_guard.py`

**Interfaces:**
- Consumes: `APP_ENV`、`APP_USERS`、`JWT_SECRET` 环境变量。
- Produces: 生产环境缺少强制配置时启动失败；开发环境仍可明确配置本地账号。

- [ ] **Step 1: 编写生产配置保护测试**

创建 `backend/test_config_guard.py`，通过子进程隔离模块导入：

```python
import os
import subprocess
import sys


def run_config(env):
    merged = os.environ.copy()
    merged.update(env)
    return subprocess.run(
        [sys.executable, "-c", "import backend.config"],
        cwd=os.path.dirname(os.path.dirname(__file__)),
        env=merged,
        capture_output=True,
        text=True,
    )


def test_production_rejects_missing_credentials():
    result = run_config({
        "APP_ENV": "production",
        "APP_USERS": "",
        "JWT_SECRET": "",
        "QWEN_API_KEY": "test-key",
    })
    assert result.returncode != 0
    assert "APP_USERS" in result.stderr or "JWT_SECRET" in result.stderr
```

- [ ] **Step 2: 运行测试并确认失败**

运行：

```powershell
python -m pytest backend/test_config_guard.py -v
```

预期：失败，因为当前配置会使用固定回退值并成功导入。

- [ ] **Step 3: 实现生产保护**

在 `backend/config.py` 中使用：

```python
APP_ENV = os.getenv("APP_ENV", "development").lower()
USERS_JSON = os.getenv("APP_USERS", "{}")
USERS = _json.loads(USERS_JSON) if USERS_JSON else {}
JWT_SECRET = os.getenv("JWT_SECRET", "")

if APP_ENV == "production":
    missing = []
    if not USERS:
        missing.append("APP_USERS")
    if not JWT_SECRET:
        missing.append("JWT_SECRET")
    if missing:
        raise RuntimeError(
            f"Missing required production settings: {', '.join(missing)}"
        )
```

不得打印用户密码、JWT 值或 API Key。

- [ ] **Step 4: 强制 Compose 生产变量**

`docker-compose.yml` 使用：

```yaml
- APP_ENV=${APP_ENV:-production}
- APP_USERS=${APP_USERS:?APP_USERS is required}
- JWT_SECRET=${JWT_SECRET:?JWT_SECRET is required}
```

`.env.example` 提供占位值和生成说明，不提供可直接用于生产的默认密码。

- [ ] **Step 5: 验证与提交**

运行：

```powershell
python -m pytest backend/test_config_guard.py -v
docker compose config
```

仅暂存：

```powershell
git add backend/config.py backend/test_config_guard.py docker-compose.yml .env.example
git commit -m "security: require production credentials"
```

由于 `backend/config.py` 当前已有用户修改，提交前必须确认 staged diff 只包含生产配置保护相关行，不得覆盖其余未提交内容。

---

### Task 6: 构建、文档与上线包

**Files:**
- Create: `scripts/build-frontends.ps1`
- Modify: `README.md`
- Modify: `DEPLOY.md`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: 两个前端各自的 `package-lock.json` 与构建脚本。
- Produces: 可重复的双前端构建命令、服务器备份/部署/回滚手册。

- [ ] **Step 1: 创建双前端构建脚本**

`scripts/build-frontends.ps1`：

```powershell
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

Push-Location (Join-Path $root 'website')
npm ci
npm run lint
npm test -- --run
npm run build
Pop-Location

Push-Location (Join-Path $root 'frontend')
npm ci
npm test -- --run
npm run build
Pop-Location

Write-Host 'Both frontends built successfully.'
```

- [ ] **Step 2: 运行构建脚本**

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-frontends.ps1
```

预期：两个 `dist/` 生成且命令退出码为 0。

- [ ] **Step 3: 更新 README**

README 必须明确：

```text
官网开发：http://127.0.0.1:5173
平台开发：http://127.0.0.1:3000
后端开发：http://127.0.0.1:8000
生产官网：/
生产平台：/evaluate
生产 API：/api/*
```

- [ ] **Step 4: 更新部署与回滚文档**

`DEPLOY.md` 必须包含上线前备份命令，备份目标至少有：

```text
.env
backend/data/
requirement/
nginx.conf
docker-compose.yml
website/dist/
frontend/dist/
```

部署命令不得包含删除 `backend/data`、重建数据目录或覆盖 `.env` 的操作。回滚步骤必须说明恢复旧 `nginx.conf`、两个旧 `dist/` 和旧容器配置。

- [ ] **Step 5: 最终本地验收**

运行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-frontends.ps1
docker compose up -d --build
powershell -ExecutionPolicy Bypass -File scripts\verify-integration.ps1
docker compose logs --tail=100 backend nginx
```

使用真实浏览器验证：

```text
/
/about
/evaluate
/login
/history
/report/<现有报告ID>
/rules
/stats
```

确认控制台无错误，官网和平台均适配桌面与手机视口。

- [ ] **Step 6: 提交**

仅暂存：

```powershell
git add scripts/build-frontends.ps1 README.md DEPLOY.md .gitignore
git commit -m "docs: add integrated build and deployment workflow"
```

---

### Task 7: 准备服务器更新但不执行

**Files:**
- Create: `docs/deployment/agulab-release-checklist.md`
- Create: `docs/deployment/agulab-rollback-checklist.md`

**Interfaces:**
- Consumes: 本地验收通过的 Git 提交、两个 `dist/`、Nginx 和 Compose 配置。
- Produces: 人工可审核的服务器更新清单；不产生远程写入。

- [ ] **Step 1: 记录发布内容**

发布清单写明：

```text
目标主机：由用户在执行时确认
官网路径：/
平台路径：/evaluate
API 路径：/api/*
数据卷：backend/data（不得覆盖）
环境文件：服务器现有 .env（不得上传替换）
```

- [ ] **Step 2: 记录上线前健康检查**

至少包括：

```text
当前 /evaluate 可访问
当前 /api/health 返回 200
记录当前容器状态
记录现有报告数量
创建代码、配置、.env 和 backend/data 备份
```

- [ ] **Step 3: 记录回滚触发条件**

任一条件触发回滚：

```text
/ 无法打开
/evaluate 无法登录
/api/health 非 200
已有报告丢失或图片不可见
新评估无法写入
Nginx 持续 404/502
```

- [ ] **Step 4: 最终安全边界检查**

确认文档中没有真实 IP 之外的密钥、账号、密码或私钥；确认没有任何命令会删除数据。

- [ ] **Step 5: 提交并停止**

```powershell
git add docs/deployment/agulab-release-checklist.md docs/deployment/agulab-rollback-checklist.md
git commit -m "docs: prepare AGULAB release and rollback checklists"
```

完成后向用户提供本地访问地址和验收结果，等待用户明确确认“可以更新服务器”。不得自动上传或重启线上服务。
