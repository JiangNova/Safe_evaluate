# Advanced PDF Template Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the universal template IR to AcroForm, text PDF, and scanned PDF templates with confirmed coordinates, choice controls, overflow checks, and visual regression.

**Architecture:** PDF compilation prefers native form fields, then text geometry, then OCR candidates. Every placement is normalized into the existing IR and confirmed against a page preview. Rendering overlays only confirmed placements and quality checks compare page count, bounds, content presence, and rendered visual changes.

**Tech Stack:** Python 3.10, pypdf, pypdfium2, pytesseract, Pillow, ReportLab, FastAPI, React 18, `unittest`, Vitest.

## Global Constraints

- Reject encrypted or malformed PDFs.
- Prefer AcroForm fields over coordinate overlays.
- OCR candidates always require human confirmation.
- Never silently clip or write outside a page.
- Preserve the original PDF pages as the final background.
- Missing required fields and overflow block formal finalization.
- Existing DOCX and text template behavior must remain unchanged.
- Preserve the user's unrelated `frontend/src/pages/history/HistoryPage.module.css` change.
- Use `unittest`, not pytest.

---

### Task 1: AcroForm compilation and filling

**Files:**
- Create: `backend/pdf_template_compiler.py`
- Create: `backend/test_pdf_template_compiler.py`
- Modify: `backend/template_parser.py`
- Modify: `backend/document_renderer.py`

**Interfaces:**
- Produces: `compile_pdf_template(path: str) -> CompiledTemplate`.
- Produces placement kinds `pdf_form_text`, `pdf_form_checkbox`, `pdf_form_choice`.

- [ ] **Step 1: Write failing AcroForm tests**

```python
@unittest.skipUnless(HAS_PDF_DEPS, "PDF dependencies required")
def test_compiles_and_fills_native_form_fields(self):
    compiled = compile_pdf_template(self.acroform_fixture)
    self.assertEqual({p.kind for f in compiled.fields for p in f.placements}, {"pdf_form_text", "pdf_form_checkbox"})
    output = render_pdf(self.acroform_fixture, compiled.fields, self.values, self.output)
    self.assertEqual(PdfReader(output.path).get_fields()["employee_name"].get("/V"), "张三")
```

- [ ] **Step 2: Run and verify failure**

Run: `.\.venv\Scripts\python.exe -m unittest backend.test_pdf_template_compiler -v`

- [ ] **Step 3: Implement AcroForm-first parsing and rendering**

Read `/AcroForm` field names, types, options, required flags, page/widget rectangles, and appearance states. Preserve unrelated fields. Update values and regenerate appearances where pypdf supports it; fall back to an overlay only when appearance generation is unavailable and record a warning.

- [ ] **Step 4: Run tests and commit**

```powershell
git add backend/pdf_template_compiler.py backend/test_pdf_template_compiler.py backend/template_parser.py backend/document_renderer.py
git commit -m "feat: fill native PDF form templates"
```

### Task 2: Text geometry and OCR candidate compilation

**Files:**
- Modify: `backend/pdf_template_compiler.py`
- Modify: `backend/test_pdf_template_compiler.py`
- Modify: `backend/template_parser.py`

**Interfaces:**
- Produces placement kinds `pdf_text_rect`, `pdf_checkbox_rect`, `pdf_image_rect`.

- [ ] **Step 1: Add failing text and scanned PDF tests**

```python
def test_text_pdf_candidate_keeps_page_and_bounds(self):
    compiled = compile_pdf_template(self.text_pdf)
    placement = compiled.fields[0].placements[0]
    self.assertGreaterEqual(placement.page, 0)
    self.assertTrue(placement.rect[2] > placement.rect[0])

def test_ocr_candidates_are_low_confidence_and_unconfirmed(self):
    compiled = compile_pdf_template(self.scanned_pdf)
    self.assertTrue(all(not p.confirmed for f in compiled.fields for p in f.placements))
```

- [ ] **Step 2: Run and verify failure**

Run: `.\.venv\Scripts\python.exe -m unittest backend.test_pdf_template_compiler -v`

- [ ] **Step 3: Implement geometry and OCR routing**

Use pypdf text visitor coordinates for text PDFs. When usable text is absent, render at 200 DPI with pypdfium2 and run `chi_sim+eng` OCR. Build candidate rectangles from nearby labels, underline regions, boxes, and checkbox glyphs. Mark OCR placements unconfirmed and include OCR confidence and page dimensions.

- [ ] **Step 4: Run tests and commit**

```powershell
git add backend/pdf_template_compiler.py backend/test_pdf_template_compiler.py backend/template_parser.py
git commit -m "feat: compile text and scanned PDF placements"
```

### Task 3: PDF placement editor frontend

