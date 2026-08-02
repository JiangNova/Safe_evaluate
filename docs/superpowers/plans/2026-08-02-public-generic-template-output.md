# Public Generic Template Output Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the anonymous public evaluator into a domain-neutral workflow where users upload materials, evaluation bases, and DOCX/PDF output templates, review mapped fields, and download finalized documents.

**Architecture:** Add an isolated anonymous-job domain beside the legacy report domain. Parse all inputs into source-addressable text, evaluate once into a canonical generic result, map that result into confirmed template fields, and use deterministic DOCX/PDF renderers for artifacts. The public React app becomes a six-step job wizard and document review workspace; the Tianxin app and legacy endpoints remain unchanged.

**Tech Stack:** FastAPI 0.115, SQLite, Pydantic 2, python-docx 1.1.2, PyMuPDF, Pillow, pytesseract/Tesseract, LibreOffice Headless, React 18, React Router 7, Axios, Vitest, Python unittest.

> **Execution note (2026-08-02):** The local pip proxy cannot install pytest. With user approval, all Python test examples in this plan are implemented with the repository's existing standard-library `unittest` style. Test behavior and coverage remain the same; no backend test-only dependency file is required.

## Global Constraints

- Public jobs are anonymous and expire 24 hours after creation.
- Material formats: image, PDF, DOCX. Basis formats: PDF, DOCX, TXT. Template formats: DOCX, PDF.
- The evaluation goal is required; at least one material, one basis, and one template are required before evaluation.
- A task may use multiple templates; template fields must be confirmed before evaluation.
- DOCX templates produce DOCX and PDF; PDF templates produce PDF; finalized outputs can be zipped.
- The server stores only a hash of the anonymous access token and requires the raw token for every job-scoped operation.
- Existing `/api/public/evaluate`, legacy reports, Tianxin UI, and authenticated APIs remain compatible.
- Preserve the user's existing change in `frontend/src/pages/history/HistoryPage.module.css`.

---

## File Structure

- `backend/public_jobs.py`: job/token lifecycle, SQLite persistence, file metadata, document revisions, expiry cleanup.
- `backend/public_files.py`: file validation, safe storage, source-addressable material/basis extraction.
- `backend/template_parser.py`: DOCX placeholders and PDF/OCR field candidates.
- `backend/generic_evaluator.py`: canonical evaluation and template-field mapping prompts/API calls.
- `backend/document_renderer.py`: DOCX replacement, PDF coordinate overlay, DOCX-to-PDF, ZIP packaging.
- `backend/public_job_routes.py`: job-scoped FastAPI routes and orchestration.
- `backend/models.py`: public job request/response models.
- `backend/main.py`: include the public job router and run cleanup at startup.
- `backend/config.py`: job storage, expiry, limits, converter paths.
- `backend/test_public_jobs.py`: persistence, token, expiry, and route contract tests.
- `backend/test_public_files.py`: validation and source extraction tests.
- `backend/test_template_parser.py`: DOCX/PDF parsing tests.
- `backend/test_document_renderer.py`: DOCX/PDF/ZIP rendering tests.
- `backend/test_generic_evaluator.py`: prompt isolation and response parsing tests.
- `frontend-public/src/pages/JobWizardPage.jsx`: six-step public workflow coordinator.
- `frontend-public/src/pages/TemplateConfirmPage.jsx`: field confirmation UI.
- `frontend-public/src/pages/JobWorkspacePage.jsx`: progress, review, finalize, and download UI.
- `frontend-public/src/components/FileSection.jsx`: typed reusable uploader.
- `frontend-public/src/components/StepIndicator.jsx`: wizard progress.
- `frontend-public/src/components/TemplateFieldEditor.jsx`: field definition editor.
- `frontend-public/src/components/DocumentFieldEditor.jsx`: mapped-value editor.
- `frontend-public/src/services/jobSession.js`: sessionStorage token handling.
- `frontend-public/src/services/api.js`: public job API client.
- `frontend-public/src/App.jsx`: new job routes while retaining legacy report routes.
- `frontend-public/src/App.module.css`: wizard/workspace layout.
- `frontend-public/src/App.test.jsx`: public route and source-contract tests.
- `Dockerfile`: OCR and LibreOffice system packages.
- `backend/requirements.txt`: document/OCR/render dependencies.

