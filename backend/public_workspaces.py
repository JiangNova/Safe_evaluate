"""Persistence and recovery authentication for anonymous long-lived workspaces."""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Any, Iterator

from .config import (
    DB_PATH as CONFIG_DB_PATH,
    PUBLIC_WORKSPACE_ACTIVE_DAYS,
    PUBLIC_WORKSPACE_GRACE_DAYS,
)


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


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime | str) -> str:
    if isinstance(value, str):
        return value
    return value.astimezone(timezone.utc).isoformat()


def init_workspace_db() -> None:
    with _get_db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS public_workspaces (
                id                 TEXT PRIMARY KEY,
                access_secret_hash TEXT NOT NULL,
                name               TEXT NOT NULL DEFAULT '',
                status             TEXT NOT NULL DEFAULT 'active',
                created_at         TEXT NOT NULL,
                last_accessed_at   TEXT NOT NULL,
                cleanup_after      TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_public_workspaces_cleanup
                ON public_workspaces(status, cleanup_after);
            """
        )


def _fetch_workspace_row(workspace_id: str) -> dict | None:
    with _get_db() as conn:
        row = conn.execute(
            "SELECT * FROM public_workspaces WHERE id = ?", (workspace_id,)
        ).fetchone()
    return dict(row) if row else None


def get_workspace(workspace_id: str) -> dict | None:
    return _fetch_workspace_row(workspace_id)


def create_workspace(name: str = "") -> tuple[dict, str]:
    cleaned_name = name.strip()
    if len(cleaned_name) > 120:
        raise ValueError("工作区名称不能超过 120 个字符")
    workspace_id = secrets.token_urlsafe(18)
    raw_secret = secrets.token_urlsafe(32)
    secret_hash = hashlib.sha256(raw_secret.encode("utf-8")).hexdigest()
    now = _utc_now()
    cleanup_after = now + timedelta(days=PUBLIC_WORKSPACE_ACTIVE_DAYS)
    with _get_db() as conn:
        conn.execute(
            """
            INSERT INTO public_workspaces (
                id, access_secret_hash, name, status,
                created_at, last_accessed_at, cleanup_after
            ) VALUES (?, ?, ?, 'active', ?, ?, ?)
            """,
            (
                workspace_id,
                secret_hash,
                cleaned_name,
                _iso(now),
                _iso(now),
                _iso(cleanup_after),
            ),
        )
    workspace = get_workspace(workspace_id)
    if workspace is None:  # pragma: no cover
        raise RuntimeError("created workspace could not be loaded")
    return workspace, raw_secret


def authorize_workspace(
    workspace_id: str, raw_secret: str, *, renew: bool = True
) -> dict:
    row = _fetch_workspace_row(workspace_id)
    if row is None or row["status"] == "deleted":
        raise LookupError("workspace not found")
    candidate = hashlib.sha256(raw_secret.encode("utf-8")).hexdigest()
    if not hmac.compare_digest(row["access_secret_hash"], candidate):
        raise PermissionError("invalid workspace recovery secret")
    now = _utc_now()
    if (
        row["status"] == "pending_cleanup"
        and datetime.fromisoformat(row["cleanup_after"]) <= now
    ):
        raise PermissionError("workspace recovery grace period has expired")
    if renew:
        return update_workspace(
            workspace_id,
            status="active",
            last_accessed_at=now,
            cleanup_after=now + timedelta(days=PUBLIC_WORKSPACE_ACTIVE_DAYS),
        )
    return row


def update_workspace(workspace_id: str, **changes: Any) -> dict:
    allowed = {"name", "status", "last_accessed_at", "cleanup_after"}
    unknown = set(changes) - allowed
    if unknown:
        raise ValueError(f"unsupported workspace fields: {sorted(unknown)}")
    if "status" in changes and changes["status"] not in {
        "active",
        "pending_cleanup",
        "deleted",
    }:
        raise ValueError("invalid workspace status")
    if not changes:
        existing = get_workspace(workspace_id)
        if existing is None:
            raise LookupError("workspace not found")
        return existing
    assignments: list[str] = []
    values: list[Any] = []
    for key, value in changes.items():
        assignments.append(f"{key} = ?")
        values.append(
            _iso(value) if key in {"last_accessed_at", "cleanup_after"} else value
        )
    values.append(workspace_id)
    with _get_db() as conn:
        cursor = conn.execute(
            f"UPDATE public_workspaces SET {', '.join(assignments)} WHERE id = ?",
            values,
        )
        if cursor.rowcount == 0:
            raise LookupError("workspace not found")
    updated = get_workspace(workspace_id)
    if updated is None:  # pragma: no cover
        raise LookupError("workspace not found")
    return updated


def mark_inactive_workspaces(now: datetime | None = None) -> list[str]:
    cutoff = now or _utc_now()
    grace_deadline = cutoff + timedelta(days=PUBLIC_WORKSPACE_GRACE_DAYS)
    with _get_db() as conn:
        rows = conn.execute(
            """
            SELECT id FROM public_workspaces
            WHERE status = 'active' AND cleanup_after <= ? ORDER BY id
            """,
            (_iso(cutoff),),
        ).fetchall()
        ids = [row["id"] for row in rows]
        if ids:
            placeholders = ",".join("?" for _ in ids)
            conn.execute(
                f"UPDATE public_workspaces SET status = 'pending_cleanup', cleanup_after = ? WHERE id IN ({placeholders})",
                [_iso(grace_deadline), *ids],
            )
    return ids


def list_expired_workspace_ids(now: datetime | None = None) -> list[str]:
    cutoff = _iso(now or _utc_now())
    with _get_db() as conn:
        rows = conn.execute(
            """
            SELECT id FROM public_workspaces
            WHERE status = 'pending_cleanup' AND cleanup_after <= ? ORDER BY id
            """,
            (cutoff,),
        ).fetchall()
    return [row["id"] for row in rows]


def delete_workspace(workspace_id: str) -> None:
    with _get_db() as conn:
        conn.execute("DELETE FROM public_workspaces WHERE id = ?", (workspace_id,))
