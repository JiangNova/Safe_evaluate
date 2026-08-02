# Universal Text and DOCX Template Compiler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compile text and DOCX templates into a unified intermediate representation, judge document applicability, fill structural Word locations accurately, and block empty or unsafe final documents.

**Architecture:** A typed template IR separates field semantics from placement actions. Compilation extracts deterministic DOCX structure first and uses AI only to label ambiguous candidates. Evaluation produces evidence-backed facts and per-document applicability before mapping values; rendering executes only confirmed placement instructions.

**Tech Stack:** Python 3.10, Pydantic, python-docx, lxml, FastAPI, React 18, SQLite, `unittest`, Vitest.

## Global Constraints

- Default all human-readable labels and generated content to Simplified Chinese.
- Internal field keys remain unique ASCII identifiers.
- AI must not invent missing administrative data, identity, signatures, document numbers, dates, or decisive facts.
- Missing required fields block finalization; drafts must carry an explicit draft status.
- AI recommendations and user-authorized decisions remain distinct.
- Preserve original DOCX layout and run formatting wherever the placement action permits.
- Existing placeholder templates remain compatible.
- Preserve the user's unrelated `frontend/src/pages/history/HistoryPage.module.css` change.
- Use `unittest`, not pytest.

---

### Task 1: Typed template intermediate representation

**Files:**
- Create: `backend/template_ir.py`
- Create: `backend/test_template_ir.py`
- Modify: `backend/template_parser.py`

**Interfaces:**
- Produces: `CompiledTemplate`, `CompiledField`, `Placement`, `ApplicabilityRule` Pydantic models.
- Produces: `compile_legacy_fields(source_format: str, fields: list[dict]) -> CompiledTemplate`.

- [ ] **Step 1: Write failing model validation tests**

```python
def test_single_choice_rejects_multiple_selected_defaults(self):
    with self.assertRaises(ValidationError):
        CompiledField(key="action", label="处罚", value_type="single_choice", options=["警告", "记过"], default=["警告", "记过"])

def test_legacy_anchor_compiles_to_compatibility_placement(self):
    compiled = compile_legacy_fields("docx", [legacy_field])
    self.assertEqual(compiled.fields[0].placements[0].kind, "paragraph_insert")
```

- [ ] **Step 2: Run and verify failure**

Run: `.\.venv\Scripts\python.exe -m unittest backend.test_template_ir -v`

- [ ] **Step 3: Implement exact enums and models**

Define template kinds `text_freeform`, `text_structured`, `docx`, `pdf`; value types `text`, `multiline`, `date`, `number`, `boolean`, `single_choice`, `multi_choice`, `list`, `table`; fill sources `ai`, `user`, `ai_then_user`, `computed`; missing policies `block_finalize`, `allow_blank`, `omit_section`; and placement kinds from the approved design.

- [ ] **Step 4: Run tests and commit**

Run: `.\.venv\Scripts\python.exe -m unittest backend.test_template_ir backend.test_template_parser -v`

```powershell
git add backend/template_ir.py backend/test_template_ir.py backend/template_parser.py
git commit -m "feat: define universal template intermediate representation"
```

### Task 2: Deterministic DOCX structural candidate extraction

**Files:**
- Create: `backend/docx_template_compiler.py`
- Create: `backend/test_docx_template_compiler.py`
- Modify: `backend/template_parser.py`

**Interfaces:**
- Produces: `extract_docx_candidates(path: str) -> list[PlacementCandidate]`.
- Produces: `compile_docx_template(path: str, infer_semantics: Callable | None = None) -> CompiledTemplate`.

- [ ] **Step 1: Create fixture-building failing tests**

```python
def test_extracts_blank_runs_date_parts_checkboxes_and_table_cells(self):
    path = self.make_docx_with_structures()
    candidates = extract_docx_candidates(path)
    kinds = {item.kind for item in candidates}
    self.assertTrue({"run_range_replace", "date_parts", "checkbox_select", "table_cell_fill"}.issubset(kinds))
```

- [ ] **Step 2: Run and verify failure**

Run: `.\.venv\Scripts\python.exe -m unittest backend.test_docx_template_compiler -v`

