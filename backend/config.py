"""Application configuration — .env first, fallback to defaults."""
import json as _json
import os
import sys
from dotenv import load_dotenv

# Locate .env
_ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
_LOADED = load_dotenv(_ENV_PATH)

# Qwen API (DashScope compatible mode)
QWEN_API_KEY = os.getenv("QWEN_API_KEY", "")
QWEN_API_BASE = os.getenv(
    "QWEN_API_BASE",
    "https://dashscope.aliyuncs.com/compatible-mode/v1",
)
QWEN_MODEL = os.getenv("QWEN_MODEL", "qwen-vl-plus")

# Backup API (failover when primary API is unreachable)
# Uses OpenAI-compatible protocol — works with SiliconFlow, Wishes, etc.
BACKUP_API_KEY = os.getenv("BACKUP_API_KEY", "")
BACKUP_API_BASE = os.getenv(
    "BACKUP_API_BASE",
    "https://api.siliconflow.cn/v1",
)
BACKUP_MODEL = os.getenv("BACKUP_MODEL", "Qwen/Qwen2.5-VL-72B-Instruct")

# Retry settings
API_MAX_RETRIES = int(os.getenv("API_MAX_RETRIES", "3"))
API_RETRY_DELAY = float(os.getenv("API_RETRY_DELAY", "1.5"))  # seconds, multiplied exponentially

# App settings
REQUIREMENT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "requirement")

# Template files in requirement/ that are output templates, NOT regulation documents.
# They should be excluded from the evaluation context and only used as output format templates.
OUTPUT_TEMPLATE_FILES = {
    "公安派出所日常消防监督检查记录表.docx",
    "派出所责令立即改正通知书.docx",
}
REPORT_STORAGE_DIR = os.path.join(os.path.dirname(__file__), "data", "reports")
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

# Anonymous generic public evaluation jobs
PUBLIC_JOB_STORAGE_DIR = os.path.join(
    os.path.dirname(__file__), "data", "public_jobs"
)
PUBLIC_JOB_EXPIRY_HOURS = int(os.getenv("PUBLIC_JOB_EXPIRY_HOURS", "24"))
PUBLIC_JOB_MAX_FILES = int(os.getenv("PUBLIC_JOB_MAX_FILES", "30"))
PUBLIC_JOB_MAX_TOTAL_SIZE = int(
    os.getenv("PUBLIC_JOB_MAX_TOTAL_SIZE", str(150 * 1024 * 1024))
)
LIBREOFFICE_COMMAND = os.getenv("LIBREOFFICE_COMMAND", "soffice")
TESSERACT_COMMAND = os.getenv("TESSERACT_COMMAND", "tesseract")
PUBLIC_JOB_CREATE_RATE = int(os.getenv("PUBLIC_JOB_CREATE_RATE", "20"))
PUBLIC_JOB_MAX_CONCURRENCY = int(os.getenv("PUBLIC_JOB_MAX_CONCURRENCY", "2"))

# Auth
APP_ENV = os.getenv("APP_ENV", "development").lower()
USERS_JSON = os.getenv("APP_USERS", "{}")
USERS = _json.loads(USERS_JSON) if USERS_JSON else {}
JWT_SECRET = os.getenv("JWT_SECRET", "")
JWT_EXPIRY_HOURS = int(os.getenv("JWT_EXPIRY_HOURS", "24"))

if APP_ENV == "production":
    _missing_settings = []
    if not USERS:
        _missing_settings.append("APP_USERS")
    if not JWT_SECRET:
        _missing_settings.append("JWT_SECRET")
    if _missing_settings:
        raise RuntimeError(
            f"Missing required production settings: {', '.join(_missing_settings)}"
        )

# CORS
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")

# Database (SQLite)
DB_PATH = os.path.join(os.path.dirname(__file__), "data", "reports.db")

# Image storage (uploaded evaluation images persisted to disk)
IMAGE_STORAGE_DIR = os.path.join(os.path.dirname(__file__), "data", "images")

# Ensure directories exist
os.makedirs(REPORT_STORAGE_DIR, exist_ok=True)
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
os.makedirs(IMAGE_STORAGE_DIR, exist_ok=True)
os.makedirs(PUBLIC_JOB_STORAGE_DIR, exist_ok=True)

# ----- Startup check -----
_STARTUP_OK = True
if not QWEN_API_KEY:
    print("[CONFIG] WARNING: QWEN_API_KEY not set! Add it to .env file", file=sys.stderr)
    _STARTUP_OK = False
if _LOADED:
    print(f"[CONFIG] .env loaded from: {_ENV_PATH}")
else:
    print(f"[CONFIG] WARNING: .env not found at: {_ENV_PATH}, using defaults", file=sys.stderr)
print(f"[CONFIG] Model={QWEN_MODEL} | Users={list(USERS.keys())} | CORS={CORS_ORIGINS}")
print(f"[CONFIG] Primary API:  {'SET' if QWEN_API_KEY else 'MISSING'} | Backup API: {'SET' if BACKUP_API_KEY else 'MISSING'} | Retries={API_MAX_RETRIES}")
