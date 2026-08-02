"""FastAPI routes for anonymous, template-driven generic evaluation jobs."""

from __future__ import annotations

import asyncio
import os
import time
from collections import defaultdict, deque
from dataclasses import asdict
from pathlib import Path
from typing import Annotated, Any

from fastapi import (
    APIRouter,
    BackgroundTasks,
    File,
    Header,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse

from . import public_files, public_jobs
from .config import PUBLIC_JOB_CREATE_RATE, PUBLIC_JOB_MAX_CONCURRENCY
from .document_renderer import (
    DocumentRenderError,
    build_artifact_zip,
    convert_docx_to_pdf,
    render_docx,
    render_pdf,
)
from .generic_evaluator import (
    FieldValue,
    GenericEvaluationResult,
    evaluate_generic,
    infer_template_fields,
    map_template,
    regenerate_field,
)
from .models import (
    DocumentFieldsUpdate,
    PublicJobCreateRequest,
    PublicJobCreateResponse,
    RegenerateFieldRequest,
    TemplateFieldsUpdate,
)
from .template_parser import (
    TemplateParseResult,
    parse_template,
    validate_field_definitions,
)


router = APIRouter(prefix="/api/public/jobs", tags=["public-generic-jobs"])

_CREATE_EVENTS: dict[str, deque[float]] = defaultdict(deque)
_JOB_SEMAPHORE = asyncio.Semaphore(max(1, PUBLIC_JOB_MAX_CONCURRENCY))


def _api_error(
    status_code: int,
    code: str,
    message: str,
    *,
    stage: str,
    retryable: bool = False,
) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={
            "code": code,
            "message": message,
            "stage": stage,
            "retryable": retryable,
        },
    )


def _enforce_create_rate(request: Request) -> None:
    address = request.client.host if request.client else "unknown"
    now = time.monotonic()
    events = _CREATE_EVENTS[address]
    while events and events[0] <= now - 60:
        events.popleft()
    if len(events) >= PUBLIC_JOB_CREATE_RATE:
        raise _api_error(
            429,
            "rate_limited",
            "创建任务过于频繁，请稍后重试",
            stage="create",
            retryable=True,
        )
    events.append(now)


def _authorize(job_id: str, token: str | None) -> dict:
    if not token:
        raise _api_error(
            401,
            "job_token_required",
            "缺少匿名任务访问凭证",
            stage="authorize",
        )
    try:
        return public_jobs.authorize_job(job_id, token)
    except LookupError as exc:
        raise _api_error(
            404, "job_not_found", "匿名评估任务不存在", stage="authorize"
        ) from exc
    except PermissionError as exc:
        message = str(exc)
        if "expired" in message:
            raise _api_error(
                410, "job_expired", "匿名评估任务已过期", stage="authorize"
            ) from exc
        raise _api_error(
            403, "job_token_invalid", "匿名任务访问凭证无效", stage="authorize"
        ) from exc


def _template_payload(template: dict) -> dict:
    return {
        "id": template["id"],
        "source_file_id": template["source_file_id"],
        "source_format": template["source_format"],
        "fields": template.get("fields_json") or [],
        "preview_metadata": template.get("preview_metadata_json") or {},
        "confirmation_status": template["confirmation_status"],
        "created_at": template["created_at"],
    }


def _file_payload(record: dict) -> dict:
    """Expose file metadata without leaking the server filesystem path."""
    return {
        "id": record["id"],
        "kind": record["kind"],
        "name": record["original_name"],
        "mime_type": record["mime_type"],
        "size": record["size"],
        "parse_status": record["parse_status"],
        "parse_metadata": record.get("parse_metadata_json"),
        "created_at": record["created_at"],
    }


def _document_payload(document: dict) -> dict:
    return {
        "id": document["id"],
        "template_id": document["template_id"],
        "ai_initial_fields": document.get("ai_initial_fields_json") or {},
        "current_fields": document.get("current_fields_json") or {},
        "status": document["status"],
        "docx_file_id": document.get("docx_file_id"),
        "pdf_file_id": document.get("pdf_file_id"),
        "warnings": document.get("warnings_json") or [],
        "error": document.get("error_json"),
        "updated_at": document["updated_at"],
    }


