"""Simple JSON-file-based report storage."""
import json
import os
import uuid
from datetime import datetime
from .config import REPORT_STORAGE_DIR


def save_report(report_data: dict) -> str:
    """Save a report to disk, return the report ID."""
    report_id = uuid.uuid4().hex[:12]
    report_data["id"] = report_id
    report_data["created_at"] = datetime.now().isoformat()

    filepath = os.path.join(REPORT_STORAGE_DIR, f"{report_id}.json")
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(report_data, f, ensure_ascii=False, indent=2)

    return report_id


def get_report(report_id: str) -> dict | None:
    """Load a single report by ID."""
    filepath = os.path.join(REPORT_STORAGE_DIR, f"{report_id}.json")
    if not os.path.exists(filepath):
        return None
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def list_reports(page: int = 1, page_size: int = 10) -> dict:
    """List reports with pagination, newest first."""
    if not os.path.exists(REPORT_STORAGE_DIR):
        return {"items": [], "total": 0, "page": page, "page_size": page_size}

    files = sorted(
        [f for f in os.listdir(REPORT_STORAGE_DIR) if f.endswith(".json")],
        key=lambda f: os.path.getmtime(os.path.join(REPORT_STORAGE_DIR, f)),
        reverse=True,
    )

    total = len(files)
    start = (page - 1) * page_size
    end = start + page_size
    page_files = files[start:end]

    items = []
    for filename in page_files:
        filepath = os.path.join(REPORT_STORAGE_DIR, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            report = json.load(f)

        # Determine risk level from stats
        nc = report.get("stats", {}).get("nonCompliant", 0)
        if nc == 0:
            risk = "low"
        elif nc <= 3:
            risk = "medium"
        else:
            risk = "high"

        items.append({
            "id": report["id"],
            "title": report.get("title", ""),
            "date": report.get("date", ""),
            "filename": report.get("filename", ""),
            "risk_level": risk,
            "created_at": report.get("created_at", ""),
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}
