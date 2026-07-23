"""Qwen API integration — evaluates images against fire safety requirements."""
import json
import re
import base64
import httpx
from .config import QWEN_API_KEY, QWEN_API_BASE, QWEN_MODEL
from .prompts import SYSTEM_PROMPT, build_user_prompt


def _encode_image_to_base64(file_bytes: bytes, mime_type: str) -> str:
    """Encode image bytes to a base64 data URL."""
    encoded = base64.b64encode(file_bytes).decode("utf-8")
    return f"data:{mime_type};base64,{encoded}"


def _build_messages(
    images: list[tuple[bytes, str]],
    rules: list[str],
    requirements_context: str,
) -> list[dict]:
    """Build the message payload for the Qwen vision API.

    Supports multiple images — each image becomes an image_url content block,
    followed by the text prompt at the end.
    """
    user_text = build_user_prompt(rules, requirements_context)

    # Build content blocks: [img1, img2, ..., imgN, text]
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


def _parse_response(content: str) -> dict:
    """Parse the Qwen response into structured report data."""
    # Try to extract JSON from the response (may be wrapped in markdown)
    json_match = re.search(r"\{[\s\S]*\"findings\"[\s\S]*\}", content)
    if json_match:
        try:
            return json.loads(json_match.group(0))
        except json.JSONDecodeError:
            pass

    # Broader match: try any JSON block
    json_match = re.search(r"```json\s*([\s\S]*?)```", content)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass

    # Last resort: look for any JSON object
    json_match = re.search(r"\{[\s\S]*\}", content)
    if json_match:
        try:
            return json.loads(json_match.group(0))
        except json.JSONDecodeError:
            pass

    raise ValueError(f"无法解析AI评估结果。原始响应片段:\n{content[:500]}")


async def evaluate_images(
    images: list[tuple[bytes, str]],
    rules: list[str],
    requirements_context: str,
    timeout: int = 120,
) -> dict:
    """Send one or more images to Qwen for fire safety evaluation.

    Args:
        images: List of (file_bytes, mime_type) tuples
        rules: List of selected rule IDs (empty = use all docs)
        requirements_context: Parsed requirement document text
        timeout: API timeout in seconds

    Returns:
        Parsed evaluation result dict with stats and findings
    """
    messages = _build_messages(images, rules, requirements_context)

    payload = {
        "model": QWEN_MODEL,
        "messages": messages,
        "temperature": 0.1,
        "max_tokens": 4096,
    }

    headers = {
        "Authorization": f"Bearer {QWEN_API_KEY}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=timeout, trust_env=False) as client:
        response = await client.post(
            f"{QWEN_API_BASE}/chat/completions",
            json=payload,
            headers=headers,
        )

        if response.status_code != 200:
            error_detail = response.text[:500]
            raise RuntimeError(
                f"Qwen API 调用失败 (HTTP {response.status_code}): {error_detail}"
            )

        result = response.json()

    # Extract the assistant's message
    choices = result.get("choices", [])
    if not choices:
        raise RuntimeError("Qwen API 返回结果为空")

    content = choices[0].get("message", {}).get("content", "")
    if not content:
        raise RuntimeError("Qwen API 返回内容为空")

    return _parse_response(content)
