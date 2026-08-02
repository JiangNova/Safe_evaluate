"""AcroForm-first compiler for native, text, and scanned PDF templates."""

from __future__ import annotations

import hashlib
import re
from pathlib import Path

from .template_ir import CompiledField, CompiledTemplate, Placement


def _safe_key(name: str, index: int) -> str:
    key = re.sub(r"[^A-Za-z0-9_]", "_", name).strip("_")
    if not key or not key[0].isalpha():
        key = f"field_{index}"
    return key


def _widget_fields(reader) -> list[dict]:
    widgets = []
    for page_index, page in enumerate(reader.pages):
        for reference in page.get("/Annots", []):
            annotation = reference.get_object()
            if annotation.get("/Subtype") != "/Widget":
                continue
            parent = annotation.get("/Parent")
            parent = parent.get_object() if parent else annotation
            name = str(parent.get("/T") or annotation.get("/T") or f"field_{len(widgets)+1}")
            field_type = str(parent.get("/FT") or annotation.get("/FT") or "/Tx")
            rect = [float(value) for value in annotation.get("/Rect", [0, 0, 100, 20])]
            flags = int(parent.get("/Ff", 0))
            options = []
            for option in parent.get("/Opt", []) or []:
                options.append(str(option[0] if isinstance(option, list) else option))
            widgets.append({
                "name": name, "field_type": field_type, "page": page_index,
                "rect": rect, "required": bool(flags & 2), "options": options,
            })
    return widgets


def _acroform_fields(reader) -> list[CompiledField]:
    fields = []
    used = set()
    for index, widget in enumerate(_widget_fields(reader), start=1):
        key = _safe_key(widget["name"], index)
        while key in used:
            key = f"{key}_{index}"
        used.add(key)
        kind = {"/Btn": "pdf_form_checkbox", "/Ch": "pdf_form_choice"}.get(widget["field_type"], "pdf_form_text")
        value_type = {"/Btn": "boolean", "/Ch": "single_choice"}.get(widget["field_type"], "text")
        options = widget["options"]
        if value_type == "single_choice" and not options:
            options = ["选项"]
        fields.append(CompiledField(
            key=key, label=widget["name"], value_type=value_type,
            options=options, required=widget["required"],
            placements=[Placement(
                kind=kind, page=widget["page"], rect=widget["rect"],
                anchor=widget["name"],
                fingerprint=hashlib.sha256(f"{widget['name']}|{widget['page']}|{widget['rect']}".encode()).hexdigest(),
            )],
        ))
    return fields


def _text_candidates(reader) -> list[CompiledField]:
    fields = []
    for page_index, page in enumerate(reader.pages):
        fragments = []
        def visitor(text, _cm, tm, _font, font_size):
            if text.strip():
                fragments.append((text, float(tm[4]), float(tm[5]), float(font_size or 10)))
        page.extract_text(visitor_text=visitor)
        for text, x, y, font_size in fragments:
            for match in re.finditer(r"([^：:\n]{1,20})[：:]\s*[_＿]{2,}", text):
                label = match.group(1).strip()
                width = max(80.0, len(match.group(0)) * font_size * 0.5)
                key = _safe_key(label, len(fields) + 1)
                fields.append(CompiledField(
                    key=key, label=label,
                    placements=[Placement(
                        kind="pdf_text_rect", page=page_index,
                        rect=[x + width * 0.45, y - 2, x + width, y + font_size * 1.4],
                        context=text, confirmed=True, confidence=0.85,
                    )],
                ))
    return fields


def _ocr_candidates(path: str, reader) -> list[CompiledField]:
    try:
        import pypdfium2 as pdfium
        import pytesseract
        from pytesseract import Output
    except ImportError:
        return []
    fields = []
    pdf = pdfium.PdfDocument(path)
    for page_index in range(len(pdf)):
        bitmap = pdf[page_index].render(scale=200 / 72)
        image = bitmap.to_pil()
        data = pytesseract.image_to_data(image, lang="chi_sim+eng", output_type=Output.DICT)
        page_width = float(reader.pages[page_index].mediabox.width)
        page_height = float(reader.pages[page_index].mediabox.height)
        sx, sy = page_width / image.width, page_height / image.height
        for index, text in enumerate(data.get("text", [])):
            if not text or not re.search(r"[:：]$", text):
                continue
            confidence = max(0.0, min(1.0, float(data["conf"][index]) / 100))
            x, y, w, h = (data[name][index] for name in ("left", "top", "width", "height"))
            label = text.rstrip("：:")
            fields.append(CompiledField(
                key=_safe_key(label, len(fields) + 1), label=label,
                placements=[Placement(
                    kind="pdf_image_rect", page=page_index,
                    rect=[(x+w)*sx, page_height-(y+h)*sy, min(page_width, (x+w+180)*sx), page_height-y*sy],
                    context=text, confirmed=False, confidence=confidence,
                )],
            ))
    return fields


def compile_pdf_template(path: str) -> CompiledTemplate:
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise RuntimeError("缺少 pypdf，无法编译 PDF 模板") from exc
    reader = PdfReader(path)
    if reader.is_encrypted:
        raise ValueError("不支持加密 PDF 模板")
    fields = _acroform_fields(reader)
    mode = "acroform"
    if not fields:
        fields = _text_candidates(reader)
        mode = "text_geometry"
    if not fields and not any((page.extract_text() or "").strip() for page in reader.pages):
        fields = _ocr_candidates(path, reader)
        mode = "ocr"
    return CompiledTemplate(
        kind="pdf", title=Path(path).stem, fields=fields,
        metadata={
            "pdf_mode": mode,
            "page_count": len(reader.pages),
            "page_sizes": [[float(page.mediabox.width), float(page.mediabox.height)] for page in reader.pages],
        },
        warnings=[] if fields else ["未自动识别到 PDF 填写位置，请人工框选"],
    )
