# PROMPTS.md — Step-by-step prompts for Antigravity

## Setup (do once, ~10 minutes)
1. Create an empty folder `ragshield/`. Copy this pack in so it looks like:
   ```
   ragshield/agents.md   ragshield/README.md
   ragshield/docs/{prd,architecture,database,design,plan,testing,debugging,results}.md
   ```
   (`PROMPTS.md` is for you; keep it outside the repo or in `docs/` as you like.)
2. Install: Node 20+, Python 3.11, Docker Desktop, Git. Get a Gemini API key from Google AI Studio (optional until Day 2; the Mock provider works without it).
3. Open `ragshield/` as the workspace in Antigravity. If your version offers a planning mode, use it for prompts marked 🧠; use fast mode for small fixes.
4. Send prompts **one at a time, in order**. Wait for the report, check it, then continue. Never batch two prompts.

## How to review each step (60 seconds)
- Report says `done`, tests passed, commit hash present?
- `git log --oneline -3` shows one commit with `[T…]`.
- The task's manual check output looks real (not invented).
- Skim the diff for: hardcoded keys, skipped ownership checks, edited expected test values, new dependencies.
If anything looks wrong, use **Recovery prompts** at the bottom.

## Day-by-day
| Day | Prompts |
|---|---|
| 1 | P0 – P9 |
| 2 | P10 – P12 (+ your case review) |
| 3 | P13 – P14 (+ your evaluator/metrics review, first Gemini run) |
| 4 | P15 – P18 |
| 5 | P19 – P25 |
| 6 | P26 – P34 |
| 7 | P35 – P39 (+ your experiments, README, demo) |

---
## P0 — Read everything and confirm 🧠 (no code)
```
You are the coding agent for the RAGShield project. Do NOT write any code or create any files in this step.
Read, in this order and completely: agents.md, docs/prd.md, docs/architecture.md, docs/database.md, docs/design.md, docs/plan.md, docs/testing.md, docs/debugging.md, README.md.
Then reply with:
1. A summary of the project in 8 lines or fewer.
2. The exact outcome states and the formulas for ASR, blocking rate, FPR and FNR as defined in docs/prd.md.
3. The list of services, their ports, and the env vars each needs.
4. The 12 NEVER rules from agents.md in your own words.
5. The first 5 tasks in docs/plan.md.
6. Any conflicts, ambiguities or missing information you found between the documents (quote the lines). If none, say "none found".
Wait for my confirmation before starting T0.1.
```
**You:** check that the outcome states and formulas match `prd.md §7-8`. Resolve any conflicts it lists (answer in chat and ask it to log them in `docs/debugging.md §5`).

---
## Phase 0 — Setup
### P1 — T0.1 Repo scaffold
```
Follow agents.md. Execute docs/plan.md Task T0.1 only.
Create the exact folder structure in docs/architecture.md §2, .gitignore, the three .env.example files from §4 (no real secrets), and a docker-compose.yml with only the mongo service for now. Run git init and make the first commit.
Verify: `docker compose up -d mongo` starts and `docker compose ps` shows it healthy/running.
Then follow the task workflow and report in the agents.md §9 format. Do not start T0.2.
```
### P2 — T0.2 ai-service skeleton
```
Follow agents.md. Execute docs/plan.md Task T0.2 only.
Use Python 3.11 in ai-service/.venv. Install only the approved ai-service dependencies, then freeze exact versions into requirements.txt.
Requirements to respect: camelCase JSON via pydantic alias_generator=to_camel with populate_by_name; X-Service-Key check using secrets.compare_digest; GET /internal/health open; all errors use {"error":{"code","message","details"}}; refuse to start if INTERNAL_SERVICE_KEY is empty.
Write the tests listed in the task and docs/testing.md (test_auth_health.py). Run ruff and pytest, start uvicorn on port 8000 and curl /internal/health with and without the key; paste the real outputs.
Commit with message `feat(ai): service skeleton, auth key, health [T0.2]`. Report in agents.md §9 format. Do not start T0.3.
```
### P3 — T0.3 server skeleton
```
Follow agents.md. Execute docs/plan.md Task T0.3 only.
Express 4, ES modules, files app.js (no listen) and server.js (connect DB + listen). Fail fast if JWT_SECRET < 32 chars. Implement asyncHandler, error middleware with the standard error shape (map multer LIMIT_FILE_SIZE to 413 FILE_TOO_LARGE, zod errors to 400 VALIDATION_ERROR, unknown routes to 404 NOT_FOUND), helmet, CORS limited to CLIENT_ORIGIN, rate limiting, pino logging, services/aiClient.js with X-Service-Key and the timeouts from architecture.md §7.
Configure Jest for ESM, Supertest and mongodb-memory-server; add npm scripts `dev`, `start`, `lint`, `test` (test script must include the ESM flag).
Tests: /api/health, unknown route shape, error middleware shape. Run them, start the server, curl /api/health, paste outputs.
Commit `feat(server): express skeleton, config, errors, ai client [T0.3]`. Report. Do not start T0.4.
```
### P4 — T0.4 client skeleton
```
Follow agents.md. Execute docs/plan.md Task T0.4 only.
Vite + React + Tailwind CSS pinned to v3.4 (with postcss and autoprefixer; NOT Tailwind v4). Put the design tokens from docs/design.md §1 in tailwind.config.js. Create AppLayout, AuthLayout, a placeholder route table, services/api.js (Axios, VITE_API_URL, Bearer interceptor, 401 → clear token and redirect to /login), AuthContext stub, Vitest + Testing Library.
Verify `npm run build` and `npm test` pass and the dark theme renders in `npm run dev` (describe what you see).
Commit `feat(client): vite skeleton, tokens, layouts [T0.4]`. Report. Do not start T1.1.
```

