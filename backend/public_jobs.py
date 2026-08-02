"""SQLite persistence for anonymous, short-lived public evaluation jobs."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Any, Iterator

from .config import DB_PATH as CONFIG_DB_PATH, PUBLIC_JOB_EXPIRY_HOURS


DB_PATH = CONFIG_DB_PATH


@contextmanager
def _get_db() -> Iterator[sqlite3.Connection]:
    os.makedirs(os.path.dirname(os.path.abspath(DB_PATH)), exist_ok=True)
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


def init_public_job_db() -> None:
    """Create the isolated public-job tables and indexes idempotently."""
    with _get_db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS public_jobs (
                id                  TEXT PRIMARY KEY,
                access_token_hash   TEXT NOT NULL,
                workspace_id        TEXT,
                goal                TEXT NOT NULL,
                status              TEXT NOT NULL DEFAULT 'draft',
                result_json         TEXT,
                error_json          TEXT,
                created_at          TEXT NOT NULL,
                updated_at          TEXT NOT NULL,
                expires_at          TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_public_jobs_expires_at
                ON public_jobs(expires_at);

            CREATE TABLE IF NOT EXISTS public_job_resources (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id              TEXT NOT NULL REFERENCES public_jobs(id) ON DELETE CASCADE,
                resource_kind       TEXT NOT NULL,
                asset_version_id    INTEGER NOT NULL,
                snapshot_json       TEXT NOT NULL,
                created_at          TEXT NOT NULL,
                UNIQUE(job_id, resource_kind, asset_version_id)
            );

            CREATE TABLE IF NOT EXISTS public_job_files (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id              TEXT NOT NULL REFERENCES public_jobs(id) ON DELETE CASCADE,
                kind                TEXT NOT NULL,
                safe_name           TEXT NOT NULL,
                original_name       TEXT NOT NULL,
                mime_type           TEXT NOT NULL,
                size                INTEGER NOT NULL,
                storage_path        TEXT NOT NULL,
                parse_status        TEXT NOT NULL DEFAULT 'pending',
                parse_metadata_json TEXT,
                created_at          TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_public_job_files_job_kind
                ON public_job_files(job_id, kind);

            CREATE TABLE IF NOT EXISTS public_job_templates (
                id                    INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id                TEXT NOT NULL REFERENCES public_jobs(id) ON DELETE CASCADE,
                source_file_id        INTEGER NOT NULL REFERENCES public_job_files(id) ON DELETE CASCADE,
                source_format         TEXT NOT NULL,
                fields_json           TEXT NOT NULL DEFAULT '[]',
                preview_metadata_json TEXT,
                confirmation_status   TEXT NOT NULL DEFAULT 'pending',
                created_at            TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS public_job_documents (
                id                      INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id                  TEXT NOT NULL REFERENCES public_jobs(id) ON DELETE CASCADE,
                template_id             INTEGER NOT NULL REFERENCES public_job_templates(id) ON DELETE CASCADE,
                ai_initial_fields_json  TEXT NOT NULL DEFAULT '{}',
                current_fields_json     TEXT NOT NULL DEFAULT '{}',
                status                  TEXT NOT NULL DEFAULT 'draft',
                docx_file_id            INTEGER REFERENCES public_job_files(id) ON DELETE SET NULL,
                pdf_file_id             INTEGER REFERENCES public_job_files(id) ON DELETE SET NULL,
                warnings_json           TEXT NOT NULL DEFAULT '[]',
                error_json              TEXT,
                created_at              TEXT NOT NULL,
                updated_at              TEXT NOT NULL,
                UNIQUE(job_id, template_id)
            );

            CREATE TABLE IF NOT EXISTS public_job_revisions (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                document_id     INTEGER NOT NULL REFERENCES public_job_documents(id) ON DELETE CASCADE,
                field_key       TEXT NOT NULL,
                before_json     TEXT,
                after_json      TEXT,
                source          TEXT NOT NULL,
                created_at      TEXT NOT NULL
            );
            """
        )
        columns = {
            row["name"] for row in conn.execute("PRAGMA table_info(public_jobs)")
        }
        if "workspace_id" not in columns:
            conn.execute("ALTER TABLE public_jobs ADD COLUMN workspace_id TEXT")


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime | str) -> str:
    if isinstance(value, str):
        return value
    return value.astimezone(timezone.utc).isoformat()


def _encode_json(value: Any) -> str | None:
    if value is None:
        return None
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _decode_row(row: sqlite3.Row | None) -> dict | None:
    if row is None:
        return None
    decoded = dict(row)
    for key, value in list(decoded.items()):
        if key.endswith("_json"):
            decoded[key] = json.loads(value) if value else None
    return decoded


