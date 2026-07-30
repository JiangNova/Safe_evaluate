# Public Evaluation Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/evaluate/` placeholder with a functional anonymous evaluation flow based on the existing internal platform while keeping management and historical data private.

**Architecture:** Add narrowly scoped `/api/public/*` routes that reuse the existing evaluation engine but use generic standards context and expose no collection or write-management endpoints. Build the public React application from public-specific route/page adapters while reusing the internal platform’s stable presentational components and CSS modules.

**Tech Stack:** FastAPI, Pydantic, pytest, React 18, React Router 7, Axios, Vite, Vitest

## Global Constraints

- The public flow is upload → optional built-in rule selection → evaluation → current report.
- Remove login, logout, history, statistics, rule CRUD, and organization/location branding from `/evaluate/`.
- Do not delete or rewrite the existing `/evaluate_tianxin/` application or stored reports.
- The public API must not expose report collections, statistics, custom rules, or rule mutation.
- Public evaluation must not load the police-station-specific requirement documents or output templates.
- Preserve the current internal authenticated API behavior.
- Do not modify the user’s uncommitted history-page changes.

---

### Task 1: Public API Contract

**Files:**
- Create: `backend/test_public_api.py`
- Modify: `backend/main.py`

**Interfaces:**
- Produces: `POST /api/public/evaluate`, `GET /api/public/rules`, `GET /api/public/reports/{report_id}`, and `GET /api/public/reports/{report_id}/images/{image_index}`.
- Preserves: all existing authenticated `/api/evaluate`, `/api/reports*`, `/api/rules*`, and `/api/stats` routes.

- [ ] **Step 1: Write failing route and sanitization tests**

```python
def test_public_route_surface_is_narrow():
    routes = {(route.path, method) for route in app.routes for method in route.methods}
    assert ("/api/public/evaluate", "POST") in routes
    assert ("/api/public/rules", "GET") in routes
    assert ("/api/public/reports", "GET") not in routes
    assert ("/api/public/stats", "GET") not in routes

def test_public_rules_are_builtin_and_neutral():
    response = client.get("/api/public/rules")
    assert response.status_code == 200
    payload = response.json()
    assert all(not item["is_custom"] for item in payload["items"])
    assert all("派出所" not in str(item) and "天心区" not in str(item) for item in payload["items"])
```

- [ ] **Step 2: Run the tests and verify the public routes are missing**

Run: `.\.venv\Scripts\python.exe -m pytest backend/test_public_api.py -q`

Expected: FAIL because `/api/public/*` is not defined.

- [ ] **Step 3: Extract shared evaluation execution and add public wrappers**

Refactor the existing evaluation body into:

```python
async def _run_evaluation(
    files: List[UploadFile],
    rules: str,
    *,
    use_local_requirements: bool = True,
) -> EvaluateResponse:
    docs = load_all_requirements() if use_local_requirements else []
    templates = load_output_templates() if use_local_requirements else []
    ...
```

The authenticated route calls `_run_evaluation(..., use_local_requirements=True)`. The public route calls `_run_evaluation(..., use_local_requirements=False)`. Add a report helper accepting `image_base_url` so public report images use `/api/public/reports/...`.

Return only non-custom, neutral built-in rules from `GET /api/public/rules`; exclude any item whose serialized visible fields contain `天心区`, `公安分局`, or `派出所`.

- [ ] **Step 4: Test public and internal contracts**

Run: `.\.venv\Scripts\python.exe -m pytest backend/test_public_api.py backend/test_config_guard.py -q`

Expected: PASS.

- [ ] **Step 5: Commit the public API**

```powershell
git add backend/main.py backend/test_public_api.py
git commit -m "feat: add isolated public evaluation api"
```

### Task 2: Public Application Shell and API Client

**Files:**
- Modify: `frontend-public/package.json`
- Modify: `frontend-public/package-lock.json`
- Modify: `frontend-public/src/main.jsx`
- Modify: `frontend-public/src/App.jsx`
- Modify: `frontend-public/src/App.module.css`
- Modify: `frontend-public/src/index.css`
- Create: `frontend-public/src/services/api.js`
- Create: `frontend-public/src/components/PublicLayout.jsx`
- Create: `frontend-public/src/components/PublicLayout.module.css`
- Create: `frontend-public/src/App.test.jsx`

**Interfaces:**
- Produces: `submitEvaluation(formData)`, `getReport(id)`, and `getRules()` against `/api/public`.
- Produces routes: `/`, `/summary`, and `/report/:id` under `BrowserRouter basename="/evaluate"`.

- [ ] **Step 1: Add failing route/content tests**

```jsx
it('contains only public evaluation routes and neutral navigation', () => {
  expect(source).toContain('path="/"')
  expect(source).toContain('path="/summary"')
  expect(source).toContain('path="/report/:id"')
  expect(source).not.toMatch(/login|history|stats|rules\/manage/i)
})
```

- [ ] **Step 2: Run Vitest and verify failure**

Run: `npm test -- --run`

Working directory: `frontend-public`

Expected: FAIL because the router and client do not exist.

- [ ] **Step 3: Add dependencies and implement the public shell**

Add `axios` and `react-router-dom`. Wrap the app in:

```jsx
<BrowserRouter basename="/evaluate">
  <App />
</BrowserRouter>
```