### Task 1: Anonymous job persistence and access tokens

**Files:**
- Create: `backend/public_jobs.py`
- Create: `backend/test_public_jobs.py`
- Modify: `backend/config.py`
- Modify: `backend/models.py`

**Interfaces:**
- Produces: `create_job(goal: str) -> tuple[dict, str]`, `authorize_job(job_id: str, token: str) -> dict`, `update_job(job_id: str, **changes) -> dict`, `add_file(job_id: str, kind: str, metadata: dict) -> dict`, `add_template(job_id: str, source_file_id: int, source_format: str, fields: list[dict]) -> dict`, `add_document(job_id: str, template_id: int, ai_fields: dict) -> dict`, `add_revision(document_id: int, field_key: str, before: object, after: object, source: str) -> dict`, `delete_expired_jobs(now: datetime | None = None) -> list[str]`.
- Produces: `PublicJobCreateResponse`, `PublicJobStatusResponse` Pydantic models.

- [ ] **Step 1: Write failing token, schema, and expiry tests**

```python
def test_create_job_returns_raw_token_but_persists_only_hash(tmp_job_db, monkeypatch):
    job, token = public_jobs.create_job("Compare the submission with the policy")
    assert len(token) >= 40
    assert public_jobs.authorize_job(job["id"], token)["goal"] == job["goal"]
    with pytest.raises(PermissionError):
        public_jobs.authorize_job(job["id"], "wrong-token")
    row = public_jobs._fetch_job_row(job["id"])
    assert token not in row["access_token_hash"]

def test_delete_expired_jobs_returns_job_ids(tmp_job_db, monkeypatch):
    job, _ = public_jobs.create_job("Expired")
    public_jobs.update_job(job["id"], expires_at="2000-01-01T00:00:00+00:00")
    assert public_jobs.delete_expired_jobs(now=datetime(2026, 8, 2, tzinfo=timezone.utc)) == [job["id"]]
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `.\.venv\Scripts\python.exe -m unittest backend.test_public_jobs -v`
Expected: FAIL because `backend.public_jobs` does not exist.

- [ ] **Step 3: Implement the four job tables, SHA-256 token hashing, UTC timestamps, and CRUD**

```python
def create_job(goal: str) -> tuple[dict, str]:
    cleaned = goal.strip()
    if not cleaned:
        raise ValueError("evaluation goal is required")
    raw_token = secrets.token_urlsafe(32)
    job_id = secrets.token_urlsafe(18)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=PUBLIC_JOB_EXPIRY_HOURS)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    # INSERT public_jobs and return the decoded row plus raw_token.
```

Create `public_jobs`, `public_job_files`, `public_job_templates`, `public_job_documents`, and `public_job_revisions` with foreign keys and `ON DELETE CASCADE`. Add `PUBLIC_JOB_STORAGE_DIR`, `PUBLIC_JOB_EXPIRY_HOURS=24`, `PUBLIC_JOB_MAX_FILES=30`, and `PUBLIC_JOB_MAX_TOTAL_SIZE=157286400` to config.

- [ ] **Step 4: Run tests and verify pass**

Run: `.\.venv\Scripts\python.exe -m unittest backend.test_public_jobs -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add backend/public_jobs.py backend/test_public_jobs.py backend/config.py backend/models.py
git commit -m "feat: add anonymous public job storage"
```

### Task 2: Secure file storage and generic source extraction

**Files:**
- Create: `backend/public_files.py`
- Create: `backend/test_public_files.py`
- Modify: `backend/requirements.txt`

**Interfaces:**
- Consumes: `public_jobs.add_file(job_id, metadata)`.
- Produces: `validate_upload(kind: str, filename: str, mime: str, data: bytes) -> ValidatedUpload`, `store_upload(job_id: str, upload: ValidatedUpload) -> dict`, `extract_source(file_record: dict) -> ParsedSource`.

- [ ] **Step 1: Write failing kind-specific validation and extraction tests**

```python
@pytest.mark.parametrize("kind,name,mime", [
    ("material", "photo.png", "image/png"),
    ("material", "brief.docx", DOCX_MIME),
    ("basis", "policy.txt", "text/plain"),
    ("template", "output.pdf", "application/pdf"),
])
def test_allowed_uploads(kind, name, mime, fixture_bytes):
    assert validate_upload(kind, name, mime, fixture_bytes[name]).extension

