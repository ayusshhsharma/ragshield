"""Defenses module: pattern engine, scanners, and validators."""

from app.defenses.patterns import ALL_DOC_PATTERNS, DOC_PATTERNS, PATTERNS, ScannerPattern
from app.defenses.scanner import PatternMatch, ScanResult, normalize_text, scan_text

__all__ = [
    "ALL_DOC_PATTERNS",
    "DOC_PATTERNS",
    "PATTERNS",
    "PatternMatch",
    "ScanResult",
    "ScannerPattern",
    "normalize_text",
    "scan_text",
]

