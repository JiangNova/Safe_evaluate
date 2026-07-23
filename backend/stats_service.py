"""Statistics aggregation service — computes analytics across all reports."""
import json
import os
from collections import defaultdict
from .config import REPORT_STORAGE_DIR
from .models import FINDING_CATEGORIES


def _load_all_reports() -> list[dict]:
    """Load all report JSON files from storage."""
    reports = []
    if not os.path.exists(REPORT_STORAGE_DIR):
        return reports

    for filename in os.listdir(REPORT_STORAGE_DIR):
        if not filename.endswith(".json"):
            continue
        filepath = os.path.join(REPORT_STORAGE_DIR, filename)
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                reports.append(json.load(f))
        except (json.JSONDecodeError, OSError):
            continue

    # Sort by created_at ascending
    reports.sort(key=lambda r: r.get("created_at", ""))
    return reports


def compute_overview(reports: list[dict]) -> dict:
    """Compute aggregate overview statistics."""
    total = len(reports)
    if total == 0:
        return {
            "total_reports": 0,
            "total_findings": 0,
            "total_compliant": 0,
            "total_non_compliant": 0,
            "total_suggestions": 0,
            "compliance_rate": 0.0,
            "risk_distribution": {"low": 0, "medium": 0, "high": 0},
        }

    compliant = 0
    non_compliant = 0
    suggestions = 0
    risk_dist = {"low": 0, "medium": 0, "high": 0}

    for r in reports:
        stats = r.get("stats", {})
        compliant += stats.get("compliant", 0)
        non_compliant += stats.get("nonCompliant", 0)
        suggestions += stats.get("suggestions", 0)

        nc = stats.get("nonCompliant", 0)
        if nc == 0:
            risk_dist["low"] += 1
        elif nc <= 3:
            risk_dist["medium"] += 1
        else:
            risk_dist["high"] += 1

    total_findings = compliant + non_compliant
    compliance_rate = round(compliant / total_findings * 100, 1) if total_findings > 0 else 0.0

    return {
        "total_reports": total,
        "total_findings": total_findings,
        "total_compliant": compliant,
        "total_non_compliant": non_compliant,
        "total_suggestions": suggestions,
        "compliance_rate": compliance_rate,
        "risk_distribution": risk_dist,
    }


def compute_by_category(reports: list[dict]) -> list[dict]:
    """Compute non-compliant counts grouped by finding category."""
    category_counts: dict[str, int] = defaultdict(int)

    for r in reports:
        for f in r.get("findings", []):
            if f.get("severity") in ("danger", "warning"):
                cat = f.get("category", "other")
                if cat not in FINDING_CATEGORIES:
                    cat = "other"
                category_counts[cat] += 1

    total_nc = sum(category_counts.values())
    result = []
    for cat, label in FINDING_CATEGORIES.items():
        count = category_counts.get(cat, 0)
        result.append({
            "category": cat,
            "label": label,
            "non_compliant_count": count,
            "percentage": round(count / total_nc * 100, 1) if total_nc > 0 else 0.0,
        })

    # Sort by count descending
    result.sort(key=lambda x: x["non_compliant_count"], reverse=True)
    return result


def compute_top_issues(reports: list[dict], limit: int = 10) -> list[dict]:
    """Find the most frequently occurring non-compliant finding titles."""
    title_counts: dict[str, dict] = defaultdict(lambda: {"count": 0, "category": "other"})

    for r in reports:
        for f in r.get("findings", []):
            if f.get("severity") in ("danger", "warning"):
                title = f.get("title", "").strip()
                if title:
                    title_counts[title]["count"] += 1
                    title_counts[title]["category"] = f.get("category", "other")

    # Sort by count descending
    sorted_issues = sorted(title_counts.items(), key=lambda x: x[1]["count"], reverse=True)
    result = []
    for title, info in sorted_issues[:limit]:
        result.append({
            "title": title,
            "count": info["count"],
            "category": info["category"],
        })
    return result


def compute_trends(reports: list[dict]) -> list[dict]:
    """Compute monthly compliance trends."""
    monthly: dict[str, dict] = defaultdict(lambda: {"total": 0, "compliant": 0, "non_compliant": 0})

    for r in reports:
        created = r.get("created_at", "")
        if not created:
            continue
        # Extract YYYY-MM from ISO timestamp
        period = created[:7]  # "2026-07"
        stats = r.get("stats", {})
        monthly[period]["total"] += 1
        monthly[period]["compliant"] += stats.get("compliant", 0)
        monthly[period]["non_compliant"] += stats.get("nonCompliant", 0)

    result = []
    for period in sorted(monthly.keys()):
        m = monthly[period]
        total_findings = m["compliant"] + m["non_compliant"]
        rate = round(m["compliant"] / total_findings * 100, 1) if total_findings > 0 else 0.0
        result.append({
            "period": period,
            "total": m["total"],
            "compliant": m["compliant"],
            "non_compliant": m["non_compliant"],
            "compliance_rate": rate,
        })

    return result


def get_all_stats() -> dict:
    """Compute and return all statistics."""
    reports = _load_all_reports()
    return {
        "overview": compute_overview(reports),
        "by_category": compute_by_category(reports),
        "top_issues": compute_top_issues(reports),
        "trends": compute_trends(reports),
    }
