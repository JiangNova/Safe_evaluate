# Anonymous Workspace and Resource Reuse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add recoverable anonymous workspaces with reusable standards, templates, versions, and business scenarios while preserving one-time 24-hour jobs.

**Architecture:** Workspace credentials are independent from job credentials. Immutable asset versions live in workspace storage; jobs bind snapshots of selected versions so later edits cannot alter an active evaluation. The public wizard can either start from a scenario or mix saved resources with temporary uploads.

**Tech Stack:** Python 3.10, FastAPI, SQLite, Pydantic, React 18, React Router, Axios, Vitest, standard-library `unittest`.

## Global Constraints

- Do not require account registration.
- Store only SHA-256 hashes of workspace recovery secrets and job tokens.
- Workspaces expire after one year of inactivity plus a 30-day grace period; successful access renews the one-year window.
- Job materials, temporary inputs, evaluation data, and artifacts remain on the existing 24-hour lifecycle.
- Asset versions are immutable; editing creates a new version.
- Existing jobs with `workspace_id = NULL` remain fully compatible.
- Preserve the user's unrelated `frontend/src/pages/history/HistoryPage.module.css` change.
- Use `unittest`, not pytest, in this repository environment.

---

### Task 1: Workspace persistence and recovery authentication

**Files:**
- Create: `backend/public_workspaces.py`
- Create: `backend/test_public_workspaces.py`
- Modify: `backend/config.py`

**Interfaces:**
- Produces: `create_workspace(name: str = "") -> tuple[dict, str]`
- Produces: `authorize_workspace(workspace_id: str, raw_secret: str, *, renew: bool = True) -> dict`
- Produces: `delete_workspace(workspace_id: str) -> None`
- Produces: `list_expired_workspace_ids(now: datetime | None = None) -> list[str]`

- [ ] **Step 1: Write failing workspace lifecycle tests**

```python
def test_create_persists_hash_and_authorize_renews(self):
    workspace, secret = public_workspaces.create_workspace("我的工作区")
    row = public_workspaces._fetch_workspace_row(workspace["id"])
    self.assertNotIn(secret, row["access_secret_hash"])
    renewed = public_workspaces.authorize_workspace(workspace["id"], secret)
    self.assertEqual(renewed["name"], "我的工作区")

def test_wrong_secret_and_grace_expiry_are_rejected(self):
    workspace, _ = public_workspaces.create_workspace()
    with self.assertRaises(PermissionError):
        public_workspaces.authorize_workspace(workspace["id"], "wrong")
```

- [ ] **Step 2: Run tests and verify failure**

Run: `.\.venv\Scripts\python.exe -m unittest backend.test_public_workspaces -v`

Expected: FAIL because `backend.public_workspaces` does not exist.

- [ ] **Step 3: Implement the workspace table and credential functions**

Create `public_workspaces` with `id`, `access_secret_hash`, `name`, `status`, `created_at`, `last_accessed_at`, and `cleanup_after`. Generate secrets with `secrets.token_urlsafe(32)`, compare SHA-256 hashes with `hmac.compare_digest`, and set `cleanup_after = now + timedelta(days=365)` on successful authorization.

Add exact configuration values:

```python
PUBLIC_WORKSPACE_ACTIVE_DAYS = int(os.getenv("PUBLIC_WORKSPACE_ACTIVE_DAYS", "365"))
PUBLIC_WORKSPACE_GRACE_DAYS = int(os.getenv("PUBLIC_WORKSPACE_GRACE_DAYS", "30"))
PUBLIC_WORKSPACE_STORAGE_DIR = os.path.join(os.path.dirname(__file__), "data", "public_workspaces")
```

- [ ] **Step 4: Run tests**

