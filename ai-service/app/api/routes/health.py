"""GET /internal/health — open endpoint (no service key required).

Response shape: {status, provider, model, version}
"""

from __future__ import annotations

from fastapi import APIRouter

from app.core.config import get_settings
from app.core.models import CamelModel

router = APIRouter(tags=["internal"])

_VERSION = "0.1.0"


class HealthResponse(CamelModel):
    status: str
    provider: str
    model: str
    version: str


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Return service liveness plus the configured LLM provider and model."""
    settings = get_settings()
    return HealthResponse(
        status="ok",
        provider=settings.LLM_PROVIDER,
        model=settings.GEMINI_MODEL,
        version=_VERSION,
    )

