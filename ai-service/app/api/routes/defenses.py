"""Internal defenses endpoints: inspect."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter
from pydantic import Field

from app.core.models import CamelModel
from app.defenses import PatternMatch, scan_text

router = APIRouter(prefix="/defenses", tags=["defenses"])


class InspectRequest(CamelModel):
    kind: Literal["input", "document", "output"] = "input"
    text: str = ""
    threshold: float = Field(default=0.5, ge=0.0, le=1.0)


class InspectResponse(CamelModel):
    score: float
    flagged: bool
    matches: list[PatternMatch]


@router.post("/inspect", response_model=InspectResponse)
async def inspect_endpoint(body: InspectRequest) -> InspectResponse:
    """Scan arbitrary text using the heuristic pattern engine."""
    scan_res = scan_text(body.text, threshold=body.threshold)
    return InspectResponse(
        score=scan_res.score,
        flagged=scan_res.flagged,
        matches=scan_res.matches,
    )
