"""Compiler for user-authored freeform and structured text output templates."""

from __future__ import annotations

import re

from .template_ir import CompiledField, CompiledTemplate, Placement


CONCEPTS = [
    (("事实", "经过", "问题"), "facts", "事实与情况"),
    (("依据", "规定", "制度", "条款"), "basis", "适用依据"),
    (("结论", "判断", "评估结果"), "conclusion", "评估结论"),
    (("建议", "措施", "处罚"), "recommendation", "处理建议"),
    (("整改", "改进"), "rectification", "整改要求"),
    (("申诉", "复议", "救济"), "appeal", "申诉说明"),
]


def _unique_key(label: str, index: int, used: set[str]) -> str:
    known = {
        "员工姓名": "employee_name", "姓名": "name", "违规事实": "violation_facts",
        "处罚建议": "discipline_recommendation", "制度依据": "policy_basis",
        "申诉说明": "appeal", "日期": "date", "签名": "signature",
    }
    key = next((value for name, value in known.items() if name in label), f"field_{index}")
    while key in used:
        key = f"{key}_{index}"
    used.add(key)
    return key


def _structured_fields(source_text: str) -> list[CompiledField]:
    fields: list[CompiledField] = []
    used: set[str] = set()
    pattern = re.compile(r"^\s*([^：:\n]{1,40})[：:]\s*(?:[_＿]{2,}|\{\{[^}]+\}\}|$)")
    for line in source_text.splitlines():
        match = pattern.match(line)
        if not match:
            continue
        label = match.group(1).strip()
        index = len(fields) + 1
        key = _unique_key(label, index, used)
        user_only = any(word in label for word in ("签名", "签字", "文号", "编号", "审批人"))
        value_type = "date" if "日期" in label or "时间" in label else "multiline" if any(word in label for word in ("事实", "依据", "建议", "说明", "要求")) else "text"
        fields.append(CompiledField(
            key=key, label=label, value_type=value_type,
            fill_source="user" if user_only else "ai_then_user",
            required=user_only,
            placements=[Placement(kind="text_section", anchor=label, context=line)],
        ))
    return fields


def _freeform_fields(source_text: str) -> list[CompiledField]:
    fields: list[CompiledField] = []
    lowered = source_text.lower()
    for aliases, key, label in CONCEPTS:
        if any(alias in lowered for alias in aliases):
            fields.append(CompiledField(
                key=key, label=label, value_type="multiline", fill_source="ai_then_user",
                required=True, placements=[Placement(kind="text_section", anchor=label)],
            ))
    if not fields:
        fields = [
            CompiledField(key="summary", label="评估摘要", value_type="multiline", required=True, placements=[Placement(kind="text_section", anchor="评估摘要")]),
            CompiledField(key="conclusion", label="评估结论", value_type="multiline", required=True, placements=[Placement(kind="text_section", anchor="评估结论")]),
        ]
    return fields


def compile_text_template(mode: str, source_text: str) -> CompiledTemplate:
    if mode not in {"structured", "freeform", "text_structured", "text_freeform"}:
        raise ValueError("文字模板模式必须为 structured 或 freeform")
    if not source_text.strip():
        raise ValueError("文字模板内容不能为空")
    structured = mode in {"structured", "text_structured"}
    fields = _structured_fields(source_text) if structured else _freeform_fields(source_text)
    if structured and not fields:
        raise ValueError("结构化文字模板中未识别到“标签：空白”字段")
    title_match = re.search(r"(?:生成|输出|制作)([^，。\n]{2,30}(?:书|表|报告|建议|通知))", source_text)
    title = title_match.group(1) if title_match else "评估输出文书"
    return CompiledTemplate(
        kind="text_structured" if structured else "text_freeform",
        title=title,
        fields=fields,
        metadata={"source_text": source_text},
    )
