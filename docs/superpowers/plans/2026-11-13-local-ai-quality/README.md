# Local-AI Quality Tooling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the local model take one whole task from a plan and finish it alone, with proof: a written test basis (strategy and project test plan), a Test plan block in every task, and one command (`npm run check:task`) that checks tests, hygiene, code quality, plan coverage, deliberate breaks and unseen probes.

**Architecture:** Plain TypeScript scripts in `scripts/` (run with `node`, tested by Vitest in `scripts/**/*.test.ts`), each a pure, tested function plus a thin command-line wrapper. `check:task` runs them in order and prints one pass/fail report. Two documents (`docs/testing-strategy.md`, `docs/test-plan.md`) are the written basis. No new dependency.

**Tech Stack:** TypeScript run with `node` (type stripping), Vitest, ESLint (second config), git. Nothing new.

**Spec:** [Design: Letting the local AI do most of the work, with proof](../../specs/2026-11-13-local-ai-quality-design.md). Also binding: [engineering.md](../../../engineering.md), [local-model-notes.md](../../../developer/local-model-notes.md).

**Standard:** not applicable (this plan builds the standard; it cannot be graded by it). Plans written after this one carry `**Standard:** test-plan-v1` in their README and are checked by `check:plan`.

## Global Constraints

- **Zero cost, no new dependency** (engineering.md section 4). Every script uses `node:` built-ins, `git`, `npx vitest` and `npx eslint`, which are installed already.
- **Scripts are TypeScript run directly with `node`**, as in `scripts/check-perf-comments.ts`: ES modules, `import type` for types, explicit `.ts` extensions in relative imports, no build step. Each has `<name>.test.ts` beside it.
- **300 lines max per file, no `any`** (a justified exception needs a comment). Split a script into `scripts/lib/` modules when it grows.
- **A check must fail closed.** A check that silently passes bad input is the worst failure (local-model-notes.md). Every script has tests for its failing input, not only its passing input, and for empty input, a missing file and malformed input. A script that cannot do its job exits non-zero with a message, never 0.
- **No coverage-percentage target, no automatic merging** (design sections 3 and 6.5). Agents never merge.
- **Output teaches the class, not the example:** the probe runner never prints a probe's input or expected value (design 6.3).
- **Documentation is part of done:** every script and command is documented in `docs/developer/` and in the Commands table of `AGENTS.md`.
- **Worktree and branch:** `feat/local-ai-quality`, created from `feat/accounts-teams` (Plan 2, PR #12); rebase onto `main` once PR #12 is merged. Tracking in `.planning/2026-11-13-local-ai-quality/` (`progress.md`; resume as in the Plan 1 router).
- **Model tier:** every task here is strong or mid. The tooling is the guardrail, so nothing in it goes to the local model; a wrong check is invisible until it has let bad work through.

## Review Focus

The input classes most likely to bite a person using these checks, most likely first. Each has a test in the owning task.

1. A check that passes when it should fail: a test file with a header comment but none on the new test; a `test.skip` written as `it.skip`, `xit`, `test.fixme` or `describe.only`; a removed test whose count is hidden by an added one (Task 3).
2. A deliberate break that is applied to the wrong place, matches twice, or is not restored after a crash or Ctrl-C, leaving the developer with a broken file (Task 5).
3. A probe failure message that leaks the probe's input and so teaches the example (Task 6).
4. A Test plan block with a missing, misspelled or empty section being read as "no cases" and passing (Task 2).
5. A changed-files list that misses a renamed, deleted or untracked file, so a violation is never checked (Tasks 3, 4, 8).

## Tasks

| # | Task | Tier | Depends on | Checkpoints | Status |
|---|---|---|---|---|---|
| 1 | [Test strategy and project test plan](task-1-strategy-and-test-plan.md) | strong | none | 1A 1B | done |
| 2 | [Test plan block, plan parser and `check:plan`](task-2-plan-check.md) | mid | 1 | 2A 2B | done |
| 3 | [Test hygiene check](task-3-test-hygiene.md) | mid | none | 3A 3B | done |
| 4 | [Code quality limits on changed files](task-4-quality-limits.md) | mid | none | 4A 4B | done |
| 5 | [Deliberate breaks runner](task-5-breaks-runner.md) | strong | 2 | 5A 5B | not started |
| 6 | [Probe runner](task-6-probe-runner.md) | mid | 2 | 6A 6B | not started |
| 7 | [Review sampling and escape rate](task-7-review-sampling.md) | mid | none | 7A 7B | not started |
| 8 | [`check:task`, the self-check command](task-8-check-task.md) | strong | 2, 3, 4, 5, 6, 7 | 8A 8B | not started |
| 9 | [Local-model runbook and server ping](task-9-local-model-runbook.md) | mid | 8 | 9A 9B | not started |

**Status values:** `not started`, `in progress`, `awaiting review`, `done`. Tasks 3, 4 and 7 are independent of the rest and of each other. Run tasks one at a time (implementers never run in parallel).

## Done when

- `npm run check:task -- --task <task file>` exists, passes on a task that meets the standard and fails, naming the row, on one that does not (shown in Task 8).
- `docs/testing-strategy.md` and `docs/test-plan.md` exist and are linked from `AGENTS.md` and `docs/README.md`.
- A task template with the Test plan block exists, and `check:plan` rejects a task file without a tier, an Interfaces block or a Test plan.
- `docs/developer/local-model-runbook.md` describes the procedure; `local-model-notes.md` points to it.
- `npm test` is green, `npm run check:docs` is clean, and the whole-branch review has passed.

## Calls made without the developer (carried from the design, section 9)

Names `docs/testing-strategy.md`, `docs/test-plan.md`, `npm run check:task`; review sample of about one local task in three with always-review for rules, auth, sync and data; function-length and complexity limits on changed files only; two columns plus an escape-rate measure in `progress.md`; a plan check script; hand-listed breaks, no mutation library; probes run on every task in a folder the prompt does not mention; breaks only on code Vitest can reach; guidance and a ping script, not a model runner. Exact limits and formats are the builder's, set in the tasks below and marked **[my call]**.