**Files:**
- Create: `frontend-public/src/components/PdfPlacementEditor.jsx`
- Modify: `frontend-public/src/components/PlacementEditor.jsx`
- Modify: `frontend-public/src/pages/TemplateConfirmPage.jsx`
- Modify: `frontend-public/src/services/api.js`
- Modify: `frontend-public/src/App.module.css`
- Modify: `frontend-public/src/App.test.jsx`

**Interfaces:**
- Consumes page image/metadata and confirmed placement updates.
- Produces normalized page-space rectangles independent of browser zoom.

- [ ] **Step 1: Write failing source-contract test**

```javascript
it('edits PDF page, rectangle, font, alignment, and confirmation', () => {
  const source = readSource('components/PdfPlacementEditor.jsx');
  for (const text of ['页码', '填写区域', '字号', '对齐方式', '确认此位置']) expect(source).toContain(text);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- --run` in `frontend-public`.

- [ ] **Step 3: Implement page overlay editor**

Render the selected page preview, draw draggable/resizable rectangles, and convert CSS coordinates to PDF points using saved page width/height. Support page, font size, alignment, multiline, and checkbox appearance. Require explicit confirmation for OCR candidates and overlapping rectangles.

- [ ] **Step 4: Run tests/build and commit**

Run: `npm test -- --run` and `npm run build`.

```powershell
git add frontend-public/src/components/PdfPlacementEditor.jsx frontend-public/src/components/PlacementEditor.jsx frontend-public/src/pages/TemplateConfirmPage.jsx frontend-public/src/services/api.js frontend-public/src/App.module.css frontend-public/src/App.test.jsx
git commit -m "feat: confirm PDF template placements visually"
```

### Task 4: PDF overflow and visual quality checks

**Files:**
- Create: `backend/pdf_quality.py`
- Create: `backend/test_pdf_quality.py`
- Modify: `backend/document_renderer.py`
- Modify: `backend/document_quality.py`

**Interfaces:**
- Produces: `validate_pdf_render(template_path: str, output_path: str, compiled: CompiledTemplate) -> list[RenderWarning]`.

- [ ] **Step 1: Write failing quality tests**

```python
def test_out_of_bounds_and_clipped_text_block_finalize(self):
    warnings = validate_pdf_render(self.template, self.output, self.compiled)
    self.assertIn("pdf_text_overflow", {w.code for w in warnings})

def test_page_count_must_not_change(self):
    warnings = validate_pdf_render(self.two_page_template, self.one_page_output, self.compiled)
    self.assertIn("pdf_page_count_changed", {w.code for w in warnings})
```

- [ ] **Step 2: Run and verify failure**

Run: `.\.venv\Scripts\python.exe -m unittest backend.test_pdf_quality -v`

- [ ] **Step 3: Implement deterministic checks**

Validate page count and rectangle bounds before render. Use ReportLab font metrics to detect clipped lines. Render template and output pages with pypdfium2, calculate changed-pixel bounding boxes around confirmed placements, and warn when changes occur outside allowed padded rectangles or expected content produces no visible difference.

- [ ] **Step 4: Run tests and commit**

```powershell
git add backend/pdf_quality.py backend/test_pdf_quality.py backend/document_renderer.py backend/document_quality.py
git commit -m "feat: enforce PDF rendering quality"
```

### Task 5: PDF end-to-end, deployment, and full regression

**Files:**
- Create: `backend/test_pdf_template_end_to_end.py`
- Modify: `backend/requirements.txt`
- Modify: `Dockerfile`
- Modify: `README.md`

**Interfaces:**
- Exercises native form, text PDF, scanned PDF, API confirmation, draft, quality block, final download, and ZIP.

- [ ] **Step 1: Add synthetic PDF end-to-end fixtures and tests**

Generate test PDFs in temporary directories with ReportLab and pypdf. Assert that native form values persist, coordinate overlays remain inside bounds, unconfirmed OCR cannot finalize, and one failed PDF template does not block a successful DOCX template.

- [ ] **Step 2: Pin runtime dependencies**

Keep compatible pinned versions for `pypdf`, `pypdfium2`, `Pillow`, `pytesseract`, and `reportlab`. Ensure Docker retains Noto CJK fonts, Tesseract Chinese data, and LibreOffice Writer.

- [ ] **Step 3: Run full verification**

Run: `.\.venv\Scripts\python.exe -m unittest discover -s backend -p 'test_*.py'`

Run: `npm test -- --run` and `npm run build` in `frontend-public`.

Run: `docker compose config --quiet`

Run: `git diff --check`

Expected: all checks PASS in the production dependency environment; local optional-dependency skips must state the missing dependency.

- [ ] **Step 4: Commit**

```powershell
git add backend/test_pdf_template_end_to_end.py backend/requirements.txt Dockerfile README.md
git commit -m "test: verify advanced PDF template workflows"
```
