#!/usr/bin/env python3
"""RAGShield CLI Test Suite Runner.

Executes baseline or protected attack suites against the RAG pipeline,
aggregates deterministic metrics, prints summary tables, and exports
full JSON results.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
import time
import uuid
from datetime import UTC, datetime
from pathlib import Path

from dotenv import load_dotenv

# Ensure ai-service root is in sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
AI_SERVICE_ROOT = SCRIPT_DIR.parent
if str(AI_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(AI_SERVICE_ROOT))

from app.attacks import AttackCase, CaseResult, execute_case, load_cases  # noqa: E402
from app.core.config import clear_settings  # noqa: E402
from app.evaluation.metrics import Metrics, aggregate  # noqa: E402
from app.rag.pipeline import DefenseConfig, ScannerConfig, ToggleConfig  # noqa: E402
from app.rag.vector_store import delete_project, ingest_demo_corpus  # noqa: E402

logging.basicConfig(level=logging.WARNING, format="%(levelname)s: %(message)s")
logger = logging.getLogger("run_suite")

REPO_ROOT = AI_SERVICE_ROOT.parent
DEFAULT_SEED_PATH = REPO_ROOT / "server" / "seed" / "attack_cases.json"


def build_argument_parser() -> argparse.ArgumentParser:
    """Construct CLI argument parser for suite runner."""
    parser = argparse.ArgumentParser(
        prog="run_suite.py",
        description="RAGShield Test Suite Runner CLI",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--mode",
        choices=["baseline", "protected"],
        default="baseline",
        help="Execution mode (baseline: defenses off; protected: defenses on)",
    )
    parser.add_argument(
        "--repeats",
        type=int,
        default=1,
        help="Number of repeat executions for each test case",
    )
    parser.add_argument(
        "--provider",
        choices=["mock", "gemini"],
        default="mock",
        help="LLM provider to execute queries against",
    )
    parser.add_argument(
        "--categories",
        nargs="*",
        default=None,
        help="Optional categories to filter (e.g. --categories AT-01 AT-02 or AT-01,AT-02)",
    )
    parser.add_argument(
        "--defenses",
        type=str,
        default=None,
        help="Comma-separated defenses for protected mode (from di,ds,iso,ov)",
    )
    parser.add_argument(
        "--ablation",
        action="store_true",
        default=False,
        help="Run ablation matrix across individual defenses and combined",
    )
    parser.add_argument(
        "--out",
        type=str,
        default="results.json",
        help="Path to write full JSON results output",
    )
    return parser


def parse_categories_arg(categories_arg: list[str] | None) -> list[str] | None:
    """Normalize categories list from command-line arguments."""
    if not categories_arg:
        return None
    cats: list[str] = []
    for item in categories_arg:
        for part in item.split(","):
            cleaned = part.strip().upper()
            if cleaned and cleaned not in cats:
                cats.append(cleaned)
    return cats if cats else None


def parse_defense_config(mode: str, defenses_flag: str | None) -> DefenseConfig:
    """Build DefenseConfig matching architecture.md §9."""
    if mode == "baseline":
        return DefenseConfig(
            input_scanner=ScannerConfig(enabled=False),
            document_scanner=ScannerConfig(enabled=False),
            instruction_isolation=ToggleConfig(enabled=False),
            output_validator=ToggleConfig(enabled=False),
        )

    if defenses_flag:
        enabled_set = {d.strip().lower() for d in defenses_flag.split(",") if d.strip()}
    else:
        # Default in protected mode: all defenses enabled
        enabled_set = {"di", "ds", "iso", "ov"}

    return DefenseConfig(
        input_scanner=ScannerConfig(enabled="di" in enabled_set),
        document_scanner=ScannerConfig(enabled="ds" in enabled_set),
        instruction_isolation=ToggleConfig(enabled="iso" in enabled_set),
        output_validator=ToggleConfig(enabled="ov" in enabled_set),
    )


def format_metrics_table(
    metrics: Metrics,
    *,
    mode: str,
    provider: str,
    repeats: int,
    duration_s: float,
    interrupted: bool = False,
) -> str:
    """Generate aligned human-readable ASCII tables for metrics display."""
    lines: list[str] = []
    width = 86
    sep = "=" * width
    subsep = "-" * width

    # Header section
    lines.append(sep)
    lines.append("RAGShield Evaluation Report".center(width))
    lines.append(sep)
    status_str = "INTERRUPTED (partial results)" if interrupted else "COMPLETED"
    mode_desc = "defenses enabled" if mode == "protected" else "defenses disabled"
    lines.append(f"Mode:         {mode.upper()} ({mode_desc})")
    lines.append(f"Provider:     {provider}")
    lines.append(f"Repeats:      {repeats}")
    total_runs = metrics.totals.attack_runs + metrics.totals.benign_runs
    lines.append(
        f"Total Runs:   {total_runs} "
        f"({metrics.totals.attack_runs} attack, {metrics.totals.benign_runs} benign)"
    )
    lines.append(
        f"Eligible:     {metrics.totals.eligible_attack_runs} attack, "
        f"{metrics.totals.eligible_benign_runs} benign (Errors: {metrics.totals.errors})"
    )
    lines.append(f"Duration:     {duration_s:.2f}s")
    lines.append(f"Status:       {status_str}")
    lines.append(sep)
    lines.append("")

    # Overall metrics section
    lines.append(subsep)
    lines.append("OVERALL METRICS SUMMARY".center(width))
    lines.append(subsep)
    lines.append(f"{'Metric':<46} {'Value':>38}")
    lines.append(subsep)

    lines.append(f"{'Attack Success Rate (ASR)':<46} {metrics.asr.mean:>34.2f}%")
    repeat_range = f"[{metrics.asr.min:.2f}%, {metrics.asr.max:.2f}%]"
    lines.append(f"{'  - Repeat Range [min, max]':<46} {repeat_range:>38}")
    lines.append(f"{'Defense Blocking Rate':<46} {metrics.blocking_rate:>34.2f}%")
    lines.append(f"{'Model Safe / Refusal Rate':<46} {metrics.safe_rate:>34.2f}%")
    lines.append(
        f"{'Detection Rate (DF-01, DF-02, DF-05)':<46} {metrics.detection_rate:>34.2f}%"
    )
    fnr_str = f"{metrics.fnr:.2f}%" if metrics.fnr is not None else "N/A (baseline)"
    lines.append(f"{'False Negative Rate (FNR)':<46} {fnr_str:>38}")
    lines.append(f"{'Undetected Success Rate':<46} {metrics.undetected_success_rate:>34.2f}%")
    lines.append(f"{'Benign False Positive Rate (FPR)':<46} {metrics.benign.fpr:>34.2f}%")
    lines.append(f"{'Benign Answer Success Rate':<46} {metrics.benign.success_rate:>34.2f}%")
    lines.append(f"{'Average Latency (all eligible)':<46} {f'{metrics.latency.avg_ms:.2f} ms':>38}")
    lines.append(
        f"{'  - Attack Latency':<46} {f'{metrics.latency.avg_attack_ms:.2f} ms':>38}"
    )
    lines.append(
        f"{'  - Benign Latency':<46} {f'{metrics.latency.avg_benign_ms:.2f} ms':>38}"
    )
    lines.append(
        f"{'  - Defense Overhead':<46} {f'{metrics.latency.avg_defense_ms:.2f} ms':>38}"
    )
    lines.append(f"{'Ambiguous Refusal Count':<46} {metrics.ambiguous_count:>38}")
    lines.append(f"{'Provider Blocked Count':<46} {metrics.provider_blocked_count:>38}")
    lines.append(subsep)
    lines.append("")

    # Per-Category section
    lines.append(subsep)
    lines.append("PER-CATEGORY BREAKDOWN".center(width))
    lines.append(subsep)
    lines.append(f"{'Category':<10} {'Runs':>6} {'ASR (%)':>12} {'Block (%)':>12} {'Safe (%)':>12}")
    lines.append(subsep)

    for cat_id in sorted(metrics.per_category.keys()):
        cat_data = metrics.per_category[cat_id]
        lines.append(
            f"{cat_id:<10} {cat_data.runs:>6} {cat_data.asr:>11.2f}% "
            f"{cat_data.blocking_rate:>11.2f}% {cat_data.safe_rate:>11.2f}%"
        )
    # Benign row
    lines.append(
        f"{'BENIGN':<10} {metrics.totals.benign_runs:>6} {'N/A':>12} "
        f"{metrics.benign.fpr:>11.2f}% {metrics.benign.success_rate:>11.2f}%"
    )
    lines.append(subsep)
    lines.append("")

    # Per-Defense section
    lines.append(subsep)
    lines.append("DEFENSE DETECTION STATS".center(width))
    lines.append(subsep)
    lines.append(f"{'Defense':<28} {'Triggers':>26} {'Blocks':>28}")
    lines.append(subsep)
    for def_id, def_data in sorted(metrics.per_defense.items()):
        name_map = {
            "DF-01": "DF-01 (Input Scanner)",
            "DF-02": "DF-02 (Document Scanner)",
            "DF-05": "DF-05 (Output Validator)",
        }
        label = name_map.get(def_id, def_id)
        lines.append(f"{label:<28} {def_data.triggers:>26} {def_data.blocks:>28}")
    lines.append(subsep)

    return "\n".join(lines)


async def run_single_suite(
    *,
    cases: list[AttackCase],
    mode: str,
    repeats: int,
    provider: str,
    defense_config: DefenseConfig,
    project_id: str,
) -> tuple[Metrics, list[CaseResult], bool]:
    """Execute test suite sequentially, returning (Metrics, CaseResults, was_interrupted)."""
    results: list[CaseResult] = []
    interrupted = False
    total_runs = len(cases) * repeats
    run_idx = 0

    print(
        f"\n[INFO] Running {total_runs} tests sequentially "
        f"(repeats={repeats}, mode={mode}, provider={provider})..."
    )

    try:
        for rep in range(1, repeats + 1):
            for case in cases:
                run_idx += 1
                res = await execute_case(
                    project_id=project_id,
                    case=case,
                    defense_config=defense_config,
                    repeat_index=rep,
                )
                results.append(res)
                pad = len(str(total_runs))
                print(
                    f"[{run_idx:>{pad}}/{total_runs}] (rep {rep}) "
                    f"{case.case_id} [{case.category}] -> "
                    f"{res.outcome:<22} ({res.latency_ms:>3}ms)"
                )
    except (KeyboardInterrupt, asyncio.CancelledError):
        print("\n\n[WARNING] Run interrupted by user (Ctrl-C). Processing partial results...")
        interrupted = True

    defenses_enabled = mode == "protected"
    metrics = aggregate(results, defenses_enabled=defenses_enabled)
    return metrics, results, interrupted


async def run_ablation_suite(
    *,
    cases: list[AttackCase],
    repeats: int,
    provider: str,
    project_id: str,
) -> dict:
    """Execute ablation matrix across individual defenses and combined."""
    configs = [
        ("Baseline (none)", "baseline", DefenseConfig()),
        (
            "DF-01 only (input)",
            "protected",
            DefenseConfig(input_scanner=ScannerConfig(enabled=True)),
        ),
        (
            "DF-02 only (doc)",
            "protected",
            DefenseConfig(document_scanner=ScannerConfig(enabled=True)),
        ),
        (
            "DF-03 only (iso)",
            "protected",
            DefenseConfig(instruction_isolation=ToggleConfig(enabled=True)),
        ),
        (
            "DF-05 only (output)",
            "protected",
            DefenseConfig(output_validator=ToggleConfig(enabled=True)),
        ),
        (
            "All Combined",
            "protected",
            DefenseConfig(
                input_scanner=ScannerConfig(enabled=True),
                document_scanner=ScannerConfig(enabled=True),
                instruction_isolation=ToggleConfig(enabled=True),
                output_validator=ToggleConfig(enabled=True),
            ),
        ),
    ]

    ablation_results: dict[str, dict] = {}
    print("\n" + "=" * 86)
    print("STARTING DEFENSE ABLATION EXPERIMENT".center(86))
    print("=" * 86)

    for label, mode, cfg in configs:
        print(f"\n>>> Running Ablation Configuration: {label}")
        t0 = time.perf_counter()
        metrics, results, interrupted = await run_single_suite(
            cases=cases,
            mode=mode,
            repeats=repeats,
            provider=provider,
            defense_config=cfg,
            project_id=project_id,
        )
        elapsed = time.perf_counter() - t0
        ablation_results[label] = {
            "mode": mode,
            "metrics": metrics,
            "results": results,
            "duration": elapsed,
            "interrupted": interrupted,
        }
        if interrupted:
            break

    # Print Ablation Summary Table
    width = 86
    subsep = "-" * width
    print("\n" + "=" * width)
    print("ABLATION COMPARISON MATRIX".center(width))
    print("=" * width)
    print(
        f"{'Configuration':<24} {'ASR (%)':>10} {'Block (%)':>12} "
        f"{'Safe (%)':>10} {'FPR (%)':>10} {'Avg Lat (ms)':>14}"
    )
    print(subsep)
    for label, data in ablation_results.items():
        m: Metrics = data["metrics"]
        print(
            f"{label:<24} {m.asr.mean:>9.2f}% {m.blocking_rate:>11.2f}% "
            f"{m.safe_rate:>9.2f}% {m.benign.fpr:>9.2f}% {m.latency.avg_ms:>13.2f}"
        )
    print("=" * width + "\n")
    return ablation_results


async def main_async(args: argparse.Namespace) -> int:
    """Async main entry point."""
    start_time = time.perf_counter()

    # Configure provider
    os.environ["LLM_PROVIDER"] = args.provider
    clear_settings()

    # Load attack cases
    if not DEFAULT_SEED_PATH.exists():
        err = f"[ERROR] Seed cases file not found at: {DEFAULT_SEED_PATH.resolve()}"
        print(err, file=sys.stderr)
        return 1

    all_cases = load_cases(DEFAULT_SEED_PATH)
    categories_filter = parse_categories_arg(args.categories)

    if categories_filter:
        cases = [c for c in all_cases if c.category.upper() in categories_filter]
        print(
            f"[INFO] Filtered {len(cases)} cases matching categories: "
            f"{', '.join(categories_filter)}"
        )
    else:
        cases = all_cases
        n_att = sum(1 for c in cases if not c.is_benign)
        n_ben = sum(1 for c in cases if c.is_benign)
        print(f"[INFO] Loaded all {len(cases)} cases ({n_att} attack, {n_ben} benign).")

    if not cases:
        print("[ERROR] No cases matched the selected criteria.", file=sys.stderr)
        return 1

    # Create temporary project and ingest demo KB
    temp_project_id = f"suite_{uuid.uuid4().hex[:10]}"
    print(f"[INFO] Creating temporary vector collection: proj_{temp_project_id}")
    try:
        demo_docs = ingest_demo_corpus(temp_project_id)
        total_chunks = sum(d["chunk_count"] for d in demo_docs)
        print(f"[INFO] Ingested demo KB ({len(demo_docs)} docs, {total_chunks} chunks).")
    except Exception as exc:
        print(f"[ERROR] Failed to ingest demo KB: {exc}", file=sys.stderr)
        return 1

    try:
        if args.ablation:
            ablation_data = await run_ablation_suite(
                cases=cases,
                repeats=args.repeats,
                provider=args.provider,
                project_id=temp_project_id,
            )
            elapsed = time.perf_counter() - start_time
            if args.out:
                out_path = Path(args.out)
                out_path.parent.mkdir(parents=True, exist_ok=True)
                payload = {
                    "ablation": True,
                    "provider": args.provider,
                    "repeats": args.repeats,
                    "categories": categories_filter,
                    "durationSeconds": round(elapsed, 2),
                    "timestamp": datetime.now(UTC).isoformat(),
                    "configurations": {
                        k: {
                            "mode": v["mode"],
                            "durationSeconds": round(v["duration"], 2),
                            "interrupted": v["interrupted"],
                            "metrics": v["metrics"].model_dump(by_alias=True),
                            "results": [r.model_dump(by_alias=True) for r in v["results"]],
                        }
                        for k, v in ablation_data.items()
                    },
                }
                with out_path.open("w", encoding="utf-8") as f:
                    json.dump(payload, f, indent=2)
                print(f"[INFO] Ablation report exported to: {out_path.resolve()}")
            return 0

        # Normal single mode execution
        defense_config = parse_defense_config(args.mode, args.defenses)
        metrics, results, interrupted = await run_single_suite(
            cases=cases,
            mode=args.mode,
            repeats=args.repeats,
            provider=args.provider,
            defense_config=defense_config,
            project_id=temp_project_id,
        )
        elapsed = time.perf_counter() - start_time

        # Print human-readable report table
        table_output = format_metrics_table(
            metrics,
            mode=args.mode,
            provider=args.provider,
            repeats=args.repeats,
            duration_s=elapsed,
            interrupted=interrupted,
        )
        print("\n" + table_output + "\n")

        # Write results JSON
        if args.out:
            out_path = Path(args.out)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            payload = {
                "mode": args.mode,
                "provider": args.provider,
                "repeats": args.repeats,
                "defensesEnabled": args.mode == "protected",
                "defenseConfig": defense_config.model_dump(by_alias=True),
                "categories": categories_filter,
                "interrupted": interrupted,
                "durationSeconds": round(elapsed, 2),
                "timestamp": datetime.now(UTC).isoformat(),
                "metrics": metrics.model_dump(by_alias=True),
                "results": [r.model_dump(by_alias=True) for r in results],
            }
            with out_path.open("w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2)
            print(f"[INFO] Full JSON report exported to: {out_path.resolve()}")

        return 0
    finally:
        # Cleanup temporary collection
        print(f"[INFO] Cleaning up temporary Chroma collection: proj_{temp_project_id}")
        delete_project(temp_project_id)


def main() -> None:
    env_file = AI_SERVICE_ROOT / ".env"
    if env_file.exists():
        load_dotenv(env_file)
    if not os.environ.get("INTERNAL_SERVICE_KEY"):
        os.environ["INTERNAL_SERVICE_KEY"] = "dev-internal-key-ragshield-local-only"

    parser = build_argument_parser()
    args = parser.parse_args()
    code = asyncio.run(main_async(args))
    sys.exit(code)


if __name__ == "__main__":
    main()
