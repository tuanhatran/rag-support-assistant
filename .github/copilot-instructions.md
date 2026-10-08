# Fieldnote Support Assistant

This workspace implements the RAG support assistant described in `readme.md`. Treat `project_skeleton.md` as the architecture, security, and workflow contract. Keep product behavior, route names, collection names, plan values, retention defaults, and consent policy aligned with those files.

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
- Make the smallest changes that fulfill the task, add focused tests, and keep `.github/context/FILE_GRAPH.md` accurate when modules or contracts change.
- Run `cd backend && python -m pytest -q -p no:warnings` and `cd frontend && npm run build` for the full gate when possible.
- Each task has its own handoff file `.github/handoff/tasks/<TASK-ID>.md` (ticket number, for example `PROJ-123`), created from `.github/handoff/TEMPLATE.md`.
- Never put handoff files or `FILE_GRAPH.md` in `.github/agents/`; only agent definitions belong there.
- Do not commit changes. Do not expose secrets in code, test output, screenshots, logs, or handoff text.