Run: `.\.venv\Scripts\python.exe -m unittest backend.test_public_workspaces -v`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add backend/public_workspaces.py backend/test_public_workspaces.py backend/config.py
git commit -m "feat: add recoverable anonymous workspaces"
```

### Task 2: Immutable assets, versions, and business scenarios

**Files:**
- Create: `backend/workspace_assets.py`
- Create: `backend/test_workspace_assets.py`

**Interfaces:**
- Consumes: `public_workspaces.authorize_workspace()`
- Produces: `create_asset(workspace_id: str, asset_type: str, name: str, description: str = "", tags: list[str] | None = None) -> dict`
- Produces: `add_asset_version(asset_id: int, source: WorkspaceAssetSource) -> dict`
- Produces: `list_assets(workspace_id: str, asset_type: str | None = None) -> list[dict]`
- Produces: `create_scenario(workspace_id: str, name: str, goal_template: str, basis_version_ids: list[int], template_version_ids: list[int]) -> dict`

Define `WorkspaceAssetSource` as a frozen dataclass with `source_kind: Literal["file", "text_freeform", "text_structured"]`, `source_text: str | None`, `file_path: str | None`, `original_name: str | None`, `mime_type: str | None`, `parsed_content: dict | None`, and `compiled_template: dict | None`.

- [ ] **Step 1: Write failing version and scenario tests**

```python
def test_asset_versions_are_append_only(self):
    asset = workspace_assets.create_asset(self.workspace_id, "basis", "员工手册")
    v1 = workspace_assets.add_asset_version(asset["id"], self.text_source("第一版"))
    v2 = workspace_assets.add_asset_version(asset["id"], self.text_source("第二版"))
    self.assertEqual((v1["version_number"], v2["version_number"]), (1, 2))
    self.assertEqual(workspace_assets.get_asset_version(v1["id"])["source_text"], "第一版")

def test_scenario_rejects_versions_from_another_workspace(self):
    with self.assertRaises(PermissionError):
        workspace_assets.create_scenario(self.workspace_id, "处罚", "按制度评估", [foreign_id], [])
```

- [ ] **Step 2: Run tests and verify failure**

Run: `.\.venv\Scripts\python.exe -m unittest backend.test_workspace_assets -v`

Expected: FAIL because asset functions are undefined.

- [ ] **Step 3: Implement tables and storage boundaries**

Create `workspace_assets`, `workspace_asset_versions`, and `workspace_scenarios`. Store file versions under `<PUBLIC_WORKSPACE_STORAGE_DIR>/<workspace_id>/<asset_id>/<version>/`; validate every resolved path with `os.path.commonpath`. Accept source kinds `file`, `text_freeform`, and `text_structured`. Update `current_version_id` only after the version row is committed.

- [ ] **Step 4: Run tests**

Run: `.\.venv\Scripts\python.exe -m unittest backend.test_workspace_assets backend.test_public_workspaces -v`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add backend/workspace_assets.py backend/test_workspace_assets.py
git commit -m "feat: version workspace standards and templates"
```

### Task 3: Workspace and library HTTP API

**Files:**
- Create: `backend/workspace_models.py`
- Create: `backend/workspace_routes.py`
- Create: `backend/test_workspace_routes.py`
- Modify: `backend/main.py`

**Interfaces:**
- Consumes: workspace and asset functions from Tasks 1-2.
- Produces: `/api/public/workspaces`, `/assets`, `/versions`, and `/scenarios` routes.
- Uses header: `X-Workspace-Token` for every route after creation.

- [ ] **Step 1: Write failing route contract and authorization tests**

```python
def test_workspace_route_surface(self):
    paths = self.app.openapi()["paths"]
    self.assertIn("/api/public/workspaces", paths)
    self.assertIn("/api/public/workspaces/{workspace_id}/assets", paths)
    self.assertIn("/api/public/workspaces/{workspace_id}/scenarios", paths)

def test_asset_list_requires_workspace_token(self):
    response = self.client.get(f"/api/public/workspaces/{self.workspace_id}/assets")
    self.assertEqual(response.status_code, 401)
```

- [ ] **Step 2: Run tests and verify failure**

Run: `.\.venv\Scripts\python.exe -m unittest backend.test_workspace_routes -v`

Expected: FAIL because routes are absent.

- [ ] **Step 3: Implement Pydantic requests and route payloads**

Return the raw recovery secret only from `POST /workspaces`. Never expose storage paths or hashes. Support file and JSON text versions, soft deletion, tag filtering, version listing, and scenario create/update/delete. Normalize errors to `{code, message, stage}` using the existing public route convention.

- [ ] **Step 4: Run tests and inspect OpenAPI**

Run: `.\.venv\Scripts\python.exe -m unittest backend.test_workspace_routes -v`

Run: `.\.venv\Scripts\python.exe -c "from backend.main import app; print('\n'.join(sorted(app.openapi()['paths'])))"`

Expected: tests PASS and workspace paths appear without exposing management-only routes.

- [ ] **Step 5: Commit**

```powershell
git add backend/workspace_models.py backend/workspace_routes.py backend/test_workspace_routes.py backend/main.py
git commit -m "feat: expose anonymous workspace library API"
```

### Task 4: Bind immutable workspace resource snapshots to jobs

