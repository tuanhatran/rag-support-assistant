# Agent Handoff: RSA-1

Status: DONE

## Model Routing

| Complexity | Coder | Tester | Reviewer |
| --- | --- | --- | --- |
| S | Gemini 3.8 Flash (copilot) | Gemini 3.8 Flash (copilot) | Claude Haiku 5.5 (copilot) |
| M | Gemini 3.8 Flash (copilot) | Gemini 3.8 Flash (copilot) | Claude Haiku 5.5 (copilot) |
| L | Gemini 3.8 Flash (copilot) | Gemini 3.8 Flash (copilot) | Claude Haiku 5.5 (copilot) |

Planner model: Claude Haiku 5.5 (copilot). Use the exact model names in the agent picker.

## Current Task

- Task: Admin "Ingestion" tab. An admin uploads a `.txt` or `.pdf` document up to 500 KB. A background pipeline runs File Parsing, Chunking, Embedding, and Database Ready. Chunks and vectors are stored in PostgreSQL with pgvector. The upload returns a pipeline ID. Clicking the ID opens a detail page (layout from the attached mockup) that polls and shows stage progress, chunks, extracted text, and an export payload.
- Branch: feature/RSA-1-ingestion-pipeline
- Complexity: L
- Context files:
  - `.github/context/FILE_GRAPH.md`
  - `docker-compose.yml`
  - `.env.example`
  - `frontend/nginx.conf`
  - `backend/requirements.txt`
  - `backend/app/config.py`
  - `backend/app/main.py`
  - `backend/app/dependencies.py`
  - `backend/app/repositories.py`
  - `backend/app/errors.py`
  - `backend/app/audit.py`
  - `backend/app/redaction.py`
  - `backend/app/routers/admin.py` (for the router pattern only)
  - `backend/tests/fakes.py`
  - `backend/tests/test_api.py`
  - `backend/tests/test_core.py`
  - `frontend/src/api.ts`
  - `frontend/src/types.ts`
  - `frontend/src/components/AdminView.tsx`
  - `frontend/src/styles.css`
  - `readme.md` (Database row and Docker env only)
- Files to create:
  - `backend/app/ingestion.py`: parsing, chunking, option validation, pipeline orchestration, `IngestionService`
  - `backend/app/embeddings.py`: provider protocol and the Cloudflare, local (fastembed), and OpenAI providers
  - `backend/app/vectorstore.py`: pgvector store (psycopg async), schema bootstrap, sweep
  - `backend/app/routers/ingestion.py`: admin endpoints
  - `frontend/src/components/IngestionView.tsx`: upload form and option panel
  - `frontend/src/components/IngestionPipelineView.tsx`: pipeline detail page
  - `backend/tests/test_ingestion.py`: chunking, parsing, and pipeline tests
