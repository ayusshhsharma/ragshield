# Results — RAGShield experiments

**Human-owned.** Fill only from real runs (T6.5). The agent must never write numbers here. Source of truth: exported JSON reports in `docs/results/`.

## Setup
| Item | Value |
|---|---|
| Date | |
| Model id (`GEMINI_MODEL`) | |
| Temperature | |
| Embedding model | |
| Chunk size / overlap / top-K | |
| System prompt | default (`architecture.md §10`) |
| Attack cases / benign cases | 48 / 10 |
| Repeats | 3 |
| Errors excluded (count) | |
| Run IDs / export files | |

## Baseline vs protected (all four defenses)
| Metric | Baseline | Protected | Delta |
|---|---|---|---|
| ASR mean [min–max] | | | |
| Blocking rate | | | |
| Safe rate | | | |
| Detection rate | | | |
| FNR (miss rate) | n/a | | |
| FPR | | | |
| Benign success rate | | | |
| Avg latency (ms) | | | |
| Defense overhead (ms) | n/a | | |

## Per-category ASR
| Category | Baseline | Protected |
|---|---|---|
| AT-01 | | |
| AT-02 | | |
| AT-03 | | |
| AT-04 | | |
| AT-05 | | |
| AT-06 | | |
| AT-07 | | |
| AT-08 | | |

## Ablation (one defense at a time)
| Defenses enabled | ASR | Blocking | FPR | Benign success | Avg latency |
|---|---|---|---|---|---|
| none (baseline) | | | | | |
| DF-01 only | | | | | |
| DF-02 only | | | | | |
| DF-03 only | | | | | |
| DF-05 only | | | | | |
| all | | | | | |

## Observations (write honestly)
- Which attacks still succeeded under all defenses, and why?
- Which defense helped most / cost most in false positives?
- Which categories were hardest (e.g. Hinglish bypass of the scanner)?
- Ambiguous / providerBlocked counts and how they were reviewed:
- Anything surprising or any success condition corrected after review:

## Reproduce
Commands, commit hash, and environment used:
