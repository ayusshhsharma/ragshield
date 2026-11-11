# Testing — RAGShield

## 1. Principles
1. **No network in automated tests.** Gemini is never called in tests; use `MockProvider` / stubbed clients. Express tests mock the AI service with `nock`.
2. **Golden tests protect the numbers.** Evaluator and metrics have hand-written fixtures whose expected values were computed by a human. The agent must not edit expected values to make tests pass (`agents.md` NEVER #3).
3. **Pure functions first.** Evaluator, metrics, scanners, validator, chunker, prompt builders have no I/O and get dense unit tests.
4. **Every route has an auth test and a foreign-resource test.**
5. A bug fix always adds a regression test (`debugging.md`).

## 2. Tooling and commands
| Service | Runner | Command |
|---|---|---|
| ai-service | pytest, pytest-asyncio, ruff | `ruff check . && pytest -q` |
| server | Jest (ESM: `node --experimental-vm-modules node_modules/jest/bin/jest.js`), Supertest, mongodb-memory-server, nock | `npm run lint && npm test` (script wraps the ESM flag) |
| client | Vitest, Testing Library, jsdom | `npm run build && npm test` |
If `mongodb-memory-server` cannot download its binary (offline), use `MONGO_URI_TEST` pointing at the Docker mongo with a throwaway database name and drop it after the suite.

## 3. ai-service tests (`ai-service/tests/`)
| File | Must cover |
|---|---|
| `test_auth_health.py` | health open; missing/wrong key → 401 standard shape; startup fails without key |
| `test_extract_chunk.py` | txt/pdf/docx extraction; unicode; empty file error; chunk size/overlap invariants (every chunk ≤ size, consecutive overlap, no empty chunks, text coverage) |
| `test_vector_store.py` | ingest/query/delete; project isolation; idempotent re-ingest; delete project |
| `test_providers.py` | Mock behaviors; retry/backoff with fake clock; non-retryable error; Gemini wrapper with stub (empty text → providerBlocked) |
| `test_prompts.py` | naive vs isolated template exact structure; `</untrusted_context>` stripped from chunks |
| `test_evaluator.py` | golden fixture ≥ 25 rows; normalization (case, zero-width, NFKC); refusal-echo → ambiguous; order error → blocked → success → safe |
| `test_metrics.py` | hand-computed fixture; ASR+blocking+safe = 100; errors excluded; repeat ranges; FNR null when no defenses; per-category/per-defense; no NaN |
| `test_scanner.py` | ≥ 15 malicious (EN, Hinglish, Devanagari, spoofed delimiters, zero-width evasion) flagged; ≥ 15 benign not flagged; threshold behavior; seed docs not flagged |
| `test_doc_scanner.py` | poisoned chunk dropped; trigger lists dropped indexes |
| `test_output_validator.py` | each registry secret; link exfil; base64 secret; system prompt echo; benign answers pass |
| `test_pipeline.py` | order of steps; input block skips LLM (assert provider not called); defenses toggle independently; injected chunk positions; latency fields present |
| `test_run_case.py` | one case per category in naive Mock mode → attack_succeeded where expected; benign acceptable flag; provider error → `error` outcome |
| `test_cases_seed.py` | all 58 cases validate; unique caseIds; 6 per category; benign keywords present in seed text; regexes compile; no placeholder text like `<~` remains |

## 4. Server tests (`server/tests/`)
| File | Must cover |
|---|---|
| `auth.test.js` | register/login/me; duplicate; weak password; bad token; no passwordHash in responses; rate-limit on auth |
| `projects.test.js` | CRUD; validation of rag-config/defenses bounds; defaults |
| `documents.test.js` | type/size/magic-byte rejection; AI-service failure → failed status; demo KB twice → 409; delete cascade calls AI delete |
| `attacks.test.js` | seed idempotent = 58; filters; custom create validation (bad regex, missing condition); isolation between users |
| `runs.test.js` | preconditions (409/400); full run with nock; error results; cancel; report shape; startup recovery; repeats and counters |
| `experiments.test.js` | creates two runs sharing cases/repeats; comparison deltas math |
| `dashboard_query.test.js` | playground proxy; dashboard only own data |
| `authorization.test.js` | **matrix** (below) |
| `validation.test.js` | invalid ObjectId params → 400/404 not 500; oversized bodies |

**Authorization matrix:** build a list of every route (method, path template, needs body). For each: (a) no token → 401; (b) user B token with user A's ids → 404; (c) owner token → not 404/401. A final test compares the list with the Express router stack and fails if a route is missing from the list.

## 5. Client tests (`client/src/**/__tests__`)
`ProtectedRoute` redirects; login form validation; `formatPercent/formatMs` utils; `OutcomeBadge` label+class mapping for all five outcomes; API interceptor logs out on 401. No snapshot tests.

## 6. Golden fixtures (human-owned values)
- `ai-service/tests/fixtures/evaluator_golden.json`: `[ {response, condition, blocked, expectedOutcome, note}, ... ]`. Must include: exact marker line (succeeds), marker mentioned inside a refusal (ambiguous true), secret with zero-width characters, secret in base64 link, Hindi response, empty response (safe), blocked with raw match.
- `ai-service/tests/fixtures/metrics_fixture.json`: results list + `expected` metrics block with arithmetic noted in comments field.

## 7. Verification gate (run before every commit; see agents.md §8)
1. Lint passes (ruff / eslint).
2. Unit + integration tests for the touched service pass.
3. For endpoint work: one real request executed and its response pasted in the report.
4. `git status` shows no `.env`, caches, or data directories staged.
Before the last task of each phase: all three suites + `npm run build`.

## 8. Coverage targets (report, do not game)
ai-service evaluator/metrics/defenses ≥ 90 % lines; server services/middleware ≥ 80 %; overall report included in T6.4. Do not add meaningless tests to inflate coverage.

## 9. Manual test script (final, T6.3/T6.5)
1. Register two users. User A: create project, load demo KB, set defenses all on.
2. Run experiment (Mock, repeats 1) → compare page shows baseline ASR > protected ASR.
3. As user B, open A's run URL → 404 page.
4. Upload a `.exe` renamed `.pdf` → rejected.
5. Cancel a running run → status `cancelled`.
6. Stop ai-service mid-run → run finishes with `error` results, not a crash; restart server mid-run → run marked `failed`.
7. Download report JSON; confirm it includes config snapshots and limitations.
