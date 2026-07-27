"""Qwen API integration — evaluates images against fire safety requirements.

Supports primary + backup API with automatic failover, retry with exponential
backoff, and connection pooling for better stability under load.
"""
import json
import os
import re
import base64
import asyncio
import sys
from typing import Optional

import httpx


def _safe_print(*args, **kwargs):
    """Print to stderr safely, falling back to ASCII on encoding errors (GBK terminals)."""
    try:
        print(*args, **kwargs)
    except UnicodeEncodeError:
        safe_args = [str(a).encode('ascii', errors='replace').decode() for a in args]
        print(*safe_args, **kwargs)


# ---------------------------------------------------------------------------
# Shared HTTP client — reused for connection pooling
# ---------------------------------------------------------------------------

_client: Optional[httpx.AsyncClient] = None


def _get_client(timeout: int = 120) -> httpx.AsyncClient:
    """Return a module-level AsyncClient with connection pooling.

    Uses trust_env=False to avoid Windows system proxy interference.
    """
    global _client
    if _client is None or _client.is_closed:
        limits = httpx.Limits(
            max_keepalive_connections=10,
            max_connections=50,
            keepalive_expiry=30,
        )
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(timeout, connect=30),
            limits=limits,
            trust_env=False,  # Windows system proxy can cause ConnectError
        )
    return _client

from .config import (
    QWEN_API_KEY,
    QWEN_API_BASE,
    QWEN_MODEL,
    BACKUP_API_KEY,
    BACKUP_API_BASE,
    BACKUP_MODEL,
    API_MAX_RETRIES,
    API_RETRY_DELAY,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _encode_image_to_base64(file_bytes: bytes, mime_type: str) -> str:
    """Encode image bytes to a base64 data URL."""
    encoded = base64.b64encode(file_bytes).decode("utf-8")
    return f"data:{mime_type};base64,{encoded}"


def _build_messages(
    images: list[tuple[bytes, str]],
    rules: list[str],
    requirements_context: str,
) -> list[dict]:
    """Build the message payload for a vision-capable chat-completions API.

    Each image becomes an ``image_url`` content block, followed by the text
    prompt at the end.
    """
    from .prompts import SYSTEM_PROMPT, build_user_prompt

    user_text = build_user_prompt(rules, requirements_context)

    content_blocks = []
    for img_bytes, mime_type in images:
        img_b64 = _encode_image_to_base64(img_bytes, mime_type)
        content_blocks.append({
            "type": "image_url",
            "image_url": {"url": img_b64},
        })

    content_blocks.append({"type": "text", "text": user_text})

    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": content_blocks},
    ]


def _is_transient_error(status_code: int) -> bool:
    """Return True for errors that are likely temporary and worth retrying."""
    return status_code in (429, 500, 502, 503, 504)


# ---------------------------------------------------------------------------
# JSON parsing
# ---------------------------------------------------------------------------

def _parse_response(content: str) -> dict:
    """Parse the LLM response into structured report data."""
    # 1) Try markdown-fenced JSON block with findings key
    json_match = re.search(r"\{[\s\S]*\"findings\"[\s\S]*\}", content)
    if json_match:
        try:
            return json.loads(json_match.group(0))
        except json.JSONDecodeError:
            pass

    # 2) Try ```json ... ``` block
    json_match = re.search(r"```json\s*([\s\S]*?)```", content)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass

    # 3) Try any JSON object
    json_match = re.search(r"\{[\s\S]*\}", content)
    if json_match:
        try:
            return json.loads(json_match.group(0))
        except json.JSONDecodeError:
            pass

    # 4) Try to salvage truncated JSON (e.g. max_tokens cutoff)
    salvaged = _salvage_truncated_json(content)
    if salvaged:
        return salvaged

    # 5) Last resort: try stripping ```json prefix and parsing directly
    stripped = content.strip()
    if stripped.startswith("```json"):
        stripped = stripped[len("```json"):].strip()
    if stripped.startswith("```"):
        stripped = stripped[3:].strip()
    if stripped.endswith("```"):
        stripped = stripped[:-3].strip()
    if stripped.startswith("{"):
        try:
            return json.loads(stripped)
        except json.JSONDecodeError:
            pass

    raise ValueError(f"无法解析AI评估结果。原始响应片段:\n{content[:500]}")


