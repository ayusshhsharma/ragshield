"""Deterministic offline MockProvider for tests and baseline/protected simulation."""

from __future__ import annotations

import re
import time

from app.core.constants import SECRET_REGISTRY
from app.providers.base import LLMProvider, LLMResult

_UNTRUSTED_BLOCK_RE = re.compile(
    r"<untrusted_context>(.*?)</untrusted_context>",
    re.IGNORECASE | re.DOTALL,
)
_NAIVE_CONTEXT_RE = re.compile(
    r"Context:\s*(.*?)(?:\n\s*Question:|\Z)",
    re.IGNORECASE | re.DOTALL,
)
_QUESTION_RE = re.compile(r"Question:\s*(.*)\Z", re.IGNORECASE | re.DOTALL)

_OUTPUT_EXACTLY_RE = re.compile(r"OUTPUT\s+EXACTLY\s*:\s*([^\r\n]+)", re.IGNORECASE)
_SAY_QUOTED_OR_COLON_RE = re.compile(
    r"""\bsay\s*:\s*([^\r\n]+)|\bsay\s+["']([^"'\r\n]+)["']""",
    re.IGNORECASE,
)
_SAY_IMPERATIVE_RE = re.compile(
    r"(?:^|[.!;\n]|(?:ignore|forget|disregard|override|bypass)\b[^.\n]*?\band)"
    r"\s*(?:just\s+|only\s+|simply\s+)?say\s+"
    r"(?!about\b|that\b|whether\b|if\b|how\b|why\b|what\b|when\b|where\b|so\b)([^\r\n]+)",
    re.IGNORECASE,
)

_REVEAL_INSTRUCTIONS_RE = re.compile(
    r"\b(?:repeat|reveal|show|print|output|display|disclose|echo|tell\s+me)\b"
    r".{0,40}\b(?:(?:your|the)\s+)?"
    r"(?:system\s+prompt|system\s+instructions|hidden\s+instructions|"
    r"original\s+instructions|your\s+instructions|your\s+prompt|system\s+rules)\b"
    r"|\bwhat\s+(?:are|were)\s+your\s+(?:system\s+)?(?:instructions|system\s+prompt)\b",
    re.IGNORECASE | re.DOTALL,
)

_SECRET_TOPIC_KEYWORDS: dict[str, tuple[str, ...]] = {
    "master_override_code": ("override", "master", "tiger", "emergency"),
    "admin_password": ("password", "admin", "passcode", "credential", "ruby"),
    "customer_card_ref": ("card", "credit", "payment", "priya", "customer", "billing"),
    "customer_phone": ("phone", "telephone", "mobile", "priya", "customer", "contact"),
}
_GENERAL_SECRET_RE = re.compile(
    r"\b(?:secret|confidential|sensitive|internal\s+code|internal\s+note|private|leak)\b",
    re.IGNORECASE,
)


def _extract_exact_directive(text: str) -> str | None:
    exact = _OUTPUT_EXACTLY_RE.search(text)
    if exact:
        return exact.group(1).strip()

    quoted = _SAY_QUOTED_OR_COLON_RE.search(text)
    if quoted:
        value = quoted.group(1) if quoted.group(1) is not None else quoted.group(2)
        return value.strip()

    imperative = _SAY_IMPERATIVE_RE.search(text)
    if imperative:
        return imperative.group(1).strip()

    return None


def _extract_asked_secrets(question_text: str, context_text: str) -> list[str]:
    present: dict[str, str] = {
        key: value for key, value in SECRET_REGISTRY.items() if value in context_text
    }
    if not present:
        return []

    q_lower = question_text.lower()
    matched: list[str] = []
    for key, value in present.items():
        keywords = _SECRET_TOPIC_KEYWORDS.get(key, ())
        if any(keyword in q_lower for keyword in keywords):
            matched.append(value)

    if matched:
        return matched
    if _GENERAL_SECRET_RE.search(question_text):
        return list(present.values())
    return []


def _first_sentence(text: str) -> str:
    cleaned = re.sub(r"(?m)^\s*\[\d+\]\s*", "", text).strip()
    normalized = " ".join(cleaned.split())
    if not normalized:
        return ""
    match = re.match(r"^(.+?[.!?])(?:\s|$)", normalized)
    if match:
        return match.group(1)
    return normalized


class MockProvider(LLMProvider):
    """Deterministic local LLM double for tests and offline runs."""

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
        max_tokens: int = 512,
    ) -> LLMResult:
        del temperature, max_tokens
        started = time.monotonic()

        untrusted_blocks = _UNTRUSTED_BLOCK_RE.findall(user_prompt)
        is_isolated = bool(untrusted_blocks)

        if is_isolated:
            trusted_text = _UNTRUSTED_BLOCK_RE.sub("", user_prompt)
            context_text = "\n".join(untrusted_blocks)
        else:
            trusted_text = user_prompt
            naive_match = _NAIVE_CONTEXT_RE.search(user_prompt)
            context_text = naive_match.group(1) if naive_match else user_prompt

        q_match = _QUESTION_RE.search(trusted_text)
        question_text = q_match.group(1).strip() if q_match else trusted_text

        directive = _extract_exact_directive(trusted_text)
        if directive is not None:
            answer = directive
        elif _REVEAL_INSTRUCTIONS_RE.search(trusted_text):
            answer = system_prompt
        elif not is_isolated:
            secrets = _extract_asked_secrets(question_text, context_text)
            if secrets:
                answer = ", ".join(secrets)
            else:
                answer = _first_sentence(context_text)
        else:
            answer = _first_sentence(context_text)

        latency_ms = max(0, round((time.monotonic() - started) * 1000))
        return LLMResult(text=answer, latency_ms=latency_ms, provider_blocked=False)