def _fetch_job_row(job_id: str) -> dict | None:
    with _get_db() as conn:
        row = conn.execute(
            "SELECT * FROM public_jobs WHERE id = ?", (job_id,)
        ).fetchone()
    return dict(row) if row else None


def get_job(job_id: str) -> dict | None:
    with _get_db() as conn:
        row = conn.execute(
            "SELECT * FROM public_jobs WHERE id = ?", (job_id,)
        ).fetchone()
    return _decode_row(row)


def create_job(goal: str, workspace_id: str | None = None) -> tuple[dict, str]:
    cleaned = goal.strip()
    if not cleaned:
        raise ValueError("evaluation goal is required")

    raw_token = secrets.token_urlsafe(32)
    job_id = secrets.token_urlsafe(18)
    now = _utc_now()
    expires_at = now + timedelta(hours=PUBLIC_JOB_EXPIRY_HOURS)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    with _get_db() as conn:
        conn.execute(
            """
            INSERT INTO public_jobs (
                id, access_token_hash, workspace_id, goal, status,
                created_at, updated_at, expires_at
            ) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?)
            """,
            (
                job_id,
                token_hash,
                workspace_id,
                cleaned,
                _iso(now),
                _iso(now),
                _iso(expires_at),
            ),
        )

    job = get_job(job_id)
    if job is None:  # pragma: no cover - guards impossible DB inconsistency
        raise RuntimeError("created public job could not be loaded")
    return job, raw_token


def bind_job_resource(
    job_id: str,
    resource_kind: str,
    asset_version_id: int,
    snapshot: dict,
) -> dict:
    """Attach an immutable serialized workspace resource snapshot to a job."""
    if resource_kind not in {"basis", "template"}:
        raise ValueError("job resource kind must be basis or template")
    if get_job(job_id) is None:
        raise LookupError("public job not found")
    with _get_db() as conn:
        cursor = conn.execute(
            """
            INSERT INTO public_job_resources (
                job_id, resource_kind, asset_version_id, snapshot_json, created_at
            ) VALUES (?, ?, ?, ?, ?)
            """,
            (
                job_id,
                resource_kind,
                int(asset_version_id),
                _encode_json(snapshot),
                _iso(_utc_now()),
            ),
        )
        row = conn.execute(
            "SELECT * FROM public_job_resources WHERE id = ?",
            (int(cursor.lastrowid),),
        ).fetchone()
    decoded = _decode_row(row)
    if decoded is None:  # pragma: no cover
        raise RuntimeError("created job resource could not be loaded")
    return decoded


def list_job_resources(job_id: str, resource_kind: str | None = None) -> list[dict]:
    query = "SELECT * FROM public_job_resources WHERE job_id = ?"
    values: list[Any] = [job_id]
    if resource_kind is not None:
        if resource_kind not in {"basis", "template"}:
            raise ValueError("job resource kind must be basis or template")
        query += " AND resource_kind = ?"
        values.append(resource_kind)
    query += " ORDER BY id"
    with _get_db() as conn:
        rows = conn.execute(query, values).fetchall()
    return [_decode_row(row) for row in rows]


def bind_ephemeral_text_resource(
    job_id: str, resource_kind: str, source_text: str, name: str
) -> dict:
    """Bind an upload-session-only text resource using a private negative ID."""
    existing = list_job_resources(job_id)
    ephemeral_id = -(len(existing) + 1)
    return bind_job_resource(
        job_id,
        resource_kind,
        ephemeral_id,
        {
            "asset_id": None,
            "asset_name": name.strip() or "文字输入",
            "asset_type": resource_kind,
            "version_number": None,
            "source_kind": "text_structured" if resource_kind == "template" else "text_freeform",
            "source_text": source_text,
            "original_name": None,
            "mime_type": "text/plain",
            "size": len(source_text.encode("utf-8")),
            "parsed_content": None,
            "compiled_template": None,
        },
    )


def authorize_job(job_id: str, token: str) -> dict:
    row = _fetch_job_row(job_id)
    if row is None:
        raise LookupError("public job not found")
    candidate = hashlib.sha256(token.encode("utf-8")).hexdigest()
    if not hmac.compare_digest(row["access_token_hash"], candidate):
        raise PermissionError("invalid public job access token")
    expires_at = datetime.fromisoformat(row["expires_at"])
    if expires_at <= _utc_now():
        raise PermissionError("public job has expired")
    decoded = get_job(job_id)
    if decoded is None:  # pragma: no cover
        raise LookupError("public job not found")
    return decoded