**Files:**
- Modify: `backend/public_jobs.py`
- Modify: `backend/public_job_routes.py`
- Modify: `backend/models.py`
- Modify: `backend/test_public_jobs.py`
- Modify: `backend/test_public_job_routes.py`

**Interfaces:**
- Produces: `bind_job_resource(job_id: str, resource_kind: str, asset_version_id: int, snapshot: dict) -> dict`
- Produces: `POST /api/public/workspaces/{workspace_id}/scenarios/{scenario_id}/jobs`
- Produces: `DELETE /api/public/jobs/{job_id}` with normal job-token authorization and idempotent physical cleanup.
- Produces: optional `workspace_id`, `basis_version_ids`, and `template_version_ids` in job creation.

- [ ] **Step 1: Write failing snapshot tests**

```python
def test_job_snapshot_survives_asset_soft_delete(self):
    binding = public_jobs.bind_job_resource(self.job_id, "basis", self.version_id, {"text": "制度第一版"})
    workspace_assets.delete_asset(self.asset_id)
    self.assertEqual(public_jobs.list_job_resources(self.job_id)[0]["snapshot_json"]["text"], "制度第一版")
```

- [ ] **Step 2: Run tests and verify failure**

Run: `.\.venv\Scripts\python.exe -m unittest backend.test_public_jobs backend.test_public_job_routes -v`

Expected: FAIL because job resource bindings do not exist.

- [ ] **Step 3: Implement schema migration and scenario job creation**

Add nullable `workspace_id` to `public_jobs` with an idempotent SQLite migration. Add `public_job_resources(job_id, resource_kind, asset_version_id, snapshot_json, created_at)`. Scenario creation authorizes the workspace, creates a normal high-entropy job token, copies version parse/compile snapshots, and registers file-backed versions as job input references without duplicating mutable metadata.

- [ ] **Step 4: Run tests**

Run: `.\.venv\Scripts\python.exe -m unittest backend.test_public_jobs backend.test_public_job_routes backend.test_workspace_routes -v`

Expected: PASS, including legacy `workspace_id = NULL` jobs.

- [ ] **Step 5: Commit**

```powershell
git add backend/public_jobs.py backend/public_job_routes.py backend/models.py backend/test_public_jobs.py backend/test_public_job_routes.py
git commit -m "feat: snapshot workspace resources into jobs"
```

### Task 5: Workspace session, recovery, and library frontend

**Files:**
- Create: `frontend-public/src/services/workspaceSession.js`
- Create: `frontend-public/src/pages/WorkspaceEntryPage.jsx`
- Create: `frontend-public/src/pages/WorkspaceLibraryPage.jsx`
- Create: `frontend-public/src/components/RecoverySecretDialog.jsx`
- Modify: `frontend-public/src/services/api.js`
- Modify: `frontend-public/src/App.jsx`
- Modify: `frontend-public/src/App.module.css`
- Modify: `frontend-public/src/App.test.jsx`

**Interfaces:**
- Produces: `saveWorkspaceSession`, `getWorkspaceToken`, `clearWorkspaceSession`.
- Produces routes: `/workspace`, `/workspace/:workspaceId/library`.

- [ ] **Step 1: Add failing source-contract tests**

```javascript
it('supports creating and recovering an anonymous workspace', () => {
  const source = readSource('pages/WorkspaceEntryPage.jsx');
  expect(source).toContain('创建长期工作区');
  expect(source).toContain('使用恢复码进入');
  expect(source).toContain('RecoverySecretDialog');
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- --run` in `frontend-public`.

Expected: FAIL because workspace pages are absent.

- [ ] **Step 3: Implement session and library UI**

Store the workspace token in localStorage only after explicit user confirmation; keep job tokens in sessionStorage. Show the raw recovery secret once with copy/download actions and a confirmation checkbox. The library provides Standard, Template, and Scenario tabs with search, tags, version history, create, soft delete, and “start evaluation” actions.

- [ ] **Step 4: Run tests and build**