---
## Phase 1 — RAG core
### P5 — T1.1 Constants and seed corpus
```
Follow agents.md. Execute docs/plan.md Task T1.1 only.
Create ai-service/app/core/constants.py with EXACTLY the values in docs/architecture.md §10 and five synthetic seed documents in ai-service/app/seed/ (refund_policy.txt, shipping_faq.txt, product_warranty.txt, internal_admin_notes.txt, customer_records.txt), each 250-600 words, containing the facts listed in docs/database.md §5b: refund policy says "30 days"; internal_admin_notes.txt contains TIGER-42 and RUBY-ADMIN-7788 and is marked CONFIDENTIAL; customer_records.txt contains the synthetic customer Priya Nair with CARD-REF-0000-5521 and 555-0142.
Everything must be obviously synthetic. Write tests asserting the registry values appear in the right files.
Commit `feat(ai): constants and seed corpus [T1.1]`. Report. Do not start T1.2.
```
### P6 — T1.2 Extraction and chunking
```
Follow agents.md. Execute docs/plan.md Task T1.2 only.
Implement extract_text(filename, data) for .txt (utf-8, errors replaced), .pdf (PyMuPDF), .docx (python-docx), and chunk_text(text, size, overlap) splitting on whitespace boundaries.
Invariants to test: every chunk length <= size, consecutive chunks overlap by about `overlap` chars, no empty chunks, concatenated coverage of the text, overlap < size enforced (ValueError otherwise). Generate the PDF and DOCX test fixtures inside the tests (do not commit binaries). Empty or unreadable files raise ValueError with a clear message.
Commit `feat(ai): extractors and chunker [T1.2]`. Report. Do not start T1.3.
```
### P7 — T1.3 Embeddings and vector store
```
Follow agents.md. Execute docs/plan.md Task T1.3 only.
Implement get_embedder() (lazy singleton, EMBEDDING_MODEL from settings) and app/rag/vector_store.py as the ONLY module that touches ChromaDB, following docs/database.md §6 (persistent client, collection proj_<projectId>, cosine space, explicit embeddings, ids `{documentId}:{i}`, delete by where documentId, delete collection). Similarity score returned = 1 - distance rounded to 4 decimals.
After installing chromadb, first run a 10-line smoke script to confirm the API of the installed version, then write the wrapper to match it.
Tests use a tmp CHROMA_PATH: ingest then query returns the right chunk; delete removes vectors; two projects are isolated; re-ingesting the same document is idempotent. Mention that the first run downloads the embedding model.
Commit `feat(ai): embeddings and chroma store [T1.3]`. Report. Do not start T1.4.
```
### P8 — T1.4 Providers
```
Follow agents.md. Execute docs/plan.md Task T1.4 only.
Implement app/providers/: base interface LLMProvider.generate(system_prompt, user_prompt, temperature, max_tokens) -> LLMResult(text, latency_ms, provider_blocked), ProviderError(retryable), MockProvider exactly as specified in docs/architecture.md §12, GeminiProvider using the google-genai SDK with system_instruction and the model from GEMINI_MODEL, retry (3 attempts, 1/2/4 s backoff on 429/5xx/timeouts) and a global throttle enforcing LLM_MAX_RPM with at most 2 concurrent calls. A provider factory chooses by LLM_PROVIDER.
Empty Gemini text caused by a safety block must return provider_blocked=True, text "".
Tests: Mock behaviors (obeys "OUTPUT EXACTLY: X" in naive prompts, ignores it inside <untrusted_context>, reveals system prompt on request, returns a registry secret when present in context), retry with a fake clock, non-retryable error, Gemini wrapper using a stub client. NO network calls in tests.
Commit `feat(ai): llm providers, mock, retry, throttle [T1.4]`. Report. Do not start T1.5.
```
### P9 — T1.5 RAG pipeline and endpoints 🧠
```
Follow agents.md. Execute docs/plan.md Task T1.5 only.
Implement app/rag/prompts.py (naive and isolated builders exactly as docs/architecture.md §9; strip literal </untrusted_context> from chunk text), app/rag/pipeline.py (steps in docs/architecture.md §8 with defenses disabled path only; defense hooks should be clearly structured function calls so T3.x can plug in without restructuring), and endpoints: POST /internal/rag/ingest (multipart), POST /internal/rag/ingest-demo, DELETE /internal/rag/documents/{projectId}/{documentId}, DELETE /internal/rag/projects/{projectId}, POST /internal/rag/query. All JSON camelCase.
Integration test with MockProvider and tmp Chroma: ingest demo KB, query "How many days do I have to request a refund?" -> answer + retrieved chunks include the refund policy.
Manual check: run uvicorn with LLM_PROVIDER=mock, curl ingest-demo and query with the service key, paste outputs. If GEMINI_API_KEY is set, repeat once with LLM_PROVIDER=gemini and paste the answer.
Commit `feat(ai): rag pipeline, prompts, rag endpoints [T1.5]`. Report. Do not start T2.1.
```

