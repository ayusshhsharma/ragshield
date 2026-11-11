# Plan — RAGShield (7 days)

Rules: one task at a time, in order. Tick `[x]` only after the verification gate in `agents.md §8` passes. **HUMAN** tasks are done by the person, not the agent. Task IDs are used in commit messages.

## Day map
| Day | Phases | Checkpoint |
|---|---|---|
| 1 | 0 Setup, 1 RAG core | Ingest demo KB and answer a question with Mock and Gemini |
| 2 | 2 Library + evaluator (T2.1-T2.3) | 58 reviewed cases, evaluator golden tests pass |
| 3 | 2 (T2.4-T2.5) | **Baseline CLI run produces real metrics** |
| 4 | 3 Defenses | Protected CLI run, ablation, numbers sane |
| 5 | 4 Express backend | All routes + cross-user matrix pass |
| 6 | 5 Frontend | Full UI flow works against real backend |
| 7 | 6 Hardening, Docker, results, README, demo | `docker compose up` works; results recorded |
If behind schedule, cut UI polish (T5.10) first, never evaluation, tests, or the cross-user matrix.

---
## Phase 0 — Setup
- [x] **T0.1 Repo scaffold.** Create the folder structure from `architecture.md §2`, `.gitignore` (node_modules, .venv, .env, chroma_data, dist, __pycache__, .pytest_cache, model caches), three `.env.example` files from `architecture.md §4`, root `docker-compose.yml` containing only `mongo` (volume `mongo_data`, port 27017) for now, `git init`, first commit. *Accept:* `docker compose up -d mongo` works; tree matches doc.
- [x] **T0.2 ai-service skeleton.** FastAPI app, `pydantic-settings` config (refuse start if `INTERNAL_SERVICE_KEY` empty), camelCase base model, service-key dependency (`secrets.compare_digest`), `GET /internal/health`, JSON error handlers (standard shape), logging, `pytest.ini`, `ruff.toml`. *Accept:* tests: health OK without key; other route without key → 401 shape; with key → 200. `uvicorn app.main:app --port 8000` runs.
- [ ] **T0.3 server skeleton.** `app.js` + `server.js`, config validation (JWT secret ≥ 32), pino logger, helmet, CORS, rate limiter, `asyncHandler`, error middleware (standard shape), Mongo connection, `GET /api/health`, `services/aiClient.js` (axios instance with `X-Service-Key`, timeouts, error mapping to 502), Jest + Supertest + mongodb-memory-server configured. *Accept:* health test passes; unknown route → 404 shape.
- [ ] **T0.4 client skeleton.** Vite + React + Tailwind 3.4 with tokens from `design.md §1`, React Router, `AppLayout`/`AuthLayout` shells, Axios instance (`VITE_API_URL`, Bearer interceptor, 401 → logout), `AuthContext` stub, Vitest + Testing Library. *Accept:* `npm run build` and `npm test` pass; dark theme renders.

## Phase 1 — RAG core (ai-service)
- [ ] **T1.1 Constants and seed corpus.** `app/core/constants.py` exactly per `architecture.md §10`; five synthetic seed `.txt` files (each 250-600 words, containing the facts listed in `database.md §5b`). *Accept:* test asserts registry values appear in the right seed files; benign keywords test placeholder exists.
- [ ] **T1.2 Extraction and chunking.** `extract_text(filename, bytes)` for txt/pdf/docx; `chunk_text(text, size, overlap)` char-based on whitespace boundaries. *Accept:* tests with small generated fixtures (create PDF/DOCX in test using the libs); overlap and boundary tests; empty/garbage file → clear `ValueError`.
- [ ] **T1.3 Embeddings and vector store.** Lazy `get_embedder()`, `vector_store.py` wrapper per `database.md §6` (ingest, query, delete document, delete project). *Accept:* tests with tmp `CHROMA_PATH`; ingest → query returns the right chunk; delete removes vectors; two projects isolated. First run downloads the model (note in report).
- [ ] **T1.4 Providers.** `LLMProvider`, `ProviderError`, `MockProvider`, `GeminiProvider`, retry + throttle per `architecture.md §12`. *Accept:* Mock behavior tests (obeys marker in naive, ignores inside untrusted_context, returns secret when in context); retry test with a fake failing provider; Gemini provider unit-tested with a stubbed client (no network in tests).
- [ ] **T1.5 RAG pipeline and endpoints.** `prompts.py` (naive + isolated), `pipeline.py` steps 3-9 without defenses wired yet (defenses disabled path), endpoints `ingest`, `ingest-demo`, delete ×2, `query`. *Accept:* integration test with Mock + tmp Chroma: ingest demo KB, query "refund window" returns answer containing `30 days` and retrieved chunks. Manual check with `LLM_PROVIDER=gemini` if key available.

