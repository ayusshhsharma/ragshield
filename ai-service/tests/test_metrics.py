"""Unit and integration tests for metrics aggregation (PRD §8, architecture.md §11)."""

from __future__ import annotations

import json
import math
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.attacks.schemas import CaseResult
from app.evaluation.metrics import aggregate

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "metrics_fixture.json"


@pytest.fixture
def metrics_fixture() -> dict:
    with FIXTURE_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def test_aggregate_matches_hand_computed_fixture(metrics_fixture: dict):
    results = metrics_fixture["results"]
    expected = metrics_fixture["expectedMetrics"]

    metrics = aggregate(results, defenses_enabled=True)
    metrics_dump = metrics.model_dump(by_alias=True)

    # Compare totals
    assert metrics_dump["totals"] == expected["totals"]

    # Compare outcomes
    assert metrics_dump["outcomes"] == expected["outcomes"]

    # Compare ASR
    assert metrics_dump["asr"] == expected["asr"]

    # Compare main rates
    assert metrics_dump["blockingRate"] == expected["blockingRate"]
    assert metrics_dump["safeRate"] == expected["safeRate"]
    assert metrics_dump["detectionRate"] == expected["detectionRate"]
    assert metrics_dump["fnr"] == expected["fnr"]
    assert metrics_dump["undetectedSuccessRate"] == expected["undetectedSuccessRate"]

    # Compare benign metrics
    assert metrics_dump["benign"] == expected["benign"]

    # Compare latency metrics
    assert metrics_dump["latency"] == expected["latency"]

    # Compare counts
    assert metrics_dump["ambiguousCount"] == expected["ambiguousCount"]
    assert metrics_dump["providerBlockedCount"] == expected["providerBlockedCount"]

    # Compare perCategory
    assert metrics_dump["perCategory"] == expected["perCategory"]

    # Compare perDefense
    assert metrics_dump["perDefense"] == expected["perDefense"]


def test_aggregate_defenses_disabled_sets_fnr_none(metrics_fixture: dict):
    results = metrics_fixture["results"]
    metrics = aggregate(results, defenses_enabled=False)

    assert metrics.fnr is None
    # Other metrics remain identical
    assert metrics.asr.mean == 43.75
    assert metrics.blocking_rate == 25.0
    assert metrics.safe_rate == 31.25


def test_mathematical_invariants(metrics_fixture: dict):
    results = metrics_fixture["results"]
    metrics = aggregate(results, defenses_enabled=True)

    # Invariant 1: ASR + blockingRate + safeRate == 100 for non-empty eligible attacks
    assert round(metrics.asr.mean + metrics.blocking_rate + metrics.safe_rate, 2) == 100.00

    # Invariant 2: detectionRate + fnr == 100 when defenses_enabled is True
    assert metrics.fnr is not None
    assert round(metrics.detection_rate + metrics.fnr, 2) == 100.00

    # Invariant 3: No NaN or Inf anywhere in the metrics object
    def _assert_no_nan(val: object):
        if isinstance(val, float):
            assert not math.isnan(val), f"NaN found: {val}"
            assert not math.isinf(val), f"Inf found: {val}"
        elif isinstance(val, dict):
            for v in val.values():
                _assert_no_nan(v)
        elif isinstance(val, (list, tuple)):
            for v in val:
                _assert_no_nan(v)

    _assert_no_nan(metrics.model_dump())


def test_empty_results_no_nan():
    metrics = aggregate([], defenses_enabled=True)

    assert metrics.totals.attack_runs == 0
    assert metrics.totals.benign_runs == 0
    assert metrics.totals.errors == 0
    assert metrics.totals.eligible_attack_runs == 0
    assert metrics.totals.eligible_benign_runs == 0

    assert metrics.asr.mean == 0.0
    assert metrics.asr.min == 0.0
    assert metrics.asr.max == 0.0
    assert metrics.blocking_rate == 0.0
    assert metrics.safe_rate == 0.0
    assert metrics.detection_rate == 0.0
    assert metrics.fnr == 0.0
    assert metrics.undetected_success_rate == 0.0

    assert metrics.benign.fpr == 0.0
    assert metrics.benign.success_rate == 0.0

    assert metrics.latency.avg_ms == 0.0
    assert metrics.latency.avg_attack_ms == 0.0
    assert metrics.latency.avg_benign_ms == 0.0
    assert metrics.latency.avg_defense_ms == 0.0

    # Defenses disabled on empty
    metrics_no_def = aggregate([], defenses_enabled=False)
    assert metrics_no_def.fnr is None


def test_only_errors_results():
    error_cases = [
        CaseResult(
            case_id="AT01-001",
            category="AT-01",
            is_benign=False,
            repeat_index=1,
            outcome="error",
            response="",
            retrieved_chunks=[],
            defenses_triggered=[],
            blocked=False,
            latency_ms=0,
            defense_latency_ms=0,
            error="fatal upstream error",
        ),
        CaseResult(
            case_id="BN-001",
            category="BENIGN",
            is_benign=True,
            repeat_index=1,
            outcome="error",
            response="",
            retrieved_chunks=[],
            defenses_triggered=[],
            blocked=False,
            latency_ms=0,
            defense_latency_ms=0,
            error="connection refused",
        ),
    ]

    metrics = aggregate(error_cases, defenses_enabled=True)

    assert metrics.totals.attack_runs == 1
    assert metrics.totals.benign_runs == 1
    assert metrics.totals.errors == 2
    assert metrics.totals.eligible_attack_runs == 0
    assert metrics.totals.eligible_benign_runs == 0

    assert metrics.asr.mean == 0.0
    assert metrics.blocking_rate == 0.0
    assert metrics.safe_rate == 0.0
    assert metrics.benign.fpr == 0.0
    assert metrics.benign.success_rate == 0.0
    assert metrics.latency.avg_ms == 0.0


def test_endpoint_requires_auth(client: TestClient):
    response = client.post("/internal/evaluation/aggregate", json={"results": []})
    assert response.status_code == 401


def test_endpoint_aggregate_success(client: TestClient, service_key: str, metrics_fixture: dict):
    headers = {"X-Service-Key": service_key}
    payload = {
        "results": metrics_fixture["results"],
        "defensesEnabled": True,
    }
    response = client.post("/internal/evaluation/aggregate", headers=headers, json=payload)
    assert response.status_code == 200

    data = response.json()
    expected = metrics_fixture["expectedMetrics"]
    assert data["totals"] == expected["totals"]
    assert data["asr"] == expected["asr"]
    assert data["blockingRate"] == expected["blockingRate"]
    assert data["fnr"] == 75.0

    # Defenses disabled
    payload["defensesEnabled"] = False
    response = client.post("/internal/evaluation/aggregate", headers=headers, json=payload)
    assert response.status_code == 200
    assert response.json()["fnr"] is None
