"""Tests for document text extraction and whitespace-boundary chunking (T1.2)."""

from __future__ import annotations

import io

import pymupdf
import pytest
from docx import Document

from app.rag.chunker import chunk_text
from app.rag.extractors import extract_text


def _make_pdf_bytes(pages: list[str]) -> bytes:
    """Create a real in-memory PDF fixture using PyMuPDF."""
    doc = pymupdf.open()
    for content in pages:
        page = doc.new_page()
        page.insert_text((72, 72), content)
    return doc.tobytes()


def _make_docx_bytes(paragraphs: list[str], table_rows: list[list[str]] | None = None) -> bytes:
    """Create a real in-memory DOCX fixture using python-docx."""
    doc = Document()
    for p in paragraphs:
        doc.add_paragraph(p)
    if table_rows:
        table = doc.add_table(rows=len(table_rows), cols=len(table_rows[0]))
        for r_idx, row in enumerate(table_rows):
            for c_idx, val in enumerate(row):
                table.cell(r_idx, c_idx).text = val
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def _longest_overlap(prev_chunk: str, next_chunk: str) -> int:
    """Return length of longest suffix of prev_chunk that is a prefix of next_chunk."""
    max_k = min(len(prev_chunk), len(next_chunk))
    for k in range(max_k, 0, -1):
        if prev_chunk.endswith(next_chunk[:k]):
            return k
    return 0


def _reconstruct_without_overlap(chunks: list[str]) -> str:
    """Reassemble chunks by collapsing consecutive suffix/prefix overlaps."""
    if not chunks:
        return ""
    out = chunks[0]
    for nxt in chunks[1:]:
        k = _longest_overlap(out, nxt)
        suffix = nxt[k:].lstrip()
        if k > 0 and out.endswith(nxt[:k]) and not nxt[:k].endswith(" ") and suffix:
            # Overlap ended at a word boundary when overlap > 0, or mid-word on hard split.
            out = out + (" " if k < len(nxt) and nxt[k] == " " else "") + nxt[k:].lstrip()
        elif k == 0:
            out = out + " " + nxt
        else:
            out = out + nxt[k:]
    return " ".join(out.split())


class TestExtractText:
    def test_extract_txt_utf8_and_bom(self):
        raw = "\ufeffAcme Retail refund policy — 30 days. Café résumé.".encode()
        text = extract_text("policy.txt", raw)
        assert "Acme Retail refund policy" in text
        assert "30 days" in text
        assert "Café résumé." in text

    def test_extract_txt_replaces_invalid_utf8_bytes(self):
        raw = b"Valid header \xff\xfe invalid bytes end"
        text = extract_text("broken.TXT", raw)
        assert "Valid header" in text
        assert "\ufffd" in text
        assert "end" in text

    def test_extract_pdf_multi_page(self):
        pdf_bytes = _make_pdf_bytes([
            "Page one: standard refund window is 30 days.",
            "Page two: shipping takes 3 to 5 business days.",
        ])
        text = extract_text("guide.pdf", pdf_bytes)
        assert "standard refund window is 30 days" in text
        assert "shipping takes 3 to 5 business days" in text

    def test_extract_docx_paragraphs_and_table(self):
        docx_bytes = _make_docx_bytes(
            paragraphs=["Warranty covers 2 years for electronics."],
            table_rows=[["Tier", "Transit"], ["Express", "2 business days"]],
        )
        text = extract_text("warranty.docx", docx_bytes)
        assert "Warranty covers 2 years for electronics." in text
        assert "Express" in text
        assert "2 business days" in text

    @pytest.mark.parametrize(
        "filename,data",
        [
            ("empty.txt", b""),
            ("spaces.txt", b"   \n\t  "),
            ("empty.pdf", b""),
            ("garbage.pdf", b"not actually a pdf"),
            ("empty.docx", b""),
            ("garbage.docx", b"PK\x03\x04corrupted-zip"),
            ("image.png", b"\x89PNG\r\n\x1a\n"),
            ("noext", b"hello"),
            ("", b"hello"),
        ],
    )
    def test_empty_corrupted_or_unsupported_raises_value_error(self, filename, data):
        with pytest.raises(ValueError) as exc_info:
            extract_text(filename, data)
        assert str(exc_info.value).strip()

    def test_blank_pdf_and_blank_docx_raise_value_error(self):
        blank_pdf = _make_pdf_bytes(["   "])
        blank_docx = _make_docx_bytes(["   "])
        with pytest.raises(ValueError, match="no extractable text"):
            extract_text("blank.pdf", blank_pdf)
        with pytest.raises(ValueError, match="no extractable text"):
            extract_text("blank.docx", blank_docx)


class TestChunkText:
    def test_validation_errors(self):
        with pytest.raises(ValueError, match="size"):
            chunk_text("hello world", size=0, overlap=0)
        with pytest.raises(ValueError, match="overlap"):
            chunk_text("hello world", size=100, overlap=-1)
        with pytest.raises(ValueError, match="overlap"):
            chunk_text("hello world", size=100, overlap=100)
        with pytest.raises(ValueError, match="overlap"):
            chunk_text("hello world", size=100, overlap=120)

    def test_empty_and_short_text(self):
        assert chunk_text("", size=100, overlap=20) == []
        assert chunk_text("   \n\t  ", size=100, overlap=20) == []
        assert chunk_text("  hello   world  ", size=100, overlap=20) == ["hello world"]

    def test_invariants_on_realistic_prose(self):
        sentences = [
            f"Clause {i}: Acme Retail accepts returns within 30 days for order ref {100 + i}."
            for i in range(1, 13)
        ]
        text = " ".join(sentences)
        size = 140
        overlap = 35

        chunks = chunk_text(text, size=size, overlap=overlap)
        assert len(chunks) > 2
        words_set = set(text.split())

        for idx, chunk in enumerate(chunks):
            assert chunk != ""
            assert len(chunk) <= size
            assert chunk == chunk.strip()
            chunk_words = chunk.split()
            assert chunk_words[0] in words_set
            assert chunk_words[-1] in words_set
            # Ensure whitespace boundaries: overlap stays close to requested overlap.
            if idx > 0:
                ov = _longest_overlap(chunks[idx - 1], chunk)
                assert ov >= overlap - 15
                assert ov <= overlap + 25

        # Full text coverage in exact order.
        normalized = " ".join(text.split())
        reconstructed = _reconstruct_without_overlap(chunks)
        assert reconstructed == normalized

    def test_zero_overlap_covers_all_words_without_duplication(self):
        words = [f"word{i}" for i in range(40)]
        text = " ".join(words)
        chunks = chunk_text(text, size=50, overlap=0)

        assert len(chunks) > 1
        for chunk in chunks:
            assert 0 < len(chunk) <= 50
        assert " ".join(chunks) == text

    def test_long_single_token_still_obeys_max_size(self):
        long_token = "".join(f"{i:03d}" for i in range(80))  # 240 unique-sequence chars
        chunks = chunk_text(long_token, size=80, overlap=15)
        assert len(chunks) >= 3
        for idx, chunk in enumerate(chunks):
            assert 0 < len(chunk) <= 80
            if idx > 0:
                assert _longest_overlap(chunks[idx - 1], chunk) == 15
        assert _reconstruct_without_overlap(chunks) == long_token
