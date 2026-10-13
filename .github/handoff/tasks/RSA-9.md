# Agent Handoff: RSA-9

Status: DONE

## Status Flow

`READY_FOR_CODE` to `READY_FOR_TEST` to `READY_FOR_REVIEW` to `DONE`.
Use `CHANGES_REQUESTED` for review findings, `BLOCKED` for unresolved decisions, and `USER_CHANGES_REQUESTED` when the user changes requirements; route that status to planner, who incorporates the change and returns the task to `READY_FOR_CODE`.

## Model Routing

| Complexity | Coder      | Tester     | Reviewer   |
| ---------- | ---------- | ---------- | ---------- |
| S          | GPT-6 Luna | GPT-6 Luna | GPT-6 Luna |
| M          | GPT-6 Luna | GPT-6 Luna | GPT-6 Luna |
| L          | GPT-6 Luna | GPT-6 Luna | GPT-6 Luna |

Planner model: GPT-6 Luna. Use the exact model name in the agent picker.

## Current Task

- Task: Connect chat to the user's local Ollama DeepSeek R1 14B model and use hybrid retrieval so answers can draw on both the bundled BM25 knowledge base and administrator-ingested document chunks.
- Branch: `feat/RSA-9-connect-local-ollama`
- Complexity: L
- Context files: `.github/copilot-instructions.md`, `readme.md`, `PRODUCT.md`, `DECISIONS.md`, `.env.example`, `backend/app/llm.py`, `backend/app/rag.py`, `backend/app/ingestion.py`, `backend/app/vectorstore.py`, `backend/app/repositories.py`, `backend/app/services.py`, `backend/app/dependencies.py`, `backend/app/schemas.py`, `backend/app/routers/chat.py`, `backend/app/routers/admin.py`, `backend/app/routers/ingestion.py`, `backend/tests/test_api.py`, `backend/tests/test_core.py`, `backend/tests/test_ingestion.py`, `backend/tests/fakes.py`
- Acceptance criteria:
  - Use the existing OpenAI-compatible connection workflow for Ollama when possible. An admin can configure and test `http://localhost:11434/v1` with model `deepseek-r1:14b` without a real API key; do not weaken credential requirements for other providers or expose credentials in responses/logs.
  - Document local Ollama configuration, including the host address to use when the backend runs in Docker rather than directly on the host.
  - For chat, combine candidates from the existing BM25 corpus and pgvector similarity search over stored ingestion chunks, using the configured embedding provider for query embeddings. Do not add or assume a new embedding provider.
  - Include the actual stored, redacted chunk text in the grounded model context. Return source metadata for ingested chunks alongside bundled-document sources so chat citations identify their origin.
  - Merge and deduplicate candidates deterministically. Preserve a BM25-only fallback when pgvector or query embedding is unavailable, and keep chat usable when PostgreSQL is not configured.
  - Enforce existing consent, authentication, data-ownership, redaction, retention/expiry, and admin authorization rules. Do not expose expired chunks or another user's private data; do not log question, chunk, prompt, answer, or credential text.
  - Add focused tests for Ollama-compatible configuration/request behavior, hybrid candidate merging and source attribution, chunk text in model context, and BM25 fallback. Tests must not require a running Ollama service or external credentials.
  - Add an end-to-end test that assigns the configured Ollama model to a user, has that user submit a question, and verifies a response is returned. Verify Ollama model invocation through captured application logs using safe metadata (such as provider/model and request ID), without logging question, answer, prompt, or credential contents.
  - Update user-facing setup documentation and preserve existing API behavior and plan-to-connection assignment.
- Focused test requirements: exercise the complete model assignment -> authenticated user question -> response flow end to end; assert captured logs confirm Ollama model invocation without sensitive content. Keep tests independent of a live Ollama service and external credentials.
- Test commands: `cd backend && python -m pytest -q -p no:warnings` (including focused E2E test); `cd frontend && npm run build`
- Fix rounds: 0 / 3
- Previous stage: Planning
- Notes: Planner verified the current branch is `feat/RSA-9-connect-local-ollama` and its name passes `git check-ref-format --branch`. Pre-existing staged and unstaged changes were preserved.

