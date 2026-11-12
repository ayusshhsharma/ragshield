"""Internal RAG endpoints: ingest, ingest-demo, delete document/project, query."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, File, Form, UploadFile
from pydantic import Field, field_validator, model_validator

from app.core.errors import ServiceError
from app.core.models import CamelModel
from app.providers import ProviderError
from app.rag.chunker import chunk_text
from app.rag.extractors import extract_text
from app.rag.pipeline import (
    ChunkInfo,
    DefenseConfig,
    DefenseTrigger,
    RagConfig,
    run_rag_pipeline,
)
from app.rag.vector_store import delete_document, delete_project, ingest_document
from app.seed import SEED_DIR, SEED_FILENAMES

router = APIRouter(prefix="/rag", tags=["rag"])


class IngestResponse(CamelModel):
    chunk_count: int
    char_count: int


class IngestDemoRequest(CamelModel):
    project_id: str
    chunk_size: int = Field(default=500, ge=100, le=2000)
    chunk_overlap: int = Field(default=80, ge=0)

    @field_validator("project_id")
    @classmethod
    def _non_empty_project_id(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("projectId must not be empty.")
        return cleaned

    @model_validator(mode="after")
    def _validate_overlap(self) -> IngestDemoRequest:
        if self.chunk_overlap > self.chunk_size // 2:
            raise ValueError("chunkOverlap must be at most chunkSize // 2.")
        return self


class DemoDocumentItem(CamelModel):
    name: str
    chunk_count: int
    char_count: int
    document_id: str


class IngestDemoResponse(CamelModel):
    documents: list[DemoDocumentItem]


class DeleteResponse(CamelModel):
    deleted: bool = True


class RagQueryRequest(CamelModel):
    project_id: str
    query: str
    rag_config: RagConfig = Field(default_factory=RagConfig)
    defense_config: DefenseConfig = Field(default_factory=DefenseConfig)

    @field_validator("project_id", "query")
    @classmethod
    def _non_empty_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Field must not be empty.")
        return cleaned


class RagQueryResponse(CamelModel):
    answer: str
    blocked: bool
    blocked_by: str | None
    retrieved_chunks: list[ChunkInfo]
    defenses_triggered: list[DefenseTrigger]
    latency_ms: int


def _require_non_empty_id(value: str, name: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ServiceError(400, "VALIDATION_ERROR", f"{name} must not be empty.")
    return cleaned


@router.post("/ingest", response_model=IngestResponse)
async def ingest_endpoint(
    file: UploadFile = File(...),
    projectId: Annotated[str, Form()] = "",
    documentId: Annotated[str, Form()] = "",
    chunkSize: Annotated[int, Form(ge=100, le=2000)] = 500,
    chunkOverlap: Annotated[int, Form(ge=0)] = 80,
) -> IngestResponse:
    """Extract, chunk, embed, and store an uploaded document into ChromaDB."""
    pid = _require_non_empty_id(projectId, "projectId")
    doc_id = _require_non_empty_id(documentId, "documentId")
    if chunkOverlap > chunkSize // 2:
        raise ServiceError(
            400,
            "VALIDATION_ERROR",
            "chunkOverlap must be at most chunkSize // 2.",
        )

    data = await file.read()
    filename = (file.filename or "").strip()
    try:
        text = extract_text(filename, data)
    except ValueError as exc:
        msg = str(exc)
        code = (
            "FILE_TYPE_NOT_ALLOWED"
            if msg.startswith("Unsupported file type")
            else "VALIDATION_ERROR"
        )
        raise ServiceError(400, code, msg) from exc

    chunks = chunk_text(text, size=chunkSize, overlap=chunkOverlap)
    if not chunks:
        raise ServiceError(400, "VALIDATION_ERROR", "Document produced no text chunks.")

    chunk_count = ingest_document(
        project_id=pid,
        document_id=doc_id,
        source=filename,
        chunks=chunks,
    )
    return IngestResponse(chunk_count=chunk_count, char_count=len(text))


@router.post("/ingest-demo", response_model=IngestDemoResponse)
async def ingest_demo_endpoint(body: IngestDemoRequest) -> IngestDemoResponse:
    """Ingest all 5 synthetic seed corpus documents for a project."""
    docs_out: list[DemoDocumentItem] = []
    for name in SEED_FILENAMES:
        raw_bytes = (SEED_DIR / name).read_bytes()
        text = extract_text(name, raw_bytes)
        chunks = chunk_text(text, size=body.chunk_size, overlap=body.chunk_overlap)
        doc_id = uuid.uuid4().hex[:24]
        chunk_count = ingest_document(
            project_id=body.project_id,
            document_id=doc_id,
            source=name,
            chunks=chunks,
        )
        docs_out.append(
            DemoDocumentItem(
                name=name,
                chunk_count=chunk_count,
                char_count=len(text),
                document_id=doc_id,
            )
        )
    return IngestDemoResponse(documents=docs_out)


@router.delete("/documents/{projectId}/{documentId}", response_model=DeleteResponse)
async def delete_document_endpoint(projectId: str, documentId: str) -> DeleteResponse:
    """Remove all vectors belonging to a single document."""
    pid = _require_non_empty_id(projectId, "projectId")
    doc_id = _require_non_empty_id(documentId, "documentId")
    delete_document(pid, doc_id)
    return DeleteResponse(deleted=True)


@router.delete("/projects/{projectId}", response_model=DeleteResponse)
async def delete_project_endpoint(projectId: str) -> DeleteResponse:
    """Delete the entire vector collection for a project."""
    pid = _require_non_empty_id(projectId, "projectId")
    delete_project(pid)
    return DeleteResponse(deleted=True)


@router.post("/query", response_model=RagQueryResponse)
async def query_endpoint(body: RagQueryRequest) -> RagQueryResponse:
    """Run the RAG pipeline for a project query."""
    try:
        result = await run_rag_pipeline(
            project_id=body.project_id,
            query=body.query,
            rag_config=body.rag_config,
            defense_config=body.defense_config,
        )
    except NotImplementedError as exc:
        raise ServiceError(501, "NOT_IMPLEMENTED", str(exc)) from exc
    except ProviderError as exc:
        raise ServiceError(502, "AI_SERVICE_UNAVAILABLE", exc.message) from exc

    return RagQueryResponse(
        answer=result.answer,
        blocked=result.blocked,
        blocked_by=result.blocked_by,
        retrieved_chunks=result.retrieved_chunks,
        defenses_triggered=result.defenses_triggered,
        latency_ms=result.latency_ms,
    )
