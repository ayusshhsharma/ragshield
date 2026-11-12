"""GeminiProvider backed by google-genai with retry, backoff, and global throttling."""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Awaitable, Callable
from typing import Any

from google import genai
from google.genai import errors as genai_errors
from google.genai import types as genai_types

from app.core.config import get_settings
from app.providers.base import LLMProvider, LLMResult, ProviderError
from app.providers.throttle import (
    BACKOFF_SECONDS,
    MAX_ATTEMPTS,
    AsyncThrottle,
    get_throttle,
    run_with_retry,
)

logger = logging.getLogger(__name__)

_SAFETY_FINISH_REASONS = frozenset(
    {
        "SAFETY",
        "RECITATION",
        "BLOCKLIST",
        "PROHIBITED_CONTENT",
        "SPII",
        "IMAGE_SAFETY",
        "IMAGE_PROHIBITED_CONTENT",
        "IMAGE_RECITATION",
    }
)


def _enum_name(value: Any) -> str:
    if value is None:
        return ""
    name = getattr(value, "name", None)
    if isinstance(name, str):
        return name.upper()
    return str(value).split(".")[-1].upper()


def _is_safety_blocked(response: Any) -> bool:
    prompt_feedback = getattr(response, "prompt_feedback", None)
    block_reason = _enum_name(getattr(prompt_feedback, "block_reason", None))
    if block_reason and block_reason not in {"NONE", "BLOCK_REASON_UNSPECIFIED"}:
        return True

    candidates = getattr(response, "candidates", None) or []
    for candidate in candidates:
        reason = _enum_name(getattr(candidate, "finish_reason", None))
        if (
            reason in _SAFETY_FINISH_REASONS
            or "SAFETY" in reason
            or "PROHIBITED" in reason
            or "BLOCK" in reason
        ):
            return True
    return False


def _classify_exception(exc: Exception) -> ProviderError:
    if isinstance(exc, ProviderError):
        return exc

    if isinstance(exc, (TimeoutError, ConnectionError)):
        return ProviderError(
            f"Gemini transient failure: {exc or type(exc).__name__}",
            retryable=True,
        )

    code = getattr(exc, "code", None)
    if code is None:
        code = getattr(exc, "status_code", None)

    if isinstance(code, int):
        retryable = code == 429 or 500 <= code < 600
        return ProviderError(
            str(exc) or f"Gemini API error ({code})",
            retryable=retryable,
            status_code=code,
        )

    exc_name = type(exc).__name__
    if isinstance(exc, genai_errors.APIError):
        return ProviderError(str(exc), retryable=False)
    if "Timeout" in exc_name or "Connect" in exc_name:
        return ProviderError(f"Gemini transport failure: {exc or exc_name}", retryable=True)

    return ProviderError(str(exc) or exc_name, retryable=False)


class GeminiProvider(LLMProvider):
    """LLMProvider wrapping google-genai async generation."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        model: str | None = None,
        timeout_s: float | None = None,
        client: Any | None = None,
        throttle: AsyncThrottle | None = None,
        clock: Callable[[], float] = time.monotonic,
        sleep_fn: Callable[[float], Awaitable[Any]] = asyncio.sleep,
        max_attempts: int = MAX_ATTEMPTS,
        backoff_seconds: tuple[float, ...] = BACKOFF_SECONDS,
    ) -> None:
        settings = get_settings()
        self._model = (model if model is not None else settings.GEMINI_MODEL).strip()
        if not self._model:
            raise ProviderError("GEMINI_MODEL must not be empty.", retryable=False)

        self._timeout_s = float(timeout_s if timeout_s is not None else settings.LLM_TIMEOUT_S)
        self._throttle = throttle if throttle is not None else get_throttle()
        self._clock = clock
        self._sleep_fn = sleep_fn
        self._max_attempts = max_attempts
        self._backoff_seconds = backoff_seconds

        if client is not None:
            self._client = client
        else:
            resolved_key = (api_key if api_key is not None else settings.GEMINI_API_KEY).strip()
            if not resolved_key:
                raise ProviderError(
                    "GEMINI_API_KEY must not be empty when using GeminiProvider.",
                    retryable=False,
                )
            timeout_ms = max(1000, int(self._timeout_s * 1000))
            self._client = genai.Client(
                api_key=resolved_key,
                http_options=genai_types.HttpOptions(timeout=timeout_ms),
            )

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
        max_tokens: int = 512,
    ) -> LLMResult:
        started = self._clock()
        config = genai_types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=temperature,
            max_output_tokens=max_tokens,
        )

        async def _attempt() -> Any:
            async with self._throttle.acquire():
                try:
                    return await asyncio.wait_for(
                        self._client.aio.models.generate_content(
                            model=self._model,
                            contents=user_prompt,
                            config=config,
                        ),
                        timeout=self._timeout_s,
                    )
                except Exception as exc:
                    raise _classify_exception(exc) from exc

        response = await run_with_retry(
            _attempt,
            max_attempts=self._max_attempts,
            backoff_seconds=self._backoff_seconds,
            sleep_fn=self._sleep_fn,
        )

        latency_ms = max(0, round((self._clock() - started) * 1000))
        return self._parse_response(response, latency_ms)

    @staticmethod
    def _parse_response(response: Any, latency_ms: int) -> LLMResult:
        try:
            raw_text = getattr(response, "text", None)
        except ValueError:
            raw_text = None

        text = raw_text if isinstance(raw_text, str) else ""
        if not text.strip():
            blocked = _is_safety_blocked(response)
            if blocked:
                logger.warning("Gemini response blocked by safety filter")
            return LLMResult(text="", latency_ms=latency_ms, provider_blocked=blocked)

        return LLMResult(text=text, latency_ms=latency_ms, provider_blocked=False)
