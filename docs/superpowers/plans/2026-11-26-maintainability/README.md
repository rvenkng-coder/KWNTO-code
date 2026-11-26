# Maintainability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. A person can follow the same steps by hand.

**Goal:** Make the repository easy to read, change and check by hand: consistent layout, static checks on every code area, comments that explain themselves, and docs that match how the project works.

**Architecture:** No product behaviour changes. First close the check gaps (hooks lint, tooling typecheck), then prepare for and apply one format-only commit, then rewrite comments that point at old plans (with a script proving no code changed), then fix the docs and CI.

**Tech Stack:** TypeScript, ESLint, Prettier 3.10.1 (the one new dependency), Vitest, Playwright, GitHub Actions.

**Spec:** [engineering.md](../../../engineering.md) and the findings below (repository review, 2026-11-26). Also binding: [security.md](../../../security.md), [testing-strategy.md](../../../testing-strategy.md).

**Standard:** test-plan-v1

## Findings this plan answers

| Finding (measured 2026-11-26) | Task |
|---|---|
| About 3,100 lines of `backend/pb_hooks` have no active lint rule | 1 |
| `tests/`, `e2e/` and `scripts/` are not typechecked (24 errors under a strict config) | 2 |
| `syncEngine.ts` is hard to follow; `backend/index.ts` repeats 13 getter bodies | 3 |
| No formatter; 226 lines in `frontend/src` exceed 140 characters | 3, 4 |
| About 670 comment lines cite a plan, task, decision number, case id or finding | 5 to 8 |
| Stale docs; human and agent-only material is mixed | 9 |
| CI does not run `check:hygiene` | 10 |

Already fixed before this plan: card size and node links lost by export and share views (`85c074c`).

## Developer decisions (2026-11-26)

- Add Prettier at a line width of 120.
- Keep all agent tooling; separate it clearly from what a person needs. Delete nothing.
- Rewrite all history comments now.

## Choices proposed by the plan writer, confirmed by the developer (2026-11-26)

| Choice | Why |
|---|---|
| Frontend test files may have 500 lines (source stays at 300; the developer chose 500) | `syncEngine.test.ts` is 337 after formatting, and moving tests to another file trips `check:hygiene` |
| `check:quality` stays out of CI; CI prints `report:quality` | A formatted tree has 29 old findings, which would block every pull request that touches those files |
| In tasks 4 and 6 to 8, a `check:task` FAIL caused only by old quality findings is accepted; paste the output and say so | Those tasks touch many files and change no logic |
| Migrations are neither formatted nor comment-rewritten | A migration that has run is not changed without asking ([engineering.md](../../../engineering.md) section 5) |
| References to the design, `security.md` and decision records may stay, after the comment states the reason | Those are living documents a person can open |
| Agent docs are separated in the indexes, not moved | Scripts and skills print and read their paths |
| Tooling typecheck is `strict` without `noUncheckedIndexedAccess` | With it there are 168 errors, mostly in tests; tighten later |
| Task 2 edits types in existing tests (no assertion or title changes) | Approving the plan approves those edits |
| The git rule becomes: branch, pull request, developer merges | It is what happens; `engineering.md` section 7 still says "without a pull request" |

## Global Constraints

- **Start:** after pull request #28 is merged, branch `chore/maintainability` from `main`. Progress goes in `.planning/2026-11-26-maintainability/progress.md`.
- **Pull requests:** A = tasks 1 to 3; B = task 4 alone; C = tasks 5 to 8; D = tasks 9 and 10. Merge B with a merge commit (not squash or rebase), so the SHA in `.git-blame-ignore-revs` stays valid.
- **Every task ends with** `npm run lint`, `npm run typecheck`, `npm run test:unit`, then `npm run check:task -- --task <task file> --base <sha at task start> --built-by strong`, pasted in the report.
- **No behaviour change.** On-screen text, API replies and stored data stay as they are.
- **Hard rules (AGENTS.md):** only `frontend/src/backend/` imports `pocketbase`; no `any`; no dependency other than `prettier`; never edit a failing test; never push or merge without the developer.
- **Counts in this plan** were measured at `eb1790f`. If yours differ, report it; do not force a match.

## Tasks

| Task | What | Tier | Status |
|---|---|---|---|
| [1](task-1-lint-hooks.md) | Lint the backend hooks | mid | done |
| [2](task-2-typecheck-tooling.md) | Typecheck tests, end-to-end tests and scripts | mid | done |
| [3](task-3-before-formatting.md) | Prepare for formatting: assertion counter, sync engine, backend index | strong | done |
| [4](task-4-prettier.md) | Prettier and the format-only commit | mid | awaiting developer review |
| [5](task-5-comment-checker.md) | A checker for history references and comment-only changes | mid | awaiting developer review |
| [6](task-6-comments-hooks.md) | Rewrite comments: backend hooks | strong | awaiting developer review |
| [7](task-7-comments-frontend.md) | Rewrite comments: frontend | strong | awaiting developer review |
| [8](task-8-comments-tests-scripts.md) | Rewrite comments: tests and scripts; turn the check on | strong | awaiting developer review |
| [9](task-9-docs.md) | Docs for people, agent material separated, recipes | strong | awaiting developer review |
| [10](task-10-ci-closeout.md) | CI checks and closeout | mid | awaiting developer review |

## Review Focus

1. **A hook that lints but fails inside PocketBase** (its JavaScript engine is not Node): the access-rule tests must pass after tasks 1, 4 and 6.
2. **Formatting that changes on-screen text** (JSX whitespace): the full end-to-end suite must pass in task 4.
3. **A comment rewrite that changes code:** `--same-code` must report nothing in tasks 6 to 8 (task 5 tests it).
4. **A lost directive comment** (`eslint-disable`, `/// <reference`, `// Protects:`, `PERF:`): the code comparison cannot see it, so lint and `check:hygiene` run in tasks 6 to 8.
5. **An unmerged branch** that conflicts after formatting: task 4 starts by listing them for the developer.
