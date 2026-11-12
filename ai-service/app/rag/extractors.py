"""Text extractors for TXT, PDF, and DOCX uploads."""

from __future__ import annotations

import io
from pathlib import Path

import pymupdf
from docx import Document

SUPPORTED_EXTENSIONS = frozenset({".txt", ".pdf", ".docx"})


def extract_text(filename: str, data: bytes) -> str:
    """Extract plain text from .txt, .pdf, or .docx bytes.

    Raises ValueError with a clear message on unsupported extensions,
    empty files, or unreadable/corrupted documents.
    """
    if not filename or not filename.strip():
        raise ValueError("Filename must not be empty.")

    ext = Path(filename).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise ValueError(
            f"Unsupported file type '{ext or '<none>'}'. Allowed extensions: .txt, .pdf, .docx."
        )

    if not data:
        raise ValueError("File is empty.")

    if ext == ".txt":
        return _extract_txt(data)
    if ext == ".pdf":
        return _extract_pdf(data)
    return _extract_docx(data)


def _extract_txt(data: bytes) -> str:
    text = data.decode("utf-8", errors="replace").lstrip("\ufeff").strip()
    if not text:
        raise ValueError("Text file contains no extractable text.")
    return text


def _extract_pdf(data: bytes) -> str:
    try:
        with pymupdf.open(stream=bytes(data), filetype="pdf") as doc:
            pages = [page.get_text("text") for page in doc]
    except Exception as exc:
        raise ValueError("Unreadable or corrupted PDF file.") from exc

    text = "\n".join(part.strip() for part in pages if part and part.strip()).strip()
    if not text:
        raise ValueError("PDF file contains no extractable text.")
    return text


def _extract_docx(data: bytes) -> str:
    try:
        doc = Document(io.BytesIO(data))
        parts: list[str] = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
        for table in doc.tables:
            for row in table.rows:
                row_text = " | ".join(
                    cell.text.strip() for cell in row.cells if cell.text.strip()
                )
                if row_text:
                    parts.append(row_text)
    except Exception as exc:
        raise ValueError("Unreadable or corrupted DOCX file.") from exc

    text = "\n".join(parts).strip()
    if not text:
        raise ValueError("DOCX file contains no extractable text.")
    return text
