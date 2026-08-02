"""HTTP API for recoverable workspaces and reusable evaluation resources."""

from __future__ import annotations

import os
import tempfile
from typing import Annotated

from fastapi import APIRouter, File, Header, HTTPException, Query, UploadFile

from . import public_workspaces, workspace_assets
from .config import MAX_FILE_SIZE
from .workspace_assets import WorkspaceAssetSource
from .workspace_models import (
    AssetCreateRequest,
    AssetUpdateRequest,
    ScenarioCreateRequest,
    ScenarioUpdateRequest,
    TextVersionCreateRequest,
    WorkspaceCreateRequest,
    WorkspaceRecoverRequest,
)


router = APIRouter(prefix="/api/public/workspaces", tags=["public-workspaces"])

_ALLOWED_EXTENSIONS = {
    "basis": {".pdf", ".docx", ".txt"},
    "template": {".pdf", ".docx"},
}


def _api_error(status_code: int, code: str, message: str, *, stage: str):
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "stage": stage},
    )


def _workspace_payload(workspace: dict) -> dict:
    return {
        "workspace_id": workspace["id"],
        "name": workspace["name"],
        "status": workspace["status"],
        "created_at": workspace["created_at"],
        "last_accessed_at": workspace["last_accessed_at"],
        "cleanup_after": workspace["cleanup_after"],
    }


def _asset_payload(asset: dict) -> dict:
    return {
        "id": asset["id"],
        "workspace_id": asset["workspace_id"],
        "asset_type": asset["asset_type"],
        "name": asset["name"],
        "description": asset["description"],
        "tags": asset.get("tags_json") or [],
        "current_version_id": asset["current_version_id"],
        "created_at": asset["created_at"],
        "updated_at": asset["updated_at"],
    }


def _version_payload(version: dict) -> dict:
    return {
        "id": version["id"],
        "asset_id": version["asset_id"],
        "version_number": version["version_number"],
        "source_kind": version["source_kind"],
        "source_text": version.get("source_text"),
        "original_name": version.get("original_name"),
        "mime_type": version.get("mime_type"),
        "size": version["size"],
        "parsed_content": version.get("parsed_content_json"),
        "compiled_template": version.get("compiled_template_json"),
        "compilation_status": version["compilation_status"],
        "warnings": version.get("warnings_json") or [],
        "created_at": version["created_at"],
    }


def _scenario_payload(scenario: dict) -> dict:
    return {
        "id": scenario["id"],
        "workspace_id": scenario["workspace_id"],
        "name": scenario["name"],
        "goal_template": scenario["goal_template"],
        "description": scenario["description"],
        "basis_version_ids": scenario.get("basis_version_ids_json") or [],
        "template_version_ids": scenario.get("template_version_ids_json") or [],
        "created_at": scenario["created_at"],
        "updated_at": scenario["updated_at"],
    }


def _authorize(workspace_id: str, token: str | None) -> dict:
    if not token:
        raise _api_error(401, "workspace_token_required", "需要工作区访问凭证", stage="workspace_auth")
    try:
        return public_workspaces.authorize_workspace(workspace_id, token)
    except LookupError:
        raise _api_error(404, "workspace_not_found", "工作区不存在", stage="workspace_auth")
    except PermissionError:
        raise _api_error(403, "workspace_access_denied", "工作区访问凭证无效或已过期", stage="workspace_auth")


def _require_asset(workspace_id: str, asset_id: int) -> dict:
    asset = workspace_assets.get_asset(asset_id, workspace_id)
    if asset is None or asset.get("deleted_at") is not None:
        raise _api_error(404, "asset_not_found", "资源不存在", stage="workspace_asset")
    return asset


@router.post("", status_code=201)
async def create_workspace(body: WorkspaceCreateRequest):
    try:
        workspace, token = public_workspaces.create_workspace(body.name)
    except ValueError as exc:
        raise _api_error(400, "invalid_workspace", str(exc), stage="workspace_create")
    return {**_workspace_payload(workspace), "access_token": token}