def _job_payload(job: dict) -> dict:
    return {
        "id": job["id"],
        "goal": job["goal"],
        "status": job["status"],
        "result": job.get("result_json"),
        "errors": job.get("error_json"),
        "created_at": job["created_at"],
        "updated_at": job["updated_at"],
        "expires_at": job["expires_at"],
        "files": [_file_payload(item) for item in public_jobs.list_files(job["id"])],
        "templates": [
            _template_payload(item) for item in public_jobs.list_templates(job["id"])
        ],
        "documents": [
            _document_payload(item) for item in public_jobs.list_documents(job["id"])
        ],
    }


@router.post("", response_model=PublicJobCreateResponse, status_code=201)
async def create_public_job(request: Request, body: PublicJobCreateRequest):
    _enforce_create_rate(request)
    try:
        job, token = public_jobs.create_job(body.goal)
    except ValueError as exc:
        raise _api_error(400, "goal_required", str(exc), stage="create") from exc
    return PublicJobCreateResponse(
        job_id=job["id"],
        access_token=token,
        status=job["status"],
        expires_at=job["expires_at"],
    )


@router.get("/{job_id}")
async def get_public_job(
    job_id: str,
    x_job_token: Annotated[str | None, Header()] = None,
):
    job = _authorize(job_id, x_job_token)
    return _job_payload(job)


async def _validate_uploads(kind: str, files: list[UploadFile]):
    if not files:
        raise _api_error(400, "files_required", "请至少上传一个文件", stage="upload")
    validated = []
    for upload in files:
        data = await upload.read()
        try:
            validated.append(
                public_files.validate_upload(
                    kind,
                    upload.filename or "",
                    upload.content_type or "application/octet-stream",
                    data,
                )
            )
        except public_files.UploadValidationError as exc:
            raise _api_error(
                400, "invalid_upload", str(exc), stage="upload"
            ) from exc
    return validated


@router.post("/{job_id}/files/{kind}", status_code=201)
async def upload_public_job_files(
    job_id: str,
    kind: str,
    files: list[UploadFile] = File(...),
    x_job_token: Annotated[str | None, Header()] = None,
):
    _authorize(job_id, x_job_token)
    if kind not in {"material", "basis"}:
        raise _api_error(400, "invalid_file_kind", "文件用途无效", stage="upload")
    validated = await _validate_uploads(kind, files)
    try:
        records = [public_files.store_upload(job_id, item) for item in validated]
    except public_files.UploadValidationError as exc:
        raise _api_error(400, "upload_limit", str(exc), stage="upload") from exc
    return {"files": [_file_payload(item) for item in records]}


@router.post("/{job_id}/templates", status_code=201)
async def upload_public_job_templates(
    job_id: str,
    files: list[UploadFile] = File(...),
    auto_infer: bool = Query(default=True),
    x_job_token: Annotated[str | None, Header()] = None,
):
    _authorize(job_id, x_job_token)
    validated = await _validate_uploads("template", files)
    templates = []
    for upload in validated:
        try:
            record = public_files.store_upload(job_id, upload)
            parsed = parse_template(record)
            if auto_infer and not parsed.fields:
                text = "\n".join(
                    str(item.get("text", ""))
                    for item in parsed.preview_metadata.get("paragraphs", [])
                )
                layout = parsed.preview_metadata.get("pages", []) or parsed.preview_metadata.get(
                    "paragraphs", []
                )
                try:
                    inferred = await infer_template_fields(
                        parsed.source_format, text, layout
                    )
                    parsed = TemplateParseResult(
                        source_format=parsed.source_format,
                        fields=inferred,
                        preview_metadata=parsed.preview_metadata,
                        warnings=parsed.warnings,
                        requires_confirmation=True,
                    )
                except Exception as exc:
                    parsed = TemplateParseResult(
                        source_format=parsed.source_format,
                        fields=[],
                        preview_metadata=parsed.preview_metadata,
                        warnings=[*parsed.warnings, f"AI 字段识别失败: {exc}"],
                        requires_confirmation=True,
                    )
            template = public_jobs.add_template(
                job_id,
                record["id"],
                parsed.source_format,
                [field.to_dict() for field in parsed.fields],
                preview_metadata={
                    **parsed.preview_metadata,
                    "warnings": parsed.warnings,
                    "requires_confirmation": parsed.requires_confirmation,
                },
            )
            templates.append(_template_payload(template))
        except (public_files.UploadValidationError, ValueError) as exc:
            raise _api_error(
                400, "template_parse_failed", str(exc), stage="template_parse"
            ) from exc
    return {"templates": templates}