def test_docm_and_mismatched_magic_are_rejected():
    with pytest.raises(UploadValidationError):
        validate_upload("template", "macro.docm", DOCX_MIME, b"MZ...")

def test_docx_and_pdf_sources_include_page_or_section_refs(fixtures):
    assert extract_source(fixtures.docx_record).chunks[0].source_ref
    assert extract_source(fixtures.pdf_record).chunks[0].source_ref.startswith("page:")
```

- [ ] **Step 2: Run tests and verify failure**

Run: `.\.venv\Scripts\python.exe -m pytest backend/test_public_files.py -q`
Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement signature checks, safe storage, DOCX/PDF/TXT extraction, and image metadata**

```python
ALLOWED_BY_KIND = {
    "material": {".png", ".jpg", ".jpeg", ".webp", ".pdf", ".docx"},
    "basis": {".pdf", ".docx", ".txt"},
    "template": {".pdf", ".docx"},
}

@dataclass(frozen=True)
class SourceChunk:
    text: str
    source_ref: str

@dataclass(frozen=True)
class ParsedSource:
    chunks: list[SourceChunk]
    warnings: list[str]
```

Pin `PyMuPDF`, `Pillow`, and `pytesseract` in requirements. Enforce 50 MB per file, total-job limits, ZIP entry limits for DOCX, encrypted-PDF rejection, UTF-8/GB18030 TXT decoding, and generated storage names.

- [ ] **Step 4: Run tests and verify pass**

Run: `.\.venv\Scripts\python.exe -m pytest backend/test_public_files.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add backend/public_files.py backend/test_public_files.py backend/requirements.txt
git commit -m "feat: validate and parse public job files"
```

### Task 3: DOCX/PDF template parsing and field confirmation

**Files:**
- Create: `backend/template_parser.py`
- Create: `backend/test_template_parser.py`

**Interfaces:**
- Consumes: `extract_source(file_record)` and stored template bytes.
- Produces: `parse_template(file_record: dict) -> TemplateParseResult`, `validate_field_definitions(source_format: str, fields: list[dict]) -> list[TemplateField]`.

- [ ] **Step 1: Write failing parser tests for split DOCX runs, tables, headers, text PDF, and scanned PDF**

```python
def test_docx_parser_finds_placeholder_split_across_runs(docx_template):
    result = parse_template(docx_template)
    assert result.fields_by_key["unit_name"].locator.kind == "docx_text"

def test_pdf_parser_emits_rect_and_requires_confirmation(pdf_template):
    result = parse_template(pdf_template)
    field = result.fields[0]
    assert field.locator.page == 0
    assert len(field.locator.rect) == 4
    assert result.requires_confirmation is True

def test_overlapping_pdf_rectangles_are_rejected():
    with pytest.raises(TemplateFieldError):
        validate_field_definitions("pdf", overlapping_fields)
```

- [ ] **Step 2: Run tests and verify failure**

Run: `.\.venv\Scripts\python.exe -m pytest backend/test_template_parser.py -q`
Expected: FAIL because parser types/functions are missing.

- [ ] **Step 3: Implement parser types and deterministic placeholder discovery**

```python
@dataclass
class TemplateField:
    key: str
    label: str
    field_type: Literal["text", "multiline", "date", "boolean", "list"]
    required: bool
    repeating: bool
    confidence: float
    locator: dict

