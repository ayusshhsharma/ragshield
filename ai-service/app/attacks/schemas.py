"""Pydantic AttackCase schema and seed loader.

Mirrors the Zod schema on the Express server (server/validators/attackCase.js).
All field names are camelCase in JSON (alias_generator=to_camel).

Validation rules (identical to database.md §3):
- caseId  : ^(AT0[1-8]|BN)-\\d{3}$  (predefined)
- category: AT-01..AT-08 or BENIGN
- technique: 13 allowed values
- severity: low|medium|high|critical
- language: en|hi|hinglish
- Attack case  : successCondition required, values non-empty, regex values compile,
                 each value <= 300 chars; expectedKeywords must be []
- Benign case  : successCondition null; expectedKeywords non-empty; category BENIGN
- injectedChunks: only AT-02, AT-07, custom; text <= 6000 chars; <= 3 chunks
- userQuery    : <= 1000 chars
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator
from pydantic.alias_generators import to_camel

# ---------------------------------------------------------------------------
# Allowed literal sets
# ---------------------------------------------------------------------------
CATEGORIES = Literal[
    "AT-01", "AT-02", "AT-03", "AT-04",
    "AT-05", "AT-06", "AT-07", "AT-08", "BENIGN",
]

TECHNIQUES = Literal[
    "direct_request",
    "ignore_previous",
    "roleplay",
    "authority_claim",
    "delimiter_spoof",
    "hidden_comment",
    "buried_in_long_text",
    "translation",
    "transliteration",
    "encoding",
    "format_trick",
    "link_exfil",
    "multi_step",
]

SEVERITIES = Literal["low", "medium", "high", "critical"]
LANGUAGES = Literal["en", "hi", "hinglish"]
SOURCES = Literal["predefined", "custom"]
SC_TYPES = Literal["contains_any", "regex"]

# Categories that may carry injectedChunks
_INJECTABLE_CATEGORIES = {"AT-02", "AT-07"}


# ---------------------------------------------------------------------------
# Sub-models
# ---------------------------------------------------------------------------
class CamelModel(BaseModel):
    model_config = {
        "alias_generator": to_camel,
        "populate_by_name": True,
    }


class SuccessCondition(CamelModel):
    type: SC_TYPES
    values: list[str] = Field(min_length=1)
    flags: str = ""

    @field_validator("flags")
    @classmethod
    def _valid_flags(cls, v: str) -> str:
        allowed = {"", "i", "im"}
        if v not in allowed:
            raise ValueError(f"flags must be one of {allowed!r}, got {v!r}")
        return v

    @field_validator("values")
    @classmethod
    def _values_len(cls, v: list[str]) -> list[str]:
        for val in v:
            if len(val) > 300:
                raise ValueError(
                    f"successCondition value exceeds 300 chars: {val[:60]!r}..."
                )
        return v


class InjectedChunkSpec(CamelModel):
    text: str
    position: Literal["first", "middle", "last"]

    @field_validator("text")
    @classmethod
    def _text_len(cls, v: str) -> str:
        if len(v) > 6000:
            raise ValueError("injectedChunk text exceeds 6000 chars")
        return v


# ---------------------------------------------------------------------------
# Main model
# ---------------------------------------------------------------------------
class AttackCase(CamelModel):
    case_id: str = Field(alias="caseId")
    category: CATEGORIES
    name: str
    technique: TECHNIQUES
    severity: SEVERITIES
    language: LANGUAGES
    description: str
    user_query: str = Field(alias="userQuery")
    injected_chunks: list[InjectedChunkSpec] = Field(
        default_factory=list, alias="injectedChunks"
    )
    expected_behavior: str = Field(alias="expectedBehavior")
    success_condition: SuccessCondition | None = Field(
        default=None, alias="successCondition"
    )
    is_benign: bool = Field(alias="isBenign")
    expected_keywords: list[str] = Field(
        default_factory=list, alias="expectedKeywords"
    )
    owasp_ref: str = Field(default="", alias="owaspRef")
    source: SOURCES = "predefined"

    # ------------------------------------------------------------------
    # Field-level validators
    # ------------------------------------------------------------------
    @field_validator("case_id", mode="before")
    @classmethod
    def _valid_case_id(cls, v: str) -> str:
        if not re.fullmatch(r"(AT0[1-8]|BN)-\d{3}", v):
            raise ValueError(
                f"caseId must match ^(AT0[1-8]|BN)-\\d{{3}}$ (predefined), got {v!r}"
            )
        return v

    @field_validator("user_query", mode="before")
    @classmethod
    def _query_len(cls, v: str) -> str:
        if len(v) > 1000:
            raise ValueError(
                f"userQuery must be <= 1000 chars, got {len(v)}"
            )
        return v

    @field_validator("injected_chunks", mode="before")
    @classmethod
    def _chunks_count(cls, v: list) -> list:
        if len(v) > 3:
            raise ValueError("At most 3 injectedChunks allowed per case")
        return v

    # ------------------------------------------------------------------
    # Cross-field validators
    # ------------------------------------------------------------------
    @model_validator(mode="after")
    def _cross_validate(self) -> AttackCase:
        # 1. injectedChunks only allowed for AT-02, AT-07, custom
        if (
            self.injected_chunks
            and self.category not in _INJECTABLE_CATEGORIES
            and self.source != "custom"
        ):
            raise ValueError(
                f"injectedChunks not allowed for category {self.category!r}"
            )

        if not self.is_benign:
            # 2. Attack case: successCondition required
            if self.success_condition is None:
                raise ValueError(
                    "Attack case must have successCondition (isBenign=false)"
                )
            # 3. Attack case: expectedKeywords must be empty
            if self.expected_keywords:
                raise ValueError(
                    "Attack case must have empty expectedKeywords (isBenign=false)"
                )
            # 4. Regex values must compile in Python
            if self.success_condition.type == "regex":
                flags_map = {
                    "": 0,
                    "i": re.IGNORECASE,
                    "im": re.IGNORECASE | re.MULTILINE,
                }
                py_flags = flags_map.get(self.success_condition.flags, 0)
                for val in self.success_condition.values:
                    try:
                        re.compile(val, py_flags)
                    except re.error as exc:
                        raise ValueError(
                            f"successCondition value is not a valid regex: {val!r} — {exc}"
                        ) from exc
        else:
            # 5. Benign case: successCondition must be null
            if self.success_condition is not None:
                raise ValueError(
                    "Benign case must have successCondition=null (isBenign=true)"
                )
            # 6. Benign case: expectedKeywords must be non-empty
            if not self.expected_keywords:
                raise ValueError(
                    "Benign case must have non-empty expectedKeywords (isBenign=true)"
                )
            # 7. Benign case: category must be BENIGN
            if self.category != "BENIGN":
                raise ValueError(
                    "Benign case (isBenign=true) must have category='BENIGN'"
                )

        return self


# ---------------------------------------------------------------------------
# Loader
# ---------------------------------------------------------------------------
def load_cases(path: str | Path) -> list[AttackCase]:
    """Load and validate all attack/benign cases from a JSON file.

    Args:
        path: Path to the JSON file (array of AttackCase objects).

    Returns:
        A list of validated AttackCase instances.

    Raises:
        FileNotFoundError: If the file does not exist.
        ValueError: If any case fails validation.
        json.JSONDecodeError: If the file is not valid JSON.
    """
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return [AttackCase.model_validate(item) for item in data]
