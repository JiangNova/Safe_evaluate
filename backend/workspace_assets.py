"""Reusable, versioned standards, templates, and business scenarios."""

from __future__ import annotations

import json
import os
import secrets
import shutil
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Literal

from . import public_workspaces
from .config import PUBLIC_WORKSPACE_STORAGE_DIR


@dataclass(frozen=True)
class WorkspaceAssetSource:
    source_kind: Literal["file", "text_freeform", "text_structured"]
    source_text: str | None = None
    file_path: str | None = None
    original_name: str | None = None
    mime_type: str | None = None
    parsed_content: dict | None = None
    compiled_template: dict | None = None


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _encode(value: Any) -> str | None:
    if value is None:
        return None
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _decode(row) -> dict | None:
    if row is None:
        return None
    item = dict(row)
    for key in list(item):
        if key.endswith("_json"):
            item[key] = json.loads(item[key]) if item[key] else None
    return item


def init_workspace_asset_db() -> None:
    with public_workspaces._get_db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS workspace_assets (
                id                 INTEGER PRIMARY KEY AUTOINCREMENT,
                workspace_id       TEXT NOT NULL REFERENCES public_workspaces(id) ON DELETE CASCADE,
                asset_type         TEXT NOT NULL,
                name               TEXT NOT NULL,
                description        TEXT NOT NULL DEFAULT '',
                tags_json          TEXT NOT NULL DEFAULT '[]',
                current_version_id INTEGER,
                created_at         TEXT NOT NULL,
                updated_at         TEXT NOT NULL,
                deleted_at         TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_workspace_assets_owner_type
                ON workspace_assets(workspace_id, asset_type, deleted_at);

            CREATE TABLE IF NOT EXISTS workspace_asset_versions (
                id                     INTEGER PRIMARY KEY AUTOINCREMENT,
                asset_id               INTEGER NOT NULL REFERENCES workspace_assets(id) ON DELETE CASCADE,
                version_number          INTEGER NOT NULL,
                source_kind             TEXT NOT NULL,
                source_text             TEXT,
                source_file_path        TEXT,
                original_name           TEXT,
                mime_type               TEXT,
                size                    INTEGER NOT NULL DEFAULT 0,
                parsed_content_json     TEXT,
                compiled_template_json  TEXT,
                compilation_status      TEXT NOT NULL DEFAULT 'pending',
                warnings_json           TEXT NOT NULL DEFAULT '[]',
                created_at              TEXT NOT NULL,
                UNIQUE(asset_id, version_number)
            );

            CREATE TABLE IF NOT EXISTS workspace_scenarios (
                id                         INTEGER PRIMARY KEY AUTOINCREMENT,
                workspace_id               TEXT NOT NULL REFERENCES public_workspaces(id) ON DELETE CASCADE,
                name                       TEXT NOT NULL,
                goal_template              TEXT NOT NULL,
                description                TEXT NOT NULL DEFAULT '',
                basis_version_ids_json     TEXT NOT NULL DEFAULT '[]',
                template_version_ids_json  TEXT NOT NULL DEFAULT '[]',
                created_at                 TEXT NOT NULL,
                updated_at                 TEXT NOT NULL,
                deleted_at                 TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_workspace_scenarios_owner
                ON workspace_scenarios(workspace_id, deleted_at);
            """
        )


def _require_workspace(workspace_id: str) -> None:
    if public_workspaces.get_workspace(workspace_id) is None:
        raise LookupError("workspace not found")


def create_asset(
    workspace_id: str,
    asset_type: str,
    name: str,
    description: str = "",
    tags: list[str] | None = None,
) -> dict:
    _require_workspace(workspace_id)
    if asset_type not in {"basis", "template"}:
        raise ValueError("asset type must be basis or template")
    cleaned_name = name.strip()
    if not cleaned_name:
        raise ValueError("asset name is required")
    now = _utc_iso()
    clean_tags = list(dict.fromkeys(tag.strip() for tag in (tags or []) if tag.strip()))
    with public_workspaces._get_db() as conn:
        cursor = conn.execute(
            """
            INSERT INTO workspace_assets (
                workspace_id, asset_type, name, description, tags_json,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                workspace_id,
                asset_type,
                cleaned_name,
                description.strip(),
                _encode(clean_tags),
                now,
                now,
            ),
        )
        asset_id = int(cursor.lastrowid)
    asset = get_asset(asset_id, workspace_id)
    if asset is None:  # pragma: no cover
        raise RuntimeError("created workspace asset could not be loaded")
    return asset


def get_asset(asset_id: int, workspace_id: str | None = None) -> dict | None:
    query = "SELECT * FROM workspace_assets WHERE id = ?"
    values: list[Any] = [asset_id]
    if workspace_id is not None:
        query += " AND workspace_id = ?"
        values.append(workspace_id)
    with public_workspaces._get_db() as conn:
        row = conn.execute(query, values).fetchone()
    return _decode(row)


def list_assets(workspace_id: str, asset_type: str | None = None) -> list[dict]:
    query = "SELECT * FROM workspace_assets WHERE workspace_id = ? AND deleted_at IS NULL"
    values: list[Any] = [workspace_id]
    if asset_type is not None:
        if asset_type not in {"basis", "template"}:
            raise ValueError("asset type must be basis or template")
        query += " AND asset_type = ?"
        values.append(asset_type)
    query += " ORDER BY updated_at DESC, id DESC"
    with public_workspaces._get_db() as conn:
        rows = conn.execute(query, values).fetchall()
    return [_decode(row) for row in rows]


def update_asset(
    asset_id: int,
    workspace_id: str,
    *,
    name: str | None = None,
    description: str | None = None,
    tags: list[str] | None = None,
) -> dict:
    assignments: list[str] = []
    values: list[Any] = []
    if name is not None:
        if not name.strip():
            raise ValueError("asset name is required")
        assignments.append("name = ?")
        values.append(name.strip())
    if description is not None:
        assignments.append("description = ?")
        values.append(description.strip())
    if tags is not None:
        assignments.append("tags_json = ?")
        values.append(_encode(list(dict.fromkeys(tag.strip() for tag in tags if tag.strip()))))
    assignments.append("updated_at = ?")
    values.extend([_utc_iso(), asset_id, workspace_id])
    with public_workspaces._get_db() as conn:
        cursor = conn.execute(
            f"UPDATE workspace_assets SET {', '.join(assignments)} WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL",
            values,
        )
        if cursor.rowcount == 0:
            raise LookupError("workspace asset not found")
    updated = get_asset(asset_id, workspace_id)
    if updated is None:  # pragma: no cover
        raise LookupError("workspace asset not found")
    return updated


def delete_asset(asset_id: int, workspace_id: str) -> None:
    now = _utc_iso()
    with public_workspaces._get_db() as conn:
        conn.execute(
            """
            UPDATE workspace_assets SET deleted_at = ?, updated_at = ?
            WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL
            """,
            (now, now, asset_id, workspace_id),
        )


def _asset_version_path(
    workspace_id: str, asset_id: int, version_number: int, original_name: str
) -> str:
    root = os.path.abspath(PUBLIC_WORKSPACE_STORAGE_DIR)
    directory = os.path.abspath(
        os.path.join(root, workspace_id, str(asset_id), str(version_number))
    )
    if os.path.commonpath([root, directory]) != root:
        raise ValueError("workspace asset path escaped storage root")
    extension = os.path.splitext(os.path.basename(original_name))[1].lower()
    return os.path.join(directory, f"source-{secrets.token_hex(8)}{extension}")


def add_asset_version(asset_id: int, source: WorkspaceAssetSource) -> dict:
    asset = get_asset(asset_id)
    if asset is None or asset["deleted_at"] is not None:
        raise LookupError("workspace asset not found")
    if source.source_kind not in {"file", "text_freeform", "text_structured"}:
        raise ValueError("unsupported workspace asset source kind")
    if source.source_kind == "file" and (
        not source.file_path or not os.path.isfile(source.file_path)
    ):
        raise ValueError("workspace asset source file is required")
    if source.source_kind != "file" and not (source.source_text or "").strip():
        raise ValueError("workspace asset source text is required")

    with public_workspaces._get_db() as conn:
        row = conn.execute(
            "SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version FROM workspace_asset_versions WHERE asset_id = ?",
            (asset_id,),
        ).fetchone()
        version_number = int(row["next_version"])

    stored_path = None
    original_name = source.original_name
    size = 0
    if source.source_kind == "file":
        original_name = os.path.basename(original_name or source.file_path or "source")
        stored_path = _asset_version_path(
            asset["workspace_id"], asset_id, version_number, original_name
        )
        os.makedirs(os.path.dirname(stored_path), exist_ok=True)
        shutil.copyfile(source.file_path, stored_path)
        size = os.path.getsize(stored_path)
    else:
        size = len((source.source_text or "").encode("utf-8"))

    compilation_status = "compiled" if source.compiled_template is not None else "pending"
    with public_workspaces._get_db() as conn:
        cursor = conn.execute(
            """
            INSERT INTO workspace_asset_versions (
                asset_id, version_number, source_kind, source_text,
                source_file_path, original_name, mime_type, size,
                parsed_content_json, compiled_template_json,
                compilation_status, warnings_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?)
            """,
            (
                asset_id,
                version_number,
                source.source_kind,
                source.source_text,
                stored_path,
                original_name,
                source.mime_type,
                size,
                _encode(source.parsed_content),
                _encode(source.compiled_template),
                compilation_status,
                _utc_iso(),
            ),
        )
        version_id = int(cursor.lastrowid)
        conn.execute(
            "UPDATE workspace_assets SET current_version_id = ?, updated_at = ? WHERE id = ?",
            (version_id, _utc_iso(), asset_id),
        )
    version = get_asset_version(version_id)
    if version is None:  # pragma: no cover
        raise RuntimeError("created workspace asset version could not be loaded")
    return version


def get_asset_version(
    version_id: int, workspace_id: str | None = None
) -> dict | None:
    query = """
        SELECT v.*, a.workspace_id, a.asset_type, a.name AS asset_name
        FROM workspace_asset_versions v
        JOIN workspace_assets a ON a.id = v.asset_id
        WHERE v.id = ?
    """
    values: list[Any] = [version_id]
    if workspace_id is not None:
        query += " AND a.workspace_id = ?"
        values.append(workspace_id)
    with public_workspaces._get_db() as conn:
        row = conn.execute(query, values).fetchone()
    return _decode(row)


def list_asset_versions(asset_id: int, workspace_id: str) -> list[dict]:
    asset = get_asset(asset_id, workspace_id)
    if asset is None:
        raise LookupError("workspace asset not found")
    with public_workspaces._get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM workspace_asset_versions WHERE asset_id = ? ORDER BY version_number DESC",
            (asset_id,),
        ).fetchall()
    return [_decode(row) for row in rows]


