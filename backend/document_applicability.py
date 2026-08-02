"""Evidence gate deciding whether an output document should be produced."""

from __future__ import annotations

import json
from typing import Awaitable, Callable, Literal

from pydantic import BaseModel, Field

from .generic_evaluator import FieldValue, GenericEvaluationResult, _extract_json_payload
from .template_ir import CompiledTemplate


class DocumentApplicability(BaseModel):
    status: Literal["applicable", "needs_input", "insufficient_evidence", "not_applicable", "failed"]
    reason: str = ""
    missing_requirements: list[str] = Field(default_factory=list)
    evidence_refs: list[str] = Field(default_factory=list)


class CompiledFieldValue(FieldValue):
    status: Literal["filled", "needs_user_input", "missing_evidence"] = "filled"


class CompiledMapping(BaseModel):
    fields: dict[str, CompiledFieldValue]


async def assess_document_applicability(
    result: GenericEvaluationResult,
    compiled: CompiledTemplate,
    completion: Callable[[list[dict]], Awaitable[str]] | None = None,
) -> DocumentApplicability:
    if not compiled.applicability_rules:
        return DocumentApplicability(status="applicable", reason="模板未设置额外适用条件")
    known = [item for item in result.criteria_results if item.result != "unknown"]
    evidence = [ref for item in known for ref in item.evidence_refs]
    missing = []
    for rule in compiled.applicability_rules:
        requirement_text = rule.requirement.lower()
        matching = [
            item for item in known
            if requirement_text in f"{item.criterion} {item.observation} {item.reasoning}".lower()
        ]
        if not matching or (rule.evidence_required and not any(item.evidence_refs for item in matching)):
            if rule.blocking:
                missing.append(rule.requirement)
    if missing and completion is None:
        return DocumentApplicability(
            status="insufficient_evidence", reason="缺少生成该文书所需的可核验证据",
            missing_requirements=missing, evidence_refs=evidence,
        )
    if completion is not None:
        payload = _extract_json_payload(await completion([{
            "role": "user",
            "content": json.dumps({
                "result": result.model_dump(),
                "requirements": [rule.model_dump() for rule in compiled.applicability_rules],
                "instruction": "判断文书适用性；满足项必须引用 evidence_refs。返回 status, reason, missing_requirements, evidence_refs。",
            }, ensure_ascii=False),
        }]))
        decision = DocumentApplicability.model_validate(payload)
        if decision.status == "applicable" and not decision.evidence_refs:
            return DocumentApplicability(status="insufficient_evidence", reason="适用性判断缺少证据引用", missing_requirements=[rule.requirement for rule in compiled.applicability_rules])
        return decision
    return DocumentApplicability(status="applicable", reason="适用条件已有证据支持", evidence_refs=evidence)


async def map_compiled_template(
    result: GenericEvaluationResult,
    compiled: CompiledTemplate,
    completion: Callable[[list[dict]], Awaitable[str]] | None = None,
) -> CompiledMapping:
    mapped: dict[str, CompiledFieldValue] = {}
    ai_fields = [field for field in compiled.fields if field.fill_source != "user"]
    ai_payload = {}
    if ai_fields and completion:
        response = _extract_json_payload(await completion([{
            "role": "user",
            "content": json.dumps({
                "canonical_result": result.model_dump(),
                "fields": [{"key": field.key, "label": field.label} for field in ai_fields],
                "instruction": "仅从结果映射字段，缺少事实时留空。返回 {fields:{key:{value,source_refs,confidence}}}。",
            }, ensure_ascii=False),
        }]))
        ai_payload = response.get("fields") or {}
    for field in compiled.fields:
        if field.fill_source == "user":
            mapped[field.key] = CompiledFieldValue(value="", confidence=0, status="needs_user_input")
        else:
            raw = ai_payload.get(field.key, {"value": "", "source_refs": [], "confidence": 0})
            value = CompiledFieldValue.model_validate(raw)
            if not value.value and field.required:
                value.status = "missing_evidence"
            mapped[field.key] = value
    return CompiledMapping(fields=mapped)
