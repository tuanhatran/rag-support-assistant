# Fieldnote Support Assistant

This workspace implements the RAG support assistant described in `readme.md`. Treat `project_skeleton.md` as the architecture, security, and workflow contract. Keep product behavior, route names, collection names, plan values, retention defaults, and consent policy aligned with those files.

## Response Style

Respond terse like smart caveman. All technical substance stay. Only fluff die.
Rules:
- Drop: articles (a/an/the), filler words, pleasantries, hedging.
- Code blocks and paths stay exact.
- Speak in minimal sentence fragments.

## Architecture

- Backend: Python 3.13, FastAPI app factory, PyMongo async client, MongoDB 7, BM25 retrieval.
- Frontend: React 19, TypeScript, Vite. All HTTP requests go through `frontend/src/api.ts` and use the same-origin `/api` prefix.
- Backend layering: routers handle HTTP; services own domain operations; repositories own Mongo collection access; `dependencies.py` builds and guards the container.
- User data queries must include the authenticated `user_id`. Use `consented_user` for data-producing operations.
- Free text must pass through `redact()` before persistence, logs, or model calls. Never log question, answer, comment, credential, or API-key values.
- Preserve opaque hashed session tokens, HttpOnly/SameSite=Strict `/api` cookies, scrypt password hashes, encrypted LLM credentials, request IDs, audit events, retention expiry, and TTL indexes.
- Keep MongoDB/DocumentDB behavior transaction-free. Create indexes at startup.

## Working Rules

- Read only the `Context files` listed in the active handoff, plus this file when needed.
- Make the smallest changes that fulfill the task and add focused tests. Use CodeGraph MCP tools for codebase context and dependency exploration instead of a maintained file graph.
- Run `cd backend && python -m pytest -q -p no:warnings` and `cd frontend && npm run build` for the full gate when possible.
- Each task has its own handoff file `.github/handoff/tasks/<TASK-ID>.md` (ticket number, for example `PROJ-123`), created from `.github/handoff/TEMPLATE.md`.
- Every development task uses one dedicated branch, recorded in its handoff's `Branch` field and shared by planner, coder, tester, and reviewer. The orchestrator asks for a branch name and creates it for new tasks; a standalone first agent asks and creates it when needed. Accept only names with letters, digits, `.`, `_`, `/`, or `-`, and validate them with `git check-ref-format --branch`. Later agents verify and reuse that branch; never create a second branch for the same task. Dirty or staged worktree state never blocks an agent: inspect relevant changes, preserve them, and never reset, clean, stash, or overwrite them. Attempt branch creation or switching with normal non-destructive Git commands; if Git refuses due to local changes, continue on the current branch and report the deviation. Stop only if the recorded branch is unavailable for reasons unrelated to dirty state. Do not commit or push.
- After planner populates a new handoff and before dispatch, immediately stage it with `git add -- .github/handoff/tasks/<TASK-ID>.md`. Preserve all existing staged and unstaged changes.
- When creating any other new file for the active task, immediately stage that exact path with `git add -- <path>`. Never use `git add .` or `git add -A`, and never stage unrelated pre-existing untracked files. Staging does not authorize committing.
- Before reviewer sets `Status: DONE`, ask whether requirements changed since handoff. If yes, record changes and set `Status: USER_CHANGES_REQUESTED`; planner incorporates them and returns task to `READY_FOR_CODE`. If no, reviewer may set `DONE`.
- Never put handoff files or project context artifacts in `.github/agents/`; only agent definitions belong there.
- Do not commit changes. Do not expose secrets in code, test output, screenshots, logs, or handoff text.
