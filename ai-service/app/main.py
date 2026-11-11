"""RAGShield AI Service — FastAPI application.

Entry point: uvicorn app.main:app --port 8000

The service refuses to start if INTERNAL_SERVICE_KEY is not set in the
environment (validated by pydantic-settings at import time).
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.responses import JSONResponse

from app.api.deps import require_service_key
from app.api.routes import health as health_router
from app.core.config import get_settings
from app.core.errors import setup_error_handlers
from app.core.logging_config import setup_logging

# ── Bootstrap logging before anything else ────────────────────────────────────
# Level will be overridden by settings once they load; this is the fallback.
setup_logging("INFO")
logger = logging.getLogger(__name__)


# ── Startup validation ─────────────────────────────────────────────────────────
# Calling get_settings() at module-import time ensures the service raises
# immediately (rather than on the first request) if INTERNAL_SERVICE_KEY is
# absent or empty.  pydantic's @model_validator raises ValueError, which
# propagates as an ImportError / startup crash visible in the uvicorn log.
_settings = get_settings()
setup_logging(_settings.LOG_LEVEL)

logger.info(
    "RAGShield AI Service starting",
    extra={"provider": _settings.LLM_PROVIDER, "model": _settings.GEMINI_MODEL},
)


# ── Lifespan ───────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Startup complete.")
    yield
    logger.info("Shutdown.")


# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="RAGShield AI Service",
    version="0.1.0",
    docs_url="/internal/docs",
    openapi_url="/internal/openapi.json",
    lifespan=lifespan,
)

setup_error_handlers(app)

# Open routes (no service key)
app.include_router(health_router.router, prefix="/internal")


# ── Protected probe route (used only for auth tests) ──────────────────────────
@app.get("/internal/ping", dependencies=[Depends(require_service_key)])
async def ping() -> JSONResponse:
    """Minimal protected endpoint used by auth tests to verify key enforcement."""
    return JSONResponse({"pong": True})