- Acceptance criteria:
  1. `POST /api/admin/ingestion/pipelines` (multipart: `file`, `chunk_size`, `chunk_overlap`, `separator`, `embedding_model`) is admin-only. It accepts `.txt` and `.pdf` only, returns 413 for files over 512,000 bytes (500 KB), returns 400 for empty files, and returns 415 for other extensions. On success it returns 202 with `id` and status `queued`, without waiting for embedding.
  2. The pipeline runs in the background through four stages in order: `file_parsing`, `chunking`, `embedding`, `database_ready`. Each stage records `status` (`idle`, `running`, `done`, or `failed`) and `latency_ms`. A failure sets the pipeline to `failed` with a short `error` message and skips the remaining stages.
  3. `GET /api/admin/ingestion/pipelines/{id}` returns the pipeline status, stages, options, chunk count, and redacted extracted text. It returns 404 for an unknown ID. `GET /api/admin/ingestion/pipelines/{id}/chunks` returns chunk previews (index, content, model, dimensions) and never returns vectors.
  4. `GET /api/admin/ingestion/options` returns the four models from the ticket, each with `id`, `label`, `dimensions`, and `target` (`Cloudflare Workers AI`, `Local CPU`, `OpenAI API`). It also returns the separator choices and the chunk-size and overlap limits.
  5. Embedding providers: `@cf/baai/bge-small-en-v1.5` via the Cloudflare Workers AI REST API (384-dim). `sentence-transformers/all-MiniLM-L6-v2` (384-dim) and `BAAI/bge-base-en-v1.5` (768-dim) run locally through `fastembed` (ONNX, no PyTorch). `text-embedding-3-small` via the OpenAI `/v1/embeddings` API (1536-dim). The embedding stage fails if a returned vector length differs from the catalog dimension.
  6. Vectors live in PostgreSQL table `document_chunks` with columns `id`, `pipeline_id`, `chunk_index`, `content`, `model`, `dimensions`, `embedding vector` (untyped pgvector column), and `expires_at`. The schema, including `CREATE EXTENSION IF NOT EXISTS vector`, is created at startup.
  7. Extracted text goes through `redact()` before chunking, before any embedding call, and before storage. Logs never contain document text.
  8. Chunking: `chunk_size` must be 100 to 2000, `chunk_overlap` must be 0 or more and less than `chunk_size`, and `separator` must be one of `\n\n`, `\n`, or a single space. Pieces longer than `chunk_size` are hard-split. Chunks carry the overlap from the previous chunk.
  9. Retention: the Mongo `ingestion_pipelines` documents carry `expires_at` (`RAG_INGESTION_RETENTION_DAYS`, default 90) with a TTL index. An hourly asyncio sweep in the app lifespan deletes expired `document_chunks` rows. On startup, any pipeline still `queued` or `running` is marked `failed` with "interrupted by restart".
  10. Audit events `admin.ingestion.started`, `admin.ingestion.completed`, and `admin.ingestion.failed` are recorded through `AuditService`. Their details contain the pipeline ID and file name only.
  11. Secrets: `RAG_CLOUDFLARE_API_TOKEN` and `RAG_OPENAI_API_KEY` are read from settings only. They are never logged or returned by any endpoint.
  12. Admin UI: a new `ingestion` tab in `AdminView` with drag-and-drop or browse upload (client-side 500 KB and extension check). Chunking controls default to size 500 and overlap 50. The separator select defaults to paragraphs (`\n\n`). The model select comes from `/options`, and the panel shows dimensions and deployment target. "Process & Ingest Document" is disabled until a file is chosen. After submit the page shows the pipeline ID as a link. Clicking it opens `IngestionPipelineView`, which shows four stage cards and polls every 1 second until the pipeline reaches `completed` or `failed`. Its right panel has tabs for Chunk Inspector (with count), Extracted Text, and Export Payload, plus latency.
  13. `docker-compose.yml`: add a `postgres` service (`pgvector/pgvector:pg17`) with a healthcheck and volume `pg-data`. Backend env adds `RAG_PGVECTOR_DSN`, `RAG_CLOUDFLARE_ACCOUNT_ID`, `RAG_CLOUDFLARE_API_TOKEN`, `RAG_OPENAI_API_KEY`, and `RAG_INGESTION_RETENTION_DAYS`. `POSTGRES_PASSWORD` is required with `:?`. Also fix the existing malformed `volumes:` block at the end of the file, which currently has `mongo-data:/home/thtran/rag-support-db` as a scalar. `.env.example` lists the new variables.
  14. Existing BM25 chat retrieval, auth, and other admin endpoints are unchanged.
  15. Tests: unit tests use fake embedding and vector-store providers, with no network calls. A Postgres integration test runs only when `RAG_PGVECTOR_DSN` is set and skips otherwise. Full gate passes: `cd backend && python -m pytest -q -p no:warnings` and `cd frontend && npm run build`.
- Test commands: `cd backend && python -m pytest -q -p no:warnings`; `cd frontend && npm run build`
- Fix rounds: 3 / 3
- Previous stage: Planning
- Notes:
  - Planning decisions (defaults, applied unless the reviewer changes them):
    - Pipeline status and extracted text are stored in Mongo `ingestion_pipelines`. Only vectors and chunk text live in Postgres.
    - Pipelines run as `asyncio` tasks inside the backend process. Single-process only for this ticket.
    - Upload types: the ticket says txt or pdf, so `.txt` and `.pdf` are accepted. The mockup hint also mentions `.md`. Adding `.md` later is a one-line change.
    - "500 KB" is 512,000 bytes.
    - The `vector` column is untyped so one table serves all four dimensions. No ANN index in this ticket.
    - Chunk Inspector and Export Payload read from the detail and chunks endpoints. Export Payload contains metadata and content, never vectors.
    - Cloudflare call: `POST https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/@cf/baai/bge-small-en-v1.5` with `{"text": [...]}`, reading `result.data`.
    - Local models download on first use, so the first run needs network access.
    - Chat retrieval still uses BM25. Using the new vectors for chat is out of scope.
  - Pre-existing state:
    - `project_skeleton.md` does not exist in the workspace. The copilot instructions were used instead.
    - Untracked `.agents/` and `skills-lock.json` are present. The user confirmed proceeding.
    - The branch was created from `main`.

## Handoff

@coder: use Gemini 3.8 Flash (copilot). Implement the task above, reading only the listed context files. Create the files listed under "Files to create". Keep `.github/context/FILE_GRAPH.md` accurate. Do not commit or push.

## Implementation Summary

