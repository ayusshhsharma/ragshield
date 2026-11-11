# agents.md — Rules for the AI Coding Agent

This file governs every session. Read it fully before doing anything.

## 1. Mandatory reading order (do this at the start of EVERY new session)
1. `agents.md` (this file)
2. `docs/prd.md` — what we build and why, metric definitions
3. `docs/architecture.md` — services, contracts, env vars, defense specs, folder structure
4. `docs/database.md` — Mongo/Chroma schemas, attack case schema
5. `docs/design.md` — UI system
6. `docs/plan.md` — ordered tasks with acceptance criteria and checkboxes
7. `docs/testing.md` — test strategy and verification gate
8. `docs/debugging.md` — debugging protocol and known issues
9. `README.md` — final README skeleton

**Precedence when documents disagree:** agents.md > architecture.md > database.md > prd.md > design.md > plan.md > README.md.
If two documents conflict, do NOT guess. Stop, report the conflict, and append it to the Decision Log in `docs/debugging.md`.

## 2. Project snapshot
RAGShield: a multi-user platform that attacks a RAG application with prompt-injection test cases, applies toggleable defenses, and measures results with deterministic evaluation (baseline vs protected).
Stack: React + Vite + Tailwind 3.4 | Node 20 + Express 4 + MongoDB | Python 3.11 + FastAPI + ChromaDB + Sentence Transformers | Gemini (default) with a Mock provider for tests.

## 3. NEVER (hard rules)
1. Never invent metrics, results, benchmark numbers, or sample outputs. Numbers come only from real executed runs.
2. Never hardcode API keys, secrets, or passwords (synthetic demo secrets in `constants` and seed files are the only exception).
3. Never weaken, skip, delete, or loosen a failing test to make it pass. Fix the code, or report that the test itself is wrong and why.
4. Never add a dependency that is not in section 5 without asking first.
5. Never change an API contract, schema, enum, or env var name defined in the docs without asking first.
6. Never skip an ownership check. Every project-scoped route must verify `project.ownerId === req.user.id` (return 404 on mismatch, not 403).
7. Never expose the FastAPI service publicly or call it from the browser.
8. Never commit `.env`, `node_modules`, `.venv`, `chroma_data`, or model caches.
9. Never leave `TODO` stubs that pretend to work. Unfinished code must raise `NotImplementedError` / return HTTP 501 and be listed in your report.
10. Never run destructive commands (`rm -rf` outside build dirs, dropping databases, force-push) without asking.
11. Never mark a plan checkbox done unless the verification gate (section 8) passed.
12. Never do work from a later task "while you are here". One task per session step.

## 4. Conventions
**General**
- JSON over the wire is **camelCase everywhere** (Express and FastAPI). Python internals use snake_case; pydantic models use `alias_generator=to_camel` with `populate_by_name=True`.
- All timestamps ISO-8601 UTC strings. All IDs are strings (Mongo ObjectId serialised with `toString()`).
- Error response shape everywhere: `{ "error": { "code": "STRING_CODE", "message": "human text", "details": {} } }`.
- Logs are structured JSON (pino in Node, `logging` with JSON formatter in Python). Never log passwords, tokens, API keys, or full document text.

**Node (server/)**
- ES modules (`"type": "module"`), Node 20+. Express 4.x. Wrap async handlers with `asyncHandler`.
- Layering: routes → controllers → services → models. Controllers contain no DB logic. Validation with `zod` in `validators/`.
- Passwords: `bcryptjs` cost 12. JWT: HS256, expiry from env.

**Python (ai-service/)**
- Python 3.11, type hints everywhere, pydantic v2, `ruff` for lint. Pure functions for evaluator, metrics, defenses (no I/O) so they are unit-testable.
- No global mutable state except the lazily-loaded embedding model and Chroma client (wrapped in `get_*()` functions).

**React (client/)**
- Functional components, hooks, React Router v6, Axios instance in `services/api.js` with auth interceptor. Tailwind utility classes using tokens from `docs/design.md`. No inline styles except dynamic values.

## 5. Approved dependencies (install latest stable at build time, then freeze/pin in lockfiles; never upgrade afterwards)
- **server:** express@4, mongoose, jsonwebtoken, bcryptjs, zod, multer, axios, cors, helmet, express-rate-limit, dotenv, pino, pino-http · dev: jest, supertest, mongodb-memory-server, nock, eslint
- **client:** react, react-dom, react-router-dom, axios, recharts, lucide-react, tailwindcss@3.4 + postcss + autoprefixer, vite, @vitejs/plugin-react · dev: vitest, @testing-library/react, @testing-library/jest-dom, jsdom
- **ai-service:** fastapi, uvicorn[standard], pydantic>=2, pydantic-settings, python-multipart, httpx, sentence-transformers (CPU torch), chromadb, pymupdf, python-docx, google-genai · dev: pytest, pytest-asyncio, ruff
Anything else: ask.

## 6. Git workflow
- Branch: work on `main` using small commits (solo project). One commit per plan task.
- Commit message format: `<type>(<scope>): <summary> [T<task id>]` e.g. `feat(ai): add chunker and extractors [T1.2]`. Types: feat, fix, test, docs, chore, refactor.
- Before each commit: run the verification gate (section 8). Never commit failing tests.

## 7. Task workflow (follow for every task)
1. State which `plan.md` task you are executing and restate its acceptance criteria in your own words.
2. List the files you will create or change. If it touches anything outside the task's scope, stop and ask.
3. Write tests first or alongside (see `docs/testing.md`).
4. Implement the minimum that satisfies the acceptance criteria.
5. Run the verification gate.
6. Tick the checkbox in `docs/plan.md`, commit.
7. Report using the format in section 9.

## 8. Verification gate (all must pass before a task is "done")
- `ai-service`: `ruff check .` and `pytest -q`
- `server`: `npm run lint` and `npm test`
- `client`: `npm run build` and `npm test`
- For any task that adds an endpoint: one manual request (curl/Postman-style) actually executed, with the real response pasted in your report.
- Run only the suites for services you touched, but run **all three** before the final task of each phase.

## 9. Report format at the end of every task
```
Task: T<id> <title>
Status: done | blocked | partial
Files changed: <list>
Tests: <command> -> <pass/fail counts>
Manual check: <command and trimmed real output>
Commit: <hash and message>
Deviations from docs: <none | list>
Open issues / assumptions: <none | list>
Next task: T<id>
```

## 10. Stop conditions (stop and ask instead of continuing)
- A document conflict or ambiguity affects the task.
- A test fails and you have made 3 distinct fix attempts (follow `docs/debugging.md`).
- A required external credential is missing (e.g. `GEMINI_API_KEY`): use `LLM_PROVIDER=mock` and continue, but say so.
- The task needs a dependency or contract change.

## 11. Things the HUMAN owns (do not do these; prompt the human instead)
- Reviewing and approving every attack case's success condition.
- Writing/approving the benign questions.
- Reading and understanding the evaluator and metrics code.
- Running the real baseline/protected experiments with Gemini and recording numbers in `docs/results.md`.
- Final README numbers, resume bullets, demo video.
When you reach one of these, stop and tell the human exactly what to do.
