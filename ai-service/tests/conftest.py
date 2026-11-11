"""Shared pytest fixtures for the ai-service test suite.

Sets INTERNAL_SERVICE_KEY before the app module is imported so Settings
validation passes.  Uses monkeypatch at session scope via autouse so every
test file benefits automatically.
"""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

TEST_SERVICE_KEY = "test-service-key-32-characters-long"


@pytest.fixture(scope="session", autouse=True)
def _set_env():
    """Set required env vars before the app is imported."""
    os.environ.setdefault("INTERNAL_SERVICE_KEY", TEST_SERVICE_KEY)
    os.environ.setdefault("LLM_PROVIDER", "mock")
    yield


@pytest.fixture(scope="session")
def client(_set_env):
    """Return a TestClient backed by the FastAPI app."""
    # Import here (after env is set) to avoid startup failure.
    from app.core.config import clear_settings
    clear_settings()
    from app.main import app
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


@pytest.fixture(scope="session")
def service_key() -> str:
    return TEST_SERVICE_KEY