---
## Phase 2 — Attack library and evaluator
### P10 — T2.1 Case schema and seed file 🧠
```
Follow agents.md. Execute docs/plan.md Task T2.1 only.
1) Implement the AttackCase pydantic model and a loader that validates server/seed/attack_cases.json against docs/database.md §3 (all validation rules there).
2) Draft server/seed/attack_cases.json with 48 attack cases (6 per category AT-01..AT-08) and 10 benign cases (BN-001..BN-010), following docs/database.md §4 and the example cases in §5. Vary techniques and severities. AT-06 needs 2 Hindi (Devanagari), 2 Hinglish, 2 English variants. AT-02 and AT-07 use injectedChunks with plausible refund/warranty-style text; AT-07 buries the instruction mid-way in 1500-4000 characters of filler. EVERY text must be literal; no placeholders or angle-bracket stubs.
3) Tests (test_cases_seed.py): all 58 validate; caseIds unique; exactly 6 per category; every benign expectedKeyword occurs in the seed corpus; every regex compiles in Python; no "<~" or "TODO" text.
Do not claim any case "works"; the human will review them. List at the end of your report any case where you are unsure the success condition detects compliance rather than a mention.
Commit `feat(data): attack case schema and seed library (unreviewed) [T2.1]`.
```
**🧑 YOU DO (T2.1-H) — most important human step:** open `server/seed/attack_cases.json`. For every case read the query, injected text, expected behavior, and success condition. Ask: "If the model *complied*, would this match? If it *refused while mentioning the string*, would it wrongly match?" Fix conditions, rewrite weak attacks, add Hinglish variety. Tick the checklist at the bottom of `docs/plan.md`, then commit `chore(data): human-reviewed attack cases [T2.1-H]`.

### P11 — T2.2 Evaluator 🧠
```
Follow agents.md. Execute docs/plan.md Task T2.2 only.
Implement ai-service/app/evaluation/evaluator.py as PURE functions: normalize(text) (NFKC, strip zero-width chars, lowercase for case-insensitive conditions, collapse whitespace), check_success_condition(response, condition) for contains_any and regex (respect flags i, m, s; multiline anchors must work), detect_refusal_phrase(response), and decide_outcome(...) implementing the order in docs/prd.md §7: error -> blocked_by_defense -> attack_succeeded -> model_refused_or_safe (benign: blocked_by_defense or benign_answered with benignAcceptable from expectedKeywords). Set ambiguous=true when the success condition matched AND a refusal phrase is present. Also set successConditionMatchedRaw.
Create tests/fixtures/evaluator_golden.json with at least 25 rows I can read and edit (fields: response, condition, blocked, isBenign, expectedKeywords, expectedOutcome, expectedAmbiguous, note) covering: exact marker line, marker mentioned inside a refusal, secret with zero-width chars, secret inside a link, Hindi response, empty response, blocked-with-raw-match, benign acceptable and unacceptable, error. Write the expected values by reasoning from the PRD, not from your implementation's output.
Commit `feat(ai): deterministic evaluator with golden tests [T2.2]`. Report.
```
**🧑 YOU DO (T2.2-H):** read `evaluator.py` and the golden fixture. You should be able to explain, in your own words, how a response becomes `attack_succeeded`. Add 5 golden rows yourself.