def _validate_scenario_versions(
    workspace_id: str,
    version_ids: list[int],
    expected_type: str,
) -> None:
    for version_id in version_ids:
        version = get_asset_version(version_id)
        if (
            version is None
            or version["workspace_id"] != workspace_id
            or version["asset_type"] != expected_type
        ):
            raise PermissionError("scenario references a foreign or invalid asset version")


def create_scenario(
    workspace_id: str,
    name: str,
    goal_template: str,
    basis_version_ids: list[int],
    template_version_ids: list[int],
    description: str = "",
) -> dict:
    _require_workspace(workspace_id)
    if not name.strip() or not goal_template.strip():
        raise ValueError("scenario name and goal are required")
    _validate_scenario_versions(workspace_id, basis_version_ids, "basis")
    _validate_scenario_versions(workspace_id, template_version_ids, "template")
    now = _utc_iso()
    with public_workspaces._get_db() as conn:
        cursor = conn.execute(
            """
            INSERT INTO workspace_scenarios (
                workspace_id, name, goal_template, description,
                basis_version_ids_json, template_version_ids_json,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                workspace_id,
                name.strip(),
                goal_template.strip(),
                description.strip(),
                _encode(basis_version_ids),
                _encode(template_version_ids),
                now,
                now,
            ),
        )
        scenario_id = int(cursor.lastrowid)
    scenario = get_scenario(scenario_id, workspace_id)
    if scenario is None:  # pragma: no cover
        raise RuntimeError("created workspace scenario could not be loaded")
    return scenario


def get_scenario(scenario_id: int, workspace_id: str | None = None) -> dict | None:
    query = "SELECT * FROM workspace_scenarios WHERE id = ?"
    values: list[Any] = [scenario_id]
    if workspace_id is not None:
        query += " AND workspace_id = ?"
        values.append(workspace_id)
    with public_workspaces._get_db() as conn:
        row = conn.execute(query, values).fetchone()
    return _decode(row)


def list_scenarios(workspace_id: str) -> list[dict]:
    with public_workspaces._get_db() as conn:
        rows = conn.execute(
            """
            SELECT * FROM workspace_scenarios
            WHERE workspace_id = ? AND deleted_at IS NULL
            ORDER BY updated_at DESC, id DESC
            """,
            (workspace_id,),
        ).fetchall()
    return [_decode(row) for row in rows]


def update_scenario(
    scenario_id: int,
    workspace_id: str,
    *,
    name: str,
    goal_template: str,
    basis_version_ids: list[int],
    template_version_ids: list[int],
    description: str = "",
) -> dict:
    _validate_scenario_versions(workspace_id, basis_version_ids, "basis")
    _validate_scenario_versions(workspace_id, template_version_ids, "template")
    with public_workspaces._get_db() as conn:
        cursor = conn.execute(
            """
            UPDATE workspace_scenarios SET
                name = ?, goal_template = ?, description = ?,
                basis_version_ids_json = ?, template_version_ids_json = ?,
                updated_at = ?
            WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL
            """,
            (
                name.strip(),
                goal_template.strip(),
                description.strip(),
                _encode(basis_version_ids),
                _encode(template_version_ids),
                _utc_iso(),
                scenario_id,
                workspace_id,
            ),
        )
        if cursor.rowcount == 0:
            raise LookupError("workspace scenario not found")
    updated = get_scenario(scenario_id, workspace_id)
    if updated is None:  # pragma: no cover
        raise LookupError("workspace scenario not found")
    return updated


def delete_scenario(scenario_id: int, workspace_id: str) -> None:
    with public_workspaces._get_db() as conn:
        conn.execute(
            """
            UPDATE workspace_scenarios SET deleted_at = ?, updated_at = ?
            WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL
            """,
            (_utc_iso(), _utc_iso(), scenario_id, workspace_id),
        )
