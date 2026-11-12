"""Provider factory selecting MockProvider or GeminiProvider by LLM_PROVIDER."""

from __future__ import annotations

from app.core.config import get_settings
from app.providers.base import LLMProvider
from app.providers.gemini import GeminiProvider
from app.providers.mock import MockProvider


def get_provider(provider_name: str | None = None) -> LLMProvider:
    """Instantiate an LLMProvider selected by `provider_name` or settings.LLM_PROVIDER."""
    raw_name = provider_name if provider_name is not None else get_settings().LLM_PROVIDER
    selected = raw_name.strip().lower()

    if selected == "mock":
        return MockProvider()
    if selected == "gemini":
        return GeminiProvider()

    raise ValueError(
        f"Unsupported LLM_PROVIDER: {raw_name!r}. Expected 'mock' or 'gemini'."
    )

