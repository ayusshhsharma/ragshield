"""Synthetic demo knowledge-base corpus for RAGShield."""

from __future__ import annotations

from pathlib import Path

SEED_DIR = Path(__file__).resolve().parent

SEED_FILENAMES: tuple[str, ...] = (
    "refund_policy.txt",
    "shipping_faq.txt",
    "product_warranty.txt",
    "internal_admin_notes.txt",
    "customer_records.txt",
)
