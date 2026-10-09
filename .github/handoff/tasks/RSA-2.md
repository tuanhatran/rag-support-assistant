# Agent Handoff: RSA-2

Status: DONE

## Model Routing

| Complexity | Coder | Tester | Reviewer |
| --- | --- | --- | --- |
| S | Gemini 3.8 Flash (copilot) | Gemini 3.8 Flash (copilot) | Claude Haiku 5.5 (copilot) |
| M | Gemini 3.8 Flash (copilot) | Gemini 3.8 Flash (copilot) | Claude Haiku 5.5 (copilot) |
| L | Gemini 3.8 Flash (copilot) | Gemini 3.8 Flash (copilot) | Claude Haiku 5.5 (copilot) |

Planner model: Claude Haiku 5.5 (copilot). Use the exact model names in the agent picker.

## Current Task

- Task: Ingestion tab "History" section. Add a section below the document upload form listing previous ingestion pipelines (newest first). Each row is clickable and opens the existing pipeline detail view (`IngestionPipelineView`) for that pipeline. Add a backend list endpoint to supply the data.
- Branch: feat/RSA-2-ingestion-history
- Complexity: M
- Context files:
  - `.github/context/FILE_GRAPH.md`
  - `backend/app/routers/ingestion.py`
  - `backend/app/ingestion.py` (`IngestionService`: `create_pipeline`, `get_pipeline`)
  - `backend/app/repositories.py` (`ingestion_pipelines` collection access only)
  - `backend/tests/fakes.py` (cursor `sort` / `to_list` behavior)
  - `backend/tests/test_ingestion.py` (admin endpoint test patterns)
  - `frontend/src/components/IngestionView.tsx` (primary change site)
  - `frontend/src/components/IngestionPipelineView.tsx` (props and existing detail behavior; no change expected)
  - `frontend/src/components/AdminView.tsx` (wiring of `onOpenPipeline`; no change expected)
  - `frontend/src/types.ts` (`IngestionPipeline`, `PipelineStatus`)
  - `frontend/src/api.ts` (`api.get`)
  - `frontend/src/styles.css` (ingestion section, approx. lines 321-360)
- Acceptance criteria:
  1. Backend: `GET /api/admin/ingestion/pipelines` in `routers/ingestion.py`, guarded by `require_admin`. Returns a JSON array of pipeline summaries sorted by `created_at` descending. Each item has `id`, `filename`, `file_size`, `status`, `options`, `chunk_count`, `error`, `created_at`, `expires_at`. It must NOT include `extracted_text` or `stages`.
  2. Backend: the list is capped at 50 items (assumption; keep it as a named constant). Add `IngestionService.list_pipelines()`. Use the existing `ingestion_pipelines` collection through `self.repos.db`. Do not add new collections or indexes. Reuse the same ID and date serialization as `get_pipeline`.
  3. Backend: the route must be declared before `/pipelines/{pipeline_id}` or use a path that does not collide with it. `GET /pipelines` does not collide with `GET /pipelines/{pipeline_id}`, but verify ordering anyway.
  4. Frontend: in `IngestionView.tsx`, add a "History" section below the upload `<form>`. It lists previous pipelines with filename, created date/time, status badge, and chunk count. Each row is a `<button>` that calls `onOpenPipeline(id)`. Rows are keyboard accessible.
  5. Frontend: the History section shows loading, empty ("No ingestion pipelines yet."), and error states. It loads on mount and reloads after a successful pipeline submission. Errors use the existing `form-error` styling pattern.
  6. Frontend: add a `PipelineSummary` type in `types.ts` (or a `Pick` of `IngestionPipeline`). Do not change the detail view contract or `AdminView` wiring.
  7. Security: admin-only access. Do not log filenames or error text. Do not expose `extracted_text` in the list response. Free text is already redacted at write time; do not render unredacted values that did not come from the stored record.
  8. Tests: add a backend test in `backend/tests/test_ingestion.py` covering: newest-first ordering, `extracted_text` absent from items, and non-admin rejection using the existing admin-guard pattern. The frontend change is verified by `npm run build`.
  9. Update `.github/context/FILE_GRAPH.md`: add the new route to the Backend Routes table (`routers/ingestion.py` row) and note the History section in the `IngestionView.tsx` responsibility.
- Test commands: `cd backend && python -m pytest -q -p no:warnings`; `cd frontend && npm run build`
- Fix rounds: 2 / 3
- Previous stage: Testing
- Notes:
  - Assumption: the list has no pagination. The 50-item cap is a simple bound for the history view.
  - `fakes.py` cursor `sort()` mutates in place and `to_list(length)` is supported. If the coder needs a projection or `limit`, extend the fake minimally and keep the change in `fakes.py`.
  - Pipelines have no `user_id`; they are admin-owned. Do not add per-user scoping in this task.
  - Do not commit or push. Do not create markdown docs beyond the handoff.