def update_job(job_id: str, **changes: Any) -> dict:
    allowed = {"goal", "status", "result_json", "error_json", "expires_at"}
    unknown = set(changes) - allowed
    if unknown:
        raise ValueError(f"unsupported public job fields: {sorted(unknown)}")
    if not changes:
        existing = get_job(job_id)
        if existing is None:
            raise LookupError("public job not found")
        return existing

    assignments: list[str] = []
    values: list[Any] = []
    for key, value in changes.items():
        assignments.append(f"{key} = ?")
        if key.endswith("_json"):
            value = _encode_json(value)
        elif key == "expires_at":
            value = _iso(value)
        values.append(value)
    assignments.append("updated_at = ?")
    values.append(_iso(_utc_now()))
    values.append(job_id)

    with _get_db() as conn:
        cursor = conn.execute(
            f"UPDATE public_jobs SET {', '.join(assignments)} WHERE id = ?",
            values,
        )
        if cursor.rowcount == 0:
            raise LookupError("public job not found")

    updated = get_job(job_id)
    if updated is None:  # pragma: no cover
        raise LookupError("public job not found")
    return updated


def _fetch_related(table: str, record_id: int) -> dict:
    allowed_tables = {
        "public_job_files",
        "public_job_templates",
        "public_job_documents",
        "public_job_revisions",
    }
    if table not in allowed_tables:
        raise ValueError("unsupported table")
    with _get_db() as conn:
        row = conn.execute(
            f"SELECT * FROM {table} WHERE id = ?", (record_id,)
        ).fetchone()
    decoded = _decode_row(row)
    if decoded is None:
        raise LookupError(f"{table} row not found")
    return decoded


def add_file(job_id: str, kind: str, metadata: dict) -> dict:
    if kind not in {"material", "basis", "template", "generated"}:
        raise ValueError("unsupported public job file kind")
    now = _iso(_utc_now())
    with _get_db() as conn:
        cursor = conn.execute(
            """
            INSERT INTO public_job_files (
                job_id, kind, safe_name, original_name, mime_type, size,
                storage_path, parse_status, parse_metadata_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                job_id,
                kind,
                metadata["safe_name"],
                metadata["original_name"],
                metadata["mime_type"],
                int(metadata["size"]),
                metadata["storage_path"],
                metadata.get("parse_status", "pending"),
                _encode_json(metadata.get("parse_metadata_json")),
                now,
            ),
        )
        record_id = int(cursor.lastrowid)
    return _fetch_related("public_job_files", record_id)


def get_file_usage(job_id: str) -> tuple[int, int]:
    """Return the number of stored files and their total bytes for a job."""
    with _get_db() as conn:
        row = conn.execute(
            """
            SELECT COUNT(*) AS file_count, COALESCE(SUM(size), 0) AS total_size
            FROM public_job_files WHERE job_id = ?
            """,
            (job_id,),
        ).fetchone()
    return int(row["file_count"]), int(row["total_size"])


def add_template(
    job_id: str,
    source_file_id: int,
    source_format: str,
    fields: list[dict],
    preview_metadata: dict | None = None,
    confirmation_status: str = "pending",
) -> dict:
    with _get_db() as conn:
        cursor = conn.execute(
            """
            INSERT INTO public_job_templates (
                job_id, source_file_id, source_format, fields_json,
                preview_metadata_json, confirmation_status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                job_id,
                source_file_id,
                source_format,
                _encode_json(fields),
                _encode_json(preview_metadata),
                confirmation_status,
                _iso(_utc_now()),
            ),
        )
        record_id = int(cursor.lastrowid)
    return _fetch_related("public_job_templates", record_id)


def list_files(job_id: str, kind: str | None = None) -> list[dict]:
    query = "SELECT * FROM public_job_files WHERE job_id = ?"
    values: list[Any] = [job_id]
    if kind is not None:
        query += " AND kind = ?"
        values.append(kind)
    query += " ORDER BY id"
    with _get_db() as conn:
        rows = conn.execute(query, values).fetchall()
    return [_decode_row(row) for row in rows]


def get_file(file_id: int, job_id: str | None = None) -> dict | None:
    query = "SELECT * FROM public_job_files WHERE id = ?"
    values: list[Any] = [file_id]
    if job_id is not None:
        query += " AND job_id = ?"
        values.append(job_id)
    with _get_db() as conn:
        row = conn.execute(query, values).fetchone()
    return _decode_row(row)


def list_templates(job_id: str) -> list[dict]:
    with _get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM public_job_templates WHERE job_id = ? ORDER BY id",
            (job_id,),
        ).fetchall()
    return [_decode_row(row) for row in rows]


def get_template(template_id: int, job_id: str | None = None) -> dict | None:
    query = "SELECT * FROM public_job_templates WHERE id = ?"
    values: list[Any] = [template_id]
    if job_id is not None:
        query += " AND job_id = ?"
        values.append(job_id)
    with _get_db() as conn:
        row = conn.execute(query, values).fetchone()
    return _decode_row(row)


