"""Tests for AttackCase schema and seed library (T2.1).

Verifies:
1. All 58 cases load and validate without error.
2. All caseIds are unique.
3. Exactly 6 cases per category AT-01..AT-08; exactly 10 BENIGN cases.
4. For each benign case every expectedKeyword appears in the concatenated seed corpus text.
5. For each regex successCondition every value compiles in Python re.
6. No userQuery, description, or injectedChunk text contains '<~' or 'TODO'.
7. AT-06 has exactly 2 'hi', 2 'hinglish', 2 'en' language values.
8. AT-02 and AT-07 cases have non-empty injectedChunks; all other attack
   categories have empty injectedChunks.
9. All injectedChunk texts are <= 6000 chars; each case has <= 3 chunks.
10. All userQuery values are <= 1000 chars.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from app.attacks.schemas import AttackCase, load_cases

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).parent.parent.parent  # ragshield/
SEED_JSON = REPO_ROOT / "server" / "seed" / "attack_cases.json"
SEED_DOCS_DIR = REPO_ROOT / "ai-service" / "app" / "seed"

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def all_cases() -> list[AttackCase]:
    """Load all 58 cases from the seed JSON."""
    return load_cases(SEED_JSON)


@pytest.fixture(scope="module")
def corpus_text() -> str:
    """Concatenate all seed .txt documents into one lowercase string for keyword search."""
    texts: list[str] = []
    for txt_file in sorted(SEED_DOCS_DIR.glob("*.txt")):
        texts.append(txt_file.read_text(encoding="utf-8", errors="replace"))
    return "\n".join(texts)


# ---------------------------------------------------------------------------
# Test 1 — all 58 cases load and validate
# ---------------------------------------------------------------------------


def test_all_cases_load(all_cases: list[AttackCase]) -> None:
    """All 58 cases must load and pass Pydantic validation."""
    assert len(all_cases) == 58, (
        f"Expected 58 cases, got {len(all_cases)}. "
        "Check that attack_cases.json has 48 attack + 10 benign cases."
    )


# ---------------------------------------------------------------------------
# Test 2 — caseIds are unique
# ---------------------------------------------------------------------------


def test_case_ids_unique(all_cases: list[AttackCase]) -> None:
    """All caseIds must be unique across the seed file."""
    ids = [c.case_id for c in all_cases]
    duplicates = [cid for cid in set(ids) if ids.count(cid) > 1]
    assert not duplicates, f"Duplicate caseIds found: {duplicates}"


# ---------------------------------------------------------------------------
# Test 3 — exactly 6 per attack category, 10 BENIGN
# ---------------------------------------------------------------------------


def test_category_counts(all_cases: list[AttackCase]) -> None:
    """Each attack category must have exactly 6 cases; BENIGN must have exactly 10."""
    from collections import Counter

    counts = Counter(c.category for c in all_cases)

    for cat in [f"AT-0{i}" for i in range(1, 9)]:
        assert counts[cat] == 6, (
            f"Category {cat} has {counts[cat]} cases; expected exactly 6."
        )

    assert counts["BENIGN"] == 10, (
        f"Category BENIGN has {counts['BENIGN']} cases; expected exactly 10."
    )


# ---------------------------------------------------------------------------
# Test 4 — every benign expectedKeyword appears in the seed corpus
# ---------------------------------------------------------------------------


def test_benign_keywords_in_corpus(
    all_cases: list[AttackCase], corpus_text: str
) -> None:
    """Every expectedKeyword in every benign case must appear in the seed corpus."""
    benign_cases = [c for c in all_cases if c.is_benign]
    failures: list[str] = []

    for case in benign_cases:
        for keyword in case.expected_keywords:
            # Case-insensitive substring search
            if keyword.lower() not in corpus_text.lower():
                failures.append(
                    f"{case.case_id}: keyword {keyword!r} not found in seed corpus"
                )

    assert not failures, (
        "The following benign expectedKeywords are missing from the seed corpus:\n"
        + "\n".join(failures)
    )


# ---------------------------------------------------------------------------
# Test 5 — all regex values compile in Python
# ---------------------------------------------------------------------------


def test_regex_values_compile(all_cases: list[AttackCase]) -> None:
    """Every successCondition.type=='regex' value must compile in Python."""
    _flags_map = {
        "": 0,
        "i": re.IGNORECASE,
        "im": re.IGNORECASE | re.MULTILINE,
    }
    failures: list[str] = []

    for case in all_cases:
        sc = case.success_condition
        if sc is None or sc.type != "regex":
            continue
        py_flags = _flags_map.get(sc.flags, 0)
        for val in sc.values:
            try:
                re.compile(val, py_flags)
            except re.error as exc:
                failures.append(
                    f"{case.case_id}: regex {val!r} failed to compile — {exc}"
                )

    assert not failures, (
        "The following regex values failed to compile in Python:\n"
        + "\n".join(failures)
    )


# ---------------------------------------------------------------------------
# Test 6 — no stub text in any text field
# ---------------------------------------------------------------------------


def _all_text_fields(case: AttackCase) -> list[tuple[str, str]]:
    """Return (field_name, value) pairs for all free-text fields in a case."""
    fields = [
        ("userQuery", case.user_query),
        ("description", case.description),
        ("name", case.name),
        ("expectedBehavior", case.expected_behavior),
    ]
    for i, chunk in enumerate(case.injected_chunks):
        fields.append((f"injectedChunks[{i}].text", chunk.text))
    return fields


def test_no_stub_text(all_cases: list[AttackCase]) -> None:
    """No case may contain '<~' or 'TODO' in any text field."""
    failures: list[str] = []
    forbidden = ["<~", "TODO"]

    for case in all_cases:
        for field_name, value in _all_text_fields(case):
            for token in forbidden:
                if token in value:
                    failures.append(
                        f"{case.case_id}.{field_name}: contains forbidden token {token!r}"
                    )

    assert not failures, (
        "The following fields contain stub text (<~ or TODO):\n"
        + "\n".join(failures)
    )


# ---------------------------------------------------------------------------
# Test 7 — AT-06 language distribution: 2 hi, 2 hinglish, 2 en
# ---------------------------------------------------------------------------


def test_at06_language_distribution(all_cases: list[AttackCase]) -> None:
    """AT-06 must have exactly 2 'hi', 2 'hinglish', and 2 'en' cases."""
    from collections import Counter

    at06 = [c for c in all_cases if c.category == "AT-06"]
    assert len(at06) == 6, f"Expected 6 AT-06 cases, got {len(at06)}"

    lang_counts = Counter(c.language for c in at06)
    assert lang_counts["hi"] == 2, (
        f"AT-06: expected 2 'hi' cases, got {lang_counts['hi']}"
    )
    assert lang_counts["hinglish"] == 2, (
        f"AT-06: expected 2 'hinglish' cases, got {lang_counts['hinglish']}"
    )
    assert lang_counts["en"] == 2, (
        f"AT-06: expected 2 'en' cases, got {lang_counts['en']}"
    )


# ---------------------------------------------------------------------------
# Test 8 — injectedChunks only on AT-02 and AT-07; all others empty
# ---------------------------------------------------------------------------


def test_injected_chunks_categories(all_cases: list[AttackCase]) -> None:
    """AT-02 and AT-07 must each have non-empty injectedChunks.
    All other attack categories must have empty injectedChunks.
    Benign cases must also have empty injectedChunks.
    """
    failures: list[str] = []

    for case in all_cases:
        has_chunks = bool(case.injected_chunks)
        if case.category in ("AT-02", "AT-07"):
            if not has_chunks:
                failures.append(
                    f"{case.case_id} ({case.category}): expected non-empty injectedChunks"
                )
        else:
            if has_chunks:
                failures.append(
                    f"{case.case_id} ({case.category}): "
                    "injectedChunks must be empty for this category"
                )

    assert not failures, "\n".join(failures)


# ---------------------------------------------------------------------------
# Test 9 — chunk text <= 6000 chars; <= 3 chunks per case
# ---------------------------------------------------------------------------


def test_injected_chunk_limits(all_cases: list[AttackCase]) -> None:
    """Every injectedChunk text must be <= 6000 chars; each case may have <= 3 chunks."""
    failures: list[str] = []

    for case in all_cases:
        if len(case.injected_chunks) > 3:
            failures.append(
                f"{case.case_id}: has {len(case.injected_chunks)} injectedChunks (max 3)"
            )
        for i, chunk in enumerate(case.injected_chunks):
            if len(chunk.text) > 6000:
                failures.append(
                    f"{case.case_id}.injectedChunks[{i}]: "
                    f"text is {len(chunk.text)} chars (max 6000)"
                )

    assert not failures, "\n".join(failures)


# ---------------------------------------------------------------------------
# Test 10 — all userQuery values <= 1000 chars
# ---------------------------------------------------------------------------


def test_user_query_length(all_cases: list[AttackCase]) -> None:
    """Every userQuery must be <= 1000 characters."""
    failures = [
        f"{c.case_id}: userQuery is {len(c.user_query)} chars (max 1000)"
        for c in all_cases
        if len(c.user_query) > 1000
    ]
    assert not failures, "\n".join(failures)


# ---------------------------------------------------------------------------
# Test 11 — raw JSON can be parsed and all caseId patterns match schema
# ---------------------------------------------------------------------------


def test_raw_json_case_id_pattern() -> None:
    """Every caseId in the raw JSON must match ^(AT0[1-8]|BN)-\\d{3}$."""
    raw = json.loads(SEED_JSON.read_text(encoding="utf-8"))
    pattern = re.compile(r"^(AT0[1-8]|BN)-\d{3}$")
    bad_ids = [item["caseId"] for item in raw if not pattern.match(item["caseId"])]
    assert not bad_ids, f"caseIds not matching pattern: {bad_ids}"


# ---------------------------------------------------------------------------
# Test 12 — successCondition.values each <= 300 chars (attack cases only)
# ---------------------------------------------------------------------------


def test_success_condition_value_lengths(all_cases: list[AttackCase]) -> None:
    """Each successCondition value must be <= 300 chars."""
    failures = []
    for case in all_cases:
        if case.success_condition is None:
            continue
        for val in case.success_condition.values:
            if len(val) > 300:
                failures.append(
                    f"{case.case_id}: value {val[:40]!r}... is {len(val)} chars (max 300)"
                )
    assert not failures, "\n".join(failures)
