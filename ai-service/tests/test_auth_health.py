"""Tests for service-key auth and /internal/health endpoint.

Covers the testing.md test_auth_health.py requirements:
  - GET /internal/health is open: returns 200 and {status, provider, model, version}
    without any X-Service-Key header.
  - GET /internal/ping (a protected route) without key → 401 with standard error shape.
  - GET /internal/ping with wrong key → 401 with standard error shape.
  - GET /internal/ping with correct key → 200.
  - Settings raises ValueError when INTERNAL_SERVICE_KEY is empty.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.models import CamelModel


class _SampleCamelBody(CamelModel):
    chunk_size: int

# ── Helper ─────────────────────────────────────────────────────────────────────

def _assert_error_shape(body: dict, expected_code: str | None = None) -> None:
    """Assert the standard error response shape."""
    assert "error" in body, f"'error' key missing from response: {body}"
    err = body["error"]
    assert "code" in err, f"'code' missing from error: {err}"
    assert "message" in err, f"'message' missing from error: {err}"
    assert "details" in err, f"'details' missing from error: {err}"
    if expected_code:
        assert err["code"] == expected_code, f"Expected code {expected_code!r}, got {err['code']!r}"


# ── Health (open) ───────────────────────────────────────────────────────────────

class TestHealth:
    def test_health_returns_200_without_key(self, client):
        """GET /internal/health must succeed with no auth header."""
        resp = client.get("/internal/health")
        assert resp.status_code == 200

    def test_health_response_has_required_fields(self, client):
        """Response must contain status, provider, model, version."""
        body = client.get("/internal/health").json()
        assert body["status"] == "ok"
        assert "provider" in body
        assert "model" in body
        assert "version" in body

    def test_health_response_is_camel_case(self, client):
        """Fields must be camelCase (all single-word here, so this checks no snake_case leak)."""
        body = client.get("/internal/health").json()
        # Ensure no snake_case keys leak through (none expected at this level).
        for key in body:
            assert "_" not in key, f"snake_case key {key!r} found in response"


# ── Service-key enforcement ────────────────────────────────────────────────────

class TestServiceKeyAuth:
    def test_protected_route_no_key_returns_401(self, client):
        """Missing X-Service-Key on a protected route must return 401."""
        resp = client.get("/internal/ping")
        assert resp.status_code == 401

    def test_protected_route_no_key_has_standard_error_shape(self, client):
        """401 response must use the standard error shape."""
        body = client.get("/internal/ping").json()
        _assert_error_shape(body, "UNAUTHENTICATED")

    def test_protected_route_wrong_key_returns_401(self, client):
        """Wrong X-Service-Key must return 401."""
        resp = client.get("/internal/ping", headers={"X-Service-Key": "wrong-key"})
        assert resp.status_code == 401

    def test_protected_route_wrong_key_has_standard_error_shape(self, client):
        """Wrong-key 401 must use the standard error shape."""
        body = client.get(
            "/internal/ping", headers={"X-Service-Key": "wrong-key"}
        ).json()
        _assert_error_shape(body, "UNAUTHENTICATED")

    def test_protected_route_correct_key_returns_200(self, client, service_key):
        """Correct X-Service-Key must grant access and return 200."""
        resp = client.get("/internal/ping", headers={"X-Service-Key": service_key})
        assert resp.status_code == 200

    async def test_protected_route_non_ascii_key_returns_401(self):
        """Non-ASCII header value must return 401 HTTPException, never TypeError."""
        from app.api.deps import require_service_key

        with pytest.raises(HTTPException) as exc_info:
            await require_service_key(x_service_key="clé-invalide")
        assert exc_info.value.status_code == 401
        _assert_error_shape(exc_info.value.detail, "UNAUTHENTICATED")


# ── Standard error shape & CamelModel ──────────────────────────────────────────

class TestConventions:
    def test_unknown_route_returns_standard_404_shape(self, client):
        """404 errors must follow the standard error shape."""
        resp = client.get("/internal/does-not-exist")
        assert resp.status_code == 404
        _assert_error_shape(resp.json(), "NOT_FOUND")

    def test_validation_error_returns_standard_shape(self):
        """RequestValidationError must return standard error shape with VALIDATION_ERROR."""
        from app.core.errors import setup_error_handlers

        test_app = FastAPI()
        setup_error_handlers(test_app)

        @test_app.post("/items", response_model=_SampleCamelBody)
        async def create_item(body: _SampleCamelBody) -> _SampleCamelBody:
            return body

        with TestClient(test_app) as test_client:
            bad = test_client.post("/items", json={"chunkSize": "not-an-int"})
            assert bad.status_code == 422
            _assert_error_shape(bad.json(), "VALIDATION_ERROR")

            ok_camel = test_client.post("/items", json={"chunkSize": 500})
            assert ok_camel.status_code == 200
            assert ok_camel.json() == {"chunkSize": 500}

            ok_snake = test_client.post("/items", json={"chunk_size": 250})
            assert ok_snake.status_code == 200
            assert ok_snake.json() == {"chunkSize": 250}


# ── Startup failure on empty key ───────────────────────────────────────────────

class TestStartupValidation:
    def test_settings_raises_on_empty_key(self):
        """Settings must raise ValidationError when INTERNAL_SERVICE_KEY is empty."""
        from app.core.config import Settings

        with pytest.raises((ValidationError, ValueError)):
            Settings(_env_file=None, INTERNAL_SERVICE_KEY="")

    def test_settings_raises_on_whitespace_key(self):
        """Settings must raise ValidationError when INTERNAL_SERVICE_KEY is whitespace."""
        from app.core.config import Settings

        with pytest.raises((ValidationError, ValueError)):
            Settings(_env_file=None, INTERNAL_SERVICE_KEY="   ")

    def test_settings_raises_on_missing_key(self, monkeypatch):
        """Settings must raise ValidationError when INTERNAL_SERVICE_KEY is unset."""
        from app.core.config import Settings

        monkeypatch.delenv("INTERNAL_SERVICE_KEY", raising=False)
        with pytest.raises((ValidationError, ValueError)):
            # Pass _env_file=None to avoid loading .env which may have the key set.
            Settings(_env_file=None)

    def test_settings_succeeds_with_valid_key(self):
        """Settings must load successfully when a non-empty key is provided."""
        from app.core.config import Settings

        s = Settings(_env_file=None, INTERNAL_SERVICE_KEY="a-valid-32-char-key-for-testing!")
        assert s.INTERNAL_SERVICE_KEY == "a-valid-32-char-key-for-testing!"

    def test_app_import_fails_without_service_key(self, tmp_path):
        """Starting/importing app.main without INTERNAL_SERVICE_KEY must fail."""
        service_dir = Path(__file__).resolve().parent.parent
        env = {k: v for k, v in os.environ.items() if k != "INTERNAL_SERVICE_KEY"}
        env["INTERNAL_SERVICE_KEY"] = ""
        env["PYTHONPATH"] = str(service_dir)
        # Run from tmp_path so pydantic-settings does not read ai-service/.env
        proc = subprocess.run(
            [sys.executable, "-c", "import app.main"],
            cwd=str(tmp_path),
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )
        assert proc.returncode != 0
        assert "INTERNAL_SERVICE_KEY" in proc.stderr