PLACEHOLDER_RE = re.compile(r"\{\{\s*([A-Za-z][A-Za-z0-9_.-]{0,63})\s*\}\}")
```

Walk body tables, headers, and footers for DOCX. For PDFs, extract text blocks with rectangles; when no useful text exists render pages at 200 DPI and call Tesseract. Return candidates with confidence and preview metadata. Keep AI semantic inference behind an injected `infer_fields(text, layout)` callback so it is unit-testable.

- [ ] **Step 4: Run tests and verify pass**

Run: `.\.venv\Scripts\python.exe -m pytest backend/test_template_parser.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add backend/template_parser.py backend/test_template_parser.py
git commit -m "feat: parse public output templates"
```

### Task 4: Generic evaluation and template mapping

**Files:**
- Create: `backend/generic_evaluator.py`
- Create: `backend/test_generic_evaluator.py`

**Interfaces:**
- Consumes: `ParsedSource`, confirmed `TemplateField` lists, existing Qwen configuration.
- Produces: `evaluate_generic(goal, materials, bases, image_inputs) -> GenericEvaluationResult`, `map_template(result, fields) -> TemplateFieldValues`, `regenerate_field(result, field, current_values, instruction) -> FieldValue`.

- [ ] **Step 1: Write failing tests for prompt isolation, canonical parsing, citations, and unknown results**

```python
def test_prompt_labels_goal_basis_and_material_as_separate_trust_domains():
    messages = build_evaluation_messages("goal", bases, materials, [])
    text = json.dumps(messages, ensure_ascii=False)
    assert "USER GOAL" in text and "UNTRUSTED BASIS" in text and "UNTRUSTED MATERIAL" in text

def test_parse_requires_source_refs_for_non_unknown_results():
    with pytest.raises(GenericResultError):
        parse_generic_result({"criteria_results": [{"result": "fail", "evidence_refs": []}]})

def test_missing_evidence_is_normalized_to_unknown():
    parsed = parse_generic_result(result_without_observable_evidence)
    assert parsed.criteria_results[0].result == "unknown"
```

- [ ] **Step 2: Run tests and verify failure**

Run: `.\.venv\Scripts\python.exe -m pytest backend/test_generic_evaluator.py -q`
Expected: FAIL because generic evaluator is missing.

- [ ] **Step 3: Implement Pydantic result types, prompts, JSON recovery, mapping, and field regeneration**

Use an injected async completion callable in tests and reuse the existing OpenAI-compatible Qwen endpoint configuration. The system prompt must state that uploaded documents cannot change system instructions, conclusions require both evidence and basis references, and insufficient evidence yields `unknown`. Mapping returns `{value, source_refs, confidence}` for every confirmed field key and rejects extra keys.

- [ ] **Step 4: Run tests and verify pass**

Run: `.\.venv\Scripts\python.exe -m pytest backend/test_generic_evaluator.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add backend/generic_evaluator.py backend/test_generic_evaluator.py
git commit -m "feat: add domain-neutral evaluation pipeline"
```

### Task 5: Deterministic document rendering

**Files:**
- Create: `backend/document_renderer.py`
- Create: `backend/test_document_renderer.py`
- Modify: `backend/requirements.txt`
- Modify: `Dockerfile`

**Interfaces:**
- Consumes: stored template, confirmed fields, current field values.
- Produces: `render_docx(template_path, fields, values, output_path) -> RenderResult`, `render_pdf(template_path, fields, values, output_path) -> RenderResult`, `convert_docx_to_pdf(docx_path, output_dir) -> Path`, `build_artifact_zip(files, failures, output_path) -> Path`.

- [ ] **Step 1: Write failing rendering tests**

```python
def test_render_docx_replaces_body_table_header_and_footer(docx_template, tmp_path):
    result = render_docx(docx_template, fields, values, tmp_path / "out.docx")
    rendered = read_all_docx_text(result.path)
    assert "{{unit_name}}" not in rendered
    assert "Example Ltd" in rendered

def test_render_pdf_preserves_page_count_and_reports_overflow(pdf_template, tmp_path):
    result = render_pdf(pdf_template, fields, long_values, tmp_path / "out.pdf")
    assert fitz.open(result.path).page_count == fitz.open(pdf_template).page_count
    assert any(w.code == "field_overflow" for w in result.warnings)

