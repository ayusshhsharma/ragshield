"""Global async rate limiter, concurrency semaphore, and retry/backoff helper."""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, TypeVar
from weakref import WeakKeyDictionary

from app.core.config import get_settings
from app.providers.base import ProviderError

logger = logging.getLogger(__name__)

T = TypeVar("T")

BACKOFF_SECONDS: tuple[float, ...] = (1.0, 2.0, 4.0)
MAX_ATTEMPTS = 3
MAX_CONCURRENT_CALLS = 2


@dataclass
class _LoopPrimitives:
    semaphore: asyncio.Semaphore
    lock: asyncio.Lock


class AsyncThrottle:
    """Global async RPM pacer plus bounded concurrency semaphore."""

    def __init__(
        self,
        max_rpm: int = 10,
        max_concurrent: int = MAX_CONCURRENT_CALLS,
        *,
        clock: Callable[[], float] = time.monotonic,
        sleep_fn: Callable[[float], Awaitable[Any]] = asyncio.sleep,
    ) -> None:
        if max_rpm <= 0:
            raise ValueError("max_rpm must be positive.")
        if max_concurrent <= 0:
            raise ValueError("max_concurrent must be positive.")

        self.max_rpm = max_rpm
        self.max_concurrent = max_concurrent
        self.min_interval_s = 60.0 / float(max_rpm)
        self._clock = clock
        self._sleep = sleep_fn
        self._last_started_at: float | None = None
        self._loop_state: WeakKeyDictionary[asyncio.AbstractEventLoop, _LoopPrimitives] = (
            WeakKeyDictionary()
        )

    def _get_primitives(self) -> _LoopPrimitives:
        loop = asyncio.get_running_loop()
        primitives = self._loop_state.get(loop)
        if primitives is None:
            primitives = _LoopPrimitives(
                semaphore=asyncio.Semaphore(self.max_concurrent),
                lock=asyncio.Lock(),
            )
            self._loop_state[loop] = primitives
        return primitives

    @asynccontextmanager
    async def acquire(self) -> AsyncIterator[None]:
        """Acquire a concurrency slot and enforce minimum interval between starts."""
        primitives = self._get_primitives()
        await primitives.semaphore.acquire()
        try:
            async with primitives.lock:
                now = self._clock()
                if self._last_started_at is not None:
                    elapsed = now - self._last_started_at
                    wait_s = self.min_interval_s - elapsed
                    if wait_s > 0:
                        await self._sleep(wait_s)
                        now = self._clock()
                self._last_started_at = now
            yield
        finally:
            primitives.semaphore.release()


async def run_with_retry(
    operation: Callable[[], Awaitable[T]],
    *,
    max_attempts: int = MAX_ATTEMPTS,
    backoff_seconds: tuple[float, ...] = BACKOFF_SECONDS,
    sleep_fn: Callable[[float], Awaitable[Any]] = asyncio.sleep,
) -> T:
    """Execute an async operation with exponential backoff on retryable ProviderErrors."""
    if max_attempts < 1:
        raise ValueError("max_attempts must be at least 1.")

    for attempt in range(max_attempts):
        try:
            return await operation()
        except ProviderError as exc:
            is_last_attempt = attempt >= max_attempts - 1
            if not exc.retryable or is_last_attempt:
                raise

            delay_s = backoff_seconds[min(attempt, len(backoff_seconds) - 1)]
            logger.warning(
                "Retryable provider error; backing off before retry",
                extra={"attempt": attempt + 1, "delaySeconds": delay_s},
            )
            await sleep_fn(delay_s)

    raise AssertionError("Unreachable")  # pragma: no cover


@lru_cache(maxsize=4)
def _build_throttle(max_rpm: int, max_concurrent: int) -> AsyncThrottle:
    return AsyncThrottle(max_rpm=max_rpm, max_concurrent=max_concurrent)


def get_throttle() -> AsyncThrottle:
    """Return the shared AsyncThrottle configured from settings.LLM_MAX_RPM."""
    settings = get_settings()
    return _build_throttle(settings.LLM_MAX_RPM, MAX_CONCURRENT_CALLS)


def clear_throttle() -> None:
    """Clear cached global AsyncThrottle instances (intended for tests)."""
    _build_throttle.cache_clear()

