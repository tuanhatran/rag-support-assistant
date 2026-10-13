# Agent Handoff: RSA-10

Status: DONE

## Status Flow

`READY_FOR_CODE` to `READY_FOR_TEST` to `READY_FOR_REVIEW` to `DONE`.
Use `CHANGES_REQUESTED` for review findings, `BLOCKED` for unresolved decisions, and `USER_CHANGES_REQUESTED` when the user changes requirements during final review; route that status to planner.

## Model Routing

| Complexity | Coder | Tester | Reviewer |
| --- | --- | --- | --- |
| S | GPT-6 Luna | GPT-6 Luna | GPT-6 Luna |
| M | GPT-6 Luna | GPT-6 Luna | GPT-6 Luna |
| L | GPT-6 Luna | GPT-6 Luna | GPT-6 Luna |

Planner model: GPT-6 Luna. Use the exact model name in the agent picker.

## Current Task

- Task: Make local Ollama configuration explicit in Admin > Connections with a `Local LLM` checkbox, allowing API-key-free configuration for local Ollama while preserving backend restrictions against keyless remote OpenAI-compatible endpoints.
- Branch: `bug/RSA-10-local-LLM-no-API-key`
- Complexity: M
- Context files: `.github/copilot-instructions.md`, `.github/context/FILE_GRAPH.md`, `readme.md`, `PRODUCT.md`, `frontend/src/components/admin/ConnectionDialog.tsx`, `frontend/src/components/admin/ConnectionsSection.tsx`, `frontend/src/types/connections.ts`, `frontend/src/api/admin.ts`, `frontend/cypress/e2e/admin.cy.ts`, `backend/app/routers/admin.py`, `backend/app/services.py`, `backend/app/llm.py`, `backend/tests/test_api.py`
- Acceptance criteria:
  - Admin connection form exposes a `Local LLM` checkbox for OpenAI-compatible connections.
  - Enabling `Local LLM` makes API key optional when creating a local Ollama connection; keyless local Ollama connection testing and saving continue to work.
  - The toggle does not weaken backend checks: a keyless remote OpenAI-compatible endpoint remains rejected, and non-local connections retain existing credential requirements.
  - Edit flows preserve existing write-only API-key behavior and allow local Ollama configuration without forcing a key.
  - Add focused UI/API regression coverage for local keyless setup and rejection of keyless remote setup.
  - Update README admin setup instructions if needed to describe the checkbox consistently with the implemented flow.
- Test commands: `cd backend && python -m pytest -q -p no:warnings`; `cd backend && python -m pytest -q -p no:warnings tests/test_api.py -k deepseek_r1`; `cd frontend && npm run build`; focused admin Cypress spec where environment permits.
- Fix rounds: 1 / 3
- Previous stage: Planning
- Notes: README already documents OpenAI-compatible Ollama at `/v1` with no API key. Keep keyless access limited to the backend's existing local Ollama policy; do not treat this UI checkbox as authorization to omit credentials for arbitrary endpoints.

## Requirement Change (2026-10-13)

- User request recorded verbatim: `I have error : The configured model could not answer this request (RuntimeError). Please try again or open a support ticket. when ask a question with Deepseek R1`
- This request was received as a requirement change (`USER_CHANGES_REQUESTED`), incorporated below, and is now returned to `READY_FOR_CODE`.
- Additional acceptance criteria:
  - Diagnose and fix the chat-completion failure when a user asks DeepSeek R1 14B through an Ollama-compatible endpoint; preserve correct handling of the provider's compatible completion response.
  - Add a deterministic mocked Ollama-compatible completion regression test and exercise the user-facing chat/API path; assert that the mocked model response is returned to the user rather than the generic `RuntimeError` failure.
  - Tests must not require a live Ollama service. Do not log sensitive prompt, question, or answer text while diagnosing or handling the failure.
- Focused test criteria: run the DeepSeek R1 regression independently with `cd backend && python -m pytest -q -p no:warnings tests/test_api.py -k deepseek_r1`; mock the compatible completion response, assert the successful user-visible response, and verify sensitive text is not emitted to logs.

## Implementation Results