- [ ] **Step 3: Implement XML-backed structural fingerprints**

Inspect `word/document.xml`, headers, and footers with lxml. Candidate locations include part name, paragraph index, run index/range, surrounding normalized text, table/row/cell path, and a SHA-256 context fingerprint. Detect underlined whitespace, repeated spaces between labels, `年/月/日` slots, Unicode `□`, content controls, placeholders, empty table cells adjacent to labels, and repeated table rows.

- [ ] **Step 4: Run tests and commit**

Run: `.\.venv\Scripts\python.exe -m unittest backend.test_docx_template_compiler backend.test_template_parser -v`

```powershell
git add backend/docx_template_compiler.py backend/test_docx_template_compiler.py backend/template_parser.py
git commit -m "feat: compile structural DOCX field candidates"
```

### Task 3: Structural DOCX rendering actions

**Files:**
- Create: `backend/docx_renderer.py`
- Create: `backend/test_docx_renderer.py`
- Modify: `backend/document_renderer.py`

**Interfaces:**
- Consumes: `CompiledTemplate` and confirmed field values.
- Produces: `render_compiled_docx(template_path: str, compiled: CompiledTemplate, values: dict, output_path: str) -> RenderResult`.

- [ ] **Step 1: Write failing visual-structure tests**

```python
def test_replaces_underlined_blank_without_appending_after_paragraph(self):
    result = render_compiled_docx(self.template, self.compiled, {"employee": {"value": "张三"}}, self.output)
    paragraph = Document(result.path).paragraphs[0]
    self.assertEqual(paragraph.text, "员工 张三 因迟到")

def test_selects_exact_checkbox_option(self):
    render_compiled_docx(self.checkbox_template, self.checkbox_ir, {"action": {"value": "记过"}}, self.output)
    self.assertIn("□警告　☑记过　□辞退", all_docx_text(self.output))
```

- [ ] **Step 2: Run and verify failure**

Run: `.\.venv\Scripts\python.exe -m unittest backend.test_docx_renderer -v`

- [ ] **Step 3: Implement placement executor**

Resolve the stored structural path and verify its context fingerprint before modifying XML. Implement placeholder, run range, paragraph insert, date parts, checkbox select, table cell, repeat row, header/footer, content control, and section toggle actions. Return typed warnings for stale fingerprints, missing required values, selection conflicts, and overflow.

- [ ] **Step 4: Run tests and commit**

Run: `.\.venv\Scripts\python.exe -m unittest backend.test_docx_renderer backend.test_document_renderer -v`

```powershell
git add backend/docx_renderer.py backend/test_docx_renderer.py backend/document_renderer.py
git commit -m "feat: render structural DOCX placements"
```

### Task 4: Freeform and structured text templates

**Files:**
- Create: `backend/text_template_compiler.py`
- Create: `backend/text_document_renderer.py`
- Create: `backend/test_text_templates.py`
- Modify: `backend/public_job_routes.py`

**Interfaces:**
- Produces: `compile_text_template(mode: str, source_text: str) -> CompiledTemplate`.
- Produces: `render_text_document(compiled: CompiledTemplate, values: dict, output_docx: str) -> RenderResult`.

- [ ] **Step 1: Write failing text template tests**

```python
def test_structured_text_preserves_declared_field_order(self):
    compiled = compile_text_template("structured", "员工姓名：______\n违规事实：______\n处罚建议：______")
    self.assertEqual([field.label for field in compiled.fields], ["员工姓名", "违规事实", "处罚建议"])

def test_freeform_requires_requested_sections(self):
    compiled = compile_text_template("freeform", "生成处罚建议书，包含事实、依据、建议和申诉说明")
    self.assertEqual([section.label for section in compiled.fields], ["违规事实", "制度依据", "处罚建议", "申诉说明"])
```

- [ ] **Step 2: Run and verify failure**

Run: `.\.venv\Scripts\python.exe -m unittest backend.test_text_templates -v`

- [ ] **Step 3: Implement compilation and styled DOCX output**

Structured mode parses label/blank lines deterministically and lets AI classify ambiguous field types. Freeform mode requires AI to return a Chinese section schema that is validated against the requested concepts. Render an A4 DOCX with title, section headings, source references, draft status, and page footer; use the existing LibreOffice conversion path for PDF.

