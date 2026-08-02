"""Finalization gate for formal generated documents."""

from __future__ import annotations

from pydantic import BaseModel, Field

from .document_renderer import RenderWarning
from .template_ir import CompiledTemplate


class QualityReport(BaseModel):
    can_finalize: bool
    blocking_fields: list[str] = Field(default_factory=list)
    blocking_warnings: list[dict] = Field(default_factory=list)
    messages: list[str] = Field(default_factory=list)


def validate_document_for_finalize(
    compiled: CompiledTemplate,
    values: dict,
    render_warnings: list[RenderWarning | dict],
    *,
    applicability_status: str = "applicable",
) -> QualityReport:
    blocking_fields = []
    for field in compiled.fields:
        raw = values.get(field.key, "")
        value = raw.get("value", "") if isinstance(raw, dict) else raw
        if field.missing_policy == "block_finalize" and (value is None or value == "" or value == []):
            blocking_fields.append(field.key)
    blocking_codes = {
        "stale_placement", "missing_required_field", "selection_conflict",
        "required_section_missing", "unconfirmed_pdf_placement",
        "pdf_rect_out_of_bounds", "pdf_text_overflow", "pdf_page_count_changed",
    }
    blocking_warnings = []
    for warning in render_warnings:
        payload = warning if isinstance(warning, dict) else {
            "code": warning.code, "message": warning.message, "field_key": warning.field_key,
        }
        if payload.get("code") in blocking_codes:
            blocking_warnings.append(payload)
    messages = []
    if applicability_status not in {"applicable", "needs_input"}:
        messages.append("文书适用性尚未满足，暂不能定稿")
    if blocking_fields:
        messages.append("仍有必填内容待人工补充")
    if blocking_warnings:
        messages.append("模板填写位置或渲染结果需要人工校验")
    return QualityReport(
        can_finalize=not blocking_fields and not blocking_warnings and not messages,
        blocking_fields=blocking_fields,
        blocking_warnings=blocking_warnings,
        messages=messages,
    )