@router.get("/{job_id}/templates/{template_id}/parse-result")
async def get_template_parse_result(
    job_id: str,
    template_id: int,
    x_job_token: Annotated[str | None, Header()] = None,
):
    _authorize(job_id, x_job_token)
    template = public_jobs.get_template(template_id, job_id)
    if template is None:
        raise _api_error(
            404, "template_not_found", "输出模板不存在", stage="template_parse"
        )
    return _template_payload(template)


@router.put("/{job_id}/templates/{template_id}/fields")
async def confirm_template_fields(
    job_id: str,
    template_id: int,
    body: TemplateFieldsUpdate,
    x_job_token: Annotated[str | None, Header()] = None,
):
    _authorize(job_id, x_job_token)
    template = public_jobs.get_template(template_id, job_id)
    if template is None:
        raise _api_error(
            404, "template_not_found", "输出模板不存在", stage="field_confirm"
        )
    try:
        fields = validate_field_definitions(template["source_format"], body.fields)
    except ValueError as exc:
        raise _api_error(
            400, "invalid_template_fields", str(exc), stage="field_confirm"
        ) from exc
    if not fields:
        raise _api_error(
            400,
            "template_fields_required",
            "请至少确认一个输出字段",
            stage="field_confirm",
        )
    updated = public_jobs.update_template_fields(
        template_id,
        [field.to_dict() for field in fields],
        preview_metadata=body.preview_metadata,
    )
    return _template_payload(updated)


def _evaluation_prerequisites(job_id: str) -> tuple[list[dict], list[dict], list[dict]]:
    materials = public_jobs.list_files(job_id, "material")
    bases = public_jobs.list_files(job_id, "basis")
    templates = public_jobs.list_templates(job_id)
    missing = []
    if not materials:
        missing.append("material")
    if not bases:
        missing.append("basis")
    if not templates:
        missing.append("template")
    if missing:
        raise _api_error(
            409,
            "job_inputs_incomplete",
            f"任务缺少必要输入: {', '.join(missing)}",
            stage="evaluate",
        )
    if any(item["confirmation_status"] != "confirmed" for item in templates):
        raise _api_error(
            409,
            "templates_unconfirmed",
            "所有输出模板都必须先确认字段",
            stage="evaluate",
        )
    return materials, bases, templates


async def _execute_evaluation(job_id: str) -> None:
    async with _JOB_SEMAPHORE:
        try:
            job = public_jobs.get_job(job_id)
            if job is None:
                return
            material_files, basis_files, templates = _evaluation_prerequisites(job_id)
            materials = [public_files.extract_source(item) for item in material_files]
            bases = [public_files.extract_source(item) for item in basis_files]
            image_inputs = []
            for item in material_files:
                if Path(item["safe_name"]).suffix.lower() in {
                    ".png",
                    ".jpg",
                    ".jpeg",
                    ".webp",
                }:
                    image_inputs.append(
                        (
                            Path(item["storage_path"]).read_bytes(),
                            item["mime_type"],
                            item["original_name"],
                        )
                    )
            result = await evaluate_generic(
                job["goal"], materials, bases, image_inputs
            )
            public_jobs.update_job(
                job_id, status="mapping", result_json=result.model_dump()
            )
            public_jobs.delete_documents(job_id)
            successes = 0
            errors = []
            for template in templates:
                fields = validate_field_definitions(
                    template["source_format"], template["fields_json"]
                )
                try:
                    mapped = await map_template(str(template["id"]), result, fields)
                    public_jobs.add_document(
                        job_id,
                        template["id"],
                        {
                            key: value.model_dump()
                            for key, value in mapped.fields.items()
                        },
                    )
                    successes += 1
                except Exception as exc:
                    document = public_jobs.add_document(job_id, template["id"], {})
                    public_jobs.update_document(
                        document["id"],
                        status="failed",
                        error_json={"stage": "mapping", "message": str(exc)},
                    )
                    errors.append(
                        {"template_id": template["id"], "message": str(exc)}
                    )
            public_jobs.update_job(
                job_id,
                status="review" if successes else "failed",
                error_json={"documents": errors} if errors else None,
            )
        except Exception as exc:
            public_jobs.update_job(
                job_id,
                status="failed",
                error_json={
                    "stage": "evaluation",
                    "message": str(exc),
                    "retryable": True,
                },
            )


