"""Simple token-based auth for the internal tool."""
import jwt
import time
from .config import USERS, JWT_SECRET, JWT_EXPIRY_HOURS


def authenticate(username: str, password: str) -> str | None:
    """Validate credentials and return a JWT token, or None."""
    if username in USERS and USERS[username] == password:
        payload = {
            "username": username,
            "exp": int(time.time()) + JWT_EXPIRY_HOURS * 3600,
            "iat": int(time.time()),
        }
        token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
        return token
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
