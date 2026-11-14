"""Heuristic detection patterns for prompt injection defenses (architecture.md §9).

Pattern weights range between 0.3 and 0.8. Distinct matched weights are summed
and capped at 1.0. Flagged if score >= threshold (default 0.5).
"""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class ScannerPattern:
    """Detection rule with compiled regex and risk weight."""

    id: str
    group: str
    description: str
    regex: re.Pattern[str]
    weight: float


# ── Pattern Definitions ────────────────────────────────────────────────────────
PATTERNS: tuple[ScannerPattern, ...] = (
    # ── 1. English Instruction Override (weight 0.6 - 0.8) ──────────────────────
    ScannerPattern(
        id="EN-OVR-01",
        group="instruction_override",
        description="Ignore/disregard previous/prior/above/all instructions",
        regex=re.compile(
            r"\b(?:ignore|disregard|forget|override|bypass)\b.{0,40}\b(?:previous|prior|above|all|system|initial)\b.{0,40}\b(?:instructions?|prompts?|rules?|directives?|guidelines?)\b",
            re.IGNORECASE,
        ),
        weight=0.8,
    ),
    ScannerPattern(
        id="EN-OVR-02",
        group="instruction_override",
        description="Ignore all instructions / rules directly",
        regex=re.compile(
            r"\b(?:ignore|disregard|forget)\b\s+(?:all\s+)?(?:instructions?|rules?|directives?)\b",
            re.IGNORECASE,
        ),
        weight=0.7,
    ),
    ScannerPattern(
        id="EN-OVR-03",
        group="instruction_override",
        description="New instructions / updated directives override",
        regex=re.compile(
            r"\b(?:new\s+instructions?|updated\s+directives?|from\s+now\s+on\s+you\s+(?:must|should|will))\b.{0,30}\b(?:follow|obey|execute|adhere)\b",
            re.IGNORECASE,
        ),
        weight=0.6,
    ),
    ScannerPattern(
        id="EN-OVR-04",
        group="instruction_override",
        description="Commanding model to ignore context / rules",
        regex=re.compile(
            r"\b(?:do\s+not\s+follow|stop\s+following)\b.{0,30}\b(?:any\s+rules?|previous\s+instructions?|system\s+prompt)\b",
            re.IGNORECASE,
        ),
        weight=0.7,
    ),

    # ── 2. English Prompt Disclosure (weight 0.6 - 0.8) ────────────────────────
    ScannerPattern(
        id="EN-DSC-01",
        group="prompt_disclosure",
        description="Reveal/print/repeat system prompt or hidden instructions",
        regex=re.compile(
            r"\b(?:reveal|print|repeat|show|display|leak|output|echo|tell\s+me)\b.{0,30}\b(?:system|hidden|developer|initial)\b.{0,20}\b(?:prompts?|instructions?|messages?|rules?|directives?)\b",
            re.IGNORECASE,
        ),
        weight=0.8,
    ),
    ScannerPattern(
        id="EN-DSC-02",
        group="prompt_disclosure",
        description="Querying system prompt or verbatim initial instructions",
        regex=re.compile(
            r"\b(?:what\s+(?:is|was|are)\s+your\s+(?:exact\s+)?(?:system\s+prompt|instructions?)|repeat\s+(?:the\s+)?(?:above|previous|initial)\s+text\s+verbatim)\b",
            re.IGNORECASE,
        ),
        weight=0.7,
    ),

    # ── 3. Role Switch / Jailbreak (weight 0.6 - 0.8) ──────────────────────────
    ScannerPattern(
        id="EN-RLS-01",
        group="role_switch",
        description="Pretend/act as an unrestricted AI or DAN",
        regex=re.compile(
            r"\b(?:you\s+are\s+now|act\s+as|pretend\s+to\s+be|simulate|roleplay\s+as)\b.{0,40}\b(?:dan|developer\s+mode|jailbreak|unrestricted|an?\s+ai\s+without\s+rules|an?\s+unfiltered\s+ai)\b",
            re.IGNORECASE,
        ),
        weight=0.8,
    ),
    ScannerPattern(
        id="EN-RLS-02",
        group="role_switch",
        description="Developer mode or jailbreak activation command",
        regex=re.compile(
            r"\b(?:developer\s+mode\s+(?:enabled|activated|on)|do\s+anything\s+now|jailbreak\s+mode)\b",
            re.IGNORECASE,
        ),
        weight=0.8,
    ),

    # ── 4. Delimiter Spoofing (weight 0.6 - 0.7) ───────────────────────────────
    ScannerPattern(
        id="EN-DLM-01",
        group="delimiter_spoofing",
        description="Spoofed system, context, or inst XML/bracket tags",
        regex=re.compile(
            r"</?(?:system|instructions?|user|assistant|untrusted_context|context|human)>",
            re.IGNORECASE,
        ),
        weight=0.7,
    ),
    ScannerPattern(
        id="EN-DLM-02",
        group="delimiter_spoofing",
        description="Spoofed chat markdown headers or inst tags",
        regex=re.compile(
            r"(?:###\s*(?:system|instruction|user|human)|\[\/?(?:inst|system|user)\])",
            re.IGNORECASE,
        ),
        weight=0.7,
    ),

    # ── 5. Exfiltration Verbs & Links (weight 0.5 - 0.7) ───────────────────────
    ScannerPattern(
        id="EN-EXF-01",
        group="exfiltration",
        description="Exfiltrate data to URL or webhook",
        regex=re.compile(
            r"\b(?:send|post|transmit|exfiltrate|forward|include)\b.{0,30}\b(?:(?:https?|ftp)://|to\s+url|via\s+webhook)\b",
            re.IGNORECASE,
        ),
        weight=0.7,
    ),
    ScannerPattern(
        id="EN-EXF-02",
        group="exfiltration",
        description="Markdown image or link exfiltration attempt",
        regex=re.compile(
            r"!\[.*?\]\((?:https?://[^\s)]+)\)",
            re.IGNORECASE,
        ),
        weight=0.6,
    ),

    # ── 6. Encoding & Evasion Hints (weight 0.4 - 0.6) ─────────────────────────
    ScannerPattern(
        id="EN-ENC-01",
        group="encoding_evasion",
        description="Instruction to decode base64/rot13/hex payload",
        regex=re.compile(
            r"\b(?:decode|decrypt|evaluate)\b.{0,30}\b(?:base64|rot13|rot-13|hex|ascii|ciphers?)\b",
            re.IGNORECASE,
        ),
        weight=0.5,
    ),
    ScannerPattern(
        id="EN-ENC-02",
        group="encoding_evasion",
        description="Encoded in base64 / rot13 text hint",
        regex=re.compile(
            r"\b(?:encoded\s+in\s+base64|in\s+rot13|rot-13|base64\s+encoded)\b",
            re.IGNORECASE,
        ),
        weight=0.4,
    ),

    # ── 7. Hinglish (Roman Hindi) (weight 0.6 - 0.8) ───────────────────────────
    ScannerPattern(
        id="HI-ROM-01",
        group="hinglish",
        description="Pichle nirdesh ignore / bhool jao",
        regex=re.compile(
            r"\b(?:pichhl?e|purane|upar\s+ke)\s+(?:nirdesh|instructions?|aadesh|baatein)\s*(?:ko)?\s*(?:ignore|bhool|bhula)\b",
            re.IGNORECASE,
        ),
        weight=0.8,
    ),
    ScannerPattern(
        id="HI-ROM-02",
        group="hinglish",
        description="Sab instructions / nirdesh bhool jao",
        regex=re.compile(
            r"\b(?:sab|saare)\s+(?:instructions?|nirdesh|aadesh|rules?)\s*(?:ko)?\s*(?:bhool\s+jao|ignore\s+karo|hatao)\b",
            re.IGNORECASE,
        ),
        weight=0.8,
    ),
    ScannerPattern(
        id="HI-ROM-03",
        group="hinglish",
        description="System prompt batao / dikhao",
        regex=re.compile(
            r"\b(?:system\s+prompt|system\s+instructions?)\s*(?:kya\s+hai|batao|dikhao|likho|repeat\s+karo)\b",
            re.IGNORECASE,
        ),
        weight=0.8,
    ),
    ScannerPattern(
        id="HI-ROM-04",
        group="hinglish",
        description="Instructions ignore karo / dhyan mat do",
        regex=re.compile(
            r"\b(?:nirdesh|rules?|instructions?)\s*(?:ko)?\s*(?:ignore|dhyan\s+mat\s+do|ansuna)\s+karo\b",
            re.IGNORECASE,
        ),
        weight=0.7,
    ),
    ScannerPattern(
        id="HI-ROM-05",
        group="hinglish",
        description="Secret / password batao",
        regex=re.compile(
            r"\b(?:apna\s+)?(?:secret(?:\s+code)?|password|gupt\s+code)\s*(?:kya\s+hai|batao|share\s+karo|dikhao)\b",
            re.IGNORECASE,
        ),
        weight=0.7,
    ),

    # ── 8. Devanagari (Hindi) (weight 0.6 - 0.8) ───────────────────────────────
    ScannerPattern(
        id="HI-DEV-01",
        group="devanagari",
        description="पिछले / पूर्व निर्देश अनदेखा / भूल",
        regex=re.compile(
            r"(?:पिछले|पूर्व|ऊपर\s*के)\s*(?:निर्देश|आदेश|नियमों?)\s*को?\s*(?:अनदेखा|भूल|नजरअंदाज)",
        ),
        weight=0.8,
    ),
    ScannerPattern(
        id="HI-DEV-02",
        group="devanagari",
        description="सिस्टम प्रॉम्प्ट दिखाओ / बताओ",
        regex=re.compile(
            r"(?:सिस्टम\s*प्रॉम्प्ट|सिस्टम\s*निर्देश)\s*(?:दिखाओ|बताओ|लिखो|प्रकट\s*करो)",
        ),
        weight=0.8,
    ),
    ScannerPattern(
        id="HI-DEV-03",
        group="devanagari",
        description="गुप्त कोड / पासवर्ड बताओ",
        regex=re.compile(
            r"(?:गुप्त\s*कोड|पासवर्ड|गोपनीय\s*सूचना)\s*(?:बताओ|दिखाओ|शेयर\s*करो)",
        ),
        weight=0.7,
    ),
    ScannerPattern(
        id="HI-DEV-04",
        group="devanagari",
        description="सभी / सारे निर्देश भूल जाओ",
        regex=re.compile(
            r"(?:सभी|सारे)\s*(?:निर्देश|नियम)\s*(?:भूल\s*जाओ|रद्द\s*करो|अनदेखा\s*करो)",
        ),
        weight=0.8,
    ),
)