### Changed and Created Files
- `backend/app/embeddings.py` (created): Provider protocol and Cloudflare, local (FastEmbed), and OpenAI providers, with dimension validation.
- `backend/app/vectorstore.py` (created): PgVectorStore (psycopg async), schema bootstrap, sweep, and FakeVectorStore for unit tests.
- `backend/app/ingestion.py` (created): Document parsing (.txt and .pdf with redact()), chunking with hard split and carried overlap, option validation, pipeline orchestration, and IngestionService.
- `backend/app/routers/ingestion.py` (created): Admin endpoints: POST /pipelines, GET /pipelines/{id}, GET /pipelines/{id}/chunks, GET /options.
- `frontend/src/components/IngestionView.tsx` (created): Admin Ingestion tab upload form with client-side 500 KB and extension check, chunking & model option controls.
- `frontend/src/components/IngestionPipelineView.tsx` (created): Pipeline detail page with 1s polling, 4 stage cards with latencies, Chunk Inspector, Extracted Text, and Export Payload tabs.
- `backend/tests/test_ingestion.py` (created): Unit and integration tests for chunking, parsing, redaction, dimension mismatch, API validations, and vectorstore sweep.
- `backend/app/config.py`: Added `pgvector_dsn`, `cloudflare_account_id`, `cloudflare_api_token`, `openai_api_key`, `ingestion_retention_days`.
- `backend/app/dependencies.py`: Registered VectorStore and IngestionService in Container.
- `backend/app/main.py`: Registered ingestion router, added hourly expired chunks sweep background task, and restart interruption cleanup.
- `backend/app/repositories.py`: Added `ingestion_pipelines` collection with TTL index on `expires_at`.
- `backend/requirements.txt`: Added `python-multipart`, `psycopg[binary]`, `fastembed`, `pypdf`.
- `backend/tests/fakes.py`: Added nested dotted key support in FakeDatabase `$set` updates.
- `docker-compose.yml`: Added `postgres` service (`pgvector/pgvector:pg17`) with healthcheck, updated backend env with `RAG_PGVECTOR_DSN` and secrets, fixed malformed `volumes:` block.
- `.env.example`: Added postgres and ingestion settings.
- `frontend/src/types.ts`: Added ingestion pipeline and chunk types.
- `frontend/src/api.ts`: Added `postForm` and FormData handling to `api.post`.
- `frontend/src/components/AdminView.tsx`: Added Ingestion tab and pipeline view routing.
- `frontend/src/styles.css`: Added styles for upload dropzone, options, stage cards, chunk inspector, and export payload.
- `.github/context/FILE_GRAPH.md`: Updated modules, routes, collections, tests, and frontend components.

### Test Verification
- Targeted & Full Backend Suite: `cd backend && python -m pytest -q -p no:warnings`
  - Result: 52 passed, 1 skipped in 2.13s (14 ingestion tests passed, 1 postgres integration test skipped when RAG_PGVECTOR_DSN is unset).
- Ingestion Targeted Suite: `cd backend && python -m pytest tests/test_ingestion.py -v`
  - Result: 14 passed, 1 skipped in 0.83s.
- Frontend Build: `cd frontend && npm run build`
  - Result: TypeScript check and Vite production build succeeded (`tsc -b && vite build` built in 2.27s).

### Tester Verdict
- Status: READY_FOR_REVIEW
- Branch verified: `feature/RSA-1-ingestion-pipeline`
- Acceptance criteria 1-15 verified:
  - Admin RBAC, extension (.txt/.pdf), empty file, and 500 KB limit enforced.
  - Four background stages recorded in order with status and latency.
  - Detail, chunks preview (vectors omitted), and options endpoints verified.
  - Provider catalog and dimension checking verified.
  - Redaction of sensitive data before chunking, embedding, and storage verified.
  - Chunking options, hard-split, and overlap verified.
  - Startup interruption marking and vectorstore sweep verified.
  - Admin UI ingestion tab and pipeline view with 1s polling verified.
  - Docker compose configuration and env example verified.
  - No application implementation files modified during testing; only tests and handoff updated.

@reviewer: use Claude Haiku 5.5 (copilot). Review the implementation against the acceptance criteria, architecture, and security rules. Do not commit or push.

## Review (Round 1)

Reviewer: Claude Haiku 5.5 (copilot). Branch verified: `feature/RSA-1-ingestion-pipeline`. Verdict: CHANGES_REQUESTED.

Evidence reviewed: backend and frontend diffs, handoff criteria 1-15, `npm run build` (passes), backend pytest (52 passed, 1 skipped per tester; not re-run by reviewer). Chunker probes: overlap, hard split, and whitespace-only input behave as specified. Image-only or whitespace-only input yields zero chunks (see item 4).

### Change requests (coder)

1. **Blocker: background task reference dropped.** `backend/app/ingestion.py` `IngestionService.create_pipeline` calls `asyncio.create_task(self.run_pipeline(...))` without keeping a reference. asyncio may garbage-collect the task mid-run, leaving the pipeline stuck. Fix: keep the tasks in a set on the service (or container) and use `task.add_done_callback(tasks.discard)`. Add a test that the set holds the task until completion.

2. **Blocker: failure outside the try block.** In `run_pipeline`, the `running` status update and `admin.ingestion.started` audit call sit before `try:`. If either raises, no `failed` status is written and the pipeline stays `queued` or `running`. Fix: move both inside the `try`, or wrap the whole method, so any exception sets `status: failed` with a short `error` and records `admin.ingestion.failed`. Add a test that forces `audit.record` to raise and asserts `failed`.

