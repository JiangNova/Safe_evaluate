"""Request models for reusable anonymous workspace resources."""

from typing import Literal

from pydantic import BaseModel, Field


class WorkspaceCreateRequest(BaseModel):
    name: str = Field(default="", max_length=120)


class WorkspaceRecoverRequest(BaseModel):
    workspace_id: str
    recovery_secret: str


class AssetCreateRequest(BaseModel):
    asset_type: Literal["basis", "template"]
    name: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=1000)
    tags: list[str] = Field(default_factory=list)


class AssetUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=1000)
    tags: list[str] | None = None


class TextVersionCreateRequest(BaseModel):
    source_kind: Literal["text_freeform", "text_structured"]
    source_text: str = Field(min_length=1)
    parsed_content: dict | None = None
    compiled_template: dict | None = None


class ScenarioCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    goal_template: str = Field(min_length=1, max_length=4000)
    description: str = Field(default="", max_length=1000)
    basis_version_ids: list[int] = Field(default_factory=list)
    template_version_ids: list[int] = Field(default_factory=list)


class ScenarioUpdateRequest(ScenarioCreateRequest):
    pass
