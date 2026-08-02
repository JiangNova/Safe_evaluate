"""Typed intermediate representation shared by every output template format."""

from __future__ import annotations

import re
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


TemplateKind = Literal["text_freeform", "text_structured", "docx", "pdf"]
ValueType = Literal[
    "text", "multiline", "date", "number", "boolean", "single_choice",
    "multi_choice", "list", "table",
]
FillSource = Literal["ai", "user", "ai_then_user", "computed"]
MissingPolicy = Literal["block_finalize", "allow_blank", "omit_section"]
PlacementKind = Literal[
    "placeholder_replace", "run_range_replace", "paragraph_insert", "date_parts",
    "checkbox_select", "table_cell_fill", "repeat_table_row", "header_footer_fill",
    "content_control_fill", "section_toggle", "pdf_overlay", "pdf_widget_fill",
    "text_section",
]


class Placement(BaseModel):
    kind: PlacementKind
    part: str = "document"
    paragraph_index: int | None = None
    run_start: int | None = None
    run_end: int | None = None
    table_index: int | None = None
    row_index: int | None = None
    cell_index: int | None = None
    page: int | None = None
    rect: list[float] | None = None
    anchor: str | None = None
    placeholder: str | None = None
    option_marks: dict[str, Any] | None = None
    context: str = ""
    fingerprint: str = ""


class CompiledField(BaseModel):
    key: str = Field(pattern=r"^[A-Za-z][A-Za-z0-9_]*$")
    label: str = Field(min_length=1)
    value_type: ValueType = "text"
    fill_source: FillSource = "ai_then_user"
    required: bool = False
    missing_policy: MissingPolicy = "allow_blank"
    options: list[str] = Field(default_factory=list)
    default: Any = None
    description: str = ""
    placements: list[Placement] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_choices(self):
        if self.value_type == "single_choice" and isinstance(self.default, list):
            if len(self.default) > 1:
                raise ValueError("single_choice cannot have multiple defaults")
        if self.value_type in {"single_choice", "multi_choice"} and not self.options:
            raise ValueError("choice fields require options")
        if self.required and self.missing_policy == "allow_blank":
            self.missing_policy = "block_finalize"
        return self


class ApplicabilityRule(BaseModel):
    requirement: str
    evidence_required: bool = True
    basis_required: bool = False
    blocking: bool = True


class CompiledTemplate(BaseModel):
    schema_version: str = "1.0"
    kind: TemplateKind
    title: str = "输出文书"
    fields: list[CompiledField] = Field(default_factory=list)
    applicability_rules: list[ApplicabilityRule] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def unique_keys(self):
        keys = [field.key for field in self.fields]
        if len(keys) != len(set(keys)):
            raise ValueError("compiled template field keys must be unique")
        return self


def _ascii_key(value: str, index: int) -> str:
    candidate = re.sub(r"[^A-Za-z0-9_]+", "_", value or "").strip("_").lower()
    if not candidate or not candidate[0].isalpha():
        candidate = f"field_{index}"
    return candidate


def compile_legacy_fields(source_format: str, fields: list[dict]) -> CompiledTemplate:
    """Compile the existing field-definition contract into the universal IR."""
    kind = "pdf" if source_format == "pdf" else "docx"
    compiled_fields = []
    seen: set[str] = set()
    for index, field in enumerate(fields, start=1):
        key = _ascii_key(str(field.get("key", "")), index)
        base = key
        suffix = 2
        while key in seen:
            key = f"{base}_{suffix}"
            suffix += 1
        seen.add(key)
        coordinate = field.get("coordinate") or field.get("rect")
        placeholder = field.get("placeholder")
        anchor = field.get("anchor") or field.get("label")
        if kind == "pdf":
            placement = Placement(
                kind="pdf_overlay", page=int(field.get("page", 1)), rect=coordinate,
                anchor=anchor,
            )
        elif placeholder:
            placement = Placement(kind="placeholder_replace", placeholder=placeholder, anchor=anchor)
        else:
            placement = Placement(kind="paragraph_insert", anchor=anchor, context=anchor or "")
        compiled_fields.append(
            CompiledField(
                key=key,
                label=str(field.get("label") or field.get("key") or f"字段{index}"),
                value_type=field.get("type", "text") if field.get("type") in {
                    "text", "multiline", "date", "number", "boolean", "single_choice",
                    "multi_choice", "list", "table",
                } else "text",
                fill_source=field.get("fill_source", "ai_then_user"),
                required=bool(field.get("required", False)),
                options=field.get("options") or [],
                placements=[placement],
            )
        )
    return CompiledTemplate(kind=kind, fields=compiled_fields)
