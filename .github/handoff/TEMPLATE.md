# Agent Handoff: <TASK-ID>

Status: READY_FOR_CODE

## Model Routing

| Complexity | Coder | Tester | Reviewer |
| --- | --- | --- | --- |
| S | Gemini 3.8 Flash (copilot) | Gemini 3.8 Flash (copilot) | Claude Sonnet 5.5 (copilot) |
| M | Gemini 3.8 Flash (copilot) | Gemini 3.8 Flash (copilot) | Claude Sonnet 5.5 (copilot) |
| L | Gemini 3.8 Flash (copilot) | Gemini 3.8 Flash (copilot) | Claude Sonnet 5.5 (copilot) |

Planner model: Claude Sonnet 5.5 (copilot). Use the exact model names in the agent picker.

## Current Task

- Task:
- Complexity:
- Context files:
- Acceptance criteria:
- Test commands: `cd backend && python -m pytest -q -p no:warnings`; `cd frontend && npm run build`
- Fix rounds: 0 / 3
- Previous stage: Planning
- Notes:

## Handoff

@coder: implement the task above, reading only the listed context files.
