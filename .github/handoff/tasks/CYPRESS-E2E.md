# Agent Handoff: CYPRESS-E2E

Status: DONE

## Model Routing

| Complexity | Coder | Tester | Reviewer |
| --- | --- | --- | --- |
| S | Gemini 3.8 Flash (copilot) | Gemini 3.8 Flash (copilot) | Claude Haiku 5.5 (copilot) |
| M | Gemini 3.8 Flash (copilot) | Gemini 3.8 Flash (copilot) | Claude Haiku 5.5 (copilot) |
| L | Gemini 3.8 Flash (copilot) | Gemini 3.8 Flash (copilot) | Claude Haiku 5.5 (copilot) |

Planner model: Claude Haiku 5.5 (copilot). Use the exact model names in the agent picker.

## Current Task

- Task: Add Cypress end-to-end tests to the frontend, one spec file per screen (Login, Policy/Header, AI Chat, Documents, Privacy, Admin, RBAC), run against the real stack (`docker compose up`, nginx at `http://localhost:8080`).
- Complexity: M
- Context files:
  - `.github/copilot-instructions.md`
  - `project_skeleton.md` (section 9.1 Screens and 9.4 Plans/Seed only)
  - `.github/context/FILE_GRAPH.md`
  - `frontend/package.json`, `frontend/tsconfig.json`, `frontend/tsconfig.app.json`
  - `frontend/src/App.tsx`
  - `frontend/src/components/LoginPage.tsx`, `PolicyModal.tsx`, `ChatView.tsx`, `DocumentsView.tsx`, `PrivacyView.tsx`, `AdminView.tsx`
  - `docker-compose.yml` (frontend port only)
- Setup requirements:
  - Add `cypress` as a devDependency and scripts `cy:open` (`cypress open`) and `e2e` (`cypress run`) in `frontend/package.json`. Do not change `dev` or `build`.
  - Create `frontend/cypress.config.ts` with `baseUrl` `http://localhost:8080` (overridable via `CYPRESS_BASE_URL`), `specPattern` `cypress/e2e/**/*.cy.ts`, `video: false`, support file `cypress/support/e2e.ts`.
  - Create `frontend/cypress/tsconfig.json` (types `cypress`). Keep Cypress files out of the app `tsc -b` so `npm run build` still passes.
  - Add `frontend/cypress/support/commands.ts` helpers: `registerUser(username, password, plan)`, `login(username, password)` (`cy.request` to `/api/auth/*` plus `cy.session`), `acceptPolicy()`, `adminLogin()`.
  - Admin credentials come only from Cypress env `ADMIN_USERNAME` / `ADMIN_PASSWORD` (`CYPRESS_ADMIN_USERNAME` / `CYPRESS_ADMIN_PASSWORD`). Never hardcode or print them. Admin specs skip with a clear message when the vars are missing.
  - Generate unique usernames per run (for example `e2e_<timestamp>_<n>`). Never log passwords or tokens.
  - Prefer existing accessible selectors (`aria-label`, `role="tab"`, `role="dialog"`, visible text). Add a `data-testid` only if no stable selector exists, keeping the change minimal.
  - The built-in simulator answers questions, so no external LLM calls are made.
- Specs (under `frontend/cypress/e2e/`):
  - `login.cy.ts`: Sign in / Create account tabs; validation (password mismatch, policy checkbox required); plan cards show the assigned model; registration lands in the app; wrong password shows an error.
  - `policy-header.cy.ts`: blocking policy modal until consent; header shows brand, nav (no Admin tab for regular users), model badge, user chip with plan and role; Sign out returns to Login.
  - `chat.cy.ts`: empty state with 5 suggestions; Enter sends a question (for example a VPN question); answer with source chips `[n]`, model and latency; a chip opens the document modal; Helpful, and Not helpful (form with categories, comment, data notice); new and delete conversation; "Sensitive data was redacted" appears when the question contains a fake secret such as `password=hunter2`.
  - `documents.cy.ts`: list grouped by category, search filter, tag chips, open and close a rendered document.
  - `privacy.cy.ts`: policy shown; Export my data; Delete my conversations (conversation list empties); Delete my account requires the password and returns to Login.
  - `admin.cy.ts` (admin only): Admin nav visible; LLM connections tab (seeded "Built-in simulator" row, plan badges, create/edit/test/delete a connection), Users tab (role/plan selects, last admin cannot be demoted), Chat feedback tab (stats, rating filter), Audit log tab (filters, rows).
  - `rbac.cy.ts`: a regular user has no Admin nav, and `/api/admin/users` returns 403 via `cy.request` with `failOnStatusCode: false`.
- Acceptance criteria:
  - `cd frontend && npm run build` passes and ignores Cypress files.
  - `cd frontend && npm run e2e` passes against a running `docker compose up` stack with the admin env vars set.
  - One spec file per screen; specs are independent, create their own users, and delete them where practical.
  - No secrets are committed, logged, or echoed. Ignore `frontend/cypress/screenshots` and `frontend/cypress/videos` in git.
  - Add a short "End-to-end tests" subsection to `readme.md` (setup, env vars, commands). Update `.github/context/FILE_GRAPH.md` with the Cypress files.
  - No backend or application behavior changes.
- Test commands: `cd backend && python -m pytest -q -p no:warnings`; `cd frontend && npm run build`; `cd frontend && npm run e2e` (requires the running stack)
- Fix rounds: 1 / 3 (closed)
- Previous stage: Planning
- Notes: The workspace `.env` holds the bootstrap admin values (`RAG_BOOTSTRAP_ADMIN_USERNAME`, `RAG_BOOTSTRAP_ADMIN_PASSWORD`). Pass them to Cypress via environment variables only; do not copy values into code, docs, or this file.