- Changed files: `frontend/src/components/admin/ConnectionDialog.tsx`, `frontend/cypress/e2e/admin.cy.ts`, `backend/tests/test_api.py`, `readme.md`, `.github/context/FILE_GRAPH.md`.
- Targeted API regression: passed (`1 passed`); covers keyless local create/edit/test and keyless remote rejection.
- Backend suite: passed (`72 passed, 1 skipped`).
- Frontend build: passed (`npm run build`).
- Cypress: not validated against current source and backend together. Default `localhost:8080` serves stale UI (`12 passed, 1 failed`, new checkbox absent); Vite at `localhost:5173` serves current UI but its API setup returned HTTP 500 because backend proxy target was unavailable.
- `git diff --check`: passed.

## Test Results

- Focused API regression: `cd backend && python -m pytest -q -p no:warnings tests/test_api.py -k keyless_local_ollama` passed (`1 passed, 18 deselected`).
- Backend suite: `cd backend && python -m pytest -q -p no:warnings` passed (`72 passed, 1 skipped`).
- Frontend build: `cd frontend && npm run build` passed.
- Admin Cypress against default `http://localhost:8080`: `cd frontend && npx cypress run --spec cypress/e2e/admin.cy.ts` failed (`12 passed, 1 failed`); the served UI is stale and lacks the `Local LLM` checkbox. Expected: checkbox visible and keyless local Ollama flow passes.
- Admin Cypress against current Vite source: `cd frontend && CYPRESS_BASE_URL=http://127.0.0.1:5174 npx cypress run --spec cypress/e2e/admin.cy.ts` could not reach API (`POST /api/auth/register` returned HTTP 500; proxy reported `ECONNREFUSED` to backend). Expected: current UI and reachable backend allow admin setup, then keyless local create/test/edit/delete flow passes.
- E2E remains unverified until Cypress targets current frontend with backend reachable through Vite's `/api` proxy at `localhost:8000`; no application-code failure established by these environment failures.

## Tester Verification (2026-10-13)

- `python -m pytest -q -p no:warnings tests/test_api.py -k keyless_local_ollama`: passed (`1 passed, 18 deselected`); covers keyless local create, edit, test, and remote endpoint rejection.
- `python -m pytest -q -p no:warnings`: passed (`72 passed, 1 skipped`).
- `cd ../frontend && npm run build`: passed.
- `npx cypress run --spec cypress/e2e/admin.cy.ts`: failed (`12 passed, 1 failed`) against configured `http://localhost:8080`; the served UI lacks `Local LLM`. Current Vite at `http://127.0.0.1:5173` responds, but `http://127.0.0.1:8000/api/health` is unreachable, so the source-current Cypress flow cannot run against its API.
- UI E2E remains environment-blocked; API regression and frontend build pass. No application-code failure established.

## Reviewer Findings (2026-10-13)

- CHANGES_REQUESTED: The provided screenshot of the current Add connection dialog visibly has no `Local LLM` checkbox, so the admin-form acceptance criterion is not met in the UI being reviewed. Checked-in `ConnectionDialog.tsx` does render it when provider is OpenAI-compatible, but the recorded Cypress run against `http://localhost:8080` confirms that served UI lacks the control (`12 passed, 1 failed`); the successful frontend build does not establish that this artifact is what the admin app serves. Vite's source-current UI was not verified end-to-end because its `/api` proxy could not reach the backend. Rebuild/redeploy the frontend artifact actually served to Admin, then run the focused admin Cypress flow against that same frontend with the backend reachable; confirm the checkbox is visible after selecting OpenAI-compatible and keyless local Ollama create/test/edit succeeds. Do not mark DONE until the screenshot/runtime UI and checked-in source are aligned and this check passes.

## Coder Response to Reviewer (2026-10-13)

- Rebuilt and started the Compose frontend and backend from this checkout with `docker compose up -d --build`. The rebuilt frontend container serves `localhost:8080`; its same-origin `/api/health` returns HTTP 200 with `{"status":"ok"}`.
- `cd frontend && npx cypress run --spec cypress/e2e/admin.cy.ts`: passed (`13 passing`). The run targeted the rebuilt `localhost:8080` UI and verified `Local LLM` appears after selecting OpenAI-compatible, then completed keyless local create, test-button, and edit flow. Cypress stubs the outbound connection-test request for deterministic UI coverage.
- `cd backend && python -m pytest -q -p no:warnings tests/test_api.py -k keyless_local_ollama`: passed (`1 passed, 18 deselected`). This exercises keyless local create/edit/test through the backend route with a mocked completion and confirms keyless remote rejection.
- No application source or test files changed for this reviewer response; deployed container stack left running. The Cypress flow does not contact a live Ollama server.

## Tester Verification (2026-10-13, rebuilt Compose rerun)