- [ ] **Step 4: Run tests and commit**

Run: `.\.venv\Scripts\python.exe -m unittest backend.test_text_templates -v`

```powershell
git add backend/text_template_compiler.py backend/text_document_renderer.py backend/test_text_templates.py backend/public_job_routes.py
git commit -m "feat: support text-defined output templates"
```

### Task 5: Document applicability before field mapping

**Files:**
- Create: `backend/document_applicability.py`
- Create: `backend/test_document_applicability.py`
- Modify: `backend/generic_evaluator.py`
- Modify: `backend/public_jobs.py`
- Modify: `backend/public_job_routes.py`

**Interfaces:**
- Produces: `assess_document_applicability(result: GenericEvaluationResult, compiled: CompiledTemplate, completion=None) -> DocumentApplicability`.
- `DocumentApplicability.status`: `applicable|needs_input|insufficient_evidence|not_applicable|failed`.

- [ ] **Step 1: Write failing evidence gate tests**

```python
async def test_fire_notice_is_blocked_without_violation_fact(self):
    decision = await assess_document_applicability(self.unknown_fire_result, self.rectification_notice, completion=self.fake)
    self.assertEqual(decision.status, "insufficient_evidence")
    self.assertIn("违法事实", decision.missing_requirements)

async def test_ai_cannot_supply_user_only_fields(self):
    mapped = await map_compiled_template(self.result, self.template, completion=self.fake)
    self.assertEqual(mapped.fields["signature"].status, "needs_user_input")
```

- [ ] **Step 2: Run and verify failure**

Run: `.\.venv\Scripts\python.exe -m unittest backend.test_document_applicability -v`

- [ ] **Step 3: Implement applicability and decision separation**

Prompt the model with canonical facts, criteria, applicability requirements, and template metadata. Validate that every satisfied requirement cites evidence or basis. Never map `fill_source=user` fields with AI. Store applicability JSON per document and do not create renderable field drafts for `insufficient_evidence` or `not_applicable` templates.

- [ ] **Step 4: Run tests and commit**

Run: `.\.venv\Scripts\python.exe -m unittest backend.test_document_applicability backend.test_generic_evaluator backend.test_public_job_routes -v`

```powershell
git add backend/document_applicability.py backend/test_document_applicability.py backend/generic_evaluator.py backend/public_jobs.py backend/public_job_routes.py
git commit -m "feat: gate documents by evidence and applicability"
```

### Task 6: Finalization quality gate and draft artifacts

**Files:**
- Create: `backend/document_quality.py`
- Create: `backend/test_document_quality.py`
- Modify: `backend/public_job_routes.py`
- Modify: `backend/document_renderer.py`

**Interfaces:**
- Produces: `validate_document_for_finalize(compiled: CompiledTemplate, values: dict, render_warnings: list[RenderWarning]) -> QualityReport`.
- Produces endpoints: `POST .../render-draft` and existing `finalize` with quality blocking.

- [ ] **Step 1: Write failing blocking tests**

```python
def test_required_user_field_blocks_finalize(self):
    report = validate_document_for_finalize(self.template, {"employee_id": {"value": ""}}, [])
    self.assertFalse(report.can_finalize)
    self.assertIn("employee_id", report.blocking_fields)

def test_stale_location_warning_blocks_finalize(self):
    report = validate_document_for_finalize(self.template, self.values, [RenderWarning("stale_placement", "位置已变化")])
    self.assertFalse(report.can_finalize)
```

- [ ] **Step 2: Run and verify failure**

Run: `.\.venv\Scripts\python.exe -m unittest backend.test_document_quality -v`

- [ ] **Step 3: Implement draft/final distinction**

Draft rendering is allowed with `[待人工补充]` markers and a prominent “草稿” header/footer. Finalization returns HTTP 409 with blocking fields and warnings when quality fails. Check required values, placement resolution, choice conflicts, overflow, missing required sections, and applicability status.

- [ ] **Step 4: Run tests and commit**

Run: `.\.venv\Scripts\python.exe -m unittest backend.test_document_quality backend.test_public_job_routes backend.test_document_renderer -v`

