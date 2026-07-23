"""Pydantic models for API request/response schemas."""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    user: dict


class EvaluateResponse(BaseModel):
    report_id: str


class StatSummary(BaseModel):
    compliant: int
    nonCompliant: int
    suggestions: int


class Finding(BaseModel):
    severity: str  # "danger" | "warning" | "success"
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
    risk_level: str  # "low" | "medium" | "high"
    created_at: str


class HistoryResponse(BaseModel):
    items: list[ReportListItem]
    total: int
    page: int
    page_size: int
