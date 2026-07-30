# Dual Evaluation Platform Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the AGULAB website, a neutral non-functional public evaluation shell, and the existing Tianxin evaluation platform from `/`, `/evaluate`, and `/evaluate_tianxin` respectively.

**Architecture:** Keep the existing `frontend` application as the authenticated Tianxin product and move it under a React Router/Vite basename. Add a small independent `frontend-public` Vite application for the neutral shell. Nginx serves both nested SPAs from separate mounted directories while the existing backend and `/api/*` behavior remain unchanged.

**Tech Stack:** React 18, Vite 8, Vitest 4, React Router 7, Nginx Alpine, Docker Compose, PowerShell, Python `unittest`.

## Global Constraints

- Do not modify backend APIs, authentication behavior, database schemas, report storage, or production data.
- The public shell must not call an AI or upload API.
- The public shell must not contain login, history, statistics, rule management,公安, 派出所, or 天心区 product content.
- The public shell action remains disabled and visibly says `功能方案完善中`.
- The existing `frontend` remains the Tianxin application; do not copy its police-specific components into `frontend-public`.
- Do not implement public report retention, 24-hour cleanup, rate limiting, or public authentication in this phase.
- Preserve unrelated working-tree changes in `debug_ai_response.txt` and `frontend/src/pages/history/*`; do not stage or rewrite them.
- Use `/evaluate/` and `/evaluate_tianxin/` as static asset bases; bare paths redirect to their trailing-slash forms.

---

## File Structure

### New public application

- `frontend-public/package.json`: public shell scripts and dependencies.
- `frontend-public/package-lock.json`: reproducible npm dependency lock.
- `frontend-public/index.html`: public shell document metadata.
- `frontend-public/vite.config.js`: `/evaluate/` asset base and test configuration.
- `frontend-public/src/main.jsx`: React entry point.
- `frontend-public/src/App.jsx`: page structure and disabled action.
- `frontend-public/src/App.module.css`: page-local responsive layout.
- `frontend-public/src/index.css`: reset, theme tokens, and global accessibility styles.
- `frontend-public/src/content/platformContent.js`: neutral copy and input-area definitions.
- `frontend-public/src/content/platformContent.test.js`: forbidden-copy and shell-state tests.
- `website/src/lib/external-link.ts`: website development link to the public shell.
- `website/src/lib/external-link.test.ts`: public-shell development and production URL tests.

### Tianxin path migration

- `frontend/src/config/routes.js`: canonical Tianxin base and hard-navigation URLs.
- `frontend/src/config/routes.test.js`: route constant tests.
- `frontend/src/main.jsx`: React Router basename.
- `frontend/vite.config.js`: Tianxin production asset base.
- `frontend/src/services/api.js`: authenticated 401 hard redirect.
- `frontend/src/utils/safeRedirect.js`: normalize safe in-app redirects under the Tianxin basename.
- `frontend/src/utils/safeRedirect.test.js`: prefixed and hostile redirect coverage.

### Deployment and verification

- `nginx.conf`: route three applications and isolate static assets.
- `docker-compose.yml`: mount both platform builds under `/usr/share/nginx/html`.
- `.gitignore`: ignore public app dependencies and build output.
- `scripts/build-frontends.ps1`: verify and build all three frontends.
- `scripts/serve-integration.py`: mirror production routing locally.
- `scripts/test_serve_integration.py`: route classification and build-output guard tests.
- `scripts/verify-integration.ps1`: assert all public and Tianxin routes.
- `README.md`: document the three user-facing entry points.
- `DEPLOY.md`: document three-frontend build and deployment commands.

---

### Task 1: Create the Neutral Public Platform Shell

**Files:**
- Create: `frontend-public/package.json`
- Create: `frontend-public/package-lock.json`
- Create: `frontend-public/index.html`
- Create: `frontend-public/vite.config.js`
- Create: `frontend-public/src/main.jsx`
- Create: `frontend-public/src/App.jsx`
- Create: `frontend-public/src/App.module.css`
- Create: `frontend-public/src/index.css`
- Create: `frontend-public/src/content/platformContent.js`
- Create: `frontend-public/src/content/platformContent.test.js`
- Modify: `website/src/lib/external-link.ts`
- Modify: `website/src/lib/external-link.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: a Vite build at `frontend-public/dist/index.html`.
- Produces: assets whose URLs start with `/evaluate/`.
- Produces: `platformContent` with `title`, `description`, `status`, and `inputAreas`.

- [ ] **Step 1: Add the public package manifest and Vite configuration**

Create `frontend-public/package.json` with scripts `dev`, `build`, `preview`, and `test`; use React `^18.3.1`, React DOM `^18.3.1`, Vite `^8.1.5`, Vitest `^4.1.10`, and `@vitejs/plugin-react` `^6.0.4`.

Configure the asset base:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/evaluate/',
  plugins: [react()],
  server: {
    port: 3001,
  },
});
```