@router.post("/{job_id}/evaluate", status_code=202)
async def start_public_job_evaluation(
    job_id: str,
    background_tasks: BackgroundTasks,
    x_job_token: Annotated[str | None, Header()] = None,
):
    job = _authorize(job_id, x_job_token)
    _evaluation_prerequisites(job_id)
    if job["status"] in {"evaluating", "mapping", "finalizing"}:
        raise _api_error(
            409, "job_busy", "任务正在处理中", stage="evaluate", retryable=True
        )
    if job["status"] == "review":
        raise _api_error(
            409,
            "job_already_evaluated",
            "任务已生成评估结果；如需完全重评，请新建匿名任务",
            stage="evaluate",
        )
    public_jobs.update_job(job_id, status="evaluating", error_json=None)
    background_tasks.add_task(_execute_evaluation, job_id)
    return {"job_id": job_id, "status": "evaluating"}


@router.put("/{job_id}/documents/{document_id}/fields")
async def update_document_fields(
    job_id: str,
    document_id: int,
    body: DocumentFieldsUpdate,
    x_job_token: Annotated[str | None, Header()] = None,
):
    _authorize(job_id, x_job_token)
    document = public_jobs.get_document(document_id, job_id)
    if document is None:
        raise _api_error(
            404, "document_not_found", "生成文书不存在", stage="review"
        )
    template = public_jobs.get_template(document["template_id"], job_id)
    expected = {item["key"] for item in (template or {}).get("fields_json", [])}
    if set(body.fields) != expected:
        raise _api_error(
            400,
            "document_fields_mismatch",
            "提交字段必须与模板字段完全一致",
            stage="review",
        )
    previous = document.get("current_fields_json") or {}
    for key, value in body.fields.items():
        if previous.get(key) != value:
            public_jobs.add_revision(
                document_id, key, previous.get(key), value, "user"
            )
    updated = public_jobs.update_document(
        document_id, current_fields_json=body.fields, status="draft"
    )
    return _document_payload(updated)


@router.post("/{job_id}/documents/{document_id}/fields/{field_key}/regenerate")
async def regenerate_document_field(
    job_id: str,
    document_id: int,
    field_key: str,
    body: RegenerateFieldRequest,
    x_job_token: Annotated[str | None, Header()] = None,
):
    job = _authorize(job_id, x_job_token)
    document = public_jobs.get_document(document_id, job_id)
    if document is None:
        raise _api_error(
            404, "document_not_found", "生成文书不存在", stage="review"
        )
    template = public_jobs.get_template(document["template_id"], job_id)
    fields = validate_field_definitions(
        template["source_format"], template["fields_json"]
    )
    field = next((item for item in fields if item.key == field_key), None)
    if field is None:
        raise _api_error(404, "field_not_found", "模板字段不存在", stage="review")
    result = GenericEvaluationResult.model_validate(job["result_json"])
    current = {
        key: FieldValue.model_validate(value)
        for key, value in (document["current_fields_json"] or {}).items()
    }
    regenerated = await regenerate_field(
        result, field, current, body.instruction
    )
    updated_fields = {
        key: value.model_dump() for key, value in current.items()
    }
    before = updated_fields.get(field_key)
    updated_fields[field_key] = regenerated.model_dump()
    public_jobs.add_revision(
        document_id,
        field_key,
        before,
        updated_fields[field_key],
        "regenerate",
    )
    updated = public_jobs.update_document(
        document_id, current_fields_json=updated_fields, status="draft"
    )
    return _document_payload(updated)


