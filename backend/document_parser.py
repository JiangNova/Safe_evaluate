"""Parse requirement documents into structured evaluation criteria."""
import os
import re
from docx import Document
from .config import REQUIREMENT_DIR


def _read_docx(filepath: str) -> str:
    """Extract all text from a .docx file."""
    doc = Document(filepath)
    paragraphs = []
    for para in doc.paragraphs:
        text = para.text.strip()
        if text:
            paragraphs.append(text)
    # Also extract table content
    for table in doc.tables:
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells]
            paragraphs.append(" | ".join(cells))
    return "\n".join(paragraphs)


def _read_doc(filepath: str) -> str:
    """Try to extract text from a legacy .doc file.

    On Windows, we try several approaches:
    1. Read raw bytes and extract readable text
    2. Fall back to a note about conversion
    """
    try:
        with open(filepath, "rb") as f:
            raw = f.read()

        # Try to decode as UTF-16 (common in .doc files from Chinese systems)
        try:
            text = raw.decode("utf-16-le", errors="ignore")
            # Filter to mostly-printable characters
            readable = "".join(c for c in text if c.isprintable() or c in "\n\r\t")
            if len(readable) > 100:
                return readable
        except Exception:
            pass

        # Extract ASCII/UTF-8 text from binary
        result = []
        for byte in raw:
            if 32 <= byte < 127 or byte in (10, 13):
                result.append(chr(byte))
        text = "".join(result)
        # Clean up: join broken Chinese characters
        text = re.sub(r"([a-zA-Z]{20,})", "\n\\1\n", text)
        return text
    except Exception as e:
        return f"[无法解析 .doc 文件: {e}]"


def load_all_requirements() -> list[dict]:
    """Load all requirement documents, returning list of {filename, content}."""
    documents = []
    if not os.path.exists(REQUIREMENT_DIR):
        return documents

    for filename in sorted(os.listdir(REQUIREMENT_DIR)):
        filepath = os.path.join(REQUIREMENT_DIR, filename)
        if not os.path.isfile(filepath):
            continue

        ext = os.path.splitext(filename)[1].lower()
        try:
            if ext == ".docx":
                content = _read_docx(filepath)
            elif ext == ".doc":
                content = _read_doc(filepath)
            else:
                continue
        except Exception as e:
            content = f"[读取失败: {e}]"

        if content and len(content.strip()) > 50:
            documents.append({
                "filename": filename,
                "filepath": filepath,
                "content": content,
                "length": len(content),
            })

    return documents


def build_requirements_context(documents: list[dict], max_chars: int = 8000) -> str:
    """Build a compact context string from all requirement documents.

    Trims to max_chars to fit within the LLM prompt budget while preserving
    the most important content from each document.
    """
    if not documents:
        return "暂无具体消防法规要求文档，请依据国家通用消防标准进行评估。"

    parts = []
    total = 0
    per_doc = max_chars // len(documents)

    for doc in documents:
        content = doc["content"]
        # Take beginning portion of each doc (front-loaded with key info)
        if len(content) > per_doc:
            # Take first half and some from middle
            first = content[: int(per_doc * 0.7)]
            mid_start = len(content) // 2
            middle = content[mid_start : mid_start + int(per_doc * 0.3)]
            excerpt = first + "\n...(省略中间部分)...\n" + middle
        else:
            excerpt = content

        parts.append(f"### {doc['filename']}\n{excerpt}")
        total += len(excerpt)

    return "\n\n".join(parts)
