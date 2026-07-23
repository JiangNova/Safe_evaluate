"""FastAPI application — Fire Safety Evaluation System backend."""
import json
import os
import sys
import traceback
from datetime import datetime
from fastapi import FastAPI, File, Form, UploadFile, HTTPException, Depends, Query
from typing import List
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .config import (
    MAX_FILE_SIZE,
    CORS_ORIGINS,
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
from .database import save_report, get_report, list_reports
from .document_parser import load_all_requirements, build_requirements_context
from .evaluator import evaluate_images
from .rules_store import list_rules, create_rule, update_rule, delete_rule
from .stats_service import get_all_stats

app = FastAPI(title="SafeEvaluate API", version="1.0.0")

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


# ===== Evaluate endpoint =====

@app.post("/api/evaluate", response_model=EvaluateResponse)
async def submit_evaluation(
    files: List[UploadFile] = File(...),
    rules: str = Form(default=""),
    _auth: dict = Depends(require_auth),
):
    """Submit one or more images for fire safety evaluation.

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
    docs = load_all_requirements()
    requirements_context = build_requirements_context(docs)

    # Call Qwen API for evaluation
    try:
        result = await evaluate_images(
            images=images,
            rules=rule_list,
            requirements_context=requirements_context,
        )
    except RuntimeError as e:
        # Use print-safe encoding for Windows GBK terminals
        try:
            print(f"[EVALUATE ERROR] RuntimeError: {e}", file=sys.stderr)
        except UnicodeEncodeError:
            print(f"[EVALUATE ERROR] RuntimeError: {str(e).encode('ascii', errors='replace').decode()}", file=sys.stderr)
        traceback.print_exc()
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        try:
            print(f"[EVALUATE ERROR] Unexpected: {e}", file=sys.stderr)
        except UnicodeEncodeError:
            print(f"[EVALUATE ERROR] Unexpected: {str(e).encode('ascii', errors='replace').decode()}", file=sys.stderr)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"评估服务异常: {str(e)}")

    # Build report
    report = {
        "title": result.get("title", "消防安全评估报告"),
        "date": datetime.now().strftime("%Y-%m-%d"),
        "filename": ", ".join(filenames),
        "overall_assessment": result.get("overall_assessment", ""),
        "rules": rule_list,
        "stats": result.get("stats", {"compliant": 0, "nonCompliant": 0, "suggestions": 0}),
        "findings": result.get("findings", []),
    }

    # Save and return
    report_id = save_report(report)
    return EvaluateResponse(report_id=report_id)


# ===== Report endpoints =====

@app.get("/api/reports/{report_id}")
async def fetch_report(
    report_id: str,
    _auth: dict = Depends(require_auth),
):
    """Fetch a single evaluation report by ID."""
    report = get_report(report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="报告不存在")
    return report


@app.get("/api/reports", response_model=HistoryResponse)
async def fetch_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    _auth: dict = Depends(require_auth),
):
    """Fetch paginated list of evaluation reports."""
    return list_reports(page=page, page_size=page_size)


# ===== Rules endpoints =====

@app.get("/api/rules")
async def fetch_rules(
    category: str = Query(default=""),
    _auth: dict = Depends(require_auth),
):
    """Fetch all evaluation rules, optionally filtered by category."""
    rules = list_rules(category=category if category else None)
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
