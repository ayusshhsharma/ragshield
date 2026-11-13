"""Case execution logic shared by the API endpoint and suite runner CLI."""

from __future__ import annotations

import logging
import time
from datetime import UTC, datetime

from app.attacks.schemas import AttackCase, CaseResult
from app.evaluation import decide_outcome
from app.rag.pipeline import (
    DefenseConfig,
    InjectedChunk,
    RagConfig,
    run_rag_pipeline,
)

logger = logging.getLogger(__name__)


async def execute_case(
    *,
    project_id: str,
    case: AttackCase,
    rag_config: RagConfig | None = None,
    defense_config: DefenseConfig | None = None,
    repeat_index: int = 1,
) -> CaseResult:
    """Execute a single attack or benign test case through the RAG pipeline.

    Catches any pipeline or provider exceptions and returns a normal CaseResult
    with outcome "error" and the error text, preventing unhandled crashes.
    """
    started = time.perf_counter()
    active_rag_config = rag_config if rag_config is not None else RagConfig()
    active_defense_config = (
        defense_config if defense_config is not None else DefenseConfig()
    )

    injected = [
        InjectedChunk(text=c.text, position=c.position)
        for c in case.injected_chunks
    ]

    try:
        pipeline_result = await run_rag_pipeline(
            project_id=project_id,
            query=case.user_query,
            rag_config=active_rag_config,
            defense_config=active_defense_config,
            injected_chunks=injected,
        )
    except Exception as exc:
        elapsed_ms = max(0, round((time.perf_counter() - started) * 1000))
        err_msg = str(exc) or exc.__class__.__name__
        logger.warning(
            "Case execution failed with exception",
            extra={
                "caseId": case.case_id,
                "projectId": project_id,
                "error": err_msg,
            },
            exc_info=True,
        )
        outcome_res = decide_outcome(
            response="",
            case=case,
            blocked=False,
            error=err_msg,
            expected_keywords=case.expected_keywords if case.is_benign else None,
        )
        return CaseResult(
            case_id=case.case_id,
            category=case.category,
            is_benign=case.is_benign,
            repeat_index=repeat_index,
            outcome=outcome_res.outcome,
            response="",
            retrieved_chunks=[],
            defenses_triggered=[],
            blocked=False,
            blocked_by=None,
            success_condition_matched_raw=False,
            benign_acceptable=None,
            ambiguous=False,
            provider_blocked=False,
            latency_ms=elapsed_ms,
            defense_latency_ms=0,
            error=err_msg,
            timestamp=datetime.now(UTC).isoformat(),
        )

    outcome_res = decide_outcome(
        response=pipeline_result.answer,
        case=case,
        blocked=pipeline_result.blocked,
        error=None,
        expected_keywords=case.expected_keywords if case.is_benign else None,
    )

    return CaseResult(
        case_id=case.case_id,
        category=case.category,
        is_benign=case.is_benign,
        repeat_index=repeat_index,
        outcome=outcome_res.outcome,
        response=pipeline_result.answer,
        retrieved_chunks=pipeline_result.retrieved_chunks,
        defenses_triggered=pipeline_result.defenses_triggered,
        blocked=pipeline_result.blocked,
        blocked_by=pipeline_result.blocked_by,
        success_condition_matched_raw=outcome_res.success_condition_matched_raw,
        benign_acceptable=outcome_res.benign_acceptable,
        ambiguous=outcome_res.ambiguous,
        provider_blocked=pipeline_result.provider_blocked,
        latency_ms=pipeline_result.latency_ms,
        defense_latency_ms=pipeline_result.defense_latency_ms,
        error=None,
        timestamp=datetime.now(UTC).isoformat(),
    )
