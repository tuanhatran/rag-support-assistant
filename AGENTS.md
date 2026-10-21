# Agent instructions

## Superpowers (required on every coding task)

This project vendors the [Superpowers](https://github.com/obra/superpowers) skills
(MIT, v7.0.1, commit `2ce8aa15d05bd57213e6f746f953aafb7ded7a8b`) in `.qoder/skills/`.

Before any coding, planning, debugging, or review task, invoke the
`using-superpowers` skill and follow it. Skill references written as
`superpowers:<name>` mean the project skill at `.qoder/skills/<name>/SKILL.md`.

Default routing:

- New feature or unclear request: `brainstorming`, then `writing-plans`.
- Multi-step implementation: `executing-plans`.
- Any behavior change: `test-driven-development` — write the failing test first.
- Bug, failing test, or unexpected result: `systematic-debugging`.
- Before claiming completion: `verification-before-completion`; use
  `requesting-code-review` for non-trivial changes.

## Project precedence

`.github/copilot-instructions.md` and the active handoff in
`.qoder/handoff/tasks/<TASK-ID>.md` take precedence over Superpowers skills.
Follow the role protocol in `.qoder/agents/`. In particular:

- Work only on a handoff whose status is `READY_FOR_CODE` or `CHANGES_REQUESTED`.
- Never commit, push, reset, clean, or stash. Do not create worktrees or finish
  branches (`using-git-worktrees`, `finishing-a-development-branch`) unless the
  user explicitly asks.
- Stage only exact paths with `git add -- <path>`.
- Preserve existing staged and unstaged changes.
- Never log or hand off secret values.