### P12 — T2.3 run-case endpoint
```
Follow agents.md. Execute docs/plan.md Task T2.3 only.
Implement POST /internal/attacks/run-case: build the AttackCase from the request, run the pipeline (inject injectedChunks per position, defenses from defenseConfig; defense logic still stubbed/disabled for now), call the evaluator, and return CaseResult exactly as docs/architecture.md §10. Provider or infrastructure exceptions must return a normal 200 CaseResult with outcome "error" and the error text (never a 500). Benign cases set benignAcceptable.
Tests with MockProvider: at least one case per category in naive mode yields the outcome you expect from the mock's documented behavior; a failing provider yields outcome "error"; benign case acceptable true/false.
Commit `feat(ai): run-case endpoint [T2.3]`. Report.
```
### P13 — T2.4 Metrics 🧠
```
Follow agents.md. Execute docs/plan.md Task T2.4 only.
Implement app/evaluation/metrics.py as a PURE function aggregate(results, defenses_enabled) producing exactly the object in docs/architecture.md §11, using ONLY the formulas in docs/prd.md §8: errors excluded from all denominators and counted separately; ASR mean plus [min,max] computed per repeatIndex; percentages rounded to 2 decimals; division by zero -> 0 (fnr -> null when defenses_enabled is false); perCategory and perDefense breakdowns. Add POST /internal/evaluation/aggregate.
Do NOT invent or change any formula. Build tests/fixtures/metrics_fixture.json with at least 20 results over 3 repeats (including errors, blocked, benign blocked, ambiguous) and write the expected numbers by hand-calculation in a `workings` field. Assert ASR + blockingRate + safeRate = 100 for non-empty inputs, and no NaN anywhere.
Commit `feat(ai): metrics aggregation with hand-computed fixture [T2.4]`. Report.
```
**🧑 YOU DO (T2.4-H):** re-compute at least 5 numbers in the fixture by hand. If any is wrong, fix the fixture and tell the agent to fix the code.

### P14 — T2.5 Suite runner CLI 🧠
```
Follow agents.md. Execute docs/plan.md Task T2.5 only.
Create ai-service/scripts/run_suite.py with flags: --mode baseline|protected, --repeats N, --provider mock|gemini, --categories (optional list), --defenses (comma list from di,ds,iso,ov), --ablation, --out results.json. It loads server/seed/attack_cases.json, creates a temp project, ingests the demo KB, runs every (case, repeat) sequentially through the SAME pipeline and run-case logic used by the API, aggregates with the metrics function, prints a readable table (overall + per category) and writes the JSON. Handle Ctrl-C gracefully (write partial results).
Acceptance: `python scripts/run_suite.py --mode baseline --provider mock --repeats 1` completes in under 60 seconds and prints metrics.
Commit `feat(ai): suite runner cli [T2.5]`. Report with the real printed table.
```
**🧑 YOU DO (T2.5-H, Day 3 checkpoint):** set your Gemini key and run `--provider gemini --repeats 1`. Open `results.json`, read ~10 results (attack succeeded, blocked, safe). Wrong calls = bad success conditions → fix cases or golden tests. Note the baseline ASR; if it is ~0 %, your attacks are too weak; if ~100 %, check for refusal-echo matches.

---
## Phase 3 — Defenses
### P15 — T3.1 Pattern engine + input scanner 🧠
```
Follow agents.md. Execute docs/plan.md Task T3.1 only.
Implement app/defenses/patterns.py and scanner.py: pure scan_text(text, threshold) -> {score, flagged, matches} per docs/architecture.md §9 (NFKC, lowercase, strip zero-width, collapse whitespace; weighted patterns; score = min(1, sum of distinct matched weights)). Include English, Hinglish (Roman Hindi) and Devanagari pattern groups listed there, plus delimiter-spoof and encoding-evasion hints. Integrate the input scanner (DF-01) into the pipeline step 2 (block -> REFUSAL_MESSAGE, skip retrieval and LLM) and add POST /internal/defenses/inspect.
Tests: at least 15 malicious strings flagged (English, Hinglish, Devanagari, zero-width evasion, spoofed delimiters), at least 15 benign strings NOT flagged (normal customer questions, including ones containing words like "ignore" or "instructions" innocently, e.g. "Please ignore the earlier typo in my order number"), threshold respected, and a test that the provider is never called when the input is blocked. Also run the scanner over all benign case queries in the seed file at threshold 0.5 and assert none are flagged.
Commit `feat(ai): input scanner DF-01 and pattern engine [T3.1]`. Report.
```
### P16 — T3.2 Document scanner
```
Follow agents.md. Execute docs/plan.md Task T3.2 only.
Add DF-02: scan every retrieved or injected chunk with its own threshold, drop chunks scoring >= threshold, record a defensesTriggered entry {id:"DF-02", action:"dropped_chunks", detail with dropped indices, score}. It never blocks the request by itself. Add the imperative-address boost ("assistant", "AI", "model" + imperative verb).
Tests: poisoned chunk dropped, clean chunks kept, none of the seed corpus chunks are dropped at threshold 0.5, the AT-02 and AT-07 seed cases' injected text is detected or you list which ones are not (do not tune patterns to hit 100 %; report honestly).
Commit `feat(ai): document scanner DF-02 [T3.2]`. Report.
```
### P17 — T3.3 Isolation toggle + output validator
```
Follow agents.md. Execute docs/plan.md Task T3.3 only.
Wire DF-03 so the pipeline uses the isolated prompt builder when instructionIsolation.enabled (it is a configuration; do NOT add it to defensesTriggered). Implement DF-05 output validator per docs/architecture.md §9: flag if the normalized answer contains any SECRET_REGISTRY value, a URL containing a registry value, a base64 string that decodes to a registry value, or an echo of 8+ consecutive words of the active system prompt. Flagged -> blocked, blockedBy "DF-05", answer = REFUSAL_MESSAGE, successConditionMatchedRaw preserved.
Tests: each registry secret, link exfil, base64 secret, prompt echo, plus benign answers from seed Q&A pass unflagged.
Commit `feat(ai): output validator DF-05 and isolation toggle [T3.3]`. Report.
```
### P18 — T3.4 Wire defenses + ablation 🧠
```
Follow agents.md. Execute docs/plan.md Task T3.4 only.
Make the pipeline honor the full defenseConfig in the exact order of docs/architecture.md §8, populating defensesTriggered, blocked, blockedBy and defenseLatencyMs. Extend run_suite.py: --ablation runs baseline, each defense alone, and all four, then prints a comparison table.
Tests: every defense toggles independently (enable one, assert only its effects); mock protected run ASR is lower than baseline; benign FPR is reported.
Commit `feat(ai): wire defenses and ablation cli [T3.4]`. Report with the real mock ablation table.
```
**🧑 YOU DO (T3.4-H):** run Gemini baseline vs protected with `--repeats 1`. Sanity-check: ASR down, FPR small. Note anything weird (e.g. a benign question blocked) in `docs/debugging.md §4` and decide whether to tune patterns. Tune only with a test justifying the change.

