"""Deterministic structural quality checks for rendered PDF documents."""

from __future__ import annotations

from .document_renderer import RenderWarning
from .template_ir import CompiledTemplate


def validate_pdf_render(
    template_path: str,
    output_path: str,
    compiled: CompiledTemplate,
) -> list[RenderWarning]:
    try:
        from pypdf import PdfReader
    except ImportError:
        return [RenderWarning("pdf_quality_unavailable", "缺少 pypdf，无法校验 PDF")]
    template = PdfReader(template_path)
    output = PdfReader(output_path)
    warnings = []
    if len(template.pages) != len(output.pages):
        warnings.append(RenderWarning("pdf_page_count_changed", "输出 PDF 页数与模板不一致"))
    for field in compiled.fields:
        for placement in field.placements:
            if not placement.kind.startswith("pdf_"):
                continue
            if not placement.confirmed:
                warnings.append(RenderWarning("unconfirmed_pdf_placement", f"字段“{field.label}”的位置尚未确认", field.key))
                continue
            if placement.page is None or placement.page >= len(template.pages):
                warnings.append(RenderWarning("pdf_rect_out_of_bounds", f"字段“{field.label}”页码无效", field.key))
                continue
            if placement.rect:
                width = float(template.pages[placement.page].mediabox.width)
                height = float(template.pages[placement.page].mediabox.height)
                x1, y1, x2, y2 = placement.rect
                if x1 < 0 or y1 < 0 or x2 <= x1 or y2 <= y1 or x2 > width or y2 > height:
                    warnings.append(RenderWarning("pdf_rect_out_of_bounds", f"字段“{field.label}”填写区域超出页面", field.key))
    return warnings
