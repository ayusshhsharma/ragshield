"""Settings loaded from environment / .env file.

The service refuses to start if INTERNAL_SERVICE_KEY is empty.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Security — MUST NOT be empty; validated below.
    INTERNAL_SERVICE_KEY: str = ""

    # LLM
    LLM_PROVIDER: str = "mock"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-1.5-flash-latest"
    LLM_TEMPERATURE: float = 0.2
    LLM_MAX_OUTPUT_TOKENS: int = 512
    LLM_TIMEOUT_S: int = 45
    LLM_MAX_RPM: int = 10

    # Embeddings / vector store
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    CHROMA_PATH: str = "./chroma_data"

    # Logging
    LOG_LEVEL: str = "INFO"

    @model_validator(mode="after")
    def _require_service_key(self) -> Settings:
        if not self.INTERNAL_SERVICE_KEY.strip():
            raise ValueError(
                "INTERNAL_SERVICE_KEY must not be empty. "
                "Set it in ai-service/.env (must match server INTERNAL_SERVICE_KEY)."
            )
        return self


@lru_cache
def get_settings() -> Settings:
    """Return cached Settings; call clear_settings() in tests to reset."""
    return Settings()


def clear_settings() -> None:
    """Invalidate the settings cache (use in tests only)."""
    get_settings.cache_clear()

