"""Lazy singleton embedding model wrapper built on sentence-transformers."""

from __future__ import annotations

import logging
from functools import lru_cache

from sentence_transformers import SentenceTransformer

from app.core.config import get_settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=2)
def _load_embedder(model_name: str) -> SentenceTransformer:
    logger.info("Loading embedding model", extra={"model": model_name})
    return SentenceTransformer(model_name)


def get_embedder() -> SentenceTransformer:
    """Return the lazily loaded SentenceTransformer instance from settings."""
    model_name = get_settings().EMBEDDING_MODEL
    return _load_embedder(model_name)


def clear_embedder() -> None:
    """Clear the cached embedding model instance (intended for tests)."""
    _load_embedder.cache_clear()


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Encode a list of strings into normalized dense embedding vectors."""
    if not texts:
        return []
    model = get_embedder()
    vectors = model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
    return [[float(value) for value in row] for row in vectors.tolist()]


def embed_query(text: str) -> list[float]:
    """Encode a single non-empty query string into an embedding vector."""
    if not text or not text.strip():
        raise ValueError("Query text must not be empty.")
    return embed_texts([text])[0]