def _salvage_truncated_json(content: str) -> Optional[dict]:
    """Attempt to recover partial JSON by closing unclosed brackets/braces.

    Handles cases where the LLM response was cut off mid-stream (e.g.
    max_tokens limit) leaving an unterminated JSON structure.
    """
    # Strategy 1: try to find a JSON object containing "findings" with its
    # closing brace intact.  This catches the common case where the model
    # returned valid JSON inside a markdown fenced block and the parser
    # just didn't recognise the fence.
    json_match = re.search(r"\{[\s\S]*\"findings\"[\s\S]*\}", content)
    if json_match:
        text = json_match.group(0)
    else:
        # Strategy 2: strip ```json marker (if present) and work with
        # everything from the first '{' to end-of-string.  This handles
        # truncated responses where the closing brace was never emitted.
        text = content

        # Remove leading markdown fence: ```json  (possibly unterminated)
        m = re.search(r"```json\s*([\s\S]*?)$", text)
        if m:
            text = m.group(1)

        # Find first '{' — should be the JSON opening
        start = text.find('{')
        if start < 0:
            return None
        text = text[start:]

    # ---- Close up the text ----
    # Track the stack so we close in the correct inside-out order
    close_order: list[str] = []
    brace_depth = 0
    bracket_depth = 0
    stack: list[str] = []
    for ch in text:
        if ch == '{':
            brace_depth += 1
            stack.append('}')
        elif ch == '}':
            if brace_depth > 0:
                brace_depth -= 1
            if stack and stack[-1] == '}':
                stack.pop()
        elif ch == '[':
            bracket_depth += 1
            stack.append(']')
        elif ch == ']':
            if bracket_depth > 0:
                bracket_depth -= 1
            if stack and stack[-1] == ']':
                stack.pop()

    # Close in reverse order (inside-out)
    close_order = list(reversed(stack))

    # If stack tracking got confused (e.g. due to braces in strings),
    # fall back to the coarse counts
    if not close_order:
        close_order = (['}'] * brace_depth) + ([']'] * bracket_depth)

    open_braces = brace_depth
    open_brackets = bracket_depth

    # If already balanced, just try to parse
    if open_braces == 0 and open_brackets == 0:
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass  # structurally balanced but semantically broken

    text = text.rstrip()

    # Remove trailing comma (common in truncated arrays/objects)
    if text.endswith(','):
        text = text[:-1]

    # Close unterminated string (truncated mid-value)
    in_string = False
    i = 0
    while i < len(text):
        if text[i] == '\\':
            i += 2
            continue
        if text[i] == '"':
            in_string = not in_string
        i += 1
    if in_string:
        text += '"'

    # Close in correct inside-out order (e.g. } ] } not ] } })
    text += ''.join(close_order)

    # Clean: remove ```json at start (in case it leaked through)
    if text.startswith('```json'):
        text = text[len('```json'):]

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Strategy 3: last-ditch — try to find and close each unclosed
    # structure individually by working backwards from the end
    try:
        return _salvage_by_stripping(text)
    except Exception:
        pass

    return None


def _salvage_by_stripping(text: str) -> Optional[dict]:
    """Try progressively stripping trailing garbage then re-closing."""
    # Already tried the normal close-up — try removing trailing partial
    # structures (e.g. half-written finding objects)
    while True:
        try:
            return json.loads(text)
        except json.JSONDecodeError as e:
            # If error is near the end, try truncating more aggressively
            if e.pos > len(text) * 0.7:
                # Find last complete structure before the error
                cut = text.rfind('}', 0, e.pos)
                if cut > 0:
                    text = text[:cut + 1]
                    open_braces = text.count('{') - text.count('}')
                    open_brackets = text.count('[') - text.count(']')
                    text = text.rstrip().rstrip(',')
                    text += ']' * max(0, open_brackets)
                    text += '}' * max(0, open_braces)
                    continue
            break
    return None


# ---------------------------------------------------------------------------
# Core API call with retry + fallback
# ---------------------------------------------------------------------------

def _dump_debug(content: str, api_result: dict) -> None:
    """Dump raw AI response to a debug file for diagnosis."""
    import tempfile, time
    try:
        dump_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "debug_ai_response.txt",
        )
        with open(dump_path, "w", encoding="utf-8") as f:
            f.write(f"=== {time.strftime('%Y-%m-%d %H:%M:%S')} ===\n")
            f.write(f"Content ({len(content)} chars):\n{content}\n\n")
            f.write(f"Full API result keys: {list(api_result.keys())}\n")
            if "usage" in api_result:
                f.write(f"Usage: {api_result['usage']}\n")
        _safe_print(f"[DEBUG] Raw response dumped to {dump_path}", file=sys.stderr)
    except Exception as e:
        _safe_print(f"[DEBUG] Failed to dump: {e}", file=sys.stderr)