## Handoff

@reviewer (model: Claude Haiku 5.5 (copilot)):
All acceptance criteria have been verified and passed after the Dockerfile fix round.

### Test Commands and Results
1. Backend Unit/API Suite:
   - Command: `cd backend && python -m pytest -q -p no:warnings`
   - Result: 38 passed in 1.74s (100% pass)
2. Frontend Build Gate:
   - Command: `cd frontend && npm run build`
   - Result: Passed (`tsc -b && vite build` completed in 2.20s; Cypress files are excluded from app build)
3. Frontend TypeScript Check for Cypress:
   - Command: `cd frontend && npx tsc -p cypress/tsconfig.json`
   - Result: Passed (0 errors / 0 diagnostics)
4. Frontend E2E Suite (against running Docker stack with admin credentials via environment variables):
   - Command: `cd frontend && npm run e2e`
   - Result: All 7 specs passed (44 of 44 tests passed in 1m 15s):
     - `admin.cy.ts`: 9 passed, 0 failed
     - `chat.cy.ts`: 9 passed, 0 failed
     - `documents.cy.ts`: 6 passed, 0 failed
     - `login.cy.ts`: 7 passed, 0 failed
     - `policy-header.cy.ts`: 4 passed, 0 failed
     - `privacy.cy.ts`: 5 passed, 0 failed
     - `rbac.cy.ts`: 4 passed, 0 failed

### Review Verification
- Verified `frontend/Dockerfile` has `ENV CYPRESS_INSTALL_BINARY=0` preceding `RUN npm install` in the build stage, avoiding Cypress binary downloads in Docker image builds.
- Verified no application or backend implementation was modified.
- Verified no secrets are logged, echoed, or committed.
- No screenshots or videos were created, and `.gitignore` covers Cypress artifacts.

---

Previous stage notes (coder to tester):
Addressed review feedback:
- Changed files: `frontend/Dockerfile`
- Added `ENV CYPRESS_INSTALL_BINARY=0` before `RUN npm install` in the build stage of `frontend/Dockerfile` to prevent Cypress binary download during Docker build.
- Test verification:
  - Backend pytest: `cd backend && python -m pytest -q -p no:warnings` (38 passed in 1.71s)
  - Frontend app build: `cd frontend && npm run build` (passed, `tsc -b && vite build` succeeded)
  - Docker build test: `docker build -t test-frontend frontend` succeeded with `npm install` completing in ~5s without binary download.
  - `.github/context/FILE_GRAPH.md` contract for `frontend/Dockerfile` remains accurate.

---

Previous stage notes (reviewer to coder):
Review result: CHANGES_REQUESTED (1 issue). Specs, support commands, tsconfig isolation, `.gitignore`, readme and FILE_GRAPH were reviewed and are acceptable: no secrets are hardcoded or logged (`log: false` on credential requests, admin values read only from `Cypress.env`), users are unique per run and cleaned up, all seven screens have a spec, and no application or backend code changed.

1. `frontend/Dockerfile` (build stage) runs `npm install`. Cypress is now a devDependency in `frontend/package.json` and `package-lock.json`, so every `docker compose up --build` (the stack these E2E tests need) downloads the Cypress binary (a few hundred MB) into the build stage. It is unused there, and on `node:20-alpine` it is not even runnable.
   - Reproduce: `docker compose build frontend --no-cache` and watch the `npm install` step download the Cypress binary.
   - Change: add `ENV CYPRESS_INSTALL_BINARY=0` before `RUN npm install` in the build stage of `frontend/Dockerfile`. Do not change anything else there.
   - Verify: `docker compose build frontend` no longer downloads the binary and still succeeds; `cd frontend && npm run build` passes; local `npm install` (without the variable) still installs the binary for `npm run e2e`.
   - Update `.github/context/FILE_GRAPH.md` only if it lists the Dockerfile contract; no other file changes are needed.

---

Previous stage notes (tester to reviewer):
All acceptance criteria have been verified and passed.

### Test Commands and Results
1. Backend Unit/API Suite:
   - Command: `cd backend && python -m pytest -q -p no:warnings`
   - Result: 38 passed in 1.73s (100% pass)
2. Frontend Build Gate:
   - Command: `cd frontend && npm run build`
   - Result: Passed (`tsc -b && vite build` succeeded, Cypress files properly isolated outside app build)
3. Frontend TypeScript Check for Cypress:
   - Command: `cd frontend && npx tsc -p cypress/tsconfig.json`
   - Result: Passed (0 diagnostics)
4. Frontend E2E Suite (against running Docker stack with admin credentials via env):
   - Command: `cd frontend && npm run e2e`
   - Result: All 7 specs passed (44 of 44 tests passed in 33s):
     - `admin.cy.ts`: 9 passed, 0 failed
     - `chat.cy.ts`: 9 passed, 0 failed
     - `documents.cy.ts`: 6 passed, 0 failed
     - `login.cy.ts`: 7 passed, 0 failed
     - `policy-header.cy.ts`: 4 passed, 0 failed
     - `privacy.cy.ts`: 5 passed, 0 failed
     - `rbac.cy.ts`: 4 passed, 0 failed

### Changes Made During Testing
- `frontend/cypress/e2e/chat.cy.ts`: Updated the conversation creation and deletion assertion in `creates and deletes conversations` to correctly account for clicking "New conversation" creating a second session in the rail, testing both creations and sequential deletions until the rail is empty.
- No application or backend source files were modified. No secrets were logged, echoed, or committed. Screenshots directory was cleaned up and is ignored by `.gitignore`.