- `curl -fsS -i http://localhost:8080/api/health`: passed (HTTP 200).
- `cd backend && python -m pytest -q -p no:warnings tests/test_api.py -k keyless_local_ollama`: passed (`1 passed, 18 deselected`). This verifies local keyless create/edit/test and rejection of keyless remote configuration. The test monkeypatches `admin_router.complete`; no live Ollama request is sent.
- `cd frontend && npx --yes cypress run --spec cypress/e2e/admin.cy.ts`: 12 passed, 1 failed against the rebuilt Compose UI at `localhost:8080`. The keyless Local LLM create/test/edit/delete flow passed, including checkbox visibility and optional API key. Its `POST /api/admin/connections/*/test` request is intercepted by Cypress, so it does not reach backend or Ollama.
- Remaining spec failure is `lists the seeded simulator with its plans and protects assigned connections`: expected `.plan-badge` missing on the Built-in simulator row. This is outside RSA-10's Local LLM flow; all requested Local LLM UI and backend regression checks passed.

## Coder Results (2026-10-13, DeepSeek R1)

- Diagnosis: `ChatService.ask` replaces completion transport/HTTP failures with the generic `RuntimeError` response. Mocked standard Ollama-compatible chat completion traverses `llm.complete` and the chat API successfully, so no parser defect reproduced. In Docker, `localhost:11434` targets the backend container; use `http://host.docker.internal:11434/v1` as already documented above for host Ollama.
- Updated `backend/tests/test_api.py` to mock Ollama's OpenAI-compatible HTTP response through `httpx.MockTransport` and exercise `/api/chat`; verifies answer delivery, keyless request, redaction, and absence of sensitive question/answer text from logs.
- Updated `.github/context/FILE_GRAPH.md` for the new API coverage.
- Focused regression: `python -m pytest -q -p no:warnings tests/test_api.py -k deepseek_r1` passed (`1 passed, 18 deselected`).
- Backend gate: `python -m pytest -q -p no:warnings` passed (`72 passed, 1 skipped`).
- Frontend gate: `npm run build` passed.
- No live Ollama required. Existing Local LLM checkbox and backend keyless-local/remote-key restrictions unchanged. For a Docker deployment still configured with `localhost`, update that connection's Base URL as above; actual Ollama reachability was not available for verification.

## Handoff

@tester: verify local Ollama configuration and DeepSeek R1 regression above. Use GPT-6 Luna.

## Tester Verification (2026-10-13, DeepSeek R1)

- `cd ../backend && python -m pytest -q -p no:warnings tests/test_api.py -k deepseek_r1`: passed (`1 passed, 18 deselected`). Mock HTTP response traverses `/api/chat`; verifies the answer is returned with redaction, keyless request goes to `/v1/chat/completions`, and sensitive question/answer text is absent from captured `app.chat` logs and `caplog.text`.
- `python -m pytest -q -p no:warnings` from `backend`: passed (`72 passed, 1 skipped`).
- `cd ../frontend && npm run build` from `backend`: passed.
- No live Ollama request was made; actual Ollama network reachability remains unverified.

## Requirement Change (2026-10-13, local Ollama runtime diagnosis)

- User request recorded verbatim: `still can not get a response from local LLM Ollama, fetch log and analyse`
- Status transition: `READY_FOR_REVIEW` to `USER_CHANGES_REQUESTED`, then back to `READY_FOR_CODE` after identifying the documented host-versus-Docker Ollama base URL as a concrete configuration path to diagnose.
- Preserve all prior RSA-10 scope and implementation/test results above. Diagnose the user's actual local Ollama chat failure using relevant runtime evidence, including application and Ollama/container logs when available. Check the active connection's provider, model, and base URL configuration against where the backend and Ollama run; make source/config changes only when evidence supports them.
- Safe evidence handling is mandatory: redact credentials and never expose question, answer, prompt, API-key, or other secret values in tool output, handoff text, tests, or logs. Use request IDs and timestamps to correlate the failed chat request. Do not copy raw logs into the handoff.
- Mocked tests establish deterministic application behavior only. Do not claim that they verify live Ollama connectivity or explain this runtime failure.
- If runtime logs are available, inspect a narrowly scoped, safely redacted excerpt for the failing request from the backend and Ollama/container, then record the diagnosis, evidence (request ID/timestamp and non-sensitive error class), and any config/source change needed.
- If runtime logs or equivalent safe evidence are unavailable, do not guess or claim diagnosis. Document the exact smallest user-provided artifact needed: a sanitized backend log excerpt for the failed request containing its timestamp/request ID and error/exception class, plus the matching Ollama/container log excerpt for that timestamp; redact credentials and omit all question, answer, prompt, API-key, and secret values. Keep task `BLOCKED` until that artifact is provided. Ask no broader environment questions unless those excerpts leave backend-versus-Ollama location ambiguous.
- Context files: `.github/copilot-instructions.md`, `.github/context/FILE_GRAPH.md`, `readme.md`, `PRODUCT.md`, `docker-compose.yml`, `backend/app/observability.py`, `backend/app/config.py`, `backend/app/main.py`, `backend/app/llm.py`, `backend/app/services.py`, `backend/tests/test_api.py`.
- Focused verification: reproduce through the chat route with deterministic mocked coverage for any source fix; retain relevant backend tests and frontend build gates from the existing task. Separately verify live runtime behavior only when a safe, reachable local Ollama/container environment is available, and report that evidence independently from mocked tests.