3. **Security (criterion 11): raw exception text is persisted and returned.** `run_pipeline` stores `"error": str(exc)` (around `ingestion.py` lines 372 and 381), and `get_pipeline` returns it. Upstream and driver exceptions can echo request or response content. Fix: store a fixed message per stage (for example "Embedding provider request failed", "Database write failed"), or `redact(str(exc))` truncated to about 200 characters. Add a test where the fake provider raises an exception containing a fake `sk-` token and assert the token does not appear in the GET response.

4. **Behavior gap: empty text completes.** Image-only PDFs yield `''` from `parse_document`, and whitespace-only `.txt` yields zero chunks. The pipeline currently finishes with `chunk_count: 0` and Database Ready as `done`. Fix: after file parsing, if `extracted_text.strip()` is empty, fail the file_parsing stage with "No text could be extracted from this document", set the pipeline to `failed`, and skip the remaining stages. Add a test.

5. **Medium: unbounded upload read.** `backend/app/routers/ingestion.py` calls `content = await file.read()` before checking size, so a very large upload is fully read into memory before the 413. Fix: `content = await file.read(MAX_FILE_BYTES + 1)`, then keep the empty (400) and oversize (413) checks. Add a test that posts a file larger than 512,000 bytes and expects 413.

6. **Low: silent schema bootstrap failure.** `backend/app/dependencies.py` `initialize_container` wraps `container.vectorstore.bootstrap()` in `try/except Exception: pass`. A broken pgvector setup stays invisible until a pipeline fails with an unclear error. Fix: log a fixed message (no DSN, no document text) with the exception class name. Startup may stay non-fatal.

7. **Low: `.env.example` DSN placeholder.** `RAG_PGVECTOR_DSN` contains the literal `${POSTGRES_PASSWORD}`. pydantic-settings does not expand it, so runs outside Compose fail to authenticate. Fix: use an explicit placeholder such as `<password>` and add a comment that Compose supplies the value itself.

8. **Low: unhandled clipboard rejection.** `frontend/src/components/IngestionPipelineView.tsx` calls `navigator.clipboard.writeText` without a catch. A rejected promise goes unhandled and no error is shown. Fix: wrap in try/catch and show a short error message in the page.

9. **Hygiene: tracked build artifact modified.** `frontend/tsconfig.app.tsbuildinfo` shows as modified in the worktree because `npm run build` rewrites it. Fix: run `git checkout -- frontend/tsconfig.app.tsbuildinfo` before the final gate and before any commit. Rerunning `npm run build` will modify it again, so revert after the final build.

### Non-blocking notes (no change required)

- `FastEmbedEmbeddingProvider` caches the model per provider instance, so the ONNX model reloads for each pipeline. Consider a module-level cache in a later ticket.
- Overlap is dropped when a hard-split piece is close to `chunk_size` (for example, 300 `A` characters with size 100 and overlap 99 yields no overlap). This is acceptable but worth documenting in the chunking docstring.
- `validate_embedding_dimensions` checks vector length but not that the vector count matches the chunk count. Consider adding the count check.

### Acceptance status

Criteria 1, 3, 4, 5, 6, 8, 10, 12, 13, 14, 15 satisfied in code review. Criteria 2 and 7 are affected by items 2 and 4. Criterion 11 is affected by item 3. Criterion 9 is satisfied except that the startup bootstrap failure is silent (item 6).

Re-review will run after the coder's fix round. Fix rounds used: 1 / 3.

## Fix Round 1 Summary

### Addressed Items
1. **Background task retention**: Added `self.background_tasks: set[asyncio.Task]` on `IngestionService`. Added task reference and `task.add_done_callback(self.background_tasks.discard)`. Added test `test_background_tasks_set_holds_and_discards`.
2. **Failure outside try block**: Moved `running` status update and `admin.ingestion.started` audit event inside the `try:` block in `run_pipeline`. Any error sets `status: failed`, records the failed stage, and audits `admin.ingestion.failed`. Added test `test_pipeline_audit_record_raises_marks_failed`.
3. **Secret redaction in error messages**: Error text is sanitized via `redact(str(exc))[:200]`. Added test `test_pipeline_error_redaction_secrets` ensuring leaked `sk-` tokens are redacted and absent from the GET response.
4. **Empty extracted text**: Added check after file parsing: if `not extracted_text.strip()`, sets file_parsing to `failed`, sets pipeline to `failed` with `"No text could be extracted from this document"`, audits failure, and skips downstream stages. Added test `test_pipeline_empty_text_fails`.
5. **Bounded upload read**: Updated `POST /api/admin/ingestion/pipelines` to read `MAX_FILE_BYTES + 1` (`await file.read(MAX_FILE_BYTES + 1)`), enforcing 413 without reading unbounded streams into memory.
6. **Schema bootstrap warning**: Added warning log in `initialize_container` logging `"Failed to bootstrap pgvector schema: %s"` with exception class name only.
7. **DSN placeholder in `.env.example`**: Updated `RAG_PGVECTOR_DSN` with `<password>` placeholder and added a comment explaining Compose automatically supplies the environment variable.
8. **Clipboard rejection handling**: Wrapped `navigator.clipboard.writeText` in try/catch in `IngestionPipelineView.tsx` and surfaces error message on rejection.
9. **Hygiene**: Reverted `frontend/tsconfig.app.tsbuildinfo` modification.
- **Non-blocking notes**: Documented overlap edge case in `chunk_text` docstring; added `expected_count` validation in `validate_embedding_dimensions` and test `test_validate_embedding_dimensions_count_mismatch`.

