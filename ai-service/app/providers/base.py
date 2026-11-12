"""Base LLM provider contract, result model, and error type."""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.core.models import CamelModel


class ProviderError(Exception):
    """Raised when an LLM provider invocation fails."""

    def __init__(
        self,
        message: str,
        retryable: bool = False,
        status_code: int | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.retryable = retryable
        self.status_code = status_code


class LLMResult(CamelModel):
    """Result returned by an LLMProvider call."""

    text: str
    latency_ms: int
    provider_blocked: bool = False


class LLMProvider(ABC):
    """Abstract base interface for LLM generation providers."""

    @abstractmethod
    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
        max_tokens: int = 512,
    ) -> LLMResult:
        """Generate a model response for the given system and user prompts."""

