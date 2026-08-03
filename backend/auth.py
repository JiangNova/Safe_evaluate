"""Simple token-based auth for the internal tool."""
import jwt
import time
from .config import LEADERSHIP_USERS, USERS, JWT_EXPIRY_HOURS, JWT_SECRET


def _issue_token(username: str, role: str) -> str:
    payload = {
        "username": username,
        "role": role,
        "exp": int(time.time()) + JWT_EXPIRY_HOURS * 3600,
        "iat": int(time.time()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def authenticate(username: str, password: str) -> str | None:
    """Validate credentials and return a JWT token, or None."""
    if username in USERS and USERS[username] == password:
        return _issue_token(username, "admin")
    return None


def authenticate_leadership_user(username: str, password: str) -> str | None:
    """Validate a leadership writing account and issue a scoped JWT."""
    if username in LEADERSHIP_USERS and LEADERSHIP_USERS[username] == password:
        return _issue_token(username, "leader_assistant")
    return None


def verify_token(token: str) -> dict | None:
    """Verify a JWT token and return the payload, or None."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
