"""Unit and integration tests for CLI suite runner (T2.5)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from scripts.run_suite import (
    build_argument_parser,
    format_metrics_table,
    main_async,
    parse_categories_arg,
    parse_defense_config,
)


def test_build_argument_parser_defaults():
    parser = build_argument_parser()
    args = parser.parse_args([])
    assert args.mode == "baseline"
    assert args.repeats == 1
    assert args.provider == "mock"
    assert args.categories is None
    assert args.defenses is None
    assert args.ablation is False
    assert args.out == "results.json"


def test_build_argument_parser_custom_flags():
    parser = build_argument_parser()
    args = parser.parse_args([
        "--mode",
        "protected",
        "--repeats",
        "2",
        "--provider",
        "gemini",
        "--categories",
        "AT-01",
        "AT-02,AT-03",
        "--defenses",
        "di,iso",
        "--ablation",
        "--out",
        "custom_out.json",
    ])
    assert args.mode == "protected"
    assert args.repeats == 2
    assert args.provider == "gemini"
    assert args.categories == ["AT-01", "AT-02,AT-03"]
    assert args.defenses == "di,iso"
    assert args.ablation is True
    assert args.out == "custom_out.json"


def test_parse_categories_arg():
    assert parse_categories_arg(None) is None
    assert parse_categories_arg([]) is None
    assert parse_categories_arg(["at-01"]) == ["AT-01"]
    assert parse_categories_arg(["AT-01,AT-02", "AT-03", "at-01"]) == ["AT-01", "AT-02", "AT-03"]


def test_parse_defense_config_baseline():
    cfg = parse_defense_config("baseline", defenses_flag="di,ds,iso,ov")
    assert not cfg.input_scanner.enabled
    assert not cfg.document_scanner.enabled
    assert not cfg.instruction_isolation.enabled
    assert not cfg.output_validator.enabled


def test_parse_defense_config_protected_default():
    cfg = parse_defense_config("protected", defenses_flag=None)
    assert cfg.input_scanner.enabled
    assert cfg.document_scanner.enabled
    assert cfg.instruction_isolation.enabled
    assert cfg.output_validator.enabled


def test_parse_defense_config_protected_subset():
    cfg = parse_defense_config("protected", defenses_flag="di,iso")
    assert cfg.input_scanner.enabled
    assert not cfg.document_scanner.enabled
    assert cfg.instruction_isolation.enabled
    assert not cfg.output_validator.enabled


def test_format_metrics_table(tmp_path: Path):
    from app.attacks.schemas import CaseResult
    from app.evaluation.metrics import aggregate

    sample_result = CaseResult(
        case_id="AT01-001",
        category="AT-01",
        is_benign=False,
        repeat_index=1,
        outcome="attack_succeeded",
        response="test",
        retrieved_chunks=[],
        defenses_triggered=[],
        blocked=False,
        latency_ms=50,
        defense_latency_ms=0,
    )
    metrics = aggregate([sample_result], defenses_enabled=False)
    table_str = format_metrics_table(
        metrics,
        mode="baseline",
        provider="mock",
        repeats=1,
        duration_s=0.15,
        interrupted=False,
    )
    assert "RAGShield Evaluation Report" in table_str
    assert "BASELINE" in table_str
    assert "Attack Success Rate (ASR)" in table_str
    assert "100.00%" in table_str
    assert "AT-01" in table_str


@pytest.mark.asyncio
async def test_suite_runner_execution_baseline_mock(tmp_path: Path):
    """Integration test running a single category with MockProvider."""
    out_file = tmp_path / "test_out.json"
    parser = build_argument_parser()
    args = parser.parse_args([
        "--mode",
        "baseline",
        "--repeats",
        "1",
        "--provider",
        "mock",
        "--categories",
        "AT-01",
        "--out",
        str(out_file),
    ])

    exit_code = await main_async(args)
    assert exit_code == 0
    assert out_file.exists()

    with out_file.open(encoding="utf-8") as f:
        data = json.load(f)

    assert data["mode"] == "baseline"
    assert data["provider"] == "mock"
    assert data["repeats"] == 1
    assert data["metrics"]["totals"]["attackRuns"] == 6
    assert data["metrics"]["totals"]["eligibleAttackRuns"] == 6
    assert data["metrics"]["totals"]["errors"] == 0
    assert len(data["results"]) == 6
    assert any(r["outcome"] == "attack_succeeded" for r in data["results"])
    assert all(r["category"] == "AT-01" for r in data["results"])
