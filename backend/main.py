"""FastAPI application — Fire Safety Evaluation System backend."""
import asyncio
import json
import os
import sys
import traceback
from contextlib import asynccontextmanager, suppress
from datetime import datetime
from fastapi import FastAPI, File, Form, UploadFile, HTTPException, Depends, Query
from fastapi.responses import FileResponse
from typing import List
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .config import (
    MAX_FILE_SIZE,
    CORS_ORIGINS,
    IMAGE_STORAGE_DIR,
)
from .models import (
    LoginRequest,
    LoginResponse,
    EvaluateResponse,
    HistoryResponse,
    Rule,
    RuleCreate,
    RuleUpdate,
    StatsResponse,
)
from .auth import authenticate, verify_token
from .database import save_report, get_report, list_reports, init_db, save_report_images, get_report_images
from .document_parser import load_all_requirements, build_requirements_context, parse_pdf, load_output_templates, build_templates_context
from .evaluator import evaluate_images
from .rules_store import list_rules, create_rule, update_rule, delete_rule
from .stats_service import get_all_stats
from .public_jobs import init_public_job_db
from .public_job_cleanup import (
    cleanup_expired_public_jobs,
    cleanup_expired_public_workspaces,
)
from .public_job_routes import router as public_job_router
from .public_workspaces import init_workspace_db
from .workspace_assets import init_workspace_asset_db
from .workspace_routes import router as workspace_router
from .leadership_routes import router as leadership_router


async def _public_job_cleanup_loop() -> None:
    while True:
        await asyncio.sleep(60 * 60)
        await asyncio.to_thread(cleanup_expired_public_jobs)
        await asyncio.to_thread(cleanup_expired_public_workspaces)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await asyncio.to_thread(cleanup_expired_public_jobs)
    await asyncio.to_thread(cleanup_expired_public_workspaces)
    cleanup_task = asyncio.create_task(_public_job_cleanup_loop())
    try:
        yield
    finally:
        cleanup_task.cancel()
        with suppress(asyncio.CancelledError):
            await cleanup_task


app = FastAPI(title="SafeEvaluate API", version="1.0.0", lifespan=lifespan)