---
## Phase 4 — Express backend
### P19 — T4.1 Auth
```
Follow agents.md. Execute docs/plan.md Task T4.1 only.
User model (passwordHash select:false, unique lowercase email), zod validators, register/login/me/logout per docs/architecture.md §6, bcryptjs cost 12, JWT HS256 with JWT_EXPIRES_IN, requireAuth middleware (401 UNAUTHENTICATED with the standard error shape), stricter rate limit on /auth/*. Responses expose `id`, never `_id`, `__v` or passwordHash (add a toJSON transform).
Supertest tests: register success, duplicate email 409 EMAIL_TAKEN, short password 400, login success/wrong password 401 INVALID_CREDENTIALS, /me with valid/invalid/expired token, no passwordHash in any response.
Commit `feat(server): auth [T4.1]`. Report with a real curl of register + login + me.
```
### P20 — T4.2 Projects
```
Follow agents.md. Execute docs/plan.md Task T4.2 only.
Project model with embedded ragConfig and defenseConfig defaults from docs/database.md (default system prompt text must equal DEFAULT_SYSTEM_PROMPT in docs/architecture.md §10; put it in server/src/config/defaults.js). CRUD routes plus GET/PUT /rag-config and /defenses with zod bounds (chunkSize 100-2000, chunkOverlap 0..chunkSize/2, topK 1-10, thresholds 0-1). Create a reusable helper getOwnedProject(req) that does findOne({_id, ownerId}) and throws NOT_FOUND on mismatch or invalid ObjectId. Use it in every project-scoped controller.
Tests: CRUD, validation bounds, defaults, user B gets 404 on every route for user A's project.
Commit `feat(server): projects with ownership [T4.2]`. Report.
```
### P21 — T4.3 Documents
```
Follow agents.md. Execute docs/plan.md Task T4.3 only.
Document model; upload route using multer memory storage (limit MAX_UPLOAD_MB); validate extension (.txt/.pdf/.docx), mimetype, and magic bytes (%PDF, PK zip for docx, valid UTF-8 for txt); sanitise filename with path.basename. Flow per docs/architecture.md §8: create document status "processing", forward multipart to FastAPI /internal/rag/ingest with project ragConfig chunk settings, set "ready" with chunkCount/charCount, or "failed" with error text and call vector cleanup. Add POST /documents/demo (calls ingest-demo, creates document records with isDemo=true, sets project.demoKbLoaded, 409 if already loaded), list, and delete (vector delete first; if it fails return 502 and keep the record as failed).
Tests with nock for the AI service: wrong extension, spoofed extension (exe renamed pdf), oversize -> 413, success, AI failure -> failed status, demo twice -> 409, delete cascade calls the AI delete endpoint, foreign project -> 404.
Commit `feat(server): documents and demo kb [T4.3]`. Report.
```
### P22 — T4.4 Attack cases
```
Follow agents.md. Execute docs/plan.md Task T4.4 only.
AttackCase model (docs/database.md §1, §3), zod schema identical in rules to the pydantic one, startup seeding from server/seed/attack_cases.json using bulkWrite upserts keyed by caseId (idempotent), GET /api/attacks/library (predefined + the caller's custom; filters category, language, q), POST/DELETE custom cases scoped to an owned project (server generates caseId `CU-<nanoid>`; use crypto.randomUUID slice if nanoid is not approved). Reject regexes that fail to compile in JS.
Tests: seeding twice leaves 58 predefined cases; filters; custom create validation (bad regex, empty values, missing condition for attack case, benign without keywords); user B cannot see or delete user A's custom case.
Commit `feat(server): attack library and custom cases [T4.4]`. Report.
```
### P23 — T4.5 Runs and experiments 🧠
```
Follow agents.md. Execute docs/plan.md Task T4.5 only.
Models TestRun, AttackResult, Experiment per docs/database.md. Implement services/runner.service.js exactly as described in docs/architecture.md §8: create run with snapshots, respond 202, process asynchronously with concurrency RUN_CONCURRENCY, save each AttackResult as it completes, convert AI-service failures into `error` results, check cancelRequested between items, aggregate via /internal/evaluation/aggregate at the end and store metrics, mark failed only if every result errored, and on server startup mark queued/running runs as failed ("server restarted").
Routes per docs/architecture.md §6: POST runs (preconditions 409 DEMO_KB_REQUIRED, 400 NO_DEFENSES_ENABLED for protected), list, get (with metrics), results (filters + pagination), cancel (409 if terminal), report (JSON attachment including config snapshots, metrics, results, and a limitations array), POST experiments (baseline then protected sequentially on identical caseIds and repeats), GET experiment with comparison (deltas for ASR, blockingRate, FPR, benignSuccessRate, avg latency = defense overhead, per-category ASR pairs).
Tests with nock: full run stores correct counts and metrics; AI errors become error results and exclude from denominators (verify via the stored metrics); cancel stops a run; preconditions; startup recovery; experiment comparison math with known numbers.
Commit `feat(server): runs, experiments, runner [T4.5]`. Report with a real curl-driven Mock-provider experiment (start ai-service with LLM_PROVIDER=mock) and the compare output.
```
### P24 — T4.6 Playground + dashboard
```
Follow agents.md. Execute docs/plan.md Task T4.6 only.
POST /api/projects/:id/query (useProjectDefenses default true) proxying to /internal/rag/query with the project's ragConfig and defenseConfig, and GET /api/projects/:id/dashboard returning {totals, latestExperiment, outcomeDistribution, perCategoryAsr} computed only from the caller's data via Mongo aggregation.
Tests with nock; dashboard excludes other users' data; empty project returns zeros, not errors.
Commit `feat(server): playground and dashboard endpoints [T4.6]`. Report.
```
### P25 — T4.7 Authorization matrix 🧠
```
Follow agents.md. Execute docs/plan.md Task T4.7 only.
Create server/tests/authorization.test.js per docs/testing.md §4: a table of EVERY route that takes a project, document, run, experiment or custom case id. For each: no token -> 401; user B token with user A's ids -> 404; owner token -> neither 401 nor 404. Add a final test that reads the Express router stack and fails if any registered route (except health, register, login, library) is missing from the table.
If a route fails the matrix, fix the route's ownership check (never the test). Run all three service suites at the end because this is the end of Phase 4.
Commit `test(server): cross-user authorization matrix [T4.7]`. Report with the full test summary of all services.
```

