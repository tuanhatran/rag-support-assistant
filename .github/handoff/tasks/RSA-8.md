# Agent Handoff: RSA-8

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

## Requirement Change

- 2026-10-10: User requested: "Yes, add the vitest stage in ci.yml". The CI change must be a distinct Vitest stage, not only another step in the frontend checks.

## Current Task

- Task: Add Vitest frontend unit tests with enforced application-source coverage of at least 85% for statements, branches, functions, and lines. Use React Testing Library for rendered React behavior where appropriate. Run coverage in frontend CI; retain the existing Cypress E2E suite as a separate test layer.
- Branch: `feat/RSA-8-add-vitest-coverage-85`
- Complexity: L
- Context files: `.github/copilot-instructions.md`, `.github/context/FILE_GRAPH.md`, `.github/workflows/ci.yml`, `frontend/package.json`, `frontend/package-lock.json`, `frontend/tsconfig.json`, `frontend/tsconfig.app.json`, `frontend/vite.config.ts`, `frontend/src/**`
- Acceptance criteria:
  - Configure Vitest and necessary DOM/testing utilities for the existing React 19 + TypeScript + Vite app; lock all dependency changes in `package-lock.json`.
  - Add focused unit/component tests for production frontend behavior, prioritizing user-visible flows and independently testable API/util logic. Do not count trivial assertions or exclude complex production modules to inflate coverage.
  - Provide documented npm scripts for running unit tests and coverage.
  - Enforce minimum 85% statement, branch, function, and line coverage across executable production TypeScript/TSX under `frontend/src`; exclude only CSS, declaration/type-only files, and the application bootstrap entry point where code is not meaningfully unit-testable.
  - Add a dedicated `vitest` job/stage in `.github/workflows/ci.yml` that installs frontend dependencies and runs `npm run test:coverage` from `frontend`.
  - Keep the existing frontend formatting and build checks and backend checks intact; keep Cypress E2E as a separate test layer and do not substitute it with Vitest.
  - Keep tests deterministic and independent of a running backend, MongoDB, credentials, or external model services; mock network boundaries.
  - Update `.github/context/FILE_GRAPH.md` with the unit test/configuration and coverage responsibilities.
- Test commands: `cd frontend && npm run test:coverage`; `cd frontend && npm run format:check`; `cd frontend && npm run build`
- Fix rounds: 1 / 3
- Previous stage: Planning
- Notes: Original unit/component coverage work is complete and its prior results remain recorded below. This requirement change adds a distinct Vitest CI job; preserve staged handoff results, existing checks, and Cypress E2E. Do not change application behavior to make tests pass.

## Handoff

@coder: implement the task above, reading only the listed context files. Add the dedicated Vitest stage in `.github/workflows/ci.yml` and preserve existing checks. Use GPT-6 Luna.

## Implementation Results

- Changed files: `frontend/package.json`, `frontend/package-lock.json`, `frontend/vite.config.ts`, `frontend/tests/setup.ts`, `frontend/tests/api.test.ts`, `frontend/tests/components.test.tsx`, `frontend/tests/views.test.tsx`, `.github/workflows/ci.yml`, `.github/context/FILE_GRAPH.md`.
- `cd frontend && npm run test:coverage`: 42 passed; statements 97.55%, branches 90.52%, functions 85.43%, lines 97.55%. All 85% thresholds pass.
- `cd frontend && npm run format:check`: passed.
- `cd frontend && npm run build`: passed.
- `cd backend && python -m pytest -q -p no:warnings`: 64 passed, 1 skipped.
- Cypress suite retained and separate; not run because it requires the running application stack.
- Dependency installation reported 4 npm audit findings (2 moderate, 2 critical); no audit remediation performed in this task.

### Requirement Change Implementation Results

- Added a dedicated `vitest` CI job that installs frontend dependencies and runs `npm run test:coverage`; removed duplicate coverage execution from the frontend formatting/build job. Backend tests, frontend formatting/build, and Cypress E2E remain separate and unchanged.
- Updated `.github/context/FILE_GRAPH.md` to record the dedicated CI coverage job and retained checks.
- `cd frontend && npm run test:coverage`: passed; 42 tests, statements/lines 97.55%, branches 90.52%, functions 85.43%.
- No application behavior or Cypress configuration changed.

## Tester Results

- `cd /e/Dev/rag-support-assistant/frontend && npm ls vitest @vitest/coverage-v8 tinypool --depth=4`: passed; `vitest@4.1.11` and `@vitest/coverage-v8@4.1.11` resolve from the installed lockfile.
- `cd /e/Dev/rag-support-assistant/frontend && npm audit`: passed; 0 vulnerabilities.
- `cd /e/Dev/rag-support-assistant/frontend && npm run test:coverage`: passed; 42 tests, statements 88.77%, branches 85.49%, functions 86.45%, lines 89.96%; all 85% thresholds pass.
- `cd /e/Dev/rag-support-assistant/frontend && npm run format:check`: passed.
- `cd /e/Dev/rag-support-assistant/frontend && npm run build`: passed.
- `cd /e/Dev/rag-support-assistant/backend && python -m pytest -q -p no:warnings`: passed; 64 passed, 1 skipped.
- `.github/workflows/ci.yml`: verified dedicated `vitest` job installs dependencies and runs coverage; backend and frontend formatting/build jobs remain separate. `.github/context/FILE_GRAPH.md` records the CI and coverage responsibilities.
- Cypress E2E was not run; it requires the running application stack.

## Reviewer Results

- Resolved prior finding: `frontend/package.json` now uses mutually compatible Vitest and `@vitest/coverage-v8` `^4.1.11`; the lockfile resolves both to `4.1.11`. Current `cd frontend && npm audit` reports 0 vulnerabilities, clearing the previously reported critical and moderate Vitest-chain findings.
- Independent review checks: `cd frontend && npm run test:coverage` passed (42 tests; statements 88.77%, branches 85.49%, functions 86.45%, lines 89.96%); `cd frontend && npm audit` passed with 0 vulnerabilities; `cd frontend && npm ls vitest @vitest/coverage-v8 tinypool --depth=4` confirms matching Vitest/provider 4.1.11.
- No actionable review findings. The dedicated `vitest` CI job remains separate from backend and frontend formatting/build checks; tester evidence records those checks passing. Cypress remains a separate E2E layer and was not run because it requires the running application stack.

## Coder Results

- Upgraded `vitest` and `@vitest/coverage-v8` to mutually compatible `4.1.11`; updated `frontend/package-lock.json` and installed exact locked dependencies with `npm ci`.
- `cd frontend && npm audit`: passed; 0 vulnerabilities, including no Vitest-chain findings.
- `cd frontend && npm run test:coverage`: passed; 42 tests. Statements 88.77%, branches 85.49%, functions 86.45%, lines 89.96%; every 85% threshold passes.
- `cd frontend && npm run format:check`: passed.
- `cd frontend && npm run build`: passed.
- Dedicated Vitest CI job and separate frontend formatting/build and Cypress E2E layers remain unchanged.
- Changed files: `frontend/package.json`, `frontend/package-lock.json`, `.github/handoff/tasks/RSA-8.md`.