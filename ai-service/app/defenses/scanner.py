"""Pure heuristic text scanner for input and document defense (architecture.md §9)."""

from __future__ import annotations

import re
import unicodedata

from pydantic import Field

from app.core.models import CamelModel
from app.defenses.patterns import PATTERNS, ScannerPattern

# Strip invisible and zero-width evasion characters
_ZERO_WIDTH_RE = re.compile(r"[\u200b-\u200f\u2060-\u2064\ufeff\u00ad]")
_WHITESPACE_RE = re.compile(r"\s+")


class PatternMatch(CamelModel):
    """Details of a single matched heuristic pattern."""

    id: str
    group: str
    weight: float
    description: str
    matched_text: str = Field(alias="matchedText")


class ScanResult(CamelModel):
    """Result of scanning text against heuristic injection patterns."""

    score: float
    flagged: bool
    matches: list[PatternMatch] = Field(default_factory=list)
    normalized_text: str = Field(default="", alias="normalizedText")


def normalize_text(text: str) -> str:
    """Normalize text with Unicode NFKC, strip zero-width chars, and collapse whitespace."""
    if not text:
        return ""
    nfkc = unicodedata.normalize("NFKC", text)
    stripped = _ZERO_WIDTH_RE.sub("", nfkc)
    collapsed = _WHITESPACE_RE.sub(" ", stripped).strip()
    return collapsed.lower()


def scan_text(
    text: str,
    threshold: float = 0.5,
    *,
    custom_patterns: tuple[ScannerPattern, ...] | None = None,
) -> ScanResult:
    """Pure heuristic scanner evaluating text against weighted detection rules.

    Normalizes text (NFKC, zero-width strip, lowercase, whitespace collapse).
    Computes score = min(1.0, sum of distinct matched pattern weights).
    Returns flagged = score >= threshold.
    """
    if not text or not text.strip():
        return ScanResult(score=0.0, flagged=False, matches=[], normalized_text="")

    normalized = normalize_text(text)
    patterns = custom_patterns if custom_patterns is not None else PATTERNS

    matches: list[PatternMatch] = []
    total_weight = 0.0

    for rule in patterns:
        match = rule.regex.search(normalized)
        if match:
            matches.append(
                PatternMatch(
                    id=rule.id,
                    group=rule.group,
                    weight=rule.weight,
                    description=rule.description,
                    matched_text=match.group(0),
                )
            )
            total_weight += rule.weight

    score = min(1.0, round(total_weight, 2))
    flagged = score >= threshold

    return ScanResult(
        score=score,
        flagged=flagged,
        matches=matches,
        normalized_text=normalized,
    )