## Coder Results

- Changed files: `backend/app/dependencies.py`, `backend/app/llm.py`, `backend/app/routers/admin.py`, `backend/app/services.py`, `backend/app/vectorstore.py`, `backend/tests/test_api.py`, `backend/tests/test_core.py`, `readme.md`, `PRODUCT.md`, `DECISIONS.md`, `.github/context/FILE_GRAPH.md`.
- Focused tests: `python -m pytest tests/test_api.py tests/test_core.py -q -p no:warnings` passed (45 passed); `python -m pytest tests/test_core.py -q -p no:warnings` passed (27 passed).
- Backend gate: `python -m pytest -q -p no:warnings` passed (71 passed, 1 skipped).
- Frontend gate: `npm run build` passed.
- File graph: created because `.github/context/FILE_GRAPH.md` did not exist; staged exact path.
- No live Ollama service or external credentials were used.
- Tester finding addressed: README opening paragraph now describes active ingested chunks in hybrid chat retrieval and bundled-knowledge fallback when vector retrieval is unavailable.
- Documentation validation: focused README wording check and `git diff --check -- ../readme.md` passed. Backend and frontend gates were not rerun because this response changed documentation only; previous gate results remain recorded above.
- Latest coder iteration: added an API end-to-end test that configures a keyless local Ollama model for the premium plan, registers a consented premium user, submits a chat question, and verifies selected model and response.
- E2E log verification: captured `app.chat` structured fields confirm `deepseek-r1:14b` and successful status; question and answer text absent.
- Latest focused test: `python -m pytest tests/test_api.py::test_assigned_ollama_model_answers_user_question_and_logs_safe_metadata -q -p no:warnings` passed (1 passed).
- Latest backend gate: `python -m pytest -q -p no:warnings` passed (72 passed, 1 skipped).
- Latest frontend gate: `npm run build` passed (TypeScript build and Vite production build).
- Latest changed files: `backend/tests/test_api.py`, `.github/handoff/tasks/RSA-9.md`.
- Requirement change (verbatim; received as `USER_CHANGES_REQUESTED`, incorporated, and returned to `READY_FOR_CODE`): write a E2E test which assign the ollama model to a user, and this user to ask a question and recept a response. Verification of model calling by log

## Tester Results

- Branch verified: `feat/RSA-9-connect-local-ollama`.
- Focused E2E: `python -m pytest tests/test_api.py::test_assigned_ollama_model_answers_user_question_and_logs_safe_metadata -q -p no:warnings` passed (1 passed).
- Backend gate, from `backend`: `python -m pytest -q -p no:warnings` passed (72 passed, 1 skipped).
- Frontend gate: `cd ../frontend && npm run build` passed (TypeScript build and Vite production build).
- Documentation check: `readme.md` describes hybrid retrieval and bundled fallback, keyless `deepseek-r1:14b` setup at `http://localhost:11434/v1`, and Docker URL `http://host.docker.internal:11434/v1`.
- `git diff --check -- ../readme.md ../.github/handoff/tasks/RSA-9.md` passed before this result update. No live Ollama service or external credentials used.
- Acceptance criteria pass; ready for review.

## Handoff

@coder: implement the updated task above, including the requested end-to-end test and privacy-safe log verification. Read only the listed context files. Use GPT-6 Luna.

## Reviewer Results

- Branch verified: `feat/RSA-9-connect-local-ollama`.
- Reviewed Ollama keyless configuration/request handling, plan assignment, hybrid candidate fusion, chunk text/context, source attribution, expiry filtering, BM25 fallback, privacy-safe logging, and setup documentation. No actionable findings.
- Focused review tests passed: Ollama assignment-to-response E2E with safe log metadata, hybrid retrieval/context and attribution, BM25 fallback, deterministic candidate merging, and keyless Ollama request behavior (5 passed).
- Backend gate and frontend build passed per tester evidence above. Existing unrelated worktree changes preserved.
- User confirmed no requirement changes since the updated handoff.
