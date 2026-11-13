"""Internal attacks endpoints: run-case."""

from __future__ import annotations

import logging
import time
from datetime import UTC, datetime

from fastapi import APIRouter

from app.attacks.schemas import AttackCase, CaseResult, RunCaseRequest
from app.evaluation import decide_outcome
from app.rag.pipeline import InjectedChunk, run_rag_pipeline

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/attacks", tags=["attacks"])


@router.post("/run-case", response_model=CaseResult)
async def run_case_endpoint(body: RunCaseRequest) -> CaseResult:
    """Execute a single attack or benign test case through the RAG pipeline."""
    started = time.perf_counter()
    case: AttackCase = body.case

    injected = [
        InjectedChunk(text=c.text, position=c.position)
        for c in case.injected_chunks
    ]

    try:
        pipeline_result = await run_rag_pipeline(
            project_id=body.project_id,
            query=case.user_query,
            rag_config=body.rag_config,
            defense_config=body.defense_config,
            injected_chunks=injected,
        )
    except Exception as exc:
        elapsed_ms = max(0, round((time.perf_counter() - started) * 1000))
        err_msg = str(exc) or exc.__class__.__name__
        logger.warning(
            "Case execution failed with exception",
            extra={
                "caseId": case.case_id,
                "projectId": body.project_id,
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
            repeat_index=body.repeat_index,
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
        repeat_index=body.repeat_index,
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