async def _execute_finalization(job_id: str, document_id: int) -> None:
    async with _JOB_SEMAPHORE:
        document = public_jobs.get_document(document_id, job_id)
        if document is None:
            return
        try:
            template = public_jobs.get_template(document["template_id"], job_id)
            source_file = public_jobs.get_file(template["source_file_id"], job_id)
            fields = validate_field_definitions(
                template["source_format"], template["fields_json"]
            )
            job_dir = os.path.abspath(
                os.path.join(public_files.PUBLIC_JOB_STORAGE_DIR, job_id)
            )
            os.makedirs(job_dir, exist_ok=True)
            values = document["current_fields_json"] or {}
            warnings: list[dict] = []
            changes: dict[str, Any] = {"status": "finalized", "error_json": None}
            if template["source_format"] == "docx":
                docx_path = os.path.join(job_dir, f"document-{document_id}.docx")
                rendered = render_docx(
                    source_file["storage_path"], fields, values, docx_path
                )
                warnings.extend(asdict(item) for item in rendered.warnings)
                docx_record = public_files.register_generated_artifact(
                    job_id,
                    rendered.path,
                    f"{Path(source_file['original_name']).stem}-结果.docx",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                )
                changes["docx_file_id"] = docx_record["id"]
                try:
                    pdf_path = convert_docx_to_pdf(rendered.path, job_dir)
                    pdf_record = public_files.register_generated_artifact(
                        job_id,
                        str(pdf_path),
                        f"{Path(source_file['original_name']).stem}-结果.pdf",
                        "application/pdf",
                    )
                    changes["pdf_file_id"] = pdf_record["id"]
                except DocumentRenderError as exc:
                    warnings.append(
                        {
                            "code": "pdf_conversion_failed",
                            "message": str(exc),
                            "field_key": None,
                        }
                    )
            else:
                pdf_path = os.path.join(job_dir, f"document-{document_id}.pdf")
                rendered = render_pdf(
                    source_file["storage_path"], fields, values, pdf_path
                )
                warnings.extend(asdict(item) for item in rendered.warnings)
                pdf_record = public_files.register_generated_artifact(
                    job_id,
                    rendered.path,
                    f"{Path(source_file['original_name']).stem}-结果.pdf",
                    "application/pdf",
                )
                changes["pdf_file_id"] = pdf_record["id"]
            changes["warnings_json"] = warnings
            public_jobs.update_document(document_id, **changes)
        except Exception as exc:
            public_jobs.update_document(
                document_id,
                status="failed",
                error_json={"stage": "render", "message": str(exc)},
            )


@router.post("/{job_id}/documents/{document_id}/finalize", status_code=202)
async def finalize_document(
    job_id: str,
    document_id: int,
    background_tasks: BackgroundTasks,
    x_job_token: Annotated[str | None, Header()] = None,
):
    _authorize(job_id, x_job_token)
    document = public_jobs.get_document(document_id, job_id)
    if document is None:
        raise _api_error(
            404, "document_not_found", "生成文书不存在", stage="finalize"
        )
    public_jobs.update_document(document_id, status="finalizing", error_json=None)
    background_tasks.add_task(_execute_finalization, job_id, document_id)
    return {"document_id": document_id, "status": "finalizing"}


@router.post("/{job_id}/artifacts/archive")
async def download_artifact_archive(
    job_id: str,
    x_job_token: Annotated[str | None, Header()] = None,
):
    _authorize(job_id, x_job_token)
    files = []
    failures = []
    for document in public_jobs.list_documents(job_id):
        for key in ("docx_file_id", "pdf_file_id"):
            file_id = document.get(key)
            if file_id:
                record = public_jobs.get_file(file_id, job_id)
                if record:
                    files.append((record["storage_path"], record["original_name"]))
        if document["status"] == "failed":
            failures.append(
                {
                    "template": f"template-{document['template_id']}",
                    "error": (document.get("error_json") or {}).get(
                        "message", "生成失败"
                    ),
                }
            )
    if not files:
        raise _api_error(
            409, "no_finalized_artifacts", "暂无可下载的定稿文书", stage="archive"
        )
    archive_path = os.path.join(
        public_files.PUBLIC_JOB_STORAGE_DIR, job_id, "全部输出文书.zip"
    )
    build_artifact_zip(files, failures, archive_path)
    return FileResponse(
        archive_path,
        media_type="application/zip",
        filename="全部输出文书.zip",
    )


@router.get("/{job_id}/artifacts/{file_id}")
async def download_artifact(
    job_id: str,
    file_id: int,
    x_job_token: Annotated[str | None, Header()] = None,
):
    _authorize(job_id, x_job_token)
    record = public_jobs.get_file(file_id, job_id)
    if record is None or record["kind"] != "generated":
        raise _api_error(
            404, "artifact_not_found", "输出文件不存在", stage="download"
        )
    return FileResponse(
        record["storage_path"],
        media_type=record["mime_type"],
        filename=record["original_name"],
    )
