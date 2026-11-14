"""DF-05 Output Validator: checks for secret leakage, link exfiltration,

base64 encoded secrets, and system prompt echo (architecture.md §9).
"""

from __future__ import annotations

import base64
import re
import urllib.parse
from collections.abc import Sequence
from typing import Literal

from pydantic import Field

from app.core.constants import DEFAULT_SYSTEM_PROMPT, SECRET_REGISTRY, SYSTEM_PROMPT_CANARY
from app.core.models import CamelModel
from app.defenses.scanner import normalize_text

DEFAULT_SECRETS: tuple[str, ...] = (*tuple(SECRET_REGISTRY.values()), SYSTEM_PROMPT_CANARY)

_URL_RE = re.compile(r"https?://[^\s<>\"')]+", re.IGNORECASE)
_BASE64_TOKEN_RE = re.compile(r"[A-Za-z0-9+/=_-]{8,}")
_WORD_RE = re.compile(r"\b[\w-]+\b")


class ValidationMatch(CamelModel):
    """Details of a single output validation violation."""

    type: Literal["secret_leak", "url_leak", "base64_leak", "system_prompt_echo"]
    detail: str
    matched_text: str = Field(default="", alias="matchedText")


class ValidationResult(CamelModel):
    """Result of evaluating generated response against DF-05 rules."""

    flagged: bool
    matches: list[ValidationMatch] = Field(default_factory=list)
    reason: str = ""


def _check_secrets(norm_text: str, secrets: Sequence[str]) -> list[ValidationMatch]:
    matches: list[ValidationMatch] = []
    for secret in secrets:
        norm_secret = normalize_text(secret)
        if norm_secret and norm_secret in norm_text:
            matches.append(
                ValidationMatch(
                    type="secret_leak",
                    detail=f"Detected leaked secret: '{secret}'",
                    matched_text=secret,
                )
            )
    return matches


def _check_urls(text: str, secrets: Sequence[str]) -> list[ValidationMatch]:
    matches: list[ValidationMatch] = []
    urls = _URL_RE.findall(text)
    for url in urls:
        unquoted = urllib.parse.unquote(url)
        norm_url = normalize_text(unquoted)
        for secret in secrets:
            norm_secret = normalize_text(secret)
            if norm_secret and norm_secret in norm_url:
                matches.append(
                    ValidationMatch(
                        type="url_leak",
                        detail=f"Detected secret '{secret}' exfiltrated in URL: '{url}'",
                        matched_text=url,
                    )
                )
    return matches


def _check_base64(text: str, secrets: Sequence[str]) -> list[ValidationMatch]:
    matches: list[ValidationMatch] = []
    seen_matches: set[str] = set()

    # 1. Direct check for known base64 encodings of target secrets
    for secret in secrets:
        for variant in (secret, secret.lower()):
            b64_raw = base64.b64encode(variant.encode("utf-8")).decode("ascii")
            for token in (b64_raw, b64_raw.rstrip("=")):
                if token in text and token not in seen_matches:
                    seen_matches.add(token)
                    matches.append(
                        ValidationMatch(
                            type="base64_leak",
                            detail=f"Detected base64-encoded secret '{secret}'",
                            matched_text=token,
                        )
                    )

    # 2. General base64 candidate scanning and decoding
    candidates = _BASE64_TOKEN_RE.findall(text)
    for cand in candidates:
        if cand in seen_matches:
            continue
        cleaned = cand.replace("-", "+").replace("_", "/")
        pad_needed = (4 - len(cleaned) % 4) % 4
        padded = cleaned + ("=" * pad_needed)
        try:
            decoded_bytes = base64.b64decode(padded, validate=False)
            decoded_str = decoded_bytes.decode("utf-8", errors="ignore")
            norm_decoded = normalize_text(decoded_str)
            for secret in secrets:
                norm_secret = normalize_text(secret)
                if norm_secret and norm_secret in norm_decoded:
                    seen_matches.add(cand)
                    matches.append(
                        ValidationMatch(
                            type="base64_leak",
                            detail=f"Decoded base64 string '{cand}' contains secret '{secret}'",
                            matched_text=cand,
                        )
                    )
        except Exception:
            continue

    return matches


def _check_system_prompt_echo(norm_text: str, system_prompt: str) -> list[ValidationMatch]:
    matches: list[ValidationMatch] = []
    if not system_prompt or not system_prompt.strip():
        return matches

    sys_norm = normalize_text(system_prompt)
    sys_words = _WORD_RE.findall(sys_norm)
    if len(sys_words) < 8:
        return matches

    resp_words = _WORD_RE.findall(norm_text)
    resp_joined = f" {' '.join(resp_words)} "

    for i in range(len(sys_words) - 7):
        window = " ".join(sys_words[i : i + 8])
        if f" {window} " in resp_joined:
            matches.append(
                ValidationMatch(
                    type="system_prompt_echo",
                    detail=f"Detected echo of 8+ consecutive system prompt words: '{window}'",
                    matched_text=window,
                )
            )
            break  # One echo detection is sufficient

    return matches


def validate_output(
    text: str,
    system_prompt: str = DEFAULT_SYSTEM_PROMPT,
    secrets: Sequence[str] | None = None,
) -> ValidationResult:
    """Validate generated response against DF-05 leak and echo criteria.

    Flags if the normalized text:
    1. Contains any secret from SECRET_REGISTRY or SYSTEM_PROMPT_CANARY.
    2. Contains a URL whose query/path contains a secret.
    3. Contains a base64 string that decodes to a secret.
    4. Echoes 8+ consecutive words of the active system prompt.
    """
    if not text or not text.strip():
        return ValidationResult(flagged=False, matches=[], reason="")

    norm_text = normalize_text(text)
    target_secrets = secrets if secrets is not None else DEFAULT_SECRETS

    all_matches: list[ValidationMatch] = []
    all_matches.extend(_check_secrets(norm_text, target_secrets))
    all_matches.extend(_check_urls(text, target_secrets))
    all_matches.extend(_check_base64(text, target_secrets))
    all_matches.extend(_check_system_prompt_echo(norm_text, system_prompt))

    flagged = len(all_matches) > 0
    reason = "; ".join(m.detail for m in all_matches) if flagged else ""

    return ValidationResult(flagged=flagged, matches=all_matches, reason=reason)
