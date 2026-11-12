"""ChromaDB vector store wrapper — the sole module touching ChromaDB."""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path
from typing import Any

import chromadb
from chromadb.errors import NotFoundError

from app.core.config import get_settings
from app.core.models import CamelModel
from app.rag.embeddings import embed_query, embed_texts

logger = logging.getLogger(__name__)

COLLECTION_PREFIX = "proj_"


class RetrievedChunk(CamelModel):
    """A retrieved document chunk with its cosine similarity score."""

    text: str
    source: str
    document_id: str
    chunk_index: int
    score: float
    injected: bool = False


def _require_non_empty(value: str, field_name: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError(f"{field_name} must not be empty.")
    return cleaned


def collection_name(project_id: str) -> str:
    """Return the Chroma collection name for a project."""
    return f"{COLLECTION_PREFIX}{_require_non_empty(project_id, 'project_id')}"


@lru_cache(maxsize=8)
def _create_chroma_client(resolved_path: str) -> chromadb.ClientAPI:
    Path(resolved_path).mkdir(parents=True, exist_ok=True)
    logger.info("Initializing ChromaDB persistent client", extra={"chromaPath": resolved_path})
    return chromadb.PersistentClient(path=resolved_path)


def get_chroma_client() -> chromadb.ClientAPI:
    """Return the lazily initialized persistent ChromaDB client for settings.CHROMA_PATH."""
    resolved_path = str(Path(get_settings().CHROMA_PATH).resolve())
    return _create_chroma_client(resolved_path)


def clear_chroma_client() -> None:
    """Clear cached ChromaDB client instances (intended for tests)."""
    _create_chroma_client.cache_clear()


def _get_project_collection(project_id: str) -> Any:
    client = get_chroma_client()
    return client.get_or_create_collection(
        name=collection_name(project_id),
        metadata={"hnsw:space": "cosine"},
    )


def ingest_document(
    project_id: str,
    document_id: str,
    source: str,
    chunks: list[str],
) -> int:
    """Embed and store document chunks idempotently inside the project's collection."""
    pid = _require_non_empty(project_id, "project_id")
    doc_id = _require_non_empty(document_id, "document_id")
    src = _require_non_empty(source, "source")

    if not chunks:
        raise ValueError("chunks must not be empty.")
    if any(not chunk or not chunk.strip() for chunk in chunks):
        raise ValueError("chunks must not contain empty items.")

    embeddings = embed_texts(chunks)
    collection = _get_project_collection(pid)

    # Remove any prior vectors for this documentId so re-ingest replaces stale chunks cleanly.
    collection.delete(where={"documentId": doc_id})

    ids = [f"{doc_id}:{index}" for index in range(len(chunks))]
    metadatas: list[dict[str, str | int]] = [
        {"documentId": doc_id, "source": src, "chunkIndex": index}
        for index in range(len(chunks))
    ]

    collection.add(
        ids=ids,
        embeddings=embeddings,
        documents=chunks,
        metadatas=metadatas,
    )
    logger.info(
        "Ingested document chunks into vector store",
        extra={"projectId": pid, "documentId": doc_id, "chunkCount": len(chunks)},
    )
    return len(chunks)


def query_project(
    project_id: str,
    query: str,
    top_k: int = 4,
) -> list[RetrievedChunk]:
    """Query the project's vector collection and return top-k chunks scored by 1 - distance."""
    pid = _require_non_empty(project_id, "project_id")
    if top_k < 1:
        raise ValueError("top_k must be at least 1.")

    query_vector = embed_query(query)
    collection = _get_project_collection(pid)
    raw = collection.query(
        query_embeddings=[query_vector],
        n_results=top_k,
        include=["documents", "metadatas", "distances"],
    )

    documents = (raw.get("documents") or [[]])[0]
    metadatas = (raw.get("metadatas") or [[]])[0]
    distances = (raw.get("distances") or [[]])[0]

    results: list[RetrievedChunk] = []
    for text, meta, distance in zip(documents, metadatas, distances, strict=True):
        metadata = meta or {}
        score = round(1.0 - float(distance), 4)
        results.append(
            RetrievedChunk(
                text=str(text),
                source=str(metadata.get("source", "")),
                document_id=str(metadata.get("documentId", "")),
                chunk_index=int(metadata.get("chunkIndex", 0)),
                score=score,
                injected=False,
            )
        )

    logger.info(
        "Queried vector store",
        extra={"projectId": pid, "topK": top_k, "resultCount": len(results)},
    )
    return results


def delete_document(project_id: str, document_id: str) -> None:
    """Delete all vectors belonging to `document_id` from the project's collection."""
    pid = _require_non_empty(project_id, "project_id")
    doc_id = _require_non_empty(document_id, "document_id")

    collection = _get_project_collection(pid)
    collection.delete(where={"documentId": doc_id})
    logger.info(
        "Deleted document vectors",
        extra={"projectId": pid, "documentId": doc_id},
    )


def delete_project(project_id: str) -> None:
    """Delete the entire Chroma collection for `project_id` if it exists."""
    pid = _require_non_empty(project_id, "project_id")
    client = get_chroma_client()
    try:
        client.delete_collection(name=collection_name(pid))
        logger.info("Deleted project vector collection", extra={"projectId": pid})
    except NotFoundError:
        logger.info("Project vector collection already absent", extra={"projectId": pid})