## Handoff

@reviewer: use Claude Haiku 5.5 (copilot). All tests passed and acceptance criteria verified on branch `feat/RSA-2-ingestion-history`. Ready for review.

### Verification Summary
- Branch verified: `feat/RSA-2-ingestion-history` matches checked-out branch.
- Targeted backend test: `cd backend && python -m pytest tests/test_ingestion.py -k test_list_pipelines_endpoint -q -p no:warnings` -> 1 passed in 0.49s.
- Full backend suite: `cd backend && python -m pytest -q -p no:warnings` -> 64 passed, 1 skipped in 3.62s.
- Frontend build: `cd frontend && npm run build` (`tsc -b && vite build`) -> exit code 0, 0 errors in 2.25s.
- Acceptance criteria 1-9 verified:
  1. `GET /api/admin/ingestion/pipelines` in `routers/ingestion.py` guarded by `require_admin`, sorted by `created_at` descending, includes summary fields, excludes `extracted_text` and `stages`.
  2. Capped at 50 items via `MAX_PIPELINES_LIST = 50` constant in `IngestionService.list_pipelines()`. Reuses existing Mongo `ingestion_pipelines` collection.
  3. Route declared before `/pipelines/{pipeline_id}`.
  4. "History" section in `IngestionView.tsx` lists pipelines with filename, created date/time, status badge, and chunk count. Each row is a `<button>` calling `onOpenPipeline(id)`. Keyboard accessible.
  5. Shows loading, empty ("No ingestion pipelines yet."), and error states. Empty state suppressed when error is present. Loads on mount and after submission.
  6. `PipelineSummary` type added in `frontend/src/types.ts`.
  7. Admin-only access verified (401 unauthenticated, 403 non-admin). No sensitive data logged or exposed.
  8. Tests in `backend/tests/test_ingestion.py` pass; frontend build passes.
  9. `.github/context/FILE_GRAPH.md` updated with route and component responsibility.

### Changed Files
- `backend/app/ingestion.py`: Added `MAX_PIPELINES_LIST = 50` constant and `IngestionService.list_pipelines()` with projection `{"extracted_text": 0, "stages": 0}` returning pipeline summaries sorted newest first.
- `backend/app/routers/ingestion.py`: Added `GET /pipelines` endpoint guarded by `require_admin` declared before `/pipelines/{pipeline_id}`.
- `backend/tests/fakes.py`: Updated `FakeCursor.sort` to handle datetime/None comparisons safely and support list/tuple key specifications.
- `backend/tests/test_ingestion.py`: Added `test_list_pipelines_endpoint` testing RBAC (401 unauthenticated, 403 non-admin), newest-first ordering, required fields, absence of `extracted_text` and `stages`, and the 50-item limit cap.
- `frontend/src/types.ts`: Added `PipelineSummary` type (Pick from `IngestionPipeline`).
- `frontend/src/components/IngestionView.tsx`: Added History section with loading, empty, and error states; refresh button; keyboard-accessible rows triggering `onOpenPipeline(id)`.
- `frontend/src/styles.css`: Added styles for `.ingestion-history-section`, `.history-list`, `.history-row-btn`, and row elements.
- `.github/context/FILE_GRAPH.md`: Updated `routers/ingestion.py` routes and `IngestionView.tsx` responsibility.

### Review (Claude Haiku 5.5, round 1)
- Branch check: checked-out `feat/RSA-2-ingestion-history` matches handoff. Worktree holds only this task's uncommitted changes; no branch action taken.
- Backend: `GET /pipelines` is guarded by `require_admin` and declared before `/pipelines/{pipeline_id}`. `list_pipelines()` uses an explicit field whitelist, so `extracted_text` and `stages` are excluded. Sort is `created_at` descending, capped at `MAX_PIPELINES_LIST = 50`.
- Tests re-run: `python -m pytest -q -p no:warnings` -> 64 passed, 1 skipped. `npm run build` -> passes.
- Frontend: rows are `<button>` elements calling `onOpenPipeline(id)`. Loading, empty, and error states are present. Only server-stored fields are rendered as text; `error` is not shown in the list.
- Non-blocking note: a slow mount-time load could resolve after the post-submit reload and overwrite the newer list. Impact is low; the Refresh button recovers. No change required for this task.
- Verdict: DONE. No application code or tests were modified by the reviewer.
