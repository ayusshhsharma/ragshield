"""Internal defenses endpoints: inspect."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter
from pydantic import Field

from app.core.models import CamelModel
from app.defenses import PatternMatch, scan_text, validate_output

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
    """Scan arbitrary text using the heuristic pattern engine or output validator."""
    if body.kind == "output":
        val_res = validate_output(body.text)
        matches = [
            PatternMatch(
                id="DF-05",
                group=m.type,
                weight=1.0,
                description=m.detail,
                matched_text=m.matched_text,
            )
            for m in val_res.matches
        ]
        return InspectResponse(
            score=1.0 if val_res.flagged else 0.0,
            flagged=val_res.flagged,
            matches=matches,
        )

    scan_res = scan_text(
        body.text,
        threshold=body.threshold,
        is_document=(body.kind == "document"),
    )
    return InspectResponse(
        score=scan_res.score,
        flagged=scan_res.flagged,
        matches=scan_res.matches,
    )

