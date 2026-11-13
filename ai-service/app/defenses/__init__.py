"""Defenses module: pattern engine, scanners, and validators."""

from app.defenses.patterns import PATTERNS, ScannerPattern
from app.defenses.scanner import PatternMatch, ScanResult, normalize_text, scan_text

__all__ = [
    "PATTERNS",
    "PatternMatch",
    "ScanResult",
    "ScannerPattern",
    "normalize_text",
    "scan_text",
]
