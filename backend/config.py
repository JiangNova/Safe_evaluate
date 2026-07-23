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

# App settings
REQUIREMENT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "requirement")
REPORT_STORAGE_DIR = os.path.join(os.path.dirname(__file__), "data", "reports")
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

# Auth
USERS_JSON = os.getenv("APP_USERS", '{"110Csust@": "110Csust@"}')
USERS = _json.loads(USERS_JSON)
JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production-please")
JWT_EXPIRY_HOURS = int(os.getenv("JWT_EXPIRY_HOURS", "24"))

# CORS
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")

# Ensure directories exist
os.makedirs(REPORT_STORAGE_DIR, exist_ok=True)

# ----- Startup check -----
_STARTUP_OK = True
if not QWEN_API_KEY:
    print("[CONFIG] WARNING: QWEN_API_KEY not set! Add it to .env file", file=sys.stderr)
    _STARTUP_OK = False
if _LOADED:
    print(f"[CONFIG] .env loaded from: {_ENV_PATH}")
else:
    print(f"[CONFIG] WARNING: .env not found at: {_ENV_PATH}, using defaults", file=sys.stderr)
print(f"[CONFIG] Model={QWEN_MODEL} | Users={list(USERS.keys())} | CORS={CORS_ORIGINS} | API_KEY={'SET' if QWEN_API_KEY else 'MISSING'}")
