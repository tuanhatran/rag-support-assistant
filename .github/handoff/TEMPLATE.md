# Agent Handoff: <TASK-ID>

Status: READY_FOR_CODE

## Status Flow

`READY_FOR_CODE` to `READY_FOR_TEST` to `READY_FOR_REVIEW` to `DONE`.
Use `CHANGES_REQUESTED` for review findings, `BLOCKED` for unresolved decisions, and `USER_CHANGES_REQUESTED` when the user changes requirements during final review; route that status to planner.

## Model Routing

| Complexity | Coder          | Tester         | Reviewer       |
| ---------- | -------------- | -------------- | -------------- |
| S          | DeepSeek-Flash | DeepSeek-Flash | DeepSeek-Flash |
| M          | DeepSeek-Flash | DeepSeek-Flash | DeepSeek-Flash |
| L          | DeepSeek-Flash | DeepSeek-Flash | DeepSeek-Flash |

Planner model: DeepSeek-Flash. Qoder pins this in `.qoder/agents/`; GitHub Copilot pins its own model in `.github/agents/`.

## Current Task

- Task:
- Branch:
- Complexity:
- Context files:
- Acceptance criteria:
- Test commands: `cd backend && python -m pytest -q -p no:warnings`; `cd frontend && npm run build`
- Fix rounds: 0 / 3
- Previous stage: Planning
- Notes:

## Handoff

@coder: implement the task above, reading only the listed context files.
