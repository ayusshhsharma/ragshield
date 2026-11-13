"""Internal evaluation endpoints: aggregate."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import Field

from app.attacks.schemas import CaseResult
from app.core.models import CamelModel
from app.evaluation.metrics import Metrics, aggregate

router = APIRouter(prefix="/evaluation", tags=["evaluation"])


class AggregateRequest(CamelModel):
    results: list[CaseResult] = Field(default_factory=list)
    defenses_enabled: bool = Field(default=True, alias="defensesEnabled")


@router.post("/aggregate", response_model=Metrics)
async def aggregate_endpoint(body: AggregateRequest) -> Metrics:
    """Aggregate individual case results into an experiment metrics summary."""
    return aggregate(body.results, defenses_enabled=body.defenses_enabled)
