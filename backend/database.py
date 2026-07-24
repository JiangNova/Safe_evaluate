"""SQLite-based report storage — replaces JSON-file storage.

Uses Python's built-in sqlite3 module (zero extra dependencies).
All writes are atomic via WAL journal mode.
"""

import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime

from .config import REPORT_STORAGE_DIR

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "reports.db")
_MIGRATION_FLAG = os.path.join(os.path.dirname(__file__), "data", ".migration_done")

# ---------------------------------------------------------------------------
# Connection helper
# ---------------------------------------------------------------------------


@contextmanager
def _get_db():
    """Yield a sqlite3.Connection with WAL mode and foreign keys enabled."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Schema init
# ---------------------------------------------------------------------------


def init_db():
    """Create tables and indexes if they don't exist, then run migration."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

    with _get_db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS reports (
                id              TEXT PRIMARY KEY,
                status          TEXT NOT NULL DEFAULT 'success',
                title           TEXT NOT NULL DEFAULT '消防安全评估报告',
                date            TEXT NOT NULL,
                filename        TEXT NOT NULL DEFAULT '',
                overall_assessment TEXT DEFAULT '',
                rules           TEXT DEFAULT '[]',
                stats_json      TEXT DEFAULT '{"compliant":0,"nonCompliant":0,"suggestions":0}',
                findings_json   TEXT DEFAULT '[]',
                raw_response    TEXT,
                error_message   TEXT,
                created_at      TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_reports_created_at
                ON reports(created_at DESC);

            CREATE INDEX IF NOT EXISTS idx_reports_status
                ON reports(status);
            """
        )

    # Migrate legacy JSON files (idempotent)
    try:
        count = _migrate_json_to_sqlite()
        if count > 0:
            import sys

            print(
                f"[DB] Migrated {count} legacy JSON reports to SQLite",
                file=sys.stderr,
            )
    except Exception:
        import sys, traceback

        print("[DB] Migration failed (app will continue):", file=sys.stderr)
        traceback.print_exc()


# ---------------------------------------------------------------------------
# Migration
# ---------------------------------------------------------------------------


def _migrate_json_to_sqlite() -> int:
    """Import legacy JSON report files into SQLite. Idempotent."""
    if os.path.exists(_MIGRATION_FLAG):
        return 0

    if not os.path.exists(REPORT_STORAGE_DIR):
        # No legacy data to migrate
        _touch_flag()
        return 0

    count = 0
    for fname in sorted(os.listdir(REPORT_STORAGE_DIR)):
        if not fname.endswith(".json"):
            continue
        fpath = os.path.join(REPORT_STORAGE_DIR, fname)
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError):
            continue

        # Normalize fields for SQLite columns
        report = {
            "id": data.get("id", uuid.uuid4().hex[:12]),
            "status": data.get("status", "success"),
            "title": data.get("title", "消防安全评估报告"),
            "date": data.get("date", ""),
            "filename": data.get("filename", ""),
            "overall_assessment": data.get("overall_assessment", ""),
            "rules": json.dumps(data.get("rules", []), ensure_ascii=False),
            "stats_json": json.dumps(
                data.get("stats", {"compliant": 0, "nonCompliant": 0, "suggestions": 0}),
                ensure_ascii=False,
            ),
            "findings_json": json.dumps(
                data.get("findings", []), ensure_ascii=False
            ),
            "raw_response": data.get("raw_response"),
            "error_message": data.get("error_message"),
            "created_at": data.get("created_at", datetime.now().isoformat()),
        }

        try:
            with _get_db() as conn:
                conn.execute(
                    """INSERT OR IGNORE INTO reports
                       (id, status, title, date, filename, overall_assessment,
                        rules, stats_json, findings_json, raw_response,
                        error_message, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        report["id"],
                        report["status"],
                        report["title"],
                        report["date"],
                        report["filename"],
                        report["overall_assessment"],
                        report["rules"],
                        report["stats_json"],
                        report["findings_json"],
                        report["raw_response"],
                        report["error_message"],
                        report["created_at"],
                    ),
                )
            count += 1
        except Exception:
            continue

    _touch_flag()
    return count


