"""Pydantic models for API request/response schemas."""
from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


# ===== Auth =====

class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    user: dict


# ===== Evaluate =====

class EvaluateResponse(BaseModel):
    report_id: str
    status: str = "success"  # "success" | "failed"
    error: Optional[str] = None


# ===== Anonymous generic public jobs =====

class PublicJobCreateResponse(BaseModel):
    job_id: str
    access_token: str
    status: str
    expires_at: datetime


class PublicJobStatusResponse(BaseModel):
    id: str
    goal: str
    status: str
    result: Optional[dict] = None
    errors: Optional[dict] = None
    created_at: datetime
    expires_at: datetime


class PublicJobCreateRequest(BaseModel):
    goal: str = Field(min_length=1, max_length=4000)


class JobTextResourceRequest(BaseModel):
    resource_kind: str
    source_text: str = Field(min_length=1, max_length=100000)
    name: str = Field(default="文字输入", max_length=160)


class TemplateFieldsUpdate(BaseModel):
    fields: list[dict]
    preview_metadata: Optional[dict] = None


class DocumentFieldsUpdate(BaseModel):
    fields: dict


class RegenerateFieldRequest(BaseModel):
    instruction: str = Field(default="", max_length=2000)


# ===== Finding & Report =====

FINDING_CATEGORIES = {
    "fire_exit": "消防通道与疏散",
    "equipment": "消防设施与器材",
    "electrical": "电气与火源管理",
    "management": "消防安全管理",
    "building": "建筑与场所属性",
    "other": "其他",
}


class StatSummary(BaseModel):
    compliant: int
    nonCompliant: int
    suggestions: int


class Finding(BaseModel):
    severity: str  # "danger" | "warning" | "success"
    category: str = "other"  # fire_exit | equipment | electrical | management | building | other
    title: str
    detail: str
    regulation_ref: Optional[str] = None


class Report(BaseModel):
    id: str
    title: str
    date: str
    filename: str
    rules: list[str]
    stats: StatSummary
    findings: list[Finding]
    created_at: str


class ReportListItem(BaseModel):
    id: str
    title: str
    date: str
    filename: str
    risk_level: str  # "low" | "medium" | "high" | "failed"
    status: str = "success"  # "success" | "failed"
    created_at: str


class HistoryResponse(BaseModel):
    items: list[ReportListItem]
    total: int
    page: int
    page_size: int


# ===== Rules =====

class Rule(BaseModel):
    id: str
    name: str
    category: str  # fire_exit | equipment | electrical | management | building | other
    description: str = ""
    source_doc: str = ""  # which requirement doc this rule comes from
    clause: str = ""  # specific clause number
    is_custom: bool = False  # user-created vs system-built-in


class RuleCreate(BaseModel):
    name: str
    category: str = "other"
    description: str = ""
    source_doc: str = ""
    clause: str = ""


class RuleUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    source_doc: Optional[str] = None
    clause: Optional[str] = None


# ===== Statistics =====

class StatsOverview(BaseModel):
    total_reports: int
    total_findings: int
    total_compliant: int
    total_non_compliant: int
    total_suggestions: int
    compliance_rate: float  # 0-100
    risk_distribution: dict  # {"low": N, "medium": N, "high": N}
    failed_count: int = 0  # count of failed evaluations


class CategoryStat(BaseModel):
    category: str
    label: str
    non_compliant_count: int
    percentage: float  # 0-100


class TopIssue(BaseModel):
    title: str
    count: int
    category: str


class TrendPoint(BaseModel):
    period: str  # "2026-07" etc.
    total: int
    compliant: int
    non_compliant: int
    compliance_rate: float


class StatsResponse(BaseModel):
    overview: StatsOverview
    by_category: list[CategoryStat] = []
    top_issues: list[TopIssue] = []
    trends: list[TrendPoint] = []