def update_template_fields(
    template_id: int,
    fields: list[dict],
    *,
    preview_metadata: dict | None = None,
    confirmation_status: str = "confirmed",
) -> dict:
    with _get_db() as conn:
        cursor = conn.execute(
            """
            UPDATE public_job_templates
            SET fields_json = ?,
                preview_metadata_json = COALESCE(?, preview_metadata_json),
                confirmation_status = ?
            WHERE id = ?
            """,
            (
                _encode_json(fields),
                _encode_json(preview_metadata),
                confirmation_status,
                template_id,
            ),
        )
        if cursor.rowcount == 0:
            raise LookupError("public job template not found")
    updated = get_template(template_id)
    if updated is None:  # pragma: no cover
        raise LookupError("public job template not found")
    return updated


def add_document(job_id: str, template_id: int, ai_fields: dict) -> dict:
    now = _iso(_utc_now())
    encoded = _encode_json(ai_fields)
    with _get_db() as conn:
        cursor = conn.execute(
            """
            INSERT INTO public_job_documents (
                job_id, template_id, ai_initial_fields_json,
                current_fields_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (job_id, template_id, encoded, encoded, now, now),
        )
        record_id = int(cursor.lastrowid)
    return _fetch_related("public_job_documents", record_id)


def list_documents(job_id: str) -> list[dict]:
    with _get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM public_job_documents WHERE job_id = ? ORDER BY id",
            (job_id,),
        ).fetchall()
    return [_decode_row(row) for row in rows]


def delete_documents(job_id: str) -> None:
    """Remove draft/mapping documents before a deliberate evaluation rerun."""
    with _get_db() as conn:
        conn.execute("DELETE FROM public_job_documents WHERE job_id = ?", (job_id,))


def get_document(document_id: int, job_id: str | None = None) -> dict | None:
    query = "SELECT * FROM public_job_documents WHERE id = ?"
    values: list[Any] = [document_id]
    if job_id is not None:
        query += " AND job_id = ?"
        values.append(job_id)
    with _get_db() as conn:
        row = conn.execute(query, values).fetchone()
    return _decode_row(row)


def update_document(document_id: int, **changes: Any) -> dict:
    allowed = {
        "current_fields_json",
        "status",
        "docx_file_id",
        "pdf_file_id",
        "warnings_json",
        "error_json",
    }
    unknown = set(changes) - allowed
    if unknown:
        raise ValueError(f"unsupported public document fields: {sorted(unknown)}")
    if not changes:
        existing = get_document(document_id)
        if existing is None:
            raise LookupError("public job document not found")
        return existing
    assignments: list[str] = []
    values: list[Any] = []
    for key, value in changes.items():
        assignments.append(f"{key} = ?")
        values.append(_encode_json(value) if key.endswith("_json") else value)
    assignments.append("updated_at = ?")
    values.extend([_iso(_utc_now()), document_id])
    with _get_db() as conn:
        cursor = conn.execute(
            f"UPDATE public_job_documents SET {', '.join(assignments)} WHERE id = ?",
            values,
        )
        if cursor.rowcount == 0:
            raise LookupError("public job document not found")
    updated = get_document(document_id)
    if updated is None:  # pragma: no cover
        raise LookupError("public job document not found")
    return updated


def add_revision(
    document_id: int,
    field_key: str,
    before: object,
    after: object,
    source: str,
) -> dict:
    if source not in {"ai", "user", "regenerate", "restore"}:
        raise ValueError("unsupported revision source")
    with _get_db() as conn:
        cursor = conn.execute(
            """
            INSERT INTO public_job_revisions (
                document_id, field_key, before_json, after_json,
                source, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                document_id,
                field_key,
                _encode_json(before),
                _encode_json(after),
                source,
                _iso(_utc_now()),
            ),
        )
        record_id = int(cursor.lastrowid)
    return _fetch_related("public_job_revisions", record_id)


def delete_expired_jobs(now: datetime | None = None) -> list[str]:
    job_ids = list_expired_job_ids(now)
    delete_jobs(job_ids)
    return job_ids


def list_expired_job_ids(now: datetime | None = None) -> list[str]:
    """Return expired job IDs without changing persistent state."""
    cutoff = _iso(now or _utc_now())
    with _get_db() as conn:
        rows = conn.execute(
            "SELECT id FROM public_jobs WHERE expires_at <= ? ORDER BY id",
            (cutoff,),
        ).fetchall()
    return [row["id"] for row in rows]


def delete_jobs(job_ids: list[str]) -> None:
    """Delete selected jobs and all related rows through foreign-key cascades."""
    if not job_ids:
        return
    placeholders = ",".join("?" for _ in job_ids)
    with _get_db() as conn:
        conn.execute(
            f"DELETE FROM public_jobs WHERE id IN ({placeholders})", job_ids
        )