Set the public document marker in `index.html`:

```html
<meta name="application-name" content="AGULAB Public Evaluation" />
```

Run `npm install` from `frontend-public` to create the lock file and local dependencies.

- [ ] **Step 2: Write the failing content-boundary test**

```js
import { describe, expect, it } from 'vitest';
import { platformContent } from './platformContent';

describe('public platform content', () => {
  it('defines the four future workflow areas and keeps evaluation disabled', () => {
    expect(platformContent.inputAreas.map((item) => item.id)).toEqual([
      'images',
      'laws',
      'policies',
      'results',
    ]);
    expect(platformContent.actionEnabled).toBe(false);
    expect(platformContent.status).toBe('功能方案完善中');
  });

  it.each(['公安', '派出所', '天心区', '历史记录', '统计分析', '规则管理'])(
    'does not expose restricted product copy: %s',
    (restrictedText) => {
      expect(JSON.stringify(platformContent)).not.toContain(restrictedText);
    },
  );
});
```

- [ ] **Step 3: Run the test and verify the missing module failure**

Run:

```powershell
cd frontend-public
npm test -- --run
```

Expected: FAIL because `src/content/platformContent.js` does not exist.

- [ ] **Step 4: Implement the neutral content model**

Create `platformContent.js` with this public contract:

```js
export const platformContent = {
  eyebrow: 'AGULAB · AI EMPOWERMENT',
  title: '自动合规评判平台',
  description:
    '面向图片材料、法律法规与规章制度的智能合规评判框架，具体服务方案正在进一步完善。',
  status: '功能方案完善中',
  actionEnabled: false,
  inputAreas: [
    {
      id: 'images',
      step: '01',
      title: '图片材料',
      description: '用于提交待识别、待核验的现场图片或业务材料。',
    },
    {
      id: 'laws',
      step: '02',
      title: '法律法规',
      description: '用于明确评判所依据的法律、法规与标准。',
    },
    {
      id: 'policies',
      step: '03',
      title: '规章制度',
      description: '用于补充组织内部制度、操作规范与管理要求。',
    },
    {
      id: 'results',
      step: '04',
      title: '评判结果',
      description: '用于呈现风险、依据、结论与后续处置建议。',
    },
  ],
};
```

- [ ] **Step 5: Implement the public shell page**

Render:

- a compact AGULAB brand link back to `/`;
- the eyebrow, title, description, and status from `platformContent`;
- four semantic `<article>` workflow cards;
- a disabled `<button type="button" disabled>` labelled `开始评判`;
- an adjacent explanatory sentence `具体评判对象与流程确认后开放`.

Use CSS Modules for the page layout and `index.css` for tokens. At widths below `760px`, cards must collapse to one column. Keep visible `:focus-visible` styles and semantic heading order (`h1` followed by `h2` card titles).

- [ ] **Step 6: Run unit tests and production build**

Run:

```powershell
cd frontend-public
npm test -- --run
npm run build
```

Expected: all tests pass and `dist/index.html` references `/evaluate/assets/`.

- [ ] **Step 7: Extend `.gitignore`**

Add:

```gitignore
frontend-public/node_modules/
frontend-public/dist/
```

- [ ] **Step 8: Point the website development link at the public shell**

Update the existing test expectation:

```ts
expect(getPlatformUrl(true)).toBe(
  'http://127.0.0.1:3001/evaluate/',
)
```

Keep the production expectation `/evaluate`. Update `getPlatformUrl()` to return the tested development URL.

Run:

```powershell
cd website
npm test -- --run src/lib/external-link.test.ts
```

Expected: the website link tests pass.

- [ ] **Step 9: Commit the public shell**

```powershell
git add .gitignore frontend-public website/src/lib/external-link.ts website/src/lib/external-link.test.ts
git commit -m "feat: add public evaluation platform shell"
```

---

### Task 2: Move the Existing Platform into the Tianxin Path Space

**Files:**
- Create: `frontend/src/config/routes.js`
- Create: `frontend/src/config/routes.test.js`
- Modify: `frontend/src/main.jsx`
- Modify: `frontend/vite.config.js`
- Modify: `frontend/src/services/api.js`
- Modify: `frontend/src/utils/safeRedirect.js`
- Modify: `frontend/src/utils/safeRedirect.test.js`

