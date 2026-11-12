"""Pure character-based text chunker splitting on whitespace boundaries."""

from __future__ import annotations


def chunk_text(text: str, size: int = 500, overlap: int = 80) -> list[str]:
    """Split text into chunks of at most `size` chars on whitespace boundaries.

    Consecutive chunks overlap by approximately `overlap` characters while
    preserving word boundaries wherever possible.
    """
    if size <= 0:
        raise ValueError("size must be positive.")
    if overlap < 0:
        raise ValueError("overlap must be non-negative.")
    if overlap >= size:
        raise ValueError("overlap must be less than size.")

    normalized = " ".join(text.split())
    if not normalized:
        return []

    total_len = len(normalized)
    if total_len <= size:
        return [normalized]

    chunks: list[str] = []
    start = 0

    while start < total_len:
        while start < total_len and normalized[start] == " ":
            start += 1
        if start >= total_len:
            break

        if total_len - start <= size:
            end = total_len
        else:
            limit = start + size
            if normalized[limit] == " ":
                end = limit
            else:
                space_idx = normalized.rfind(" ", start, limit)
                end = space_idx if space_idx > start else limit

        chunk = normalized[start:end].strip()
        if chunk:
            chunks.append(chunk)

        if end >= total_len:
            break

        if overlap == 0:
            start = end + 1 if normalized[end] == " " else end
            continue

        target = max(start + 1, end - overlap)
        if normalized[target - 1] == " ":
            next_start = target
        else:
            prev_space = normalized.rfind(" ", start, target)
            if prev_space != -1 and prev_space + 1 > start:
                next_start = prev_space + 1
            else:
                next_space = normalized.find(" ", target, end)
                next_start = next_space + 1 if next_space != -1 else target

        start = next_start

    return chunks