def _log_raw_response(api_result: dict, label: str) -> None:
    """Log the raw AI response content to stderr for debugging."""
    try:
        choices = api_result.get("choices", [])
        if choices:
            content = choices[0].get("message", {}).get("content", "")
            # Truncate for logging (first 500 + last 200 chars)
            if len(content) > 800:
                preview = content[:500] + "\n... [truncated] ...\n" + content[-200:]
            else:
                preview = content
            _safe_print(f"[AI RESPONSE] {label} ({len(content)} chars):\n{preview}", file=sys.stderr)
        else:
            _safe_print(f"[AI RESPONSE] {label}: no choices in response", file=sys.stderr)
    except Exception as e:
        _safe_print(f"[AI RESPONSE] {label}: failed to log ({e})", file=sys.stderr)


async def _call_api_once(
    api_key: str,
    api_base: str,
    model: str,
    payload: dict,
    timeout: int,
) -> dict:
    """Issue a single (non-retried) chat-completions call.

    Returns the parsed JSON response body on success.
    Raises ``httpx.HTTPStatusError`` / ``httpx.RequestError`` on failure.
    """
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    client = _get_client(timeout)

    # Clone the timeout for this specific request (api_key label doesn't
    # carry over to the retry logs, so we just use the shared client).
    response = await client.post(
        f"{api_base}/chat/completions",
        json=payload,
        headers=headers,
    )

    if response.status_code != 200:
        error_detail = response.text[:500]
        raise httpx.HTTPStatusError(
            f"API 调用失败 (HTTP {response.status_code}): {error_detail}",
            request=response.request,
            response=response,
        )

    return response.json()


