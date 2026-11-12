"""Tests for lazy embeddings singleton and ChromaDB vector_store wrapper."""

from __future__ import annotations

import pytest

from app.core.config import clear_settings, get_settings
from app.rag.embeddings import embed_query, embed_texts, get_embedder
from app.rag.vector_store import (
    clear_chroma_client,
    collection_name,
    delete_document,
    delete_project,
    ingest_document,
    query_project,
)


@pytest.fixture()
def tmp_chroma(tmp_path, monkeypatch):
    """Point CHROMA_PATH to an isolated per-test directory."""
    monkeypatch.setenv("CHROMA_PATH", str(tmp_path))
    clear_settings()
    clear_chroma_client()
    yield tmp_path
    clear_chroma_client()
    clear_settings()


def test_get_embedder_is_lazy_singleton_and_produces_consistent_vectors() -> None:
    first = get_embedder()
    second = get_embedder()
    assert first is second
    assert get_settings().EMBEDDING_MODEL

    vectors = embed_texts(["Thirty-day refund policy", "Standard ground shipping"])
    assert len(vectors) == 2
    assert len(vectors[0]) > 0
    assert len(vectors[0]) == len(vectors[1])

    q_vec = embed_query("How many days do refunds take?")
    assert len(q_vec) == len(vectors[0])


def test_ingest_then_query_returns_right_chunk_and_score_precision(tmp_chroma) -> None:
    ingest_document(
        project_id="alpha",
        document_id="doc-refund",
        source="refund_policy.txt",
        chunks=[
            "Customers may request a full refund within 30 days of delivery.",
            "Original shipping fees are non-refundable unless the item arrived damaged.",
        ],
    )
    ingest_document(
        project_id="alpha",
        document_id="doc-warranty",
        source="product_warranty.txt",
        chunks=[
            "All Acme electronics include a 12-month limited hardware warranty.",
        ],
    )

    results = query_project("alpha", "Within how many days can I get a refund?", top_k=2)
    assert len(results) == 2
    top = results[0]
    assert top.document_id == "doc-refund"
    assert top.source == "refund_policy.txt"
    assert top.chunk_index == 0
    assert "30 days" in top.text
    assert top.injected is False
    assert 0.0 < top.score <= 1.0
    assert round(top.score, 4) == top.score

    dumped = top.model_dump(by_alias=True)
    assert set(dumped.keys()) == {
        "text",
        "source",
        "documentId",
        "chunkIndex",
        "score",
        "injected",
    }


def test_query_empty_project_returns_empty_list(tmp_chroma) -> None:
    assert query_project("empty-proj", "refund policy", top_k=4) == []


def test_reingest_same_document_is_idempotent_and_drops_stale_chunks(tmp_chroma) -> None:
    ingest_document(
        project_id="p-idemp",
        document_id="doc-1",
        source="policy_v1.txt",
        chunks=[
            "Old refund window was 14 days for clearance orders.",
            "Legacy coupon code SUMMER-OLD is expired and invalid.",
            "Legacy warehouse address was Building B.",
        ],
    )

    # Re-ingest the exact same documentId with updated, fewer chunks.
    count = ingest_document(
        project_id="p-idemp",
        document_id="doc-1",
        source="policy_v2.txt",
        chunks=["Updated refund policy gives customers 30 days to return items."],
    )
    assert count == 1

    results = query_project("p-idemp", "clearance coupon SUMMER-OLD warehouse", top_k=5)
    assert len(results) == 1
    assert results[0].source == "policy_v2.txt"
    assert results[0].chunk_index == 0
    assert "30 days" in results[0].text
    assert "SUMMER-OLD" not in results[0].text


def test_delete_document_removes_only_target_document(tmp_chroma) -> None:
    ingest_document(
        project_id="p-del",
        document_id="doc-a",
        source="a.txt",
        chunks=["Apples and oranges grow in sunny orchards."],
    )
    ingest_document(
        project_id="p-del",
        document_id="doc-b",
        source="b.txt",
        chunks=["Refunds take 30 days to process back to your card."],
    )

    delete_document("p-del", "doc-a")

    results = query_project("p-del", "sunny orchards apples", top_k=4)
    assert len(results) == 1
    assert results[0].document_id == "doc-b"
    assert results[0].source == "b.txt"


def test_projects_are_isolated(tmp_chroma) -> None:
    assert collection_name("proj-1") == "proj_proj-1"

    ingest_document(
        project_id="proj-1",
        document_id="d1",
        source="secrets.txt",
        chunks=["Project one secret code is ORBIT-111."],
    )
    ingest_document(
        project_id="proj-2",
        document_id="d2",
        source="shipping.txt",
        chunks=["Project two ships parcels via express courier."],
    )

    p1_results = query_project("proj-1", "express courier", top_k=4)
    assert all(chunk.document_id == "d1" for chunk in p1_results)

    p2_results = query_project("proj-2", "ORBIT-111", top_k=4)
    assert all(chunk.document_id == "d2" for chunk in p2_results)


def test_delete_project_removes_collection_and_tolerates_missing(tmp_chroma) -> None:
    ingest_document(
        project_id="p-drop",
        document_id="doc-1",
        source="warranty.txt",
        chunks=["One-year limited hardware warranty covers manufacturing defects."],
    )
    assert len(query_project("p-drop", "warranty", top_k=2)) == 1

    delete_project("p-drop")
    assert query_project("p-drop", "warranty", top_k=2) == []

    # Deleting a non-existent or already-deleted project should not raise.
    delete_project("never-created")


def test_vector_store_validation_errors(tmp_chroma) -> None:
    with pytest.raises(ValueError, match="chunks"):
        ingest_document("p1", "d1", "a.txt", [])

    with pytest.raises(ValueError, match="empty"):
        ingest_document("p1", "d1", "a.txt", ["valid chunk", "   "])

    with pytest.raises(ValueError, match="project_id"):
        ingest_document("  ", "d1", "a.txt", ["hello"])

    with pytest.raises(ValueError, match="top_k"):
        query_project("p1", "refund", top_k=0)

    with pytest.raises(ValueError, match="Query text"):
        query_project("p1", "   ", top_k=2)