def test_zip_contains_manifest_for_failed_documents(tmp_path):
    path = build_artifact_zip(success_files, failures, tmp_path / "outputs.zip")
    assert "失败清单.txt" in ZipFile(path).namelist()
```

- [ ] **Step 2: Run tests and verify failure**

Run: `.\.venv\Scripts\python.exe -m pytest backend/test_document_renderer.py -q`
Expected: FAIL because renderer is missing.

- [ ] **Step 3: Implement run-aware DOCX replacement, PDF overlay, overflow warnings, conversion, and ZIP**

Use `python-docx` for Word replacement and PyMuPDF for PDF overlays. Run LibreOffice with `--headless --convert-to pdf --outdir`, an explicit timeout, and a temporary profile directory. Add `reportlab` only if PyMuPDF cannot embed the required CJK font. Update Docker to install `libreoffice-writer`, `fonts-noto-cjk`, `tesseract-ocr`, and `tesseract-ocr-chi-sim` without recommended packages.

- [ ] **Step 4: Run tests and verify pass**

Run: `.\.venv\Scripts\python.exe -m pytest backend/test_document_renderer.py -q`
Expected: PASS; converter-dependent test skips only when LibreOffice is absent locally.

- [ ] **Step 5: Commit**

```powershell
git add backend/document_renderer.py backend/test_document_renderer.py backend/requirements.txt Dockerfile
git commit -m "feat: render template-driven documents"
```

### Task 6: Public job API and orchestration

**Files:**
- Create: `backend/public_job_routes.py`
- Modify: `backend/main.py`
- Modify: `backend/models.py`
- Modify: `backend/test_public_jobs.py`
- Modify: `backend/test_public_api.py`

**Interfaces:**
- Consumes: Tasks 1-5 service interfaces.
- Produces: `/api/public/jobs/*` route surface from the design specification.

- [ ] **Step 1: Add failing contract tests for create, authorization, prerequisites, partial success, edit, finalize, and download**

```python
def test_job_routes_require_access_token(client, created_job):
    assert client.get(f"/api/public/jobs/{created_job.id}").status_code == 401
    assert client.get(
        f"/api/public/jobs/{created_job.id}",
        headers={"X-Job-Token": created_job.token},
    ).status_code == 200

def test_evaluate_rejects_unconfirmed_templates(client, ready_job_headers):
    response = client.post(ready_job_headers.url + "/evaluate", headers=ready_job_headers.headers)
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "templates_unconfirmed"

def test_public_job_creation_is_rate_limited(client, monkeypatch):
    monkeypatch.setattr(public_job_routes, "PUBLIC_JOB_CREATE_RATE", 2)
    assert client.post("/api/public/jobs", data={"goal": "one"}).status_code != 429
    assert client.post("/api/public/jobs", data={"goal": "two"}).status_code != 429
    assert client.post("/api/public/jobs", data={"goal": "three"}).status_code == 429
```

Patch evaluator and renderer functions in route tests so no external AI or LibreOffice call occurs.

- [ ] **Step 2: Run tests and verify failure**

Run: `.\.venv\Scripts\python.exe -m pytest backend/test_public_jobs.py backend/test_public_api.py -q`
Expected: FAIL because `/api/public/jobs` routes do not exist.

- [ ] **Step 3: Implement the router and stage transitions**

Accept multipart uploads by kind, use `X-Job-Token`, return structured `{code, message, retryable, stage}` errors, and write stage results after each successful operation. Use an in-process per-IP sliding window for job creation/upload requests and an `asyncio.Semaphore(PUBLIC_JOB_MAX_CONCURRENCY)` around AI evaluation and finalization. Use `BackgroundTasks` so long-running requests return `202`; polling `GET /jobs/{id}` exposes current stage. Include the router in `main.py` without altering legacy routes.

- [ ] **Step 4: Run backend regression tests**

Run: `.\.venv\Scripts\python.exe -m pytest backend -q`
Expected: PASS, including legacy public and authenticated route contracts.

- [ ] **Step 5: Commit**

```powershell
git add backend/public_job_routes.py backend/main.py backend/models.py backend/test_public_jobs.py backend/test_public_api.py
git commit -m "feat: expose generic public job API"
```

### Task 7: Public six-step wizard and anonymous session

**Files:**
- Create: `frontend-public/src/pages/JobWizardPage.jsx`
- Create: `frontend-public/src/components/FileSection.jsx`
- Create: `frontend-public/src/components/StepIndicator.jsx`
- Create: `frontend-public/src/services/jobSession.js`
- Modify: `frontend-public/src/services/api.js`
- Modify: `frontend-public/src/App.jsx`
- Modify: `frontend-public/src/App.module.css`
- Modify: `frontend-public/src/App.test.jsx`

**Interfaces:**
- Consumes: job creation, uploads, template parse-result, and evaluation endpoints.
- Produces: routes `/`, `/jobs/:jobId/templates`, `/jobs/:jobId/workspace`; `saveJobSession(jobId, token, expiresAt)`, `getJobToken(jobId)`, `clearJobSession(jobId)`.

- [ ] **Step 1: Add failing source-contract tests**

```javascript
it('defines the generic job workflow routes', () => {
  const app = readSource('App.jsx');
  expect(app).toContain('path="/jobs/:jobId/templates"');
  expect(app).toContain('path="/jobs/:jobId/workspace"');
});

it('keeps material, basis, and template uploads separate', () => {
  const wizard = readSource('pages/JobWizardPage.jsx');
  for (const kind of ['material', 'basis', 'template']) expect(wizard).toContain(`kind="${kind}"`);
  expect(wizard).toContain('评估目标');
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- --run`
Working directory: `frontend-public`
Expected: FAIL because the new routes/components are missing.

- [ ] **Step 3: Implement session storage, API methods, step validation, and uploads**

```javascript
export function saveJobSession(jobId, token, expiresAt) {
  sessionStorage.setItem(`safe-evaluate-job:${jobId}`, JSON.stringify({ token, expiresAt }));
}

function jobHeaders(jobId) {
  const token = getJobToken(jobId);
  if (!token) throw new Error('任务访问凭证已丢失，请重新创建评估');
  return { 'X-Job-Token': token };
}
```

The wizard must require goal/material/basis/template, show per-kind limits, preserve selected files while moving between steps, upload templates after job creation, and navigate to confirmation only after all uploads succeed.

- [ ] **Step 4: Run public frontend tests and build**

Run: `npm test -- --run; npm run build`
Working directory: `frontend-public`
Expected: tests PASS and Vite build succeeds.

- [ ] **Step 5: Commit**

```powershell
git add frontend-public/src
git commit -m "feat: add generic public evaluation wizard"
```

### Task 8: Template confirmation and document review workspace

**Files:**
- Create: `frontend-public/src/pages/TemplateConfirmPage.jsx`
- Create: `frontend-public/src/pages/JobWorkspacePage.jsx`
- Create: `frontend-public/src/components/TemplateFieldEditor.jsx`
- Create: `frontend-public/src/components/DocumentFieldEditor.jsx`
- Modify: `frontend-public/src/services/api.js`
- Modify: `frontend-public/src/App.module.css`
- Modify: `frontend-public/src/App.test.jsx`

**Interfaces:**
- Consumes: confirmed-field, job polling, field edit/regenerate, finalize, artifact, and ZIP endpoints.
- Produces: user-confirmed template definitions and finalized artifacts.

- [ ] **Step 1: Add failing tests for confirmation, polling, edit, and download controls**

```javascript
it('requires explicit field confirmation before evaluation', () => {
  const source = readSource('pages/TemplateConfirmPage.jsx');
  expect(source).toContain('确认字段并开始评估');
  expect(source).toContain('confidence');
});

it('supports field edit, regeneration, finalization, and archive download', () => {
  const source = readSource('pages/JobWorkspacePage.jsx');
  for (const text of ['重新生成此字段', '恢复 AI 初稿', '确认定稿', '下载全部文书']) {
    expect(source).toContain(text);
  }
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- --run`
Working directory: `frontend-public`
Expected: FAIL because review pages do not exist.

- [ ] **Step 3: Implement multi-template confirmation and review workspace**

Use template tabs, page preview metadata, editable labels/types/required/repeating properties, and PDF rectangle numeric controls. Poll active jobs every two seconds and stop on complete/failed/expired. Autosave changed document fields after 500 ms debounce; show AI confidence, source references, overflow warnings, draft/finalized badges, individual downloads, and ZIP download.

- [ ] **Step 4: Run tests and build**

Run: `npm test -- --run; npm run build`
Working directory: `frontend-public`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add frontend-public/src
git commit -m "feat: review and export template documents"
```

### Task 9: Expiry cleanup, deployment dependencies, and end-to-end regression

**Files:**
- Create: `backend/test_public_job_e2e.py`
- Modify: `backend/main.py`
- Modify: `backend/config.py`
- Modify: `Dockerfile`
- Modify: `docker-compose.yml`
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: deployable end-to-end anonymous workflow and documented limits.

- [ ] **Step 1: Write failing end-to-end and cleanup tests**

```python
def test_complete_anonymous_job_flow(client, fake_ai, fake_converter, fixtures):
    job = create_job_via_api(client, goal="Assess against the uploaded policy")
    upload_material_basis_and_two_templates(client, job, fixtures)
    confirm_all_template_fields(client, job)
    assert start_and_wait_for_evaluation(client, job)["status"] == "review"
    edit_and_finalize_all_documents(client, job)
    archive = download_archive(client, job)
    assert set(ZipFile(io.BytesIO(archive)).namelist()) >= {"report.docx", "report.pdf", "form.pdf"}

def test_expired_job_files_are_removed(client, expired_job):
    removed = cleanup_expired_public_jobs()
    assert expired_job.id in removed
    assert not Path(expired_job.storage_dir).exists()
```

- [ ] **Step 2: Run the full test suite and record failures**

Run: `.\.venv\Scripts\python.exe -m pytest backend -q; npm test -- --run; npm run build`
Working directories: repository root for Python, then `frontend-public` for npm commands.
Expected before completion: the new end-to-end test fails at cleanup or deployment configuration.

- [ ] **Step 3: Wire idempotent cleanup and production configuration**

Run cleanup at startup and then every hour in an application lifespan task. Add environment variables for expiry, file/total/page limits, Tesseract command, LibreOffice command, and public-job concurrency. Create `/app/backend/data/public_jobs` in Docker and persist it through the existing `backend/data` volume. Document the six-step workflow, 24-hour expiry, supported formats, and conversion dependencies.

- [ ] **Step 4: Run all verification**

Run: `.\.venv\Scripts\python.exe -m pytest backend -q`
Expected: PASS.

Run: `npm test -- --run`
Working directory: `frontend-public`
Expected: PASS.

Run: `npm run build`
Working directory: `frontend-public`
Expected: PASS.

Run: `docker compose config`
Expected: configuration renders without errors when required environment values are present.

- [ ] **Step 5: Commit**

```powershell
git add backend/test_public_job_e2e.py backend/main.py backend/config.py Dockerfile docker-compose.yml .env.example README.md
git commit -m "test: verify generic public template workflow"
```

## Final Verification

- [ ] Run `git status --short` and confirm the only unrelated change is the pre-existing `frontend/src/pages/history/HistoryPage.module.css` modification.
- [ ] Run `.\.venv\Scripts\python.exe -m pytest backend -q`.
- [ ] Run `npm test -- --run` and `npm run build` in `frontend-public`.
- [ ] Exercise one DOCX-placeholder template and one PDF-coordinate template through the local `/evaluate/` UI.
- [ ] Confirm a job cannot be accessed with a missing or incorrect `X-Job-Token`.
- [ ] Confirm an expired job loses both database rows and physical files.
- [ ] Confirm `/evaluate_tianxin/`, `/api/public/evaluate`, and authenticated report routes still work.
