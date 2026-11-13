"""Internal attacks endpoints: run-case."""

from __future__ import annotations

from fastapi import APIRouter

from app.attacks.runner import execute_case
from app.attacks.schemas import CaseResult, RunCaseRequest

router = APIRouter(prefix="/attacks", tags=["attacks"])


@router.post("/run-case", response_model=CaseResult)
async def run_case_endpoint(body: RunCaseRequest) -> CaseResult:
    """Execute a single attack or benign test case through the RAG pipeline."""
    return await execute_case(
        project_id=body.project_id,
        case=body.case,
        rag_config=body.rag_config,
        defense_config=body.defense_config,
        repeat_index=body.repeat_index,
    )

