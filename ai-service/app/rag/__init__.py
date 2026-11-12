"""RAG ingestion and pipeline modules."""

from app.rag.chunker import chunk_text
from app.rag.embeddings import clear_embedder, embed_query, embed_texts, get_embedder
from app.rag.extractors import extract_text
from app.rag.vector_store import (
    RetrievedChunk,
    clear_chroma_client,
    collection_name,
    delete_document,
    delete_project,
    get_chroma_client,
    ingest_document,
    query_project,
)

__all__ = [
    "RetrievedChunk",
    "chunk_text",
    "clear_chroma_client",
    "clear_embedder",
    "collection_name",
    "delete_document",
    "delete_project",
    "embed_query",
    "embed_texts",
    "extract_text",
    "get_chroma_client",
    "get_embedder",
    "ingest_document",
    "query_project",
]

