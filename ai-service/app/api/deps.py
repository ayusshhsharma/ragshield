"""FastAPI dependencies shared across routes."""

from __future__ import annotations

import secrets
from typing import Annotated

from fastapi import Header, HTTPException, status

from app.core.config import get_settings
from app.core.errors import _error_body


async def require_service_key(x_service_key: Annotated[str | None, Header()] = None) -> None:
    """Dependency: reject requests that do not carry the correct X-Service-Key header.

    Uses secrets.compare_digest to prevent timing attacks.
    Returns None on success; raises HTTP 401 on failure.
    """
    settings = get_settings()
    provided = x_service_key or ""
    if not secrets.compare_digest(
        provided.encode("utf-8"),
        settings.INTERNAL_SERVICE_KEY.encode("utf-8"),
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_error_body(
                "UNAUTHENTICATED",
                "Missing or invalid X-Service-Key header.",
            ),
        )

