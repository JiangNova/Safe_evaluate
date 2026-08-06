# Public Image Evaluation Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve original uploads while using conservative in-memory image copies for public visual evaluation and expose truthful job phases.

**Architecture:** Add a focused image-preparation helper in `backend/public_files.py`; it only accepts material JPEG/JPG/WebP records and returns model-ready bytes plus their MIME type. The public job executor invokes it after acquiring its concurrency slot and reports `queued`, `preprocessing`, `evaluating`, and `mapping`; the React workspace maps those statuses to user-facing progress copy.

**Tech Stack:** Python 3, Pillow, FastAPI, SQLite-backed public jobs, React 18, Vitest, unittest.

## Global Constraints

- Keep originals, all input basis files, and output templates byte-for-byte unchanged.
- Do not transform PNG, PDF, DOCX, or TXT files.
- Retain the existing upload size and file-count limits.
- Use originals on any image-preparation failure.

---

### Task 1: Implement conservative evaluation-image preparation

**Files:**
- Modify: `backend/public_files.py`
- Test: `backend/test_public_files.py`

- [ ] Add tests for a large JPEG downscale, a small JPEG identity return, a PNG identity return, and invalid JPEG fallback.
- [ ] Add `prepare_evaluation_image(file_record: dict) -> tuple[bytes, str]` using `PIL.ImageOps.exif_transpose`, a 2560-pixel longest-edge cap, JPEG/WebP quality 90, and an original-byte fallback.
- [ ] Run `python -m unittest backend.test_public_files -v`.

### Task 2: Apply copies during evaluation and publish processing phases

**Files:**
- Modify: `backend/public_job_routes.py`
- Test: `backend/test_public_job_routes.py`

- [ ] Add an executor test asserting that `/evaluate` writes `queued` before background execution.
- [ ] Set `queued` before adding the background task; inside the semaphore set `preprocessing`, build image inputs through `prepare_evaluation_image`, then set `evaluating` immediately before `evaluate_generic`.
- [ ] Preserve `mapping`, `review`, and failure behavior; run `python -m unittest backend.test_public_job_routes -v`.

### Task 3: Render phases in the public workspace

**Files:**
- Modify: `frontend-public/src/pages/JobWorkspacePage.jsx`
- Modify: `frontend-public/src/App.test.jsx`

- [ ] Extend the active-state set with `queued` and `preprocessing`.
- [ ] Map each active status to the approved Chinese progress text and render it in the existing status panel.
- [ ] Extend source-contract tests for phase labels and run `npm test -- --run` from `frontend-public`.

### Task 4: Verify the integration

**Files:**
- Test: `backend/test_public_files.py`
- Test: `backend/test_public_job_routes.py`
- Test: `frontend-public/src/App.test.jsx`

- [ ] Run the focused backend suite and frontend test/build.
- [ ] Run one local public job with an image and mock the model boundary to confirm status sequencing without external API cost.
- [ ] Inspect `git diff` to ensure only planned files changed.