## Phase 2 — Attack library and evaluator (ai-service + seed data)
- [ ] **T2.1 Case schema + seed file.** Pydantic and zod-compatible schema per `database.md §3`, loader validating `server/seed/attack_cases.json`. Agent drafts 48 attack cases (6 per category) + 10 benign following `database.md §4-5`, no placeholders. *Accept:* schema validation test passes for all 58; every benign keyword exists in seed text; regexes compile in Python. **HUMAN gate T2.1-H:** human reads every case, edits conditions, ticks the review checklist at the bottom of this file.
- [ ] **T2.2 Evaluator.** Pure functions: `normalize`, `check_success_condition`, `detect_refusal_phrase`, `decide_outcome(...)` implementing `prd.md §7` order and the `ambiguous` flag. *Accept:* golden fixture file `tests/fixtures/evaluator_golden.json` with ≥ 25 hand-written (response, condition, blocked?, expected outcome) rows including refusal-echo and zero-width-char cases; all pass. **HUMAN gate T2.2-H:** human reads evaluator code and can explain it.
- [ ] **T2.3 run-case endpoint.** `POST /internal/attacks/run-case` using pipeline + evaluator, injected chunks, benign handling (`benignAcceptable`), error → `error` outcome. *Accept:* Mock-based tests for one case per category producing expected outcomes in naive mode.
- [ ] **T2.4 Metrics.** Pure `aggregate(results, defenses_enabled)` per `prd.md §8` and `architecture.md §11`, plus endpoint. *Accept:* tests with a small hand-computed fixture (≥ 20 results across 3 repeats, includes errors and blocked) where every number was computed by hand and written in the fixture; division-by-zero cases; repeat-range ASR. **HUMAN gate T2.4-H:** human verifies fixture arithmetic.
- [ ] **T2.5 Suite runner CLI.** `scripts/run_suite.py --mode baseline|protected --repeats N --provider mock|gemini [--categories ...] [--defenses di,ds,iso,ov] --out results.json` loads seed cases, ingests demo KB into a temp project, runs sequentially via the same pipeline, prints a metrics table. *Accept:* mock baseline run completes in < 60 s and prints metrics. **HUMAN gate T2.5-H:** run with Gemini (`--repeats 1`), review outcomes of several results by eye, fix any wrong success conditions.

## Phase 3 — Defenses
- [ ] **T3.1 Pattern engine + DF-01.** `scan_text`, normalization, patterns per `architecture.md §9`, input scanner integrated, `/internal/defenses/inspect`. *Accept:* tests: ≥ 15 malicious strings flagged (incl. Hinglish/Devanagari), ≥ 15 benign strings not flagged, zero-width evasion normalised, threshold respected.
- [ ] **T3.2 DF-02 document scanner.** Chunk dropping, trigger record with dropped indices. *Accept:* poisoned chunk dropped, clean chunks kept, benign docs unaffected (tests on seed text: no seed chunk flagged at threshold 0.5).
- [ ] **T3.3 DF-03 + DF-05.** Isolation prompt (already built T1.5) selectable; output validator with registry, URL, base64, system-prompt-echo checks. *Accept:* validator tests incl. base64-encoded secret and link exfil; benign answers not flagged.
- [ ] **T3.4 Wire defenses + CLI ablation.** Pipeline honours `defenseConfig` in the order of `architecture.md §8`; `defensesTriggered`, `blockedBy`, `defenseLatencyMs` populated; CLI `--ablation` runs each defense alone plus all combined. *Accept:* mock protected run shows ASR below baseline; benign FPR reported; unit test that each defense toggles independently. **HUMAN gate T3.4-H:** run Gemini baseline vs protected (`--repeats 1`), sanity-check numbers, record in `docs/debugging.md` decision log.

