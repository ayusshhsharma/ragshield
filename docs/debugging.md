# Debugging — RAGShield

## 1. Debugging protocol (the agent follows this exactly)
1. **Reproduce.** Run the failing command; copy the exact error and the smallest repro. Do not guess from memory.
2. **Locate.** Read the stack trace bottom-up; open the files it names. Check recent diffs (`git diff`, `git log -3`).
3. **Hypothesise.** Write 1-3 candidate causes ranked by likelihood. Check the known-issues table (§3) first.
4. **Test the hypothesis cheaply** (print/log, a tiny script, one curl) before changing code.
5. **Fix minimally.** Change the smallest thing that explains the failure. No refactors, no unrelated edits.
6. **Prove.** Re-run the failing test, then the full suite of that service.
7. **Add a regression test** that fails without the fix.
8. **Record** non-obvious fixes in §4 (Decision/Issue log).
**Limit:** after 3 distinct failed fix attempts, stop and report: what you tried, evidence, your best hypothesis, what you need.
**Forbidden "fixes":** weakening/deleting tests, catching and swallowing exceptions, `sleep` to hide races, disabling auth/validation, hardcoding expected outputs, pinning to a different contract than the docs.

## 2. Diagnostic commands
```
# Mongo up?          docker compose ps ; docker compose logs mongo --tail 50
# AI service up?     curl http://localhost:8000/internal/health
# Service key ok?    curl -H "X-Service-Key: $INTERNAL_SERVICE_KEY" http://localhost:8000/internal/health
# Server up?         curl http://localhost:5000/api/health
# Auth works?        curl -X POST localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"email":"a@b.co","password":"password123"}'
# Chroma contents    python -c "import chromadb;c=chromadb.PersistentClient('./chroma_data');print([x.name for x in c.list_collections()])"
# Ports in use       (mac/linux) lsof -i :5000   (windows) netstat -ano | findstr :5000
```

## 3. Known issues and fixes
| Symptom | Likely cause | Fix |
|---|---|---|
| Browser: CORS error | `CLIENT_ORIGIN` mismatch (port or trailing slash) | Set exactly `http://localhost:5173`; restart server; check preflight `Authorization` header allowed |
| Server: `ECONNREFUSED` to ai-service | wrong `AI_SERVICE_URL` (in Docker must be `http://ai-service:8000`, not localhost) | fix env per environment |
| ai-service 401 from server | `INTERNAL_SERVICE_KEY` differs between services | make identical; restart both |
| 422 from FastAPI on valid-looking body | camelCase vs snake_case mismatch | pydantic alias_generator=to_camel + `populate_by_name`; send camelCase |
| Mongo `CastError: Cast to ObjectId failed` → 500 | unvalidated id param | validate with zod/`isValidObjectId`; return 404 |
| `E11000 duplicate key` on seed | non-idempotent seed | use `bulkWrite` upserts on `caseId` |
| `ModuleNotFoundError: fitz` | wrong package | install `pymupdf`; `import fitz` (or `import pymupdf` for newer versions) |
| First ingest very slow / hangs | embedding model downloading | wait once; mount `hf_cache` volume; set `HF_HOME` |
| Chroma: collection exists / dimension mismatch | embedding model changed after data created | delete `chroma_data` (dev) or collection; keep `EMBEDDING_MODEL` fixed |
| Chroma API errors after upgrade | API differences between versions | adapt only `vector_store.py`; do not upgrade after pinning |
| Gemini 404 model not found | outdated `GEMINI_MODEL` | check current model ids in Google AI docs; set env |
| Gemini 429 | free-tier rate limit | lower `LLM_MAX_RPM`, `RUN_CONCURRENCY=1`, use `repeats=1` for dev |
| Gemini returns empty text | safety block | set `providerBlocked=true`, outcome per rules (safe), count separately |
| Run stuck in `running` | server restarted or unhandled promise in runner | startup recovery marks failed; wrap per-item work in try/catch; log item id |
| Jest ESM errors (`Cannot use import statement`) | missing ESM flag | use script with `--experimental-vm-modules` |
| mongodb-memory-server download fails | offline/proxy | use `MONGO_URI_TEST` fallback (testing.md §2) |
| `multer` `LIMIT_FILE_SIZE` returns 500 | not mapped | map to 413 `FILE_TOO_LARGE` in error middleware |
| Tailwind classes not applied | installed Tailwind v4 / wrong config | pin `tailwindcss@3.4`, check `content` globs and `@tailwind` directives |
| Vite proxy/env undefined | env var lacks `VITE_` prefix or dev server not restarted | rename; restart |
| Docker: ai-service OOM-killed | embedding model + torch memory | raise Docker memory (≥ 4 GB), CPU torch only |
| Docker: server starts before mongo ready | missing healthcheck | add healthchecks and `depends_on.condition: service_healthy` |
| Evaluator marks refusals as success | success condition matches a *mention* | tighten regex per `database.md §4`; update golden test; human review |
| Percentages don't sum to 100 | errors counted in denominator | use eligible runs only; add test |
| Windows path/line-ending issues | CRLF in shell scripts / path separators | use `path.join`/`pathlib`; `.gitattributes` `* text=auto`; LF for `.sh` |
| JWT "invalid signature" after restart | `JWT_SECRET` regenerated each start | keep fixed secret in `.env` |
| UI polls forever | interval not cleared | clear in `useEffect` cleanup; stop on terminal status |

## 4. Decision and issue log (agent appends; newest first)
| Date | Task | Issue / decision | Resolution | Regression test |
|---|---|---|---|---|
| | | | | |

## 5. Document conflict log
| Date | Documents | Conflict | Human decision |
|---|---|---|---|
| | | | |