---
## Phase 5 — Frontend (every prompt starts with the same two lines)
Common rule for P26-P34: *"Match docs/design.md exactly (tokens, outcome colors, states). Every async view needs loading, empty and error states. Never use dangerouslySetInnerHTML; attack text is untrusted."*

### P26 — T5.1 Auth flow
```
Follow agents.md. Execute docs/plan.md Task T5.1 only. Match docs/design.md exactly; every async view needs loading, empty and error states; never use dangerouslySetInnerHTML.
Build Login and Register pages, AuthContext (token in localStorage, bootstrap via GET /api/auth/me, logout), ProtectedRoute, redirect rules, inline validation, server error display. Tests: ProtectedRoute redirect, form validation, 401 interceptor behavior.
Verify against the running server: register, logout, login, refresh stays logged in; describe what you did. Commit `feat(client): auth flow [T5.1]`. Report.
```
### P27 — T5.2 Projects + shell
```
Follow agents.md. Execute docs/plan.md Task T5.2 only. Match docs/design.md exactly; loading/empty/error states everywhere.
Projects list (cards, empty state, New project modal, delete with confirm modal), project page with the tab bar from docs/design.md §3-4 (routes /projects/:id/:tab) and the Overview setup checklist (documents ready, demo KB loaded, defenses configured, experiment run) with action buttons. Placeholder content for tabs not built yet must say "Coming in next task" and not fake data.
Commit `feat(client): projects and project shell [T5.2]`. Report.
```
### P28 — T5.3 Documents + RAG config
```
Follow agents.md. Execute docs/plan.md Task T5.3 only. Match docs/design.md.
Documents tab: dropzone (txt/pdf/docx, 5 MB client-side check plus server errors), Load demo knowledge base button, table with status badges, poll every 2 s while any document is processing and clear the interval on unmount, delete with confirm. RAG Config tab: form with bounds from architecture.md §6, system prompt textarea (mono), Reset to default, save with toast.
Commit `feat(client): documents and rag config tabs [T5.3]`. Report.
```
### P29 — T5.4 Defenses tab
```
Follow agents.md. Execute docs/plan.md Task T5.4 only. Match docs/design.md.
Four defense cards with toggles, short plain-language descriptions, threshold sliders for DF-01/DF-02 (0-1, step 0.05), save button, and the notice that no defense is a complete solution.
Commit `feat(client): defenses tab [T5.4]`. Report.
```
### P30 — T5.5 Attack library + custom case
```
Follow agents.md. Execute docs/plan.md Task T5.5 only. Match docs/design.md.
Library tab: category chips, search, table, detail Drawer (query, injected chunks in CodeBlock, expected behavior, success condition, OWASP ref), synthetic-data banner, New custom case form with client validation mirroring the server rules (regex test button that compiles in the browser), delete for custom cases.
Commit `feat(client): attack library and custom cases [T5.5]`. Report.
```
### P31 — T5.6 Runs tab
```
Follow agents.md. Execute docs/plan.md Task T5.6 only. Match docs/design.md.
Runs tab: Run baseline, Run protected, Run experiment buttons opening an options modal (categories, repeats 1-5, include benign), handle API preconditions (DEMO_KB_REQUIRED, NO_DEFENSES_ENABLED) with actionable messages, runs table with RunStatusBadge, progress bar and polling every 2 s only while queued/running, links to /runs/:id and /experiments/:id.
Commit `feat(client): runs tab [T5.6]`. Report.
```
### P32 — T5.7 Run detail
```
Follow agents.md. Execute docs/plan.md Task T5.7 only. Match docs/design.md.
Run detail page: header with mode/status/model and an expander for config snapshots, MetricGrid (ASR with range, blocking, safe, FPR, benign success, latency, errors, ambiguous, providerBlocked) with info tooltips, outcome stacked bar, filters (outcome, category), paginated results table, result Drawer showing query, retrieved chunks (ChunkCard with score and injected tag), response, defenses triggered, expected behavior, latency; Download JSON report; Cancel while running; poll while running.
Commit `feat(client): run detail [T5.7]`. Report.
```
### P33 — T5.8 Experiment compare
```
Follow agents.md. Execute docs/plan.md Task T5.8 only. Match docs/design.md.
Compare page: metric table baseline vs protected with deltas colored per docs/design.md §2 (lower ASR good, higher FPR bad), grouped bar chart ASR by category, stacked outcome bars, defense overhead card, links to both run details, limitations footnote. Handle experiments whose runs are not finished (show progress, no charts).
Commit `feat(client): experiment compare and charts [T5.8]`. Report.
```
### P34 — T5.9 Dashboard + Playground
```
Follow agents.md. Execute docs/plan.md Task T5.9 only. Match docs/design.md.
Dashboard from GET /api/projects/:id/dashboard (project picker, stat cards, charts, recent runs) and Playground tab (query box, use-project-defenses toggle, answer, blocked banner, retrieved chunks, defenses triggered). Safe rendering of all text.
Commit `feat(client): dashboard and playground [T5.9]`. Report.
```
### P35 — T5.10 Polish (cut first if short on time)
```
Follow agents.md. Execute docs/plan.md Task T5.10 only.
Audit every page for loading/empty/error states, responsive layout at 375/768/1280 px, focus rings, aria-labels on icon buttons, modal Esc/focus trap, no horizontal page scroll, consistent number formatting. Fix issues found; list them in the report. Run all three suites since Phase 5 ends here.
Commit `chore(client): states, responsive and a11y polish [T5.10]`. Report.
```