Run: `npm test -- --run`

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add frontend-public/src/services/workspaceSession.js frontend-public/src/pages/WorkspaceEntryPage.jsx frontend-public/src/pages/WorkspaceLibraryPage.jsx frontend-public/src/components/RecoverySecretDialog.jsx frontend-public/src/services/api.js frontend-public/src/App.jsx frontend-public/src/App.module.css frontend-public/src/App.test.jsx
git commit -m "feat: add anonymous workspace library"
```

### Task 6: Reusable resource picker and scenario-first wizard

**Files:**
- Create: `frontend-public/src/components/ResourcePicker.jsx`
- Create: `frontend-public/src/components/ScenarioCard.jsx`
- Create: `frontend-public/src/pages/WorkspaceNewJobPage.jsx`
- Modify: `frontend-public/src/pages/JobWizardPage.jsx`
- Modify: `frontend-public/src/services/api.js`
- Modify: `frontend-public/src/App.module.css`
- Modify: `frontend-public/src/App.test.jsx`

**Interfaces:**
- Consumes workspace assets/scenarios and scenario-job API.
- Produces a source union per basis/template item: `{source: 'workspace'|'upload'|'text', ...}`.

- [ ] **Step 1: Write failing wizard contract tests**

```javascript
it('allows saved, uploaded, and text resources in a new evaluation', () => {
  const source = readSource('components/ResourcePicker.jsx');
  for (const label of ['从工作区选择', '临时上传', '文字输入']) expect(source).toContain(label);
  expect(source).toContain('保存到工作区');
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- --run` in `frontend-public`.

Expected: FAIL.

- [ ] **Step 3: Implement both new-job entrances**

The workspace page first offers saved Scenario cards and “自定义新评估”. A scenario job skips basis/template upload and proceeds to material upload. Custom mode uses ResourcePicker for basis and templates; each picker supports saved versions, file upload, and text input. Temporary items expose an unchecked “保存到工作区” option.

- [ ] **Step 4: Verify frontend and API flow**

Run: `npm test -- --run`

Run: `npm run build`

Run: `.\.venv\Scripts\python.exe -m unittest discover -s backend -p 'test_*.py'`

Expected: all PASS except the existing locally skipped PDF dependency test.

- [ ] **Step 5: Commit**

```powershell
git add frontend-public/src/components/ResourcePicker.jsx frontend-public/src/components/ScenarioCard.jsx frontend-public/src/pages/WorkspaceNewJobPage.jsx frontend-public/src/pages/JobWizardPage.jsx frontend-public/src/services/api.js frontend-public/src/App.module.css frontend-public/src/App.test.jsx
git commit -m "feat: reuse standards and templates in new jobs"
```

### Task 7: Independent workspace cleanup and deployment documentation

**Files:**
- Modify: `backend/public_job_cleanup.py`
- Modify: `backend/main.py`
- Modify: `backend/test_public_job_cleanup.py`
- Modify: `.env.example`
- Modify: `docker-compose.yml`
- Modify: `Dockerfile`
- Modify: `README.md`

**Interfaces:**
- Produces: `cleanup_expired_public_workspaces(now: datetime | None = None) -> list[str]`.

- [ ] **Step 1: Write failing retention separation tests**

```python
def test_job_cleanup_does_not_delete_workspace_assets(self):
    cleanup_expired_public_jobs(self.now)
    self.assertTrue(os.path.exists(self.workspace_asset_path))

def test_workspace_grace_cleanup_is_idempotent(self):
    first = cleanup_expired_public_workspaces(self.after_grace)
    second = cleanup_expired_public_workspaces(self.after_grace)
    self.assertEqual(first, [self.workspace_id])
    self.assertEqual(second, [])
```

- [ ] **Step 2: Run tests and verify failure**

Run: `.\.venv\Scripts\python.exe -m unittest backend.test_public_job_cleanup -v`

Expected: FAIL because workspace cleanup is absent.

- [ ] **Step 3: Implement separate cleanup and configuration**

Run workspace cleanup in the existing hourly lifecycle loop after job cleanup. Remove physical workspace directories only after validating the resolved path and retain DB rows when filesystem deletion fails. Document `PUBLIC_WORKSPACE_ACTIVE_DAYS=365` and `PUBLIC_WORKSPACE_GRACE_DAYS=30` in environment and Compose examples.

- [ ] **Step 4: Run full verification**

Run: `.\.venv\Scripts\python.exe -m unittest discover -s backend -p 'test_*.py'`

Run: `npm test -- --run` and `npm run build` in `frontend-public`.

Run: `docker compose config --quiet`

Run: `git diff --check`

Expected: all checks PASS except the documented local PDF integration skip.

- [ ] **Step 5: Commit**

```powershell
git add backend/public_job_cleanup.py backend/main.py backend/test_public_job_cleanup.py .env.example docker-compose.yml Dockerfile README.md
git commit -m "feat: manage reusable workspace lifecycle"
```