## Phase 4 — Express backend
- [ ] **T4.1 Auth.** User model, register/login/me/logout, zod validators, bcryptjs, JWT middleware `requireAuth`, stricter auth rate limit. *Accept:* Supertest: success, duplicate email 409, wrong password 401, expired/invalid token 401, `passwordHash` never returned.
- [ ] **T4.2 Projects.** Model, CRUD, rag-config and defenses routes with validation; ownership helper `getOwnedProject(req)`. *Accept:* CRUD tests; foreign project → 404 on every route.
- [ ] **T4.3 Documents.** multer memory upload with limits, type/magic-byte validation, forward to FastAPI (nock in tests), metadata lifecycle (`processing→ready|failed`), demo KB route, delete with vector cleanup. *Accept:* tests: bad type, oversize, spoofed extension, success, AI failure → `failed` status, delete cascade.
- [ ] **T4.4 Attack cases.** Model, startup seed upsert from `seed/attack_cases.json`, library route (predefined + own custom), custom create/delete with validation. *Accept:* seed idempotent (run twice → 58); custom case validation rejects bad regex; user B cannot see user A's custom case.
- [ ] **T4.5 Runs and experiments.** Models (TestRun, AttackResult, Experiment), `runner.service.js` per `architecture.md §8`, routes: create run, list, get, results, cancel, report, experiments (create + get with comparison). Startup recovery of stale runs. *Accept:* tests with nock AI service: run completes and stores metrics; AI errors become `error` results; cancel stops the run; precondition errors; startup recovery; comparison deltas computed correctly.
- [ ] **T4.6 Playground + dashboard.** `POST /query`, `GET /dashboard`. *Accept:* tests with nock; dashboard aggregates only the caller's data.
- [ ] **T4.7 Authorization matrix.** Single test file `tests/authorization.test.js` iterating **every** project/run/experiment/document/custom-case route with user B's token against user A's resources, expecting 404 (and 401 with no token). *Accept:* matrix auto-lists routes so a newly added route without coverage fails a "coverage of routes" assertion.

## Phase 5 — Frontend
- [ ] **T5.1 Auth flow.** Login/Register pages, `AuthContext` (token in localStorage, `/auth/me` bootstrap), `ProtectedRoute`, logout. *Accept:* component tests for ProtectedRoute redirect and form validation.
- [ ] **T5.2 Projects + shell.** Projects list/create/delete, project page with tabs, Overview checklist. 
- [ ] **T5.3 Documents + RAG config tabs.** Upload with progress/state, demo KB button, status polling for `processing`, config form.
- [ ] **T5.4 Defenses tab.**
- [ ] **T5.5 Attack library tab + custom case form.**
- [ ] **T5.6 Runs tab.** Start baseline/protected/experiment (options modal), runs table with live progress polling.
- [ ] **T5.7 Run detail.** Metric grid, outcome bar, filters, paginated results table, result drawer, report download, cancel.
- [ ] **T5.8 Experiment compare + charts.**
- [ ] **T5.9 Dashboard + Playground.**
- [ ] **T5.10 States and polish.** Loading/empty/error everywhere, responsive pass, a11y pass, synthetic-data banner.
*Accept for each T5.x:* matches `design.md`; `npm run build` passes; one manual walkthrough of the feature against the real backend described in the report; `utils`/`ProtectedRoute` tests only (no snapshot tests).

## Phase 6 — Harden, ship, prove
- [ ] **T6.1 Security pass.** Review against `architecture.md §13`; add missing validation/rate limits; check logs for secret leakage; run `npm audit`/`pip list --outdated` report (no upgrades). 
- [ ] **T6.2 Docker.** Dockerfiles for server, ai-service (CPU torch; cache HF model in volume `hf_cache`), client (multi-stage → nginx); full `docker-compose.yml` with healthchecks and `depends_on: condition: service_healthy`; ai-service not published. *Accept:* clean-clone `docker compose up --build` serves UI on :8080 and a Mock-provider experiment completes.
- [ ] **T6.3 Smoke script.** `scripts/smoke.mjs`: register → project → demo KB → experiment (Mock, repeats 1) → assert compare returns baseline ASR > protected ASR → cleanup.
- [ ] **T6.4 Full test sweep.** All three suites green; coverage summary reported; fix failures per `debugging.md`.
- [ ] **T6.5 HUMAN: real experiment.** Gemini, 58 cases, repeats 3, baseline + protected + ablation. Save raw JSON exports to `docs/results/`, write `docs/results.md` (tables, date, model id, settings, observations incl. failures of defenses).
- [ ] **T6.6 README.** Fill `README.md` from the skeleton using only numbers from `docs/results.md`; add architecture diagram, limitations, OWASP table, screenshots list.
- [ ] **T6.7 HUMAN: demo + resume.** 2-minute demo video, optional deployment, resume bullets from `prd.md §14`.

---
## Human review checklist (T2.1-H) — tick per category after reading every case and condition
- [ ] AT-01 · [ ] AT-02 · [ ] AT-03 · [ ] AT-04 · [ ] AT-05 · [ ] AT-06 · [ ] AT-07 · [ ] AT-08 · [ ] BENIGN (keywords verified against seed text)