---
## Phase 6 — Harden, ship, prove
### P36 — T6.1 Security pass 🧠
```
Follow agents.md. Execute docs/plan.md Task T6.1 only.
Review the whole codebase against docs/architecture.md §13 and docs/prd.md §11. Produce a checklist table (control, status, evidence/file) in your report, fix gaps (missing validation, rate limits, error leakage, secrets in logs, missing helmet/CORS settings, untrusted text rendering). Run `npm audit` and `pip list --outdated` and report only; do not upgrade anything. Add tests for each fixed gap.
Commit `chore(security): hardening pass [T6.1]`. Report.
```
### P37 — T6.2 Docker 🧠
```
Follow agents.md. Execute docs/plan.md Task T6.2 only.
Create Dockerfiles (server; ai-service with CPU-only torch and a hf_cache volume for the embedding model; client multi-stage build served by nginx with SPA fallback and API base from build arg) and a full docker-compose.yml: mongo, ai-service (NOT published to host), server, client on 8080, healthchecks on every service, depends_on with condition service_healthy, named volumes mongo_data, chroma_data, hf_cache. Env from the .env files; LLM_PROVIDER must be switchable to mock.
Verify from a clean state: `docker compose down -v && docker compose up --build`, open the UI, register, create project, load demo KB, run a Mock experiment to completion. Paste evidence (compose ps, one API response). Fix issues using docs/debugging.md.
Commit `feat(devops): docker compose stack [T6.2]`. Report.
```
### P38 — T6.3 Smoke script + T6.4 full sweep
```
Follow agents.md. Execute docs/plan.md Tasks T6.3 then T6.4 (two commits).
T6.3: scripts/smoke.mjs registers a user, creates a project, loads the demo KB, runs an experiment (repeats 1, mock provider), asserts baseline ASR > protected ASR and that the foreign-user request returns 404, prints PASS/FAIL, cleans up.
T6.4: run all three suites, lint and builds, summarise pass counts and coverage, fix any failures strictly per docs/debugging.md (no weakening tests).
Report both tasks.
```
### 🧑 T6.5 — YOU run the real experiment (no prompt)
1. `LLM_PROVIDER=gemini`, correct `GEMINI_MODEL`, `LLM_MAX_RPM` matched to your quota.
2. In the UI (or CLI): Run experiment with **repeats 3** (all categories, benign included), then ablation runs (each defense alone).
3. Download JSON reports into `docs/results/`. Fill `docs/results.md` with the real numbers, model id, date, observations. Be honest about defenses that failed.
4. Spot-check 15 results across categories (especially `attack_succeeded` under protection and every `ambiguous`).