### Test Verification
- Ingestion Targeted Suite: `cd backend && python -m pytest tests/test_ingestion.py -v` (19 passed, 1 skipped).
- Full Backend Suite: `cd backend && python -m pytest -q -p no:warnings` (57 passed, 1 skipped in 2.59s).
- Frontend Build: `cd frontend && npm run build` (Clean build in 2.25s).

@tester: use Gemini 3.8 Flash (copilot). Verify the fix round against the reviewer's change requests and run the test gate. Do not commit or push.

### Tester Verdict (Round 2)
- Status: READY_FOR_REVIEW
- Branch verified: `feature/RSA-1-ingestion-pipeline`
- Verified reviewer change requests (items 1-9):
  1. Background task retained in `self.background_tasks` set with `add_done_callback(discard)`; verified via `test_background_tasks_set_holds_and_discards`.
  2. Failure outside try block resolved: status update and audit call wrapped in try/except; verified via `test_pipeline_audit_record_raises_marks_failed`.
  3. Secret redaction on error messages: `redact(str(exc))[:200]` applied; verified via `test_pipeline_error_redaction_secrets`.
  4. Empty extracted text fails stage and pipeline: verified via `test_pipeline_empty_text_fails`.
  5. Bounded upload read: `await file.read(MAX_FILE_BYTES + 1)` prevents reading unbounded files into memory; 413 check verified in `test_pipeline_upload_validations`.
  6. Schema bootstrap warning: logs class name without exposing DSN or text.
  7. DSN placeholder in `.env.example`: updated to `<password>` with explanatory comment.
  8. Clipboard rejection handled: try/catch in `IngestionPipelineView.tsx` with user error notice.
  9. Hygiene: `frontend/tsconfig.app.tsbuildinfo` reverted to clean state.
- Test commands & results:
  - `cd backend && python -m pytest tests/test_ingestion.py -v`: 19 passed, 1 skipped in 1.28s.
  - `cd backend && python -m pytest -q -p no:warnings`: 57 passed, 1 skipped in 2.58s.
  - `cd frontend && npm run build`: 1845 modules transformed, production build succeeded in 2.27s.
  - Tracked build artifact `frontend/tsconfig.app.tsbuildinfo` reverted after build.
- Acceptance criteria 1-15 pass.

## Review (Round 2)

Reviewer: Claude Haiku 5.5 (copilot). Branch verified: `feature/RSA-1-ingestion-pipeline`. Worktree holds only task changes plus the pre-existing untracked `.agents/` and `skills-lock.json`. Verdict: CHANGES_REQUESTED.

Round 1 items 1-9 are confirmed in code: background task set with discard callback, status and audit inside the try block, `redact(str(exc))[:200]`, empty-text failure, bounded `file.read(MAX_FILE_BYTES + 1)`, bootstrap warning with class name only, `.env.example` placeholder, clipboard try/catch, and `tsbuildinfo` no longer modified. The reviewer did not re-run tests; tester evidence is 57 passed, 1 skipped.

### Change requests (coder)

1. **Medium: silent in-memory vector store in production.** `backend/app/dependencies.py` `build_container` falls back to `FakeVectorStore()` when `RAG_PGVECTOR_DSN` is unset. A deployed app then reports pipelines as `completed` while vectors live only in process memory and are lost on restart, which breaks criterion 6. Fix: when no DSN is set, use a store whose methods raise `ConfigurationError`, so the `database_ready` stage fails with a fixed message. Let `create_app` accept an optional `vectorstore` argument, and have the `fake_container` fixture and other tests pass `FakeVectorStore()` explicitly. Add a test that a container without a DSN never reports `completed`.