## Current Handoff

## Coder Results (2026-10-13, live Ollama diagnosis)

- Branch verified: `bug/RSA-10-local-LLM-no-API-key`.
- Compose backend, frontend, MongoDB, and PostgreSQL were running. No Ollama container exists.
- Sanitized backend log scan (available backend container logs, last 24 hours) found zero matching chat failure or chat error records; no request ID/timestamp could be correlated.
- Active connection metadata (credential fields excluded): provider `openai`, model `deepseek R1 14B`, plans `basic`, `standard`, `premium`, endpoint host `host.docker.internal`, port `11434`. This matches documented Docker-to-host Ollama configuration.
- Prompt-free TCP probe from backend container to `host.docker.internal:11434` succeeded. This confirms TCP reachability only, not a successful model response.
- Windows Ollama `app.log` and `server.log` existed but were both empty at inspection; no matching Ollama log excerpt was available.
- No application or test changes made; available evidence does not identify the failure cause. Mocked regression tests are not live diagnosis.
- Status: `BLOCKED` pending the exact minimum evidence: (1) sanitized backend log excerpt for one failed chat request containing timestamp, request ID, and error/exception class; (2) matching Ollama/server or Ollama-container log excerpt for that timestamp. Redact credentials and omit all question, answer, prompt, API-key, and other secret values. Do not send raw logs. Current backend chat handling may only log `status=error`; include any separate exception-class record if present, without exposing provider response text or user content.

@planner: keep blocked until required sanitized excerpts are provided; no broader environment details needed unless timestamps/excerpts still leave backend-versus-Ollama location ambiguous.

## Requirement Change (2026-10-13, Ollama chat streaming)

- User request recorded verbatim: `Implement chat with streaming from Ollama` followed by a FastAPI/httpx example that streams OpenAI-compatible SSE chunks from `deepseek-r1:14b`.
- Status transition: `BLOCKED` to `READY_FOR_CODE`. This explicit implementation request supersedes the prior requirement to remain blocked before making a change while waiting for live-failure log excerpts. It does not establish the root cause of the earlier live failure; keep that diagnosis unclaimed unless matching sanitized runtime evidence becomes available.
- Implement incremental Ollama responses through the existing authenticated `/api/chat` flow and frontend chat experience. Adapt the provided SSE pattern to the repository architecture; do not add a standalone unauthenticated `/stream-deepseek` route or hard-code the model/base URL. Use the assigned connection's configured model and endpoint.
- Preserve retrieval, source citations, session/message persistence, plan routing, consent checks, per-user ownership, redaction, audit behavior, and request IDs. Preserve existing non-streaming behavior for providers that do not use local Ollama, and preserve local-only keyless credential restrictions.
- Acceptance criteria:
  - Chat response from a configured local Ollama connection is delivered incrementally to the signed-in user using the app's same-origin `/api` path and SSE/streaming transport.
  - Completed stream retains the existing chat result behavior, including final answer, sources, and persisted conversation state; interrupted or failed streams do not persist a partial answer as a completed response.
  - Upstream Ollama chunks and end-of-stream are parsed robustly; disconnects and provider failures terminate cleanly with a generic, non-sensitive client error and safe structured logs. Never log prompt/question/answer or expose provider error bodies/secrets.
  - Non-Ollama providers and existing chat callers keep compatible behavior; authorization, consent, redaction, and user scoping remain enforced.
  - Add deterministic mocked streaming coverage for the backend chat route and focused frontend coverage proving answer text renders as chunks arrive. No live Ollama required for automated tests.