**Interfaces:**
- Produces: `TIANXIN_BASE = '/evaluate_tianxin'`.
- Produces: `TIANXIN_LOGIN_URL = '/evaluate_tianxin/login'`.
- Produces: Tianxin assets whose URLs start with `/evaluate_tianxin/`.
- Consumes: existing in-app route values such as `/login`, `/evaluate`, and `/report/:id`; React Router basename prepends the external path.

- [ ] **Step 1: Write failing route-constant tests**

```js
import { describe, expect, it } from 'vitest';
import { TIANXIN_BASE, TIANXIN_LOGIN_URL } from './routes';

describe('Tianxin route configuration', () => {
  it('uses the dedicated Tianxin path space', () => {
    expect(TIANXIN_BASE).toBe('/evaluate_tianxin');
    expect(TIANXIN_LOGIN_URL).toBe('/evaluate_tianxin/login');
  });
});
```

- [ ] **Step 2: Extend safe redirect tests before implementation**

Add assertions:

```js
it('normalizes a fully prefixed Tianxin route', () => {
  expect(
    getSafeRedirect('/evaluate_tianxin/report/abc?tab=detail'),
  ).toBe('/report/abc?tab=detail');
});

it('rejects a lookalike Tianxin prefix', () => {
  expect(getSafeRedirect('/evaluate_tianxin-evil/report/abc')).toBe(
    '/evaluate',
  );
});
```

- [ ] **Step 3: Run the focused tests and verify failure**

Run:

```powershell
cd frontend
npm test -- --run src/config/routes.test.js src/utils/safeRedirect.test.js
```

Expected: FAIL because `src/config/routes.js` is missing and prefixed redirects are not normalized.

- [ ] **Step 4: Implement canonical route constants and redirect normalization**

Create:

```js
export const TIANXIN_BASE = '/evaluate_tianxin';
export const TIANXIN_LOGIN_URL = `${TIANXIN_BASE}/login`;
```

Update `getSafeRedirect(from)` to strip exactly one leading `TIANXIN_BASE` before applying the existing allowlist:

```js
const normalized =
  from === TIANXIN_BASE
    ? '/evaluate'
    : from.startsWith(`${TIANXIN_BASE}/`)
      ? from.slice(TIANXIN_BASE.length)
      : from;
```

Keep rejection of protocol-relative, absolute external, unrelated, and lookalike-prefix values.

- [ ] **Step 5: Configure React Router and Vite bases**

In `frontend/src/main.jsx`:

```jsx
import { TIANXIN_BASE } from './config/routes';

<BrowserRouter basename={TIANXIN_BASE}>
  <AuthProvider>
    <App />
  </AuthProvider>
</BrowserRouter>
```

In `frontend/vite.config.js`, add:

```js
base: '/evaluate_tianxin/',
```

- [ ] **Step 6: Fix the hard 401 navigation**

Import `TIANXIN_LOGIN_URL` in `frontend/src/services/api.js` and replace:

```js
window.location.href = '/login';
```

with:

```js
window.location.href = TIANXIN_LOGIN_URL;
```

Router-driven links and `<Navigate to="/login">` remain internal route values because the basename adds `/evaluate_tianxin`.

- [ ] **Step 7: Run tests and production build**

Run:

```powershell
cd frontend
npm test -- --run
npm run build
```

Expected: tests pass and `dist/index.html` references `/evaluate_tianxin/assets/`.

- [ ] **Step 8: Commit the Tianxin path migration**

Stage only the files listed in this task; explicitly do not stage pre-existing unrelated history-page changes.

```powershell
git add frontend/src/config frontend/src/main.jsx frontend/vite.config.js frontend/src/services/api.js frontend/src/utils/safeRedirect.js frontend/src/utils/safeRedirect.test.js
git commit -m "feat: move Tianxin platform under dedicated path"
```

---

### Task 3: Route and Mount All Three Frontends

**Files:**
- Modify: `nginx.conf`
- Modify: `docker-compose.yml`
- Modify: `scripts/serve-integration.py`
- Create: `scripts/test_serve_integration.py`
- Modify: `scripts/verify-integration.ps1`

**Interfaces:**
- Consumes: `website/dist`, `frontend-public/dist`, and `frontend/dist`.
- Produces: `/` website routing, `/evaluate/*` public routing, and `/evaluate_tianxin/*` Tianxin routing.
- Preserves: `/api/*` proxy to `backend:8000`.

- [ ] **Step 1: Write failing local route-classification tests**

Refactor `serve-integration.py` to expose a pure function in the next implementation step, but write this test first:

