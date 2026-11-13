# KWNTO — Agent Quick Reference

KWNTO is a branching-narrative scriptwriting tool for game devs.
See the [design](docs/superpowers/specs/2026-11-11-kwnto-design.md) and [ERD](docs/superpowers/specs/2026-11-11-kwnto-erd.md) for the full spec.

## Read first

1. [Design](docs/superpowers/specs/2026-11-11-kwnto-design.md)
2. [ERD](docs/superpowers/specs/2026-11-11-kwnto-erd.md)
3. [Engineering principles](docs/engineering.md)
4. [Security rules](docs/security.md)
5. [Test strategy](docs/testing-strategy.md)
6. [Project test plan](docs/test-plan.md)
7. The roadmap and the current plan (see [plans/](docs/superpowers/plans/README.md); the current plan is the first one not marked `done`)

## Repo layout

| Path | Purpose |
|---|---|
| `src/features/` | React app code, grouped by feature |
| `src/backend/` | Only place that may import `pocketbase` |
| `backend/` | PocketBase image, migrations, hooks |
| `tests/rules/` | PocketBase access rule tests |
| `tests/container/` | Container hardening tests |
| `e2e/` | Playwright end-to-end tests |
| `scripts/` | TypeScript utility scripts (run with `node`) |
| `spike/` | Throwaway spikes (isolated from the app) |
| `docs/` | Design, engineering, security, developer guides |

## Commands

| Command | What |
|---|---|
| `npm test` | Full suite: lint, typecheck, unit, container, rules |
| `npm run test:unit` | Pure functions (Vitest, Node) |
| `npm run test:container` | Docker container hardening |
| `npm run test:rules` | PocketBase access rules (live instance) |
| `npm run test:e2e` | Playwright across Firefox + Chromium |
| `npm run lint` | ESLint + PERF comment check + docs link check + plan check |
| `npm run check:plan` | Task files of opted-in plans have a tier, Interfaces and a valid Test plan block |
| `npm run check:hygiene` | New tests have a header comment; nothing skipped or focused; no test or assertion lost against `main` |
| `npm run check:breaks -- <task.md>` | Applies each deliberate break in the task's Test plan and requires its unit tests to fail; restores the files |
| `npm run check:probes -- <folder>` | Runs a task's probe folder (the `probes` Vitest project); prints only each failing row and kind |
| `npm run check:quality` | Function length, complexity, nesting, parameter and console limits on files changed since `main` |
| `npm run report:escape-rate -- <progress.md>` | Share of local-model tasks with a problem found after close (fails on a malformed table) |
| `npm run report:quality` | The same limits over the whole repository, counts only, exit 0 |
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm run dev` | Vite dev server |
| `npm run dev:backend` | PocketBase in Docker |

## Hard rules

- **One door to the backend.** Only `src/backend/` imports `pocketbase`.
- **300 lines max per file.** Enforced by ESLint `max-lines`.
- **No `any`.** Justified exception needs a comment.
- **Deny by default.** PocketBase rules default to `null` (superusers only).
- **No new dependencies** without a decision record and developer approval.
- **Ask first** before pushing, deleting data, touching Docker volumes, or force-pushing.
- **Never merge to `main`.** Agents do not merge.
- **Never edit a failing test.** If a test fails, stop and explain why.
- **Prototype is reference only.** Do not copy code from `branching_narrative_tool.tsx`.

## Adding a collection

1. Write the migration file in `backend/pb_migrations/`.
2. Write `tests/rules/<name>.rules.test.ts` covering list/view/create/update/delete for anonymous, other user, owner, and injection.
3. If the rule is public (`""`), add it to `PUBLIC_RULES` in `tests/rules/helpers/coverage.ts` with a code comment citing the design section.

## Tracking and resuming

- Work in checkpoints. Close each with one commit.
- Track progress in `.planning/<date>-<plan>/progress.md`. Rows for tasks built by a local model carry three columns: **Built by** (`local` or `strong`), **Review** (`none`, `clean` or `found N`) and **Escaped** (problems found after the task closed, 0 if none). See [review sampling](docs/developer/review-sampling.md); `npm run report:escape-rate -- <progress.md>` prints the rate.
- To resume: `git worktree list`, switch to the worktree on `feat/foundation`, read `progress.md`, and continue from the last unticked step.