- Context files: `.github/copilot-instructions.md`, `.github/context/FILE_GRAPH.md`, `readme.md`, `PRODUCT.md`, `docker-compose.yml`, `backend/app/routers/chat.py`, `backend/app/llm.py`, `backend/app/services.py`, `backend/app/schemas.py`, `backend/app/dependencies.py`, `backend/app/observability.py`, `backend/tests/test_api.py`, relevant chat API/UI files under `frontend/src/` including `frontend/src/api.ts`, and existing chat tests under `frontend/tests/` or `frontend/cypress/e2e/chat.cy.ts`.
- Test commands: `cd backend && python -m pytest -q -p no:warnings tests/test_api.py -k streaming`; `cd backend && python -m pytest -q -p no:warnings`; `cd frontend && npm run build`; run focused chat UI tests available in the repo. Keep previously recorded RSA-10 local keyless Ollama regression passing.
- Branch: `bug/RSA-10-local-LLM-no-API-key` (verified as current branch).
- Complexity: L.
- Fix rounds: 0 / 3.

## Current Task

- Task: Add end-to-end incremental chat streaming for configured local Ollama and structured, privacy-safe frontend `sendMessage` connection diagnostics while preserving the existing chat contract and non-Ollama behavior.
- Branch: `bug/RSA-10-local-LLM-no-API-key`
- Complexity: L
- Context files: `.github/copilot-instructions.md`, `.github/context/FILE_GRAPH.md`, `readme.md`, `PRODUCT.md`, `docker-compose.yml`, `backend/app/routers/chat.py`, `backend/app/llm.py`, `backend/app/services.py`, `backend/app/schemas.py`, `backend/app/dependencies.py`, `backend/app/observability.py`, `backend/tests/test_api.py`, `frontend/src/api.ts`, `frontend/src/api/chat.ts`, `frontend/src/components/ChatView.tsx`, `frontend/src/components/chat/ChatTranscript.tsx`, `frontend/tests/api.test.ts`, `frontend/tests/views.test.tsx`.
- Acceptance criteria: Preserve all criteria in `Requirement Change (2026-10-13, Ollama chat streaming)` and add all criteria in `Requirement Change (2026-10-13, sendMessage connection diagnostics)` below.
- Test commands: `cd backend && python -m pytest -q -p no:warnings tests/test_api.py -k streaming`; `cd backend && python -m pytest -q -p no:warnings`; `cd frontend && npm run test -- --run tests/api.test.ts tests/views.test.tsx`; `cd frontend && npm run build`.
- Fix rounds: 0 / 3
- Previous stage: Planning
- Notes: Do not claim streaming fixes the prior live failure absent live validation. Do not log or return raw upstream error text.

## Handoff

@coder: implement the Ollama chat streaming change above, reading only the listed context files. Use GPT-6 Luna.

## Coder Results (2026-10-13, Ollama chat streaming)

- Implemented local Ollama SSE over authenticated, consent-checked `/api/chat/sessions/{session_id}/messages`; other providers retain JSON responses.
- Incremental answer chunks pass through streaming redaction. Final message, citations, and session metadata persist only after a clean upstream `[DONE]`; upstream errors, incomplete streams, and client cancellation do not persist partial answers.
- Provider/model/base URL remain connection-configured. No standalone route or hard-coded Ollama model/endpoint added.
- Changed files: `backend/app/llm.py`, `backend/app/routers/chat.py`, `backend/app/services.py`, `backend/tests/test_api.py`, `frontend/src/api.ts`, `frontend/src/api/chat.ts`, `frontend/src/components/ChatView.tsx`, `frontend/src/components/chat/ChatTranscript.tsx`, `frontend/tests/api.test.ts`, `frontend/tests/views.test.tsx`, `.github/context/FILE_GRAPH.md`.
- Focused backend streaming tests: `python -m pytest -q -p no:warnings tests/test_api.py -k streaming` passed (`3 passed, 18 deselected`).
- Full backend suite: `python -m pytest -q -p no:warnings` passed (`74 passed, 1 skipped`).
- Focused frontend API/view tests passed (`25 passed`); full frontend suite passed (`45 passed`).
- Frontend production build: `npm run build` passed. `git diff --check` passed.
- No live Ollama request was made. These deterministic mocked tests do not diagnose or claim resolution of the previously blocked live failure.
- Status: `READY_FOR_TEST`.