# ── Document Imperative-Address Boost Patterns (DF-02) ────────────────────────
DOC_PATTERNS: tuple[ScannerPattern, ...] = (
    ScannerPattern(
        id="DOC-IMP-01",
        group="document_imperative",
        description="Note/instruction addressed specifically to the assistant or AI",
        regex=re.compile(
            r"\b(?:note\s+to\s+(?:the\s+)?(?:assistant|ai|model)|(?:system|ai)\s+note\b|ai\s+instructions?)\b",
            re.IGNORECASE,
        ),
        weight=0.5,
    ),
    ScannerPattern(
        id="DOC-IMP-02",
        group="document_imperative",
        description="Direct imperative addressed to assistant/AI/model",
        regex=re.compile(
            r"\b(?:assistant|ai|model)\b.{0,30}\b(?:ignore|disregard|forget|reply|output|begin|start|append|print|end|say|emit|conform|must|should|required\s+to)\b",
            re.IGNORECASE,
        ),
        weight=0.4,
    ),
    ScannerPattern(
        id="DOC-IMP-03",
        group="document_imperative",
        description="Forced output format directed at the assistant",
        regex=re.compile(
            r"\b(?:your\s+reply\s+must|your\s+response\s+must|you\s+must\s+(?:end|begin|start|output|reply|append))\b",
            re.IGNORECASE,
        ),
        weight=0.5,
    ),
    ScannerPattern(
        id="DOC-IMP-04",
        group="document_imperative",
        description="Operational / audit directive targeting assistant interactions",
        regex=re.compile(
            r"\b(?:support\s+system\s+requires\s+you\s+to|mandatory\s+step\s+required\s+by\s+(?:the\s+)?(?:operations\s+team|support|maintenance)\s+for\s+all\s+assistant\s+interactions)\b",
            re.IGNORECASE,
        ),
        weight=0.5,
    ),
    ScannerPattern(
        id="DOC-IMP-05",
        group="document_imperative",
        description="Hidden system/assistant directive comment in document text",
        regex=re.compile(
            r"<!--\s*(?:system\s+note\s+to\s+assistant|system|instruction)\b",
            re.IGNORECASE,
        ),
        weight=0.6,
    ),
)

ALL_DOC_PATTERNS: tuple[ScannerPattern, ...] = PATTERNS + DOC_PATTERNS