def _touch_flag():
    """Create the migration-complete sentinel file."""
    os.makedirs(os.path.dirname(_MIGRATION_FLAG), exist_ok=True)
    with open(_MIGRATION_FLAG, "w") as f:
        f.write("done")


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


def save_report(report_data: dict) -> str:
    """Save a report to SQLite, return the report ID.

    If report_data already contains an 'id', it is reused (for migration).
    Otherwise a new 12-char hex ID is generated.
    """
    report_id = report_data.get("id") or uuid.uuid4().hex[:12]
    now = report_data.get("created_at") or datetime.now().isoformat()

    stats = report_data.get("stats", {"compliant": 0, "nonCompliant": 0, "suggestions": 0})
    findings = report_data.get("findings", [])
    rules = report_data.get("rules", [])

    with _get_db() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO reports
               (id, status, title, date, filename, overall_assessment,
                rules, stats_json, findings_json, raw_response,
                error_message, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                report_id,
                report_data.get("status", "success"),
                report_data.get("title", "消防安全评估报告"),
                report_data.get("date", ""),
                report_data.get("filename", ""),
                report_data.get("overall_assessment", ""),
                json.dumps(rules, ensure_ascii=False),
                json.dumps(stats, ensure_ascii=False),
                json.dumps(findings, ensure_ascii=False),
                report_data.get("raw_response"),
                report_data.get("error_message"),
                now,
            ),
        )

    return report_id


def get_report(report_id: str) -> dict | None:
    """Load a single report by ID. Returns dict with deserialized JSON fields."""
    with _get_db() as conn:
        row = conn.execute(
            "SELECT * FROM reports WHERE id = ?", (report_id,)
        ).fetchone()

    if row is None:
        return None

    return _row_to_dict(row)


def list_reports(page: int = 1, page_size: int = 10) -> dict:
    """Paginated listing, newest first."""
    with _get_db() as conn:
        total_row = conn.execute("SELECT COUNT(*) as cnt FROM reports").fetchone()
        total = total_row["cnt"]

        offset = (page - 1) * page_size
        rows = conn.execute(
            "SELECT * FROM reports ORDER BY created_at DESC LIMIT ? OFFSET ?",
            (page_size, offset),
        ).fetchall()

    items = []
    for row in rows:
        status = row["status"]
        if status == "failed":
            risk = "failed"
        else:
            stats = json.loads(row["stats_json"])
            nc = stats.get("nonCompliant", 0)
            if nc == 0:
                risk = "low"
            elif nc <= 3:
                risk = "medium"
            else:
                risk = "high"

        items.append(
            {
                "id": row["id"],
                "title": row["title"],
                "date": row["date"],
                "filename": row["filename"],
                "risk_level": risk,
                "status": status,
                "created_at": row["created_at"],
            }
        )

    return {"items": items, "total": total, "page": page, "page_size": page_size}


def get_all_reports() -> list[dict]:
    """Load all successful reports for statistics computation.

    Failed reports are excluded from stats.
    """
    with _get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM reports WHERE status = 'success' ORDER BY created_at ASC"
        ).fetchall()

    return [_row_to_dict(r) for r in rows]


def count_failed() -> int:
    """Return the number of failed evaluation records."""
    with _get_db() as conn:
        row = conn.execute(
            "SELECT COUNT(*) as cnt FROM reports WHERE status = 'failed'"
        ).fetchone()
    return row["cnt"]


def delete_report(report_id: str) -> bool:
    """Delete a report by ID. Returns True if deleted, False if not found."""
    with _get_db() as conn:
        cursor = conn.execute("DELETE FROM reports WHERE id = ?", (report_id,))
        return cursor.rowcount > 0


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _row_to_dict(row: sqlite3.Row) -> dict:
    """Convert a sqlite3.Row to a plain dict with deserialized JSON fields."""
    return {
        "id": row["id"],
        "status": row["status"],
        "title": row["title"],
        "date": row["date"],
        "filename": row["filename"],
        "overall_assessment": row["overall_assessment"],
        "rules": json.loads(row["rules"]),
        "stats": json.loads(row["stats_json"]),
        "findings": json.loads(row["findings_json"]),
        "raw_response": row["raw_response"],
        "error_message": row["error_message"],
        "created_at": row["created_at"],
    }