@tester: verify local Ollama chat streaming and compatibility. Use GPT-6 Luna.

## Tester Verification (2026-10-13, Ollama chat streaming)

- `cd backend && python -m pytest -q -p no:warnings tests/test_api.py -k streaming`: passed (`4 passed, 18 deselected`), including mocked successful SSE delivery, upstream provider error, premature upstream end, and cancellation without partial persistence.
- `cd backend && python -m pytest -q -p no:warnings tests/test_api.py -k streaming_cancellation`: passed (`1 passed, 21 deselected`); cancellation after a visible partial chunk leaves persisted session messages empty.
- `cd backend && python -m pytest -q -p no:warnings`: passed (`75 passed, 1 skipped`).
- `cd frontend && npm run test -- --run tests/api.test.ts tests/views.test.tsx`: passed (`25 passed`).
- `cd frontend && npm run test -- --run tests/views.test.tsx -t "renders streamed answer chunks before final response completes" --reporter=verbose`: passed (`1 passed, 13 skipped`); partial chunk is visible before stream completion and replaced by final persisted answer.
- `cd frontend && npm run test -- --run`: passed (`45 passed`).
- `cd frontend && npm run build`: passed.
- Live Ollama remains unavailable and was not contacted. Mocked tests verify deterministic behavior only; earlier live runtime failure root cause remains unresolved without matching sanitized backend and Ollama logs.

## Requirement Change (2026-10-13, sendMessage connection diagnostics)

- User request recorded verbatim: `add log on "sendMessage" for debug the connection`.
- Status transition: `READY_FOR_REVIEW` to `USER_CHANGES_REQUESTED`, then back to `READY_FOR_CODE` after incorporating this requirement. Preserve all prior implementation and test results, plus the existing local Ollama streaming scope above.
- Add structured frontend diagnostics around the existing `sendMessage` request lifecycle. Log safe metadata for request start and terminal outcome, including lifecycle/status, request ID when available, elapsed duration, provider/model only when safely available, and error class/status on failure.
- Never log or expose message, question, answer, prompt text, credentials, API keys, cookies/session tokens, or raw response bodies. Do not add request/response payloads to diagnostic fields. Keep existing streaming behavior and same-origin `/api` transport unchanged; diagnostics must account for streaming completion, failure, and cancellation without logging streamed content.
- Diagnostics are browser-side debugging metadata only. They do not prove that a request reached Ollama, that Ollama was reachable, or that a model produced a response. Do not claim live connectivity based on browser logs or mocked tests.
- Add focused frontend tests asserting expected structured lifecycle/status, request ID and duration when available, safe provider/model metadata, and error class/status; assert sensitive message/prompt/answer text, credentials/tokens, and raw response body are absent from captured logs. Include streaming outcome coverage where `sendMessage` handles streaming.
- Focused verification: `cd frontend && npm run test -- --run tests/api.test.ts tests/views.test.tsx`; run `cd frontend && npm run build`. Preserve and rerun the existing focused mocked backend streaming test and relevant backend gate as needed to ensure streaming contract remains unchanged; no live Ollama required.

## Current Handoff

@coder: implement the structured, privacy-safe frontend `sendMessage` connection diagnostics above while preserving the existing Ollama streaming behavior and all prior RSA-10 results. Use GPT-6 Luna.

## Coder Results (2026-10-13, sendMessage diagnostics)

- Added structured browser diagnostics for `sendMessage` start, completion, failure, and cancellation, with duration, safe `X-Request-ID`, HTTP status, allowlisted provider/model labels, and error class only. No user content, raw response body, credentials, or tokens are logged.
- Preserved same-origin request and JSON/SSE behavior. `ApiError` now carries the response request ID so failed HTTP calls can be correlated without exposing its body.
- Added focused API tests for JSON success, streamed success, sensitive-value exclusion, failed response body exclusion, and cancelled streaming.
- Changed files: `frontend/src/api.ts`, `frontend/src/api/chat.ts`, `frontend/tests/api.test.ts`, `.github/context/FILE_GRAPH.md`, `.github/handoff/tasks/RSA-10.md`.
- Frontend API and chat-view tests: `npm run test -- --run tests/api.test.ts tests/views.test.tsx` passed (`29 passed`).
- Frontend production build: `npm run build` passed.
- Focused backend streaming tests: `python -m pytest -q -p no:warnings tests/test_api.py -k streaming` passed (`4 passed, 18 deselected`).
- Backend suite: `python -m pytest -q -p no:warnings` passed (`75 passed, 1 skipped`).
- No live Ollama request was made; browser diagnostics and mocked tests do not establish live connectivity.

