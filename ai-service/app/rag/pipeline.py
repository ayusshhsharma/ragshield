"""RAG execution pipeline following architecture.md §8 steps 1-9."""

from __future__ import annotations

import logging
import time
from collections.abc import Sequence
from typing import Literal

from pydantic import Field, model_validator

from app.core.config import get_settings
from app.core.constants import DEFAULT_SYSTEM_PROMPT, REFUSAL_MESSAGE
from app.core.models import CamelModel
from app.providers import LLMProvider, get_provider
from app.rag.prompts import build_prompts
from app.rag.vector_store import RetrievedChunk, query_project

logger = logging.getLogger(__name__)


class RagConfig(CamelModel):
    """Project RAG parameters matching architecture.md §6."""

    chunk_size: int = Field(default=500, ge=100, le=2000)
    chunk_overlap: int = Field(default=80, ge=0)
    top_k: int = Field(default=4, ge=1, le=10)
    system_prompt: str = Field(default=DEFAULT_SYSTEM_PROMPT)

    @model_validator(mode="after")
    def _validate_overlap(self) -> RagConfig:
        if self.chunk_overlap > self.chunk_size // 2:
            raise ValueError("chunkOverlap must be at most chunkSize // 2.")
        return self


class ScannerConfig(CamelModel):
    """Toggle + score threshold for heuristic scanners (DF-01 / DF-02)."""

    enabled: bool = False
    threshold: float = Field(default=0.5, ge=0.0, le=1.0)


class ToggleConfig(CamelModel):
    """Boolean toggle for non-threshold defenses (DF-03 / DF-05)."""

    enabled: bool = False


class DefenseConfig(CamelModel):
    """Defense configuration schema matching architecture.md §9."""

    input_scanner: ScannerConfig = Field(default_factory=ScannerConfig)
    document_scanner: ScannerConfig = Field(default_factory=ScannerConfig)
    instruction_isolation: ToggleConfig = Field(default_factory=ToggleConfig)
    output_validator: ToggleConfig = Field(default_factory=ToggleConfig)


class DefenseTrigger(CamelModel):
    """Detection event emitted by DF-01, DF-02, or DF-05."""

    id: str
    action: str
    detail: str
    score: float | None = None


class ChunkInfo(CamelModel):
    """Serialized chunk metadata returned in query and case results."""

    text: str
    source: str
    score: float
    injected: bool = False


class InjectedChunk(CamelModel):
    """Simulated context-level poisoned chunk used by attack test cases."""

    text: str
    position: Literal["first", "middle", "last"] = "first"


class PipelineResult(CamelModel):
    """Full output of a single RAG pipeline execution."""

    answer: str
    blocked: bool = False
    blocked_by: str | None = None
    retrieved_chunks: list[ChunkInfo] = Field(default_factory=list)
    defenses_triggered: list[DefenseTrigger] = Field(default_factory=list)
    latency_ms: int = 0
    defense_latency_ms: int = 0
    provider_blocked: bool = False


# ── Defense hook boundaries (T3.x will populate the enabled branches) ──────────
def _apply_input_scanner(
    query: str,
    defense_config: DefenseConfig,
) -> DefenseTrigger | None:
    """DF-01 input scanner hook (step 2)."""
    del query
    if not defense_config.input_scanner.enabled:
        return None
    raise NotImplementedError("DF-01 input scanner will be implemented in T3.1.")


def _apply_document_scanner(
    chunks: list[ChunkInfo],
    defense_config: DefenseConfig,
) -> tuple[list[ChunkInfo], DefenseTrigger | None]:
    """DF-02 document scanner hook (step 5)."""
    if not defense_config.document_scanner.enabled:
        return chunks, None
    raise NotImplementedError("DF-02 document scanner will be implemented in T3.2.")


def _apply_output_validator(
    answer: str,
    system_prompt: str,
    defense_config: DefenseConfig,
) -> DefenseTrigger | None:
    """DF-05 output validator hook (step 8)."""
    del answer, system_prompt
    if not defense_config.output_validator.enabled:
        return None
    raise NotImplementedError("DF-05 output validator will be implemented in T3.3.")


def _to_chunk_info(chunk: RetrievedChunk) -> ChunkInfo:
    return ChunkInfo(
        text=chunk.text,
        source=chunk.source,
        score=chunk.score,
        injected=chunk.injected,
    )