2. **Medium: no batching for embedding APIs.** `CloudflareEmbeddingProvider.embed` and `OpenAIEmbeddingProvider.embed` in `backend/app/embeddings.py` send every chunk in one request. A 500 KB file at chunk_size 100 produces thousands of chunks, which exceeds provider batch limits (Cloudflare's bge models accept at most 100 texts per call per the model docs; verify before fixing the constant). Fix: split `texts` into batches (100 for Cloudflare, a documented constant for OpenAI), call per batch, and concatenate in order. Add a test that monkeypatches `httpx.AsyncClient.post` (no network) and asserts batch sizes and output order.

3. **Low: raw response body persisted as error.** `CloudflareEmbeddingProvider.embed` raises `ValueError(f"... {data}")` with the full response body. `run_pipeline` stores it in the pipeline `error` after `redact()`, which does not guarantee that document text is absent. Fix: use a fixed message with no body.

4. **Low: fragile test.** `test_pipeline_error_redaction_secrets` in `backend/tests/test_ingestion.py` is `async` but uses the sync `TestClient`. It also relies on the background task surviving between two separate `with TestClient(app)` blocks. Fix: make it a sync test that polls `GET /api/admin/ingestion/pipelines/{id}` until a terminal status inside one `with TestClient(app)` block.

5. **Low: polling stops on a transient error.** In `frontend/src/components/IngestionPipelineView.tsx`, the `fetchPipeline` catch sets the error and never reschedules, so one failed GET freezes the page. Fix: keep the 1-second poll after a transient error (show the error but continue polling), and stop only on `completed` or `failed`.

### Non-blocking notes (no change required)

- `copyPayload` in `IngestionPipelineView.tsx` starts a `setTimeout` that is not cleared on unmount.
- `RAG_PGVECTOR_DSN` in `docker-compose.yml` does not URL-encode `POSTGRES_PASSWORD`, so special characters break the DSN. Consider encoding in a later ticket.

### Acceptance status

Criteria 1-4, 7, 8, 9, 10, 11, 12, 13, 14, and 15 are satisfied in code review. Criterion 5 is affected by item 2 (batching). Criterion 6 is affected by item 1 (persistence).

@coder: apply items 1-5 and rerun the gate. Re-review follows. Fix rounds used: 2 / 3. Do not commit or push.

## Fix Round 2 Summary

### Addressed Items
1. **Unconfigured vector store in production**: Added `UnconfiguredVectorStore` in `backend/app/vectorstore.py` that raises `ConfigurationError` on chunk insertion or retrieval when `RAG_PGVECTOR_DSN` is unset. Updated `backend/app/dependencies.py` to use `UnconfiguredVectorStore` by default instead of `FakeVectorStore()`. Added optional `vectorstore` parameter to `create_app` in `backend/app/main.py` and passed `vectorstore=vectorstore` in test `fake_container` fixture. Added test `test_pipeline_fails_when_vectorstore_unconfigured` asserting pipeline never reaches `completed` and fails at `database_ready` stage when DSN is unset.
2. **Batching for embedding APIs**: Added batching for `CloudflareEmbeddingProvider.embed` (batch size 100, `CLOUDFLARE_MAX_BATCH_SIZE`) and `OpenAIEmbeddingProvider.embed` (batch size 2048, `OPENAI_MAX_BATCH_SIZE`). Added tests `test_cloudflare_embedding_provider_batching_and_order` and `test_openai_embedding_provider_batching_and_order` monkeypatching `httpx.AsyncClient.post` asserting batch counts/sizes and exact vector output order.
3. **Fixed error message for Cloudflare response format**: Changed exception in `CloudflareEmbeddingProvider.embed` to a fixed message `ValueError("Unexpected Cloudflare embedding response format")` without interpolating the response body.
4. **Fragile test fixed**: Refactored `test_pipeline_error_redaction_secrets` in `backend/tests/test_ingestion.py` into a synchronous test with in-block polling of `GET /api/admin/ingestion/pipelines/{id}` until terminal status inside a single `with TestClient(app)` context.
5. **Transient error polling in UI**: Updated `fetchPipeline` in `frontend/src/components/IngestionPipelineView.tsx` to clear transient error on success and reschedule polling after catch, ensuring polling only stops on `completed` or `failed`.

### Test Verification
- Targeted Ingestion Suite: `cd backend && python -m pytest tests/test_ingestion.py -v` (22 passed, 1 skipped).
- Full Backend Suite: `cd backend && python -m pytest -q -p no:warnings` (60 passed, 1 skipped in 3.35s).
- Frontend Build: `cd frontend && npm run build` (Clean build in 2.27s, `tsconfig.app.tsbuildinfo` reverted).

@tester: use Gemini 3.8 Flash (copilot). Verify the fix round against the reviewer's change requests and run the test gate. Do not commit or push.

### Tester Verdict (Round 3)
- Status: READY_FOR_REVIEW
- Branch verified: `feature/RSA-1-ingestion-pipeline`
- Verified reviewer change requests (Round 2 items 1-5):
  1. Unconfigured vector store in production: `UnconfiguredVectorStore` raises `ConfigurationError` when `RAG_PGVECTOR_DSN` is unset; `create_app` accepts optional `vectorstore`; verified via `test_pipeline_fails_when_vectorstore_unconfigured`.
  2. Batching for embedding APIs: `CloudflareEmbeddingProvider.embed` and `OpenAIEmbeddingProvider.embed` batch chunks and preserve order; verified via `test_cloudflare_embedding_provider_batching_and_order` and `test_openai_embedding_provider_batching_and_order`.
  3. Fixed error message for Cloudflare response format: `ValueError("Unexpected Cloudflare embedding response format")` used without leaking raw response body.
  4. Fragile test fixed: `test_pipeline_error_redaction_secrets` is synchronous with in-block polling under a single `with TestClient(app)`.
  5. Transient error in UI polling: `fetchPipeline` reschedules polling on error, stopping only on terminal states (`completed` or `failed`).
- Test commands & results:
  - `cd backend && python -m pytest tests/test_ingestion.py -v`: 22 passed, 1 skipped in 2.11s.
  - `cd backend && python -m pytest -q -p no:warnings`: 60 passed, 1 skipped in 3.39s.
  - `cd frontend && npm run build`: 1845 modules transformed, production build succeeded in 2.26s.
  - Reverted tracked build artifact `frontend/tsconfig.app.tsbuildinfo` after build.
- Acceptance criteria 1-15 verified and passing.

@reviewer: use Claude Haiku 5.5 (copilot). Review the implementation against the acceptance criteria, architecture, and security rules. Do not commit or push.

## Review (Round 3)

Reviewer: Claude Haiku 5.5 (copilot). Branch verified: `feature/RSA-1-ingestion-pipeline`. Worktree holds only task changes plus the pre-existing untracked `.agents/` and `skills-lock.json`. Verdict: CHANGES_REQUESTED.

Round 2 items 1-5 are confirmed in code: `UnconfiguredVectorStore` is the default when no DSN is set, `create_app` accepts `vectorstore`, Cloudflare and OpenAI embedding calls are batched in order, the Cloudflare error is a fixed message, the redaction test is synchronous with in-block polling, and UI polling reschedules after a transient error. The reviewer re-ran the backend gate: `python -m pytest -q -p no:warnings` gives 60 passed, 1 skipped.

### Change requests (coder)

1. **Medium: unbounded zlib decompression in the PDF fallback (DoS).** `parse_document` in `backend/app/ingestion.py` calls `zlib.decompress(stream_data)` and `zlib.decompress(stream_data, -zlib.MAX_WBITS)` with no output limit. The reviewer measured a 194 KB crafted PDF with one flate stream that expands to about 200 MB. Peak traced memory was about 449 MB, which an authenticated admin upload can use to exhaust the backend container. Fix:
   - Replace both calls with bounded decompression, for example `zlib.decompressobj(...).decompress(stream_data, MAX_STREAM_DECOMPRESSED_BYTES)`, and check `unconsumed_tail` to detect truncation.
   - Enforce a cumulative cap `MAX_TOTAL_DECOMPRESSED_BYTES` across all streams in one file, and stop scanning once it is reached.
   - When a cap is exceeded, fail the pipeline at `file_parsing` with a fixed message, for example `"PDF content exceeds decompression limit"`. Do not include stream content in the message.
   - Keep the pypdf path unchanged.
   - Add a test in `backend/tests/test_ingestion.py` with a high-ratio compressed stream. Assert that parsing fails with the fixed message, or that output stays within the cap. Keep the test fast by using a small cap, for example by monkeypatching the constant.

### Non-blocking notes (no change required)

- `FakeVectorStore` is imported but unused in `backend/app/dependencies.py`. Remove it.
- `copyPayload` in `IngestionPipelineView.tsx` still does not clear its timer on unmount.
- `IngestionPipelineView.tsx` keeps polling every second after a 404, for example after TTL removal of the pipeline. Consider stopping on 404 in a later ticket.
- The Cloudflare batch constant of 100 is not verified against current provider docs. This review had no network access. Verify it before merge, or add a code comment that cites the source.
- `RAG_PGVECTOR_DSN` in `docker-compose.yml` still does not URL-encode `POSTGRES_PASSWORD` (already noted in Round 2).

### Acceptance status

Criteria 1-15 remain satisfied in code review. Item 1 is a security finding under the project security rules and does not change those criteria.

@coder: apply item 1 and rerun the gate. Remove the unused import as well. Re-review follows. Fix rounds used: 3 / 3 after this round. If the next review is not `DONE`, the status becomes `BLOCKED` and returns to the planner. Do not commit or push.

## Fix Round 3 Summary

### Addressed Items
1. **Bounded zlib decompression in PDF fallback (DoS defense)**:
   - Added `MAX_STREAM_DECOMPRESSED_BYTES = 2 * 1024 * 1024` (2 MB) and `MAX_TOTAL_DECOMPRESSED_BYTES = 8 * 1024 * 1024` (8 MB) in `backend/app/ingestion.py`.
   - Replaced unbounded `zlib.decompress` calls with bounded decompression using `zlib.decompressobj(wbits).decompress(stream_data, stream_limit + 1)`.
   - Checked `len(decomp) > stream_limit`, `dco.unconsumed_tail`, and buffered state to detect truncation.
   - Enforced cumulative cap `MAX_TOTAL_DECOMPRESSED_BYTES` across all streams in a file, raising `ValidationError("PDF content exceeds decompression limit")` when reached.
   - Preserved `run_pipeline` error handling so pipeline sets `stages.file_parsing.status = "failed"`, pipeline `status = "failed"` with fixed message `"PDF content exceeds decompression limit"`, records `admin.ingestion.failed` audit event, and skips downstream stages without exposing stream contents.
   - Kept `pypdf` extraction path unchanged.
2. **Unused import cleanup**:
   - Removed unused `FakeVectorStore` import in `backend/app/dependencies.py`.
3. **Targeted unit & pipeline tests**:
   - Added `test_parse_pdf_high_ratio_decompression_fails` testing single-stream compression bomb.
   - Added `test_parse_pdf_cumulative_decompression_limit_fails` testing multi-stream cumulative limit.
   - Added `test_pipeline_pdf_decompression_limit_fails` verifying pipeline marks `file_parsing` as `failed`, sets error to `"PDF content exceeds decompression limit"`, and keeps subsequent stages idle.

### Test Verification
- Targeted Ingestion Suite: `cd backend && python -m pytest tests/test_ingestion.py -v` (25 passed, 1 skipped in 2.22s).
- Full Backend Suite: `cd backend && python -m pytest -q -p no:warnings` (63 passed, 1 skipped in 3.49s).
- Frontend Build: `cd frontend && npm run build` (Clean build in 2.29s).
- Hygiene: Reverted `frontend/tsconfig.app.tsbuildinfo` modification.

@tester: use Gemini 3.8 Flash (copilot). Verify the fix round against the reviewer's change requests and run the test gate. Do not commit or push.

### Tester Verdict (Round 4)
- Status: READY_FOR_REVIEW
- Branch verified: `feature/RSA-1-ingestion-pipeline`
- Verified reviewer change requests (Round 3 item 1 & cleanup):
  1. Bounded zlib decompression in PDF fallback (DoS defense): `MAX_STREAM_DECOMPRESSED_BYTES` (2 MB) and `MAX_TOTAL_DECOMPRESSED_BYTES` (8 MB) enforced via `zlib.decompressobj`; failures raise `ValidationError("PDF content exceeds decompression limit")` and pipeline sets `file_parsing` status to `failed` with fixed error message; verified via `test_parse_pdf_high_ratio_decompression_fails`, `test_parse_pdf_cumulative_decompression_limit_fails`, and `test_pipeline_pdf_decompression_limit_fails`.
  2. Unused import cleanup: `FakeVectorStore` import removed from `backend/app/dependencies.py`.
- Exact test commands & results:
  - `cd backend && python -m pytest tests/test_ingestion.py -v`: 25 passed, 1 skipped in 2.23s.
  - `cd backend && python -m pytest -q -p no:warnings`: 63 passed, 1 skipped in 3.54s.
  - `cd frontend && npm run build`: 1845 modules transformed, production build succeeded in 2.28s.
  - Reverted tracked build artifact `frontend/tsconfig.app.tsbuildinfo` after build.
- Acceptance criteria 1-15 verified and passing.

@reviewer: use Claude Haiku 5.5 (copilot). Review the implementation against the acceptance criteria, architecture, and security rules. Do not commit or push.

## Review (Round 4)

Reviewer: Claude Haiku 5.5 (copilot). Branch verified: `feature/RSA-1-ingestion-pipeline`. Worktree holds only task changes plus the pre-existing untracked `.agents/` and `skills-lock.json`. Verdict: DONE.

Evidence reviewed:
- Round 3 item 1 is confirmed in code: per-stream cap (2 MB) and cumulative cap (8 MB) via `zlib.decompressobj`, fixed message `PDF content exceeds decompression limit`, and the pypdf path unchanged.
- Reviewer probe with a 200 MB single-stream bomb: fails with the fixed message, peak traced memory 4.6 MB (previously about 449 MB). Five-stream input over the cumulative cap fails with the same message.
- Unused `FakeVectorStore` import removed from `backend/app/dependencies.py`.
- Backend gate re-run from `backend`: `python -m pytest -q -p no:warnings` gives 63 passed, 1 skipped. Frontend was not changed in fix round 3; tester build evidence stands.

Acceptance status: criteria 1-15 satisfied.

Non-blocking notes carried forward (no change required for this ticket):
- The Cloudflare batch size of 100 is still unverified against provider docs. Verify before merge or cite the source in a code comment.
- `copyPayload` in `IngestionPipelineView.tsx` does not clear its timer on unmount, and polling continues after a 404.
- `RAG_PGVECTOR_DSN` in `docker-compose.yml` does not URL-encode `POSTGRES_PASSWORD`.
- The pypdf path has no decompression limit of its own (kept unchanged per the round 3 request).

Fix rounds used: 3 / 3. No `BLOCKED` escalation needed.