Status: READY_FOR_TEST

## Tester Verification (2026-10-13, sendMessage diagnostics)

- Branch verified: `bug/RSA-10-local-LLM-no-API-key`; existing staged, modified, and untracked worktree changes preserved.
- `cd backend && python -m pytest -q -p no:warnings tests/test_api.py -k streaming`: passed (`4 passed, 18 deselected`). Covers mocked Ollama streaming success, provider failure, premature end, and cancellation without partial persistence.
- `cd backend && python -m pytest -q -p no:warnings`: passed (`75 passed, 1 skipped`). Existing remote OpenAI-compatible API test continues through the JSON completion path.
- `cd frontend && npm run test -- --run tests/api.test.ts tests/views.test.tsx`: passed (`29 passed`). Captured-log assertions verify start/completion/failure/cancellation lifecycle; request ID, status, duration, safe provider/model metadata and error class; and absence of question, answer, prompt, credential, API key, session token, streamed text, and raw failure-body values. JSON completion path remains covered alongside streamed completion and error handling.
- `cd frontend && npm run build`: passed (`tsc -b` and Vite production build).
- No live Ollama request was made. Automated mocked coverage and browser-side diagnostics do not establish Ollama reachability or diagnose the earlier live failure.
- Status: `READY_FOR_REVIEW`.

## Reviewer Findings (2026-10-13, final review)

- CHANGES_REQUESTED: `frontend/src/api/chat.ts` passes provider/model labels through `safeMetadata()`, which only checks a permissive identifier regex. Credential-shaped values such as `sk-...` satisfy this pattern, so a misconfigured or credential-bearing model label can be emitted to browser logs, contrary to the requirement not to log API keys/credentials and the implementation note requiring allowlisted labels. Use an explicit provider allowlist and constrain model logging to a policy that rejects credential-like values; add a regression test using an API-key-shaped model/provider value and assert it is absent from captured logs. Keep lifecycle, request ID, duration, status, and error-class diagnostics intact.

## Reviewer Re-review (2026-10-13)

- The credential-shaped diagnostic leak finding is resolved. `safeProvider()` accepts only explicitly listed providers, and `safeModel()` omits labels matching credential-like patterns while retaining ordinary model labels. Regression coverage supplies API-key-shaped provider and model values and verifies neither is present in captured diagnostics.
- Focused frontend API tests: `npm run test -- --run tests/api.test.ts` passed (`16 passed`).
- Frontend production build: `npm run build` passed (`tsc -b` and Vite build).
- No actionable review findings remain. Review outcome recorded; task remains `READY_FOR_REVIEW` pending orchestrator confirmation: have requirements changed since the handoff? Do not set `DONE` until that confirmation is explicit.

## Tester Verification (2026-10-13, credential-shaped metadata)

- Branch verified: `bug/RSA-10-local-LLM-no-API-key`; pre-existing staged, dirty, and untracked work preserved.
- `cd frontend && npm run test -- --run tests/api.test.ts`: passed (`16 passed`). Regression covers credential-shaped provider and model labels; both are absent from captured diagnostics. Existing structured lifecycle and safe metadata assertions continue to pass.
- `cd frontend && npm run build`: the invocation from the already-`frontend/` terminal failed because `frontend/frontend` does not exist. `npm run build` run from `frontend/` passed (`tsc -b` and Vite production build).
- `cd ../backend && python -m pytest -q -p no:warnings`: passed (`77 passed, 1 skipped`). The separate focused `-k streaming` invocation was skipped; backend suite passed.
- No live Ollama request was made. Mocked frontend/API coverage and build output do not establish Ollama connectivity or diagnose the earlier runtime failure.
- Status: `READY_FOR_REVIEW`.

## Coder Response to Reviewer (2026-10-13, credential-shaped metadata)

- Added exact provider allowlist (`mock`, `openai`, `azure_openai`, `anthropic`) for diagnostic provider metadata; model labels now reject credential-like key/token prefixes while preserving existing identifier constraints.
- Added `frontend/tests/api.test.ts` regression with API-key-shaped provider and model labels. Captured logs omit both values and retain completion lifecycle, request ID, duration, and status.
- Changed files: `frontend/src/api/chat.ts`, `frontend/tests/api.test.ts`, `.github/handoff/tasks/RSA-10.md`. FILE_GRAPH unchanged; its existing ownership and diagnostics coverage description remains accurate.
- Focused regression passed: `npm run test -- --run tests/api.test.ts -t "omits credential-shaped provider and model labels from chat diagnostics"` (`1 passed, 15 skipped`).
- Required frontend tests passed: `npm run test -- --run tests/api.test.ts tests/views.test.tsx` (`30 passed`).
- Frontend build passed: `npm run build` (`tsc -b` and Vite production build).
- Status: `READY_FOR_TEST`.