def _merge_injected_chunks(
    retrieved: list[ChunkInfo],
    injected_chunks: Sequence[InjectedChunk] | None,
) -> list[ChunkInfo]:
    """Insert simulated injected chunks at their configured positions."""
    if not injected_chunks:
        return retrieved

    merged = list(retrieved)
    for item in injected_chunks:
        entry = ChunkInfo(
            text=item.text,
            source="injected",
            score=1.0,
            injected=True,
        )
        if item.position == "first":
            merged.insert(0, entry)
        elif item.position == "middle":
            merged.insert(len(merged) // 2, entry)
        else:
            merged.append(entry)
    return merged


def _elapsed_ms(started: float) -> int:
    return max(0, round((time.perf_counter() - started) * 1000))


async def run_rag_pipeline(
    *,
    project_id: str,
    query: str,
    rag_config: RagConfig | None = None,
    defense_config: DefenseConfig | None = None,
    injected_chunks: Sequence[InjectedChunk] | None = None,
    provider: LLMProvider | None = None,
) -> PipelineResult:
    """Run RAG steps 1-9 from architecture.md §8."""
    # Step 1: start timer.
    pipeline_started = time.perf_counter()
    defense_elapsed_s = 0.0

    active_rag = rag_config or RagConfig()
    active_defenses = defense_config or DefenseConfig()
    defenses_triggered: list[DefenseTrigger] = []

    # Step 2: input scanner (DF-01).
    df_started = time.perf_counter()
    input_trigger = _apply_input_scanner(query, active_defenses)
    defense_elapsed_s += time.perf_counter() - df_started
    if input_trigger is not None:
        defenses_triggered.append(input_trigger)
        return PipelineResult(
            answer=REFUSAL_MESSAGE,
            blocked=True,
            blocked_by="DF-01",
            retrieved_chunks=[],
            defenses_triggered=defenses_triggered,
            latency_ms=_elapsed_ms(pipeline_started),
            defense_latency_ms=max(0, round(defense_elapsed_s * 1000)),
            provider_blocked=False,
        )

    # Step 3: retrieve top-K chunks from Chroma.
    retrieved_raw = query_project(project_id, query, top_k=active_rag.top_k)
    retrieved = [_to_chunk_info(chunk) for chunk in retrieved_raw]

    # Step 4: insert simulated injected chunks (if any).
    working_chunks = _merge_injected_chunks(retrieved, injected_chunks)

    # Step 5: document scanner (DF-02).
    df_started = time.perf_counter()
    filtered_chunks, doc_trigger = _apply_document_scanner(working_chunks, active_defenses)
    defense_elapsed_s += time.perf_counter() - df_started
    if doc_trigger is not None:
        defenses_triggered.append(doc_trigger)

    # Step 6: build prompt (naive or instruction-isolated).
    prompt_pair = build_prompts(
        system_prompt=active_rag.system_prompt,
        query=query,
        chunks=[chunk.text for chunk in filtered_chunks],
        isolate=active_defenses.instruction_isolation.enabled,
    )

    # Step 7: call configured LLM provider.
    settings = get_settings()
    active_provider = provider if provider is not None else get_provider()
    llm_result = await active_provider.generate(
        prompt_pair.system_prompt,
        prompt_pair.user_prompt,
        temperature=settings.LLM_TEMPERATURE,
        max_tokens=settings.LLM_MAX_OUTPUT_TOKENS,
    )

    answer = llm_result.text
    blocked = False
    blocked_by: str | None = None

    # Step 8: output validator (DF-05).
    df_started = time.perf_counter()
    output_trigger = _apply_output_validator(answer, prompt_pair.system_prompt, active_defenses)
    defense_elapsed_s += time.perf_counter() - df_started
    if output_trigger is not None:
        defenses_triggered.append(output_trigger)
        answer = REFUSAL_MESSAGE
        blocked = True
        blocked_by = "DF-05"

    # Step 9: return pipeline result with timings.
    logger.info(
        "Executed RAG pipeline",
        extra={
            "projectId": project_id,
            "retrievedCount": len(working_chunks),
            "blocked": blocked,
            "providerBlocked": llm_result.provider_blocked,
        },
    )
    return PipelineResult(
        answer=answer,
        blocked=blocked,
        blocked_by=blocked_by,
        retrieved_chunks=working_chunks,
        defenses_triggered=defenses_triggered,
        latency_ms=_elapsed_ms(pipeline_started),
        defense_latency_ms=max(0, round(defense_elapsed_s * 1000)),
        provider_blocked=llm_result.provider_blocked,
    )