# Initialize database (create tables + migrate legacy JSON reports)
init_db()
init_public_job_db()
init_workspace_db()
init_workspace_asset_db()
app.include_router(public_job_router)
app.include_router(workspace_router)
app.include_router(leadership_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()

# Allowed MIME types
ALLOWED_MIMES = {
    "image/png", "image/jpeg", "image/jpg",
    "image/gif", "image/bmp", "image/webp",
    "application/pdf",
}


# ===== Auth endpoints =====

@app.post("/api/auth/login", response_model=LoginResponse)
async def login(req: LoginRequest):
    """Authenticate user and return a JWT token."""
    token = authenticate(req.username, req.password)
    if token is None:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    return LoginResponse(
        token=token,
        user={"username": req.username, "role": "admin"},
    )


# ===== Dependency: require auth =====

async def require_auth(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Dependency that verifies the JWT token."""
    payload = verify_token(credentials.credentials)
    if payload is None:
        raise HTTPException(status_code=401, detail="Token无效或已过期")
    return payload


# ===== Image persistence helper =====


def _save_uploaded_images(report_id: str, images: list[tuple], filenames: list[str]) -> None:
    """Save uploaded image bytes to disk and record metadata in DB."""
    report_dir = os.path.join(IMAGE_STORAGE_DIR, report_id)
    os.makedirs(report_dir, exist_ok=True)

    image_records = []
    for idx, (img_bytes, mime_type) in enumerate(images):
        ext = _mime_to_ext(mime_type)
        safe_name = f"{idx}{ext}"
        file_path = os.path.join(report_dir, safe_name)
        with open(file_path, "wb") as f:
            f.write(img_bytes)
        image_records.append({
            "filename": filenames[idx] if idx < len(filenames) else f"image_{idx}",
            "mime_type": mime_type,
            "file_path": file_path,
        })

    if image_records:
        save_report_images(report_id, image_records)


def _mime_to_ext(mime_type: str) -> str:
    """Map MIME type to file extension."""
    mapping = {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/gif": ".gif",
        "image/bmp": ".bmp",
        "image/webp": ".webp",
        "application/pdf": ".pdf",
    }
    return mapping.get(mime_type, ".png")


def _extract_raw_from_error(err_str: str) -> tuple[str | None, str]:
    """Extract raw AI response embedded in error message (Bug B).

    Returns (raw_content_or_None, cleaned_error_message).
    """
    marker = "\n--- RAW AI RESPONSE (first 1000 chars) ---\n"
    if marker not in err_str:
        return None, err_str

    # Split: everything before marker is user-facing error, after is raw content
    parts = err_str.split(marker, 1)
    clean_error = parts[0]
    raw_section = parts[1]

    # Remove the closing marker if present
    end_marker = "\n--- END RAW ---"
    if raw_section.endswith(end_marker):
        raw_section = raw_section[:-len(end_marker)]

    return raw_section, clean_error


# ===== Evaluation engine =====

async def _run_evaluation(
    files: List[UploadFile] = File(...),
    rules: str = Form(default=""),
    *,
    use_local_requirements: bool = True,
):
    """Run one or more images through the shared safety evaluation engine.

    All images are sent to the Qwen vision model together, so the AI can
    correlate findings across multiple photos of the same site.
    """
    if not files:
        raise HTTPException(status_code=400, detail="请至少上传一个文件")

    # Validate and read all files
    images = []
    filenames = []
    for f in files:
        mime = f.content_type or ""
        if mime not in ALLOWED_MIMES:
            raise HTTPException(
                status_code=400,
                detail=f"不支持的文件类型: {mime}（{f.filename}）。支持: {', '.join(sorted(ALLOWED_MIMES))}",
            )
        fb = await f.read()
        if len(fb) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"文件过大（{f.filename}），最大支持 {MAX_FILE_SIZE // (1024*1024)}MB",
            )
        if len(fb) == 0:
            raise HTTPException(status_code=400, detail=f"文件为空: {f.filename}")
        images.append((fb, mime))
        filenames.append(f.filename or "unknown")

    # Parse rules (optional — defaults to all requirement docs)
    if rules and rules.strip():
        try:
            rule_list = json.loads(rules)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="规则参数格式错误")
    else:
        rule_list = []

    # Load requirement documents and build context
    docs = load_all_requirements() if use_local_requirements else []
    requirements_context = build_requirements_context(docs)

    # Load output templates and build template context
    templates = load_output_templates() if use_local_requirements else []
    templates_context = build_templates_context(templates)

    # Call Qwen API for evaluation
    raw_content = None
    try:
        result, raw_content = await evaluate_images(
            images=images,
            rules=rule_list,
            requirements_context=requirements_context,
            templates_context=templates_context,
        )
        eval_status = "success"
        error_msg = None
    except RuntimeError as e:
        # API call exhausted all retries — save failure record
        try:
            print(f"[EVALUATE ERROR] RuntimeError: {e}", file=sys.stderr)
        except UnicodeEncodeError:
            print(
                f"[EVALUATE ERROR] RuntimeError: {str(e).encode('ascii', errors='replace').decode()}",
                file=sys.stderr,
            )
        traceback.print_exc()
        result = None
        eval_status = "failed"
        # Bug B: extract raw AI response from error for DB storage
        err_str = str(e)
        raw_content, clean_error = _extract_raw_from_error(err_str)
        error_msg = clean_error
    except ValueError as e:
        # JSON parse failure (legacy — should now be caught inside evaluate_images,
        # but kept as safety net for any remaining edge cases)
        try:
            print(f"[EVALUATE ERROR] ValueError (parse): {e}", file=sys.stderr)
        except UnicodeEncodeError:
            print(
                f"[EVALUATE ERROR] ValueError: {str(e).encode('ascii', errors='replace').decode()}",
                file=sys.stderr,
            )
        traceback.print_exc()
        result = None
        eval_status = "failed"
        error_msg = f"AI返回格式异常: {str(e)}"
    except Exception as e:
        try:
            print(f"[EVALUATE ERROR] Unexpected: {e}", file=sys.stderr)
        except UnicodeEncodeError:
            print(
                f"[EVALUATE ERROR] Unexpected: {str(e).encode('ascii', errors='replace').decode()}",
                file=sys.stderr,
            )
        traceback.print_exc()
        result = None
        eval_status = "failed"
        error_msg = f"评估服务异常: {str(e)}"

    # Build report (always — success or failure)
    if result and eval_status == "success":
        report = {
            "title": result.get("title", "消防安全评估报告"),
            "date": datetime.now().strftime("%Y-%m-%d"),
            "filename": ", ".join(filenames),
            "overall_assessment": result.get("overall_assessment", ""),
            "rules": rule_list,
            "stats": result.get("stats", {"compliant": 0, "nonCompliant": 0, "suggestions": 0}),
            "findings": result.get("findings", []),
            "inspection_record": result.get("inspection_record"),
            "correction_notice": result.get("correction_notice"),
            "status": "success",
            "error_message": None,
            "raw_response": raw_content,
        }
    else:
        report = {
            "title": "消防安全评估报告",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "filename": ", ".join(filenames),
            "overall_assessment": "",
            "rules": rule_list,
            "stats": {"compliant": 0, "nonCompliant": 0, "suggestions": 0},
            "findings": [],
            "inspection_record": None,
            "correction_notice": None,
            "status": "failed",
            "error_message": error_msg,
            "raw_response": raw_content,
        }

    # Save and return
    report_id = save_report(report)

    # Persist uploaded images to disk and DB
    _save_uploaded_images(report_id, images, filenames)

    return EvaluateResponse(
        report_id=report_id,
        status=eval_status,
        error=error_msg if eval_status == "failed" else None,
    )


# ===== Evaluate endpoints =====

@app.post("/api/evaluate", response_model=EvaluateResponse)
async def submit_evaluation(
    files: List[UploadFile] = File(...),
    rules: str = Form(default=""),
    _auth: dict = Depends(require_auth),
):
    """Submit an authenticated evaluation using the local requirement set."""
    return await _run_evaluation(
        files,
        rules,
        use_local_requirements=True,
    )


@app.post("/api/public/evaluate", response_model=EvaluateResponse)
async def submit_public_evaluation(
    files: List[UploadFile] = File(...),
    rules: str = Form(default=""),
):
    """Submit an anonymous evaluation using neutral, general standards."""
    return await _run_evaluation(
        files,
        rules,
        use_local_requirements=False,
    )


# ===== Report endpoints =====

def _build_report_payload(report_id: str, image_base_url: str) -> dict:
    """Build a report response with image URLs for the requested API surface."""
    report = get_report(report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="报告不存在")

    payload = dict(report)
    # Attach image URLs
    images = get_report_images(report_id)
    payload["images"] = [
        {
            "index": img["index"],
            "filename": img["filename"],
            "url": f"{image_base_url}/{report_id}/images/{img['index']}",
        }
        for img in images
    ]

    return payload


@app.get("/api/reports/{report_id}")
async def fetch_report(
    report_id: str,
    _auth: dict = Depends(require_auth),
):
    """Fetch a single authenticated evaluation report by ID."""
    return _build_report_payload(report_id, "/api/reports")


@app.get("/api/public/reports/{report_id}")
async def fetch_public_report(report_id: str):
    """Fetch one report when its opaque identifier is known."""
    return _build_report_payload(report_id, "/api/public/reports")


@app.get("/api/reports/{report_id}/images")
async def fetch_report_images(
    report_id: str,
    _auth: dict = Depends(require_auth),
):
    """List image metadata for a report."""
    images = get_report_images(report_id)
    return {
        "images": [
            {
                "index": img["index"],
                "filename": img["filename"],
                "url": f"/api/reports/{report_id}/images/{img['index']}",
            }
            for img in images
        ]
    }


@app.get("/api/reports/{report_id}/images/{image_index}")
async def serve_report_image(
    report_id: str,
    image_index: int,
    _auth: dict = Depends(require_auth),
):
    """Serve a stored image for an authenticated report."""
    return _serve_report_image(report_id, image_index)


@app.get("/api/public/reports/{report_id}/images/{image_index}")
async def serve_public_report_image(
    report_id: str,
    image_index: int,
):
    """Serve a stored image when its report identifier is known."""
    return _serve_report_image(report_id, image_index)


def _serve_report_image(report_id: str, image_index: int):
    """Resolve and serve one persisted report image."""
    images = get_report_images(report_id)
    if image_index < 0 or image_index >= len(images):
        raise HTTPException(status_code=404, detail="图片不存在")

    img = images[image_index]
    file_path = img.get("file_path", "")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="图片文件不存在")

    return FileResponse(
        file_path,
        media_type=img.get("mime_type", "image/png"),
        filename=img.get("filename", "image"),
    )


@app.get("/api/reports", response_model=HistoryResponse)
async def fetch_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    _auth: dict = Depends(require_auth),
):
    """Fetch paginated list of evaluation reports."""
    return list_reports(page=page, page_size=page_size)


# ===== Rules endpoints =====


@app.post("/api/rules/parse-pdf")
async def parse_rule_pdf(
    file: UploadFile = File(...),
    _auth: dict = Depends(require_auth),
):
    """Upload a PDF and extract text for rule creation.

    Returns the extracted text, which the frontend can use to populate
    the rule description / source_doc fields.
    """
    mime = file.content_type or ""
    if "pdf" not in mime.lower():
        raise HTTPException(
            status_code=400,
            detail=f"仅支持PDF文件，当前类型: {mime or '未知'}",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"文件过大（{file.filename}），最大支持 {MAX_FILE_SIZE // (1024 * 1024)}MB",
        )
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="文件为空")

    text = parse_pdf(content)

    return {
        "filename": file.filename,
        "text": text,
        "length": len(text),
    }


# ===== Rules (CRUD) endpoints =====

@app.get("/api/rules")
async def fetch_rules(
    category: str = Query(default=""),
    _auth: dict = Depends(require_auth),
):
    """Fetch all evaluation rules, optionally filtered by category."""
    rules = list_rules(category=category if category else None)
    return {"items": rules, "total": len(rules)}


@app.get("/api/public/rules")
async def fetch_public_rules():
    """Return neutral built-in rules without exposing management data."""
    blocked_terms = ("天心区", "公安分局", "派出所")
    rules = [
        rule
        for rule in list_rules()
        if not rule.get("is_custom", False)
        and not any(term in str(rule) for term in blocked_terms)
    ]
    return {"items": rules, "total": len(rules)}


@app.post("/api/rules", response_model=Rule)
async def add_rule(
    body: RuleCreate,
    _auth: dict = Depends(require_auth),
):
    """Create a new custom rule."""
    rule = create_rule(body.model_dump())
    return rule


@app.put("/api/rules/{rule_id}", response_model=Rule)
async def edit_rule(
    rule_id: str,
    body: RuleUpdate,
    _auth: dict = Depends(require_auth),
):
    """Update an existing rule."""
    updated = update_rule(rule_id, body.model_dump(exclude_none=True))
    if updated is None:
        raise HTTPException(status_code=404, detail="规则不存在")
    return updated


@app.delete("/api/rules/{rule_id}")
async def remove_rule(
    rule_id: str,
    _auth: dict = Depends(require_auth),
):
    """Delete a custom rule. Built-in rules cannot be deleted."""
    ok = delete_rule(rule_id)
    if not ok:
        # Check if it exists but is built-in
        rules = list_rules()
        exists = any(r["id"] == rule_id for r in rules)
        if exists:
            raise HTTPException(status_code=403, detail="内置规则不可删除")
        raise HTTPException(status_code=404, detail="规则不存在")
    return {"ok": True}


# ===== Statistics endpoints =====

@app.get("/api/stats", response_model=StatsResponse)
async def fetch_stats(
    _auth: dict = Depends(require_auth),
):
    """Fetch aggregated statistics across all evaluation reports."""
    return get_all_stats()


# ===== Health check =====

@app.get("/api/health")
async def health_check():
    """Health check endpoint (no auth required)."""
    docs = load_all_requirements()
    return {
        "status": "ok",
        "version": "1.0.0",
        "documents_loaded": len(docs),
        "documents": [d["filename"] for d in docs],
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