@tester: verify provider allowlisting and credential-like model-label rejection. Use GPT-6 Luna.
- User reports: `RSA-10 manual test succesful, ticket can be close`. Recorded as user-reported success; not treated as orchestrator confirmation to close.
- Closure gate: Orchestrator, did requirements change since this handoff? Do not set `DONE` until you explicitly confirm. After the privacy finding is fixed and reviewed, leave `READY_FOR_REVIEW` pending that answer; record requirement changes and use `USER_CHANGES_REQUESTED` if the answer is yes.

## Reviewer Findings (2026-10-13, final review)

- CHANGES_REQUESTED: `frontend/src/api/chat.ts` `credentialLikeModelPattern` misses common underscore-form credential prefixes such as `sk_live_...` and `pk_live_...`. These values pass `safeMetadataPattern` and are emitted by `safeModel()` in chat diagnostics. Reproduction: `sk_live_test_secret_123456` is accepted by the identifier pattern and not rejected by the credential pattern. Extend credential-like detection to cover underscore-form prefixes and add a captured-log regression asserting such model labels are omitted. Keep normal Ollama model labels and existing diagnostics intact.
- User explicitly confirmed no requirements changed. Do not set `DONE` until this privacy finding is fixed and reviewed.

## Coder Response to Reviewer (2026-10-13, underscore-form credential prefix)

- Extended diagnostic model-label rejection to recognize underscore and hyphen separators after `sk`, `pk`, and `rk` prefixes.
- Updated captured-log regression to use `sk_live_test_secret_123456` and assert it is absent from diagnostics. Added a normal `deepseek-r1:14b` completion assertion to preserve Ollama model labels and request/status/duration metadata.
- Changed files: `frontend/src/api/chat.ts`, `frontend/tests/api.test.ts`, `.github/handoff/tasks/RSA-10.md`.
- Focused captured-log regression: `npm run test -- --run tests/api.test.ts -t "omits credential-shaped provider and model labels from chat diagnostics"` passed (`1 passed, 15 skipped`).
- Frontend API tests: `npm run test -- --run tests/api.test.ts` passed (`16 passed`).
- Frontend build: `npm run build` passed (`tsc -b` and Vite production build).
- User explicitly confirmed no requirements changed; confirmation preserved above. Status: `READY_FOR_TEST` pending tester/reviewer verification; do not set `DONE` here.

## Tester Verification (2026-10-13, underscore-form credential labels)

- Branch verified: `bug/RSA-10-local-LLM-no-API-key`; existing staged, modified, and untracked work preserved.
- From `frontend/`, `npm run test -- --run tests/api.test.ts -t "omits credential-shaped provider and model labels from chat diagnostics"`: passed (`1 passed, 15 skipped`). The captured logs omit `sk_live_test_secret_123456`; ordinary Ollama model `deepseek-r1:14b` remains present alongside completion lifecycle, request ID, HTTP status, and duration.
- From `frontend/`, `npm run test -- --run tests/api.test.ts`: passed (`16 passed`).
- From `frontend/`, `npm run build`: passed (`tsc -b` and Vite production build).
- No live Ollama request was made. These frontend tests/build verify diagnostic behavior, not Ollama connectivity or the earlier runtime failure.
- Requirements-change confirmation remains preserved above: user explicitly confirmed no requirements changed.
- Status: `READY_FOR_REVIEW`.

## Reviewer Re-review (2026-10-13, underscore-form credential prefix)

- Confirmed `safeModel()` rejects underscore-form credential prefixes, including `sk_live_test_secret_123456`, while retaining ordinary `deepseek-r1:14b`; provider metadata remains allowlisted.
- Focused regression rerun: `npm run test -- --run tests/api.test.ts -t "omits credential-shaped provider and model labels from chat diagnostics"` passed (`1 passed, 15 skipped`). Tester-recorded API suite and frontend build also passed.
- User explicitly confirmed no requirements changed. No actionable findings remain.
- Status: `DONE`.