Build a responsive header with AGULAB, “自动安全评估平台”, and “返回官网”. Use a nested layout with only the three public routes and redirect unknown paths to `/`.

- [ ] **Step 4: Implement the public API client**

```js
const api = axios.create({ baseURL: '/api/public', timeout: 60000 })
export const submitEvaluation = (data) =>
  api.post('/evaluate', data, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 300000 })
export const getReport = (id) => api.get(`/reports/${id}`)
export const getRules = () => api.get('/rules')
```

Do not add token handling or a 401 login redirect.

- [ ] **Step 5: Run tests and build**

Run: `npm test -- --run && npm run build`

Working directory: `frontend-public`

Expected: PASS.

- [ ] **Step 6: Commit the public shell**

```powershell
git add frontend-public
git commit -m "feat: add public evaluation application shell"
```

### Task 3: Evaluation and Report Flow

**Files:**
- Create: `frontend-public/src/pages/EvaluatePage.jsx`
- Create: `frontend-public/src/pages/RuleSelector.jsx`
- Create: `frontend-public/src/pages/SummaryPage.jsx`
- Create: `frontend-public/src/pages/ReportPage.jsx`
- Modify: `frontend-public/src/App.jsx`
- Modify: `frontend-public/src/App.test.jsx`

**Interfaces:**
- Consumes: public API functions from Task 2.
- Reuses: upload, button, loading, finding, statistics, inspection, and correction presentational components from `frontend/src`.
- Produces: complete single and multi-image evaluation navigation.

- [ ] **Step 1: Add failing copy and navigation tests**

```jsx
it.each(['天心区', '公安分局', '派出所', '历史记录', '统计分析', '规则管理'])(
  'does not expose %s in the public source tree',
  (term) => expect(publicSource).not.toContain(term),
)

it('returns from a report to a new evaluation', () => {
  expect(reportSource).toContain("navigate('/')")
  expect(reportSource).toContain('返回继续评估')
})
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- --run`

Working directory: `frontend-public`

Expected: FAIL because the pages are not implemented.

- [ ] **Step 3: Port the evaluation workflow**

Reuse the internal visual components and CSS modules, but import `submitEvaluation` and `getRules` from the public client. Preserve single and per-image modes, retries, progress, and summary navigation. Change internal paths:

```js
navigate(`/report/${reportId}`)
navigate(`/summary?ids=${ids.join(',')}`)
```

Use the neutral empty-rule message `暂无可用的公开评估规则，系统仍可依据通用标准进行评估`.

- [ ] **Step 4: Port summary and report views**

Use `getReport` from the public client. Link summary cards to `/report/:id`. Replace every history action with:

```jsx
<Button variant="secondary" onClick={() => navigate('/')}>
  返回继续评估
</Button>
```

Do not render raw AI debugging output on the public report page.

- [ ] **Step 5: Run public tests and build**

Run: `npm test -- --run && npm run build`

Working directory: `frontend-public`

Expected: PASS.

- [ ] **Step 6: Commit the complete flow**

```powershell
git add frontend-public/src
git commit -m "feat: complete anonymous evaluation flow"
```

### Task 4: Integration, Content Audit, and Regression Verification

**Files:**
- Modify: `frontend-public/src/content/platformContent.test.js`
- Modify: `README.md`
- Modify: `DEPLOY.md` if deployment wording still calls `/evaluate/` a placeholder

**Interfaces:**
- Confirms: website → `/evaluate/` → public API → current report.
- Confirms: internal `/evaluate_tianxin/` remains buildable and authenticated.

- [ ] **Step 1: Replace placeholder assertions with public-surface assertions**

```js
it.each(['天心区', '公安分局', '派出所', '历史记录', '统计分析', '规则管理'])(
  'keeps %s out of public source and content',
  (term) => expect(publicText).not.toContain(term),
)
```

- [ ] **Step 2: Update documentation**

Describe `/evaluate/` as the functional anonymous evaluation platform and `/evaluate_tianxin/` as the retained internal authenticated platform. State that public users cannot browse saved reports.

- [ ] **Step 3: Run all automated checks**

Run:

```powershell
.\.venv\Scripts\python.exe -m pytest backend -q
powershell -ExecutionPolicy Bypass -File scripts/build-frontends.ps1
git diff --check
```

Expected: all tests and three frontend builds PASS; `git diff --check` prints no errors.

- [ ] **Step 4: Run a scoped keyword audit**

Search only `website/src` and `frontend-public/src`. Verify public runtime files contain none of `天心区`, `公安分局`, `派出所`, `历史记录`, `统计分析`, or `规则管理`. Test files may contain those terms only as negative assertions.

- [ ] **Step 5: Smoke-test the integrated preview**

Start: `powershell -ExecutionPolicy Bypass -File scripts/start-local.ps1 -NoBrowser`

Verify:

- `/` loads the website.
- The website “立即体验” opens `/evaluate/`.
- `/evaluate/` has no login or management navigation.
- A deliberately invalid upload returns a clear validation error.
- `/api/public/reports` and `/api/public/stats` return 404.
- `/api/reports` still returns 401 without an internal token.

- [ ] **Step 6: Commit integration documentation and tests**

```powershell
git add README.md DEPLOY.md frontend-public/src/content/platformContent.test.js
git commit -m "docs: document public evaluation workflow"
```