@router.post("/recover")
async def recover_workspace(body: WorkspaceRecoverRequest):
    workspace = _authorize(body.workspace_id, body.recovery_secret)
    return _workspace_payload(workspace)


@router.get("/{workspace_id}")
async def get_workspace(
    workspace_id: str,
    x_workspace_token: Annotated[str | None, Header()] = None,
):
    return _workspace_payload(_authorize(workspace_id, x_workspace_token))


@router.get("/{workspace_id}/assets")
async def list_assets(
    workspace_id: str,
    asset_type: str | None = Query(default=None),
    x_workspace_token: Annotated[str | None, Header()] = None,
):
    _authorize(workspace_id, x_workspace_token)
    try:
        return [_asset_payload(item) for item in workspace_assets.list_assets(workspace_id, asset_type)]
    except ValueError as exc:
        raise _api_error(400, "invalid_asset_type", str(exc), stage="workspace_asset")


@router.post("/{workspace_id}/assets", status_code=201)
async def create_asset(
    workspace_id: str,
    body: AssetCreateRequest,
    x_workspace_token: Annotated[str | None, Header()] = None,
):
    _authorize(workspace_id, x_workspace_token)
    try:
        asset = workspace_assets.create_asset(
            workspace_id, body.asset_type, body.name, body.description, body.tags
        )
    except ValueError as exc:
        raise _api_error(400, "invalid_asset", str(exc), stage="workspace_asset")
    return _asset_payload(asset)


@router.get("/{workspace_id}/assets/{asset_id}")
async def get_asset(
    workspace_id: str,
    asset_id: int,
    x_workspace_token: Annotated[str | None, Header()] = None,
):
    _authorize(workspace_id, x_workspace_token)
    return _asset_payload(_require_asset(workspace_id, asset_id))


@router.put("/{workspace_id}/assets/{asset_id}")
async def update_asset(
    workspace_id: str,
    asset_id: int,
    body: AssetUpdateRequest,
    x_workspace_token: Annotated[str | None, Header()] = None,
):
    _authorize(workspace_id, x_workspace_token)
    _require_asset(workspace_id, asset_id)
    try:
        updated = workspace_assets.update_asset(
            asset_id,
            workspace_id,
            name=body.name,
            description=body.description,
            tags=body.tags,
        )
    except (LookupError, ValueError) as exc:
        raise _api_error(400, "invalid_asset", str(exc), stage="workspace_asset")
    return _asset_payload(updated)


@router.delete("/{workspace_id}/assets/{asset_id}", status_code=204)
async def delete_asset(
    workspace_id: str,
    asset_id: int,
    x_workspace_token: Annotated[str | None, Header()] = None,
):
    _authorize(workspace_id, x_workspace_token)
    _require_asset(workspace_id, asset_id)
    workspace_assets.delete_asset(asset_id, workspace_id)


@router.get("/{workspace_id}/assets/{asset_id}/versions")
async def list_asset_versions(
    workspace_id: str,
    asset_id: int,
    x_workspace_token: Annotated[str | None, Header()] = None,
):
    _authorize(workspace_id, x_workspace_token)
    _require_asset(workspace_id, asset_id)
    return [
        _version_payload(item)
        for item in workspace_assets.list_asset_versions(asset_id, workspace_id)
    ]


@router.post("/{workspace_id}/assets/{asset_id}/versions/text", status_code=201)
async def create_text_version(
    workspace_id: str,
    asset_id: int,
    body: TextVersionCreateRequest,
    x_workspace_token: Annotated[str | None, Header()] = None,
):
    _authorize(workspace_id, x_workspace_token)
    _require_asset(workspace_id, asset_id)
    try:
        version = workspace_assets.add_asset_version(
            asset_id,
            WorkspaceAssetSource(
                source_kind=body.source_kind,
                source_text=body.source_text,
                parsed_content=body.parsed_content,
                compiled_template=body.compiled_template,
            ),
        )
    except ValueError as exc:
        raise _api_error(400, "invalid_asset_version", str(exc), stage="workspace_version")
    return _version_payload(version)