```python
import unittest

from scripts.serve_integration import classify_path


class RouteClassificationTests(unittest.TestCase):
    def test_routes_three_frontends(self):
        self.assertEqual(classify_path("/"), ("website", "index.html"))
        self.assertEqual(
            classify_path("/evaluate/"),
            ("public", "index.html"),
        )
        self.assertEqual(
            classify_path("/evaluate/assets/app.js"),
            ("public", "assets/app.js"),
        )
        self.assertEqual(
            classify_path("/evaluate_tianxin/history"),
            ("tianxin", "index.html"),
        )
        self.assertEqual(
            classify_path("/evaluate_tianxin/assets/app.js"),
            ("tianxin", "assets/app.js"),
        )

    def test_does_not_treat_lookalike_prefix_as_platform(self):
        self.assertEqual(
            classify_path("/evaluate_tianxin-evil"),
            ("website", "index.html"),
        )
```

- [ ] **Step 2: Run the route test and verify failure**

Run:

```powershell
& .\.venv\Scripts\python.exe -m unittest scripts/test_serve_integration.py -v
```

Expected: FAIL because `classify_path` does not exist.

- [ ] **Step 3: Implement local three-app route classification**

Rename the existing platform constants:

```python
PUBLIC_DIST = (PROJECT_ROOT / "frontend-public" / "dist").resolve()
TIANXIN_DIST = (PROJECT_ROOT / "frontend" / "dist").resolve()
```

Implement:

```python
def classify_path(path: str) -> tuple[str, str]:
    clean_path = path.split("?", 1)[0]
    if clean_path == "/evaluate" or clean_path.startswith("/evaluate/"):
        relative = clean_path.removeprefix("/evaluate").lstrip("/")
        if relative.startswith("assets/"):
            return ("public", relative)
        return ("public", "index.html")
    if (
        clean_path == "/evaluate_tianxin"
        or clean_path.startswith("/evaluate_tianxin/")
    ):
        relative = clean_path.removeprefix("/evaluate_tianxin").lstrip("/")
        if not relative.startswith("assets/"):
            relative = "index.html"
        return ("tianxin", relative or "index.html")
    return ("website", "index.html")
```

For the public application, return `index.html` for any non-file nested route. Map asset paths to their matching build directory. Keep `/api/*` proxying and `/website-static/*` handling unchanged. Validate all three build directories at startup.

- [ ] **Step 4: Update Docker mounts**

Mount:

```yaml
- ./website/dist:/usr/share/nginx/website:ro
- ./frontend-public/dist:/usr/share/nginx/html/evaluate:ro
- ./frontend/dist:/usr/share/nginx/html/evaluate_tianxin:ro
```

Do not change backend volumes or environment variables.

- [ ] **Step 5: Replace Nginx platform routing**

Preserve the `/api/` proxy and `/website-static/` website assets. Add:

```nginx
location = /evaluate {
    return 302 /evaluate/;
}

location ^~ /evaluate/ {
    root /usr/share/nginx/html;
    try_files $uri $uri/ /evaluate/index.html;
    add_header Cache-Control "no-cache";
}

location = /evaluate_tianxin {
    return 302 /evaluate_tianxin/;
}

location ^~ /evaluate_tianxin/ {
    root /usr/share/nginx/html;
    try_files $uri $uri/ /evaluate_tianxin/index.html;
    add_header Cache-Control "no-cache";
}
```

Add longer, exact asset-prefix locations before the SPA locations so hashed files receive `Cache-Control: public, immutable` and missing assets return 404 instead of an HTML fallback:

```nginx
location ^~ /evaluate/assets/ {
    root /usr/share/nginx/html;
    try_files $uri =404;
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

Repeat for `/evaluate_tianxin/assets/`.

- [ ] **Step 6: Expand production integration checks**

Update `scripts/verify-integration.ps1` to assert:

```powershell
@{ Path = '/'; Contains = '<title>AGULAB' }
@{ Path = '/evaluate/'; Contains = 'content="AGULAB Public Evaluation"' }
@{ Path = '/evaluate_tianxin/login'; Contains = 'content="SafeEvaluate"' }
@{ Path = '/evaluate_tianxin/evaluate'; Contains = 'content="SafeEvaluate"' }
@{ Path = '/evaluate_tianxin/history'; Contains = 'content="SafeEvaluate"' }
@{ Path = '/evaluate_tianxin/report/test-id'; Contains = 'content="SafeEvaluate"' }
@{ Path = '/evaluate_tianxin/rules'; Contains = 'content="SafeEvaluate"' }
@{ Path = '/evaluate_tianxin/stats'; Contains = 'content="SafeEvaluate"' }
```

Also request one asset extracted from each application HTML and assert HTTP 200. Continue checking `/api/health`.

- [ ] **Step 7: Run route tests**

Run:

```powershell
& .\.venv\Scripts\python.exe -m unittest scripts/test_serve_integration.py -v
```

Expected: all classification tests pass.

- [ ] **Step 8: Commit deployment routing**

```powershell
git add nginx.conf docker-compose.yml scripts/serve-integration.py scripts/test_serve_integration.py scripts/verify-integration.ps1
git commit -m "feat: route public and Tianxin platforms independently"
```

---

### Task 4: Build and Deployment Documentation

**Files:**
- Modify: `scripts/build-frontends.ps1`
- Modify: `README.md`
- Modify: `DEPLOY.md`

**Interfaces:**
- Produces: one build command that validates `website`, `frontend-public`, and `frontend`.
- Documents: the three production entry points and the unchanged `/api/*` backend route.

- [ ] **Step 1: Extend the frontend build script**

Keep the existing `Invoke-Npm` helper. Add a `frontend-public` block between website and Tianxin:

```powershell
Push-Location (Join-Path $projectRoot 'frontend-public')
try {
  Invoke-Npm -Arguments @('ci')
  Invoke-Npm -Arguments @('test', '--', '--run')
  Invoke-Npm -Arguments @('run', 'build')
} finally {
  Pop-Location
}
```

Change the final message to:

```powershell
Write-Host 'Website, public platform, and Tianxin platform built successfully.'
```

- [ ] **Step 2: Update the route documentation**

Document exactly:

```text
/                         AGULAB 官网
/evaluate                 通用自动合规评判平台框架
/evaluate_tianxin         天心区定制评判平台
/api/*                    SafeEvaluate 后端接口
```

Explain that `frontend-public` is a non-functional framework in this phase and that the current authenticated platform remains in `frontend`.

- [ ] **Step 3: Update deployment commands**

The deployment guide must build all frontends with:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-frontends.ps1
```

The release package must include both `frontend-public/dist/` and `frontend/dist/`. Keep `.env`, `backend/data/`, and `requirement/` exclusions unchanged.

- [ ] **Step 4: Run the three-frontend build**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-frontends.ps1
```

Expected: website lint/tests/build, public tests/build, and Tianxin tests/build all pass.

- [ ] **Step 5: Commit build and documentation updates**

```powershell
git add scripts/build-frontends.ps1 README.md DEPLOY.md
git commit -m "docs: document dual evaluation platform deployment"
```

---

### Task 5: End-to-End Verification and Release Readiness

**Files:**
- Modify only if verification finds a scoped defect in files from Tasks 1–4.

**Interfaces:**
- Consumes: all three frontend builds and the unchanged backend.
- Produces: evidence that routes, builds, and existing tests pass.

- [ ] **Step 1: Run backend checks**

Run:

```powershell
& .\.venv\Scripts\python.exe -m unittest discover -s backend -p 'test_*.py' -v
& .\.venv\Scripts\python.exe -m compileall -q backend
```

Expected: all backend tests pass and compileall exits 0.

- [ ] **Step 2: Run local routing tests**

Run:

```powershell
& .\.venv\Scripts\python.exe -m unittest scripts/test_serve_integration.py -v
```

Expected: all routing tests pass.

- [ ] **Step 3: Start the local integrated preview**

Start the existing backend on `127.0.0.1:8000`, then start:

```powershell
& .\.venv\Scripts\python.exe scripts/serve-integration.py --port 8080
```

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-integration.ps1 -BaseUrl http://127.0.0.1:8080
```

Expected: all route and health checks pass.

- [ ] **Step 4: Perform browser-level checks**

Inspect desktop and mobile widths for:

- `/`: website renders and its evaluation link targets `/evaluate`;
- `/evaluate/`: neutral four-area shell, disabled action, no restricted product wording;
- `/evaluate_tianxin/login`: existing login page;
- authenticated Tianxin navigation: all links stay under `/evaluate_tianxin/*`;
- direct refresh of `/evaluate_tianxin/history` and `/evaluate_tianxin/report/test-id`: Tianxin application shell loads.

- [ ] **Step 5: Inspect working-tree scope**

Run:

```powershell
git status --short
git diff --check
git log -6 --oneline
```

Expected: only the pre-existing unrelated modifications in `debug_ai_response.txt` and `frontend/src/pages/history/*` remain unstaged. No generated `dist` or `node_modules` files are tracked.

- [ ] **Step 6: Commit scoped verification fixes if necessary**

If verification required changes, stage only the scoped files and commit:

```powershell
git commit -m "fix: complete dual platform route verification"
```

If no changes were necessary, do not create an empty commit.