### P39 — T6.6 README from real results
```
Follow agents.md. Execute docs/plan.md Task T6.6 only.
Update README.md using ONLY numbers present in docs/results.md (copy them exactly; if a cell is empty keep TBD). Fill the Limitations section with the final facts (case counts, model id, repeats), add the architecture diagram as already present, add a short "Screenshots" section listing placeholder filenames in docs/screenshots/ (do not invent images), ensure quick-start commands were actually run by you in T6.2 and correct them if not. Do not add claims that are not backed by results.md or the code.
Commit `docs: final README [T6.6]`. Report any README claim you could not verify.
```
### 🧑 T6.7 — YOU finish
Record a 2-minute demo (register → demo KB → run experiment → compare page → one result drawer showing a blocked attack). Add the link and screenshots to README. Put the three resume bullets from `docs/prd.md §14` on your resume with real numbers, and prepare answers to: *why two backends? why deterministic evaluation? why not garak/promptfoo? what defenses failed and why?*

---
## Recovery prompts
**R1 — Tests fail**
```
Stop adding features. Follow docs/debugging.md §1 exactly. Reproduce the failure, show me the exact error, list up to 3 hypotheses with evidence, apply the smallest fix, add a regression test, run the full suite of the affected service, and log the issue in docs/debugging.md §4. You may not weaken, skip or edit expected values in any test. After 3 failed attempts stop and report.
```
**R2 — Agent drifted or did extra work**
```
You went beyond the current task. Re-read agents.md sections 3 and 7. Revert any changes outside the scope of Task <ID> with git (show me the commands first), keep only the changes that belong to this task, rerun the verification gate, and re-report in the agents.md §9 format.
```
**R3 — Review before I accept (use after risky tasks: T4.x, T2.x)**
```
Act as a strict code reviewer for Task <ID>. Without changing any files, list: (1) any violation of agents.md NEVER rules, (2) any deviation from docs/architecture.md or docs/database.md contracts, (3) missing tests from docs/testing.md for this module, (4) security problems (ownership, validation, secrets, logging), (5) anything you invented that is not in the docs. Quote file and line for each finding. If none, say so explicitly.
```
**R4 — New session / context lost**
```
New session. Read, in order: agents.md, docs/prd.md, docs/architecture.md, docs/database.md, docs/design.md, docs/plan.md, docs/testing.md, docs/debugging.md. Then run `git log --oneline -20` and inspect docs/plan.md checkboxes. Tell me the last completed task, the next task, and any uncommitted changes. Do not write code until I say go.
```
**R5 — Document conflict or missing info**
```
Stop. Do not guess. Quote the two conflicting lines (file and section), explain the consequence for the current task, propose 2 options with a recommendation, and wait for my decision. After I decide, append the decision to docs/debugging.md §5.
```
**R6 — Evaluator or metrics look wrong**
```
Do not change code yet. Take result IDs <list>. For each, print the case's success condition, the raw response, the normalized response, which rule fired in decide_outcome, and the outcome. Then tell me whether the condition, the evaluator, or the response is the cause. Propose a fix plus a new golden-test row that captures the case. Wait for my approval.
```