@router.post("/{workspace_id}/assets/{asset_id}/versions/file", status_code=201)
async def create_file_version(
    workspace_id: str,
    asset_id: int,
    file: UploadFile = File(...),
    x_workspace_token: Annotated[str | None, Header()] = None,
):
    _authorize(workspace_id, x_workspace_token)
    asset = _require_asset(workspace_id, asset_id)
    filename = os.path.basename(file.filename or "")
    extension = os.path.splitext(filename)[1].lower()
    if extension not in _ALLOWED_EXTENSIONS[asset["asset_type"]]:
        allowed = "、".join(sorted(_ALLOWED_EXTENSIONS[asset["asset_type"]]))
        raise _api_error(400, "unsupported_asset_file", f"仅支持 {allowed} 文件", stage="workspace_upload")
    data = await file.read()
    if not data:
        raise _api_error(400, "empty_asset_file", "上传文件为空", stage="workspace_upload")
    if len(data) > MAX_FILE_SIZE:
        raise _api_error(413, "asset_file_too_large", "上传文件超过 50MB", stage="workspace_upload")
    temporary_path = ""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=extension) as temporary:
            temporary.write(data)
            temporary_path = temporary.name
        version = workspace_assets.add_asset_version(
            asset_id,
            WorkspaceAssetSource(
                source_kind="file",
                file_path=temporary_path,
                original_name=filename,
                mime_type=file.content_type,
            ),
        )
    finally:
        if temporary_path and os.path.exists(temporary_path):
            os.remove(temporary_path)
    return _version_payload(version)


@router.get("/{workspace_id}/scenarios")
async def list_scenarios(
    workspace_id: str,
    x_workspace_token: Annotated[str | None, Header()] = None,
):
    _authorize(workspace_id, x_workspace_token)
    return [_scenario_payload(item) for item in workspace_assets.list_scenarios(workspace_id)]


@router.post("/{workspace_id}/scenarios", status_code=201)
async def create_scenario(
    workspace_id: str,
    body: ScenarioCreateRequest,
    x_workspace_token: Annotated[str | None, Header()] = None,
):
    _authorize(workspace_id, x_workspace_token)
    try:
        scenario = workspace_assets.create_scenario(
            workspace_id,
            body.name,
            body.goal_template,
            body.basis_version_ids,
            body.template_version_ids,
            body.description,
        )
    except PermissionError as exc:
        raise _api_error(403, "foreign_asset_version", str(exc), stage="workspace_scenario")
    except ValueError as exc:
        raise _api_error(400, "invalid_scenario", str(exc), stage="workspace_scenario")
    return _scenario_payload(scenario)


@router.put("/{workspace_id}/scenarios/{scenario_id}")
async def update_scenario(
    workspace_id: str,
    scenario_id: int,
    body: ScenarioUpdateRequest,
    x_workspace_token: Annotated[str | None, Header()] = None,
):
    _authorize(workspace_id, x_workspace_token)
    try:
        scenario = workspace_assets.update_scenario(
            scenario_id,
            workspace_id,
            name=body.name,
            goal_template=body.goal_template,
            basis_version_ids=body.basis_version_ids,
            template_version_ids=body.template_version_ids,
            description=body.description,
        )
    except PermissionError as exc:
        raise _api_error(403, "foreign_asset_version", str(exc), stage="workspace_scenario")
    except LookupError:
        raise _api_error(404, "scenario_not_found", "场景不存在", stage="workspace_scenario")
    return _scenario_payload(scenario)


@router.delete("/{workspace_id}/scenarios/{scenario_id}", status_code=204)
async def delete_scenario(
    workspace_id: str,
    scenario_id: int,
    x_workspace_token: Annotated[str | None, Header()] = None,
):
    _authorize(workspace_id, x_workspace_token)
    scenario = workspace_assets.get_scenario(scenario_id, workspace_id)
    if scenario is None or scenario.get("deleted_at") is not None:
        raise _api_error(404, "scenario_not_found", "场景不存在", stage="workspace_scenario")
    workspace_assets.delete_scenario(scenario_id, workspace_id)