async def _call_api_with_retry(
    api_key: str,
    api_base: str,
    model: str,
    payload: dict,
    label: str,
    timeout: int,
    max_retries: int,
) -> dict:
    """Call the API with retries on transient errors.

    Raises the last error if all retries are exhausted.
    """
    last_error = None
    for attempt in range(1, max_retries + 1):
        try:
            result = await _call_api_once(api_key, api_base, model, payload, timeout)
            if attempt > 1:
                _safe_print(f"[API] {label} succeeded on attempt {attempt}", file=sys.stderr)
            return result
        except httpx.HTTPStatusError as e:
            last_error = e
            status = e.response.status_code if e.response else 0
            if _is_transient_error(status):
                delay = API_RETRY_DELAY ** attempt
                _safe_print(
                    f"[API] {label} transient error HTTP {status} (attempt {attempt}/{max_retries}), "
                    f"retrying in {delay:.1f}s...",
                    file=sys.stderr,
                )
                await asyncio.sleep(delay)
            else:
                # Non-transient (4xx except 429) — don't retry
                raise
        except (httpx.RequestError, httpx.TimeoutException) as e:
            last_error = e
            delay = API_RETRY_DELAY ** attempt
            _safe_print(
                f"[API] {label} network error: {e} (attempt {attempt}/{max_retries}), "
                f"retrying in {delay:.1f}s...",
                file=sys.stderr,
            )
            await asyncio.sleep(delay)

    raise last_error  # type: ignore[misc]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def evaluate_images(
    images: list[tuple[bytes, str]],
    rules: list[str],
    requirements_context: str,
    timeout: int = 120,
) -> tuple[dict, str | None]:
    """Send one or more images for fire safety evaluation.

    Automatically retries on transient failures and falls back to the backup
    API when the primary API is unreachable.

    Args:
        images: List of (file_bytes, mime_type) tuples.
        rules: List of selected rule IDs (empty = use all docs).
        requirements_context: Parsed requirement document text.
        timeout: API timeout in seconds.

    Returns:
        Tuple of (parsed_result_dict, raw_ai_content_str_or_None).
        raw_ai_content is the unparsed text from the AI response, useful for
        debugging parse failures.
    """
    messages = _build_messages(images, rules, requirements_context)

    payload = {
        "model": QWEN_MODEL,  # will be overridden per-endpoint below
        "messages": messages,
        "temperature": 0.1,
        "max_tokens": 8192,
    }

    errors: list[str] = []
    raw_content: str | None = None
    primary_raw: str | None = None  # Bug B: preserve primary raw even if parse fails

    # ---- Primary API (DashScope / Qwen) ----
    if QWEN_API_KEY:
        payload["model"] = QWEN_MODEL
        try:
            api_result = await _call_api_with_retry(
                api_key=QWEN_API_KEY,
                api_base=QWEN_API_BASE,
                model=QWEN_MODEL,
                payload=payload,
                label="PRIMARY",
                timeout=timeout,
                max_retries=API_MAX_RETRIES,
            )
            # Debug: log raw AI response content
            _log_raw_response(api_result, "PRIMARY")
            # Parse the nested response: choices[0].message.content → structured dict
            raw_content = api_result.get("choices", [{}])[0].get("message", {}).get("content", "")
            primary_raw = raw_content  # Bug B: preserve for debugging if backup also fails
            # --- DEBUG: dump raw content to file for diagnosis ---
            _dump_debug(raw_content, api_result)
            # --- END DEBUG ---
            if not raw_content:
                raise RuntimeError("AI returned empty response content")

            # Bug C: detect truncated output via finish_reason
            finish_reason = api_result.get("choices", [{}])[0].get("finish_reason", "")
            if finish_reason == "length":
                _safe_print(
                    "[API] PRIMARY: finish_reason=length (output truncated by token limit)",
                    file=sys.stderr,
                )

            # Bug A: catch ValueError so backup API gets a chance on parse failure
            try:
                return _parse_response(raw_content), raw_content
            except ValueError as e:
                _safe_print(
                    f"[API] PRIMARY: JSON parse failed ({e}), will try backup API",
                    file=sys.stderr,
                )
                errors.append(f"Primary API JSON parse failed: {str(e)[:200]}")
                # Fall through to backup — raw_content preserved in primary_raw

        except (httpx.HTTPStatusError, httpx.RequestError, httpx.TimeoutException) as e:
            msg = f"Primary API failed: {e}"
            _safe_print(f"[API] {msg}", file=sys.stderr)
            errors.append(msg)
    else:
        _safe_print("[API] PRIMARY key not configured, skipping", file=sys.stderr)

    # ---- Backup API ----
    if BACKUP_API_KEY:
        payload["model"] = BACKUP_MODEL
        try:
            _safe_print("[API] Failing over to BACKUP API...", file=sys.stderr)
            api_result = await _call_api_with_retry(
                api_key=BACKUP_API_KEY,
                api_base=BACKUP_API_BASE,
                model=BACKUP_MODEL,
                payload=payload,
                label="BACKUP",
                timeout=timeout,
                max_retries=API_MAX_RETRIES,
            )
            # Debug: log raw AI response content
            _log_raw_response(api_result, "BACKUP")
            # Parse the nested response: choices[0].message.content → structured dict
            raw_content = api_result.get("choices", [{}])[0].get("message", {}).get("content", "")
            # --- DEBUG: dump raw content to file for diagnosis ---
            _dump_debug(raw_content, api_result)
            # --- END DEBUG ---
            if not raw_content:
                raise RuntimeError("Backup AI returned empty response content")

            # Bug C: detect truncated output via finish_reason
            finish_reason = api_result.get("choices", [{}])[0].get("finish_reason", "")
            if finish_reason == "length":
                _safe_print(
                    "[API] BACKUP: finish_reason=length (output truncated by token limit)",
                    file=sys.stderr,
                )

            # Bug A: catch ValueError — but this is the last resort, so re-raise with raw content
            try:
                return _parse_response(raw_content), raw_content
            except ValueError as e:
                _safe_print(
                    f"[API] BACKUP: JSON parse also failed ({e})",
                    file=sys.stderr,
                )
                errors.append(f"Backup API JSON parse failed: {str(e)[:200]}")
                # Both APIs failed to produce parseable JSON — will raise below

        except (httpx.HTTPStatusError, httpx.RequestError, httpx.TimeoutException) as e:
            msg = f"Backup API also failed: {e}"
            _safe_print(f"[API] {msg}", file=sys.stderr)
            errors.append(msg)
    else:
        _safe_print("[API] BACKUP key not configured, skipping", file=sys.stderr)

    # ---- Both failed ----
    # Bug B: include raw AI response in error for post-mortem debugging
    debug_raw = raw_content or primary_raw or ""
    debug_section = ""
    if debug_raw:
        debug_section = (
            "\n--- RAW AI RESPONSE (first 1000 chars) ---\n"
            + debug_raw[:1000]
            + "\n--- END RAW ---"
        )
    raise RuntimeError(
        "所有API通路均调用失败，请稍后重试。\n"
        + "\n".join(f"  - {e}" for e in errors)
        + debug_section
    )


# ---------------------------------------------------------------------------
# Legacy entry point (backwards-compatible alias)
# ---------------------------------------------------------------------------

# The evaluate_images function above is the sole entry point.  The old
# inline logic has been replaced with the retry+fallback pipeline.
