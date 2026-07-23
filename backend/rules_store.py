"""JSON-file-based rule storage with CRUD operations."""
import json
import os
import uuid
from .config import REPORT_STORAGE_DIR

RULES_FILE = os.path.join(os.path.dirname(__file__), "data", "rules.json")

# Default built-in rules — seeded on first run
DEFAULT_RULES = [
    {
        "id": "fire_law",
        "name": "中华人民共和国消防法",
        "category": "management",
        "description": "消防安全基本法，涵盖消防安全责任、火灾预防、消防组织、灭火救援等各方面基本要求",
        "source_doc": "",
        "clause": "",
        "is_custom": False,
    },
    {
        "id": "gb35181",
        "name": "GB 35181-2025 重大火灾隐患判定规则",
        "category": "building",
        "description": "重大火灾隐患的判定原则、方法和程序，用于识别和认定重大火灾隐患",
        "source_doc": "",
        "clause": "",
        "is_custom": False,
    },
    {
        "id": "supervision_reg",
        "name": "消防监督检查规定（公安部120号令）",
        "category": "management",
        "description": "规定消防监督检查的形式、内容、程序及隐患整改要求",
        "source_doc": "派出所防火工作消防监督指引手册7(2026版).docx",
        "clause": "",
        "is_custom": False,
    },
    {
        "id": "cs_standard",
        "name": "长沙市派出所消防重点监督对象界定标准",
        "category": "building",
        "description": "长沙市消防安全重点单位的界定标准和分类管理要求",
        "source_doc": "消防界定标准 (3).doc",
        "clause": "",
        "is_custom": False,
    },
    {
        "id": "hn_standard",
        "name": "湖南省消防安全重点单位界定标准",
        "category": "building",
        "description": "湖南省消防安全重点单位的界定标准和监督管理要求",
        "source_doc": "消防界定标准 (3).doc",
        "clause": "",
        "is_custom": False,
    },
    {
        "id": "gb50016",
        "name": "GB 50016 建筑设计防火规范",
        "category": "fire_exit",
        "description": "建筑防火设计的基本规范，涵盖疏散通道宽度、安全出口数量、防火分区等要求",
        "source_doc": "",
        "clause": "",
        "is_custom": False,
    },
    {
        "id": "gb50116",
        "name": "GB 50116 火灾自动报警系统设计规范",
        "category": "equipment",
        "description": "火灾自动报警系统的设计、安装、验收及维护管理要求",
        "source_doc": "",
        "clause": "",
        "is_custom": False,
    },
    {
        "id": "gb50974",
        "name": "GB 50974 消防给水及消火栓系统规范",
        "category": "equipment",
        "description": "消防给水系统和消火栓的技术设计、施工验收标准",
        "source_doc": "",
        "clause": "",
        "is_custom": False,
    },
]


def _ensure_rules_file() -> None:
    """Create rules.json with defaults if it doesn't exist."""
    os.makedirs(os.path.dirname(RULES_FILE), exist_ok=True)
    if not os.path.exists(RULES_FILE):
        with open(RULES_FILE, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_RULES, f, ensure_ascii=False, indent=2)


def _read_rules() -> list[dict]:
    """Read all rules from disk."""
    _ensure_rules_file()
    with open(RULES_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _write_rules(rules: list[dict]) -> None:
    """Write all rules to disk."""
    with open(RULES_FILE, "w", encoding="utf-8") as f:
        json.dump(rules, f, ensure_ascii=False, indent=2)


def list_rules(category: str | None = None) -> list[dict]:
    """List all rules, optionally filtered by category."""
    rules = _read_rules()
    if category:
        rules = [r for r in rules if r.get("category") == category]
    return rules


def create_rule(data: dict) -> dict:
    """Create a new custom rule. Returns the created rule."""
    rules = _read_rules()
    rule = {
        "id": f"custom_{uuid.uuid4().hex[:8]}",
        "name": data["name"],
        "category": data.get("category", "other"),
        "description": data.get("description", ""),
        "source_doc": data.get("source_doc", ""),
        "clause": data.get("clause", ""),
        "is_custom": True,
    }
    rules.append(rule)
    _write_rules(rules)
    return rule


def update_rule(rule_id: str, data: dict) -> dict | None:
    """Update an existing rule. Only custom rules can be fully modified;
    built-in rules can only have description/clause updated."""
    rules = _read_rules()
    for rule in rules:
        if rule["id"] == rule_id:
            for field in ("name", "category", "description", "source_doc", "clause"):
                if field in data and data[field] is not None:
                    rule[field] = data[field]
            _write_rules(rules)
            return rule
    return None


def delete_rule(rule_id: str) -> bool:
    """Delete a rule. Only custom rules can be deleted."""
    rules = _read_rules()
    for i, rule in enumerate(rules):
        if rule["id"] == rule_id:
            if not rule.get("is_custom", False):
                return False  # cannot delete built-in rules
            rules.pop(i)
            _write_rules(rules)
            return True
    return False