```powershell
git add backend/document_quality.py backend/test_document_quality.py backend/public_job_routes.py backend/document_renderer.py
git commit -m "feat: block incomplete formal documents"
```

### Task 7: Template compiler confirmation and quality frontend

**Files:**
- Create: `frontend-public/src/components/PlacementEditor.jsx`
- Create: `frontend-public/src/components/ApplicabilityPanel.jsx`
- Create: `frontend-public/src/components/QualityGatePanel.jsx`
- Modify: `frontend-public/src/pages/TemplateConfirmPage.jsx`
- Modify: `frontend-public/src/pages/JobWorkspacePage.jsx`
- Modify: `frontend-public/src/components/TemplateFieldEditor.jsx`
- Modify: `frontend-public/src/services/api.js`
- Modify: `frontend-public/src/App.module.css`
- Modify: `frontend-public/src/App.test.jsx`

**Interfaces:**
- Consumes compiled template, applicability, draft, and quality API payloads.

- [ ] **Step 1: Add failing UI contract tests**

```javascript
it('shows placement, applicability, and blocking quality states', () => {
  const runtime = readRuntimeSources();
  for (const text of ['填写位置', '文书适用性', '待人工补充', '暂不能生成', '阻止定稿']) expect(runtime).toContain(text);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- --run` in `frontend-public`.

- [ ] **Step 3: Implement compiler and review UI**

Group fields by AI, user, AI-then-user, and computed sources. Show placement kind and context preview; allow checkbox options and field requirements to be confirmed. In the workspace, show applicability before fields. Keep Finalize disabled while quality has blockers, expose Render Draft, and show exact missing information instead of an empty document download.

- [ ] **Step 4: Run frontend and backend tests**

Run: `npm test -- --run` and `npm run build` in `frontend-public`.

Run: `.\.venv\Scripts\python.exe -m unittest discover -s backend -p 'test_*.py'`.

- [ ] **Step 5: Commit**

```powershell
git add frontend-public/src/components/PlacementEditor.jsx frontend-public/src/components/ApplicabilityPanel.jsx frontend-public/src/components/QualityGatePanel.jsx frontend-public/src/pages/TemplateConfirmPage.jsx frontend-public/src/pages/JobWorkspacePage.jsx frontend-public/src/components/TemplateFieldEditor.jsx frontend-public/src/services/api.js frontend-public/src/App.module.css frontend-public/src/App.test.jsx
git commit -m "feat: review compiled templates and document quality"
```

### Task 8: Real-template regression and documentation

**Files:**
- Create: `backend/test_template_end_to_end.py`
- Create: `backend/test_fixtures/build_business_templates.py`
- Modify: `README.md`

**Interfaces:**
- Exercises the public API, compiler, applicability gate, renderer, and downloads.

- [ ] **Step 1: Build synthetic legal fixtures from the observed structures**

Create tests that generate, rather than commit, a fire rectification notice with underlined blanks and 12 checkbox categories plus an employee discipline form with table fields and single-choice action.

- [ ] **Step 2: Add end-to-end assertions**

```python
def test_employee_discipline_template_fills_and_blocks_signature(self):
    job = self.evaluate_employee_case()
    self.assertEqual(job["documents"][0]["applicability"]["status"], "needs_input")
    self.fill_user_field("signature", "负责人")
    artifact = self.finalize()
    self.assertIn("☑记过", all_docx_text(artifact))

def test_fire_notice_is_not_exported_for_inspection_only_photos(self):
    job = self.evaluate_inspection_only_case()
    self.assertEqual(job["documents"][0]["applicability"]["status"], "insufficient_evidence")
    self.assertEqual(self.finalize_response.status_code, 409)
```

- [ ] **Step 3: Run full verification**

Run: `.\.venv\Scripts\python.exe -m unittest discover -s backend -p 'test_*.py'`

Run: `npm test -- --run` and `npm run build` in `frontend-public`.

Run: `git diff --check`.

- [ ] **Step 4: Document supported template structures and commit**

```powershell
git add backend/test_template_end_to_end.py backend/test_fixtures/build_business_templates.py README.md
git commit -m "test: cover universal business document generation"
```
