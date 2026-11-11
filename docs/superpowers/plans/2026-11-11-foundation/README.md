# Foundation and Real-Time Spike Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the KWNTO repo (web app shell, PocketBase container, three test layers, guardrail checks, CI) and run the throwaway real-time test that the data model depends on.

**Architecture:** One npm package at the repo root holds the React app (`src/`), the PocketBase image and migrations (`backend/`), and the tests (`tests/`, `e2e/`). PocketBase runs in Docker for development and tests; the web app reaches it on the same origin (Vite proxies `/api` in development), and only `src/backend/` may import the PocketBase SDK. The real-time spike lives in `spike/realtime/`, isolated from the app, and ends in a written go/no-go decision.

**Tech Stack:** React, TypeScript (strict), Vite, Tailwind CSS, Zustand, `@xyflow/react`, PocketBase v0.40.6 (Docker), `pocketbase` JS SDK, Vitest, Playwright (Firefox and Chromium), ESLint, GitHub Actions, gitleaks.

**Spec:** [KWNTO design](../../specs/2026-11-11-kwnto-design.md) and [ERD](../../specs/2026-11-11-kwnto-erd.md). Also binding: [engineering.md](../../../engineering.md) and [security.md](../../../security.md). Executors read all four.

## Where this plan sits

The design covers several subsystems, so it is split into one plan per subsystem. Each later plan is written when the one before it lands, because the spike in Task 3 can change the data model.

| # | Plan | Design build step |
|---|---|---|
| **1** | **Foundation and real-time spike (this plan)** | 1 (start) |
| 2 | Accounts, teams and settings tables (sign-up, verification, password rules, lockout, block and lockdown, security log, teams, join code, invites) | 1 |
| 3 | Editor core (projects, chapters, canvas, nodes, connections, properties panel, search, undo/redo, copy/paste, multi-select, minimap, themes) | 1 |
| 4 | Offline queue, sync and conflicts | 1 |
| 5 | Media upload, quota and strict file checks | 1 |
| 6 | Deployment (Compose, Caddy, Tailscale Funnel, backups, runbook) | 1 |
| 7+ | Trash, share links, comments, presence; export; Player Mode; analytics | 2 to 5 |

## Global Constraints

- **Cost: zero.** Nothing that needs a paid plan or paid service.
- **Dependencies:** never add one that is not listed under "Dependencies approved by this plan" below. If a task seems to need another, stop and give the developer options (engineering.md section 4).
- **Ask the developer first** before pushing to any remote, deleting files or data, changing a migration that has already run, or touching the server or Docker volumes other than the test and spike volumes this plan creates. Agents never merge to `main`.
- **Work in a git worktree** on branch `feat/foundation` (superpowers:using-git-worktrees).
- **Tracking:** before Task 1, create `.planning/<date>-foundation/` with `task_plan.md` pointing at this router, `progress.md` and `findings.md`, and commit it. These files are committed with every checkpoint (see "Surviving interruptions").
- **Browsers:** desktop Firefox and Chrome, current versions.
- **Strict TypeScript.** No `any`; a justified exception uses `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- <reason>`.
- **Files are 300 lines or fewer.** Group files by feature under `src/features/<feature>/`.
- **One door to the backend:** only files under `src/backend/` import `pocketbase`.
- **Deny by default:** a PocketBase rule of `null` (superusers only) is the default; `""` (public) is allowed only when named in `PUBLIC_RULES` (Task 5).
- **Tests are documented:** each test has a comment or title saying what behavior it protects and why. Never edit a failing test to make it pass.
- **The prototype `branching_narrative_tool.tsx` is reference only.** Copy no code from it.
- **Secrets never in git.** `.env` is gitignored; `.env.example` holds names only. There is no default admin password.
- **Docs are part of done:** every script, setting and command a task adds is documented in the same task.
- **Node 22** (`.nvmrc` contains `22`); scripts in `scripts/` are TypeScript run directly with `node` (built-in type stripping).
- **Ports:** dev PocketBase `8090`, test PocketBase `8091`, spike PocketBase `8092`, Vite dev `5173`, Vite under Playwright `5174`.
- **Model tier** is on each task: **strong**, **mid** or **local-OK** (design section 8c).

### Dependencies approved by this plan

Named by the design: `react`, `react-dom`, `typescript`, `vite`, `tailwindcss`, `zustand`, `@xyflow/react`, `vitest`, `@playwright/test`, `eslint`.

**Not named by the design, needed here (my call; approving this plan approves them, all MIT or Apache-2.0, all free):** `pocketbase` (official JS SDK), `@vitejs/plugin-react`, `@tailwindcss/vite`, `typescript-eslint`, and what the Vite `react-ts` template adds (`eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals`, `@types/*`). Tools, not npm packages: Docker, gitleaks. Task 1 records all of these in `docs/decisions/0001-toolchain.md`.

## Review Focus

Conditions the design implies that are most likely to bite, each pinned by a test in the task named:

1. **A container update must never reset data or the admin password.** Restarting PocketBase on an existing volume with a different `KWNTO_ADMIN_PASSWORD` keeps the original password and records. (Task 2)
2. **Starting without admin credentials must fail loudly, not create a default admin.** (Task 2)
3. **A new collection with a public (`""`) rule or with no rule test must fail the build**, including view collections and collections added by later plans. (Task 5)
4. **Running rule or end-to-end tests when PocketBase is down, or when a crashed run left a stale container, must give one clear message or self-heal**, not a wall of timeouts. (Task 5)
5. **Real-time delivery behind a proxy and after a dropped connection.** Events missed while a browser is offline are not replayed; the spike must record this so the sync plan refetches on reconnect. (Task 3)

## Tasks

This file is the router. Each task lives in its own file and is split into checkpoints. An implementer reads this file and their one task file, nothing else from the plan. Run tasks in number order unless the "Depends on" column lets two run side by side.

| # | Task | Tier | Depends on | Checkpoints | Status |
|---|---|---|---|---|---|
| 1 | [App scaffold and toolchain](task-1-scaffold.md) | local-OK | none | 1A 1B 1C | not started |
| 2 | [PocketBase container with one-time admin bootstrap](task-2-pocketbase-container.md) | strong | 1 | 2A 2B 2C 2D | not started |
| 3 | [Real-time spike and go/no-go decision](task-3-realtime-spike.md) | strong | 2 | 3A 3B 3C 3D | not started |
| 4 | [Guardrail lint rules and the PERF comment check](task-4-lint-guardrails.md) | mid | 1 | 4A 4B | not started |
| 5 | [Backend rule-test harness and deny-by-default check](task-5-rule-test-harness.md) | strong | 2 | 5A 5B 5C 5D | not started |
| 6 | [The backend door and the end-to-end harness](task-6-backend-door-e2e.md) | mid | 1, 5 | 6A 6B | not started |
| 7 | [Docs check, secret scan and the GitHub workflow](task-7-ci-docs-secrets.md) | mid | 4, 6 | 7A 7B 7C | not started |
| 8 | [AGENTS.md, README and developer guide](task-8-agents-readme.md) | local-OK | 7 | 8A 8B | not started |

**Status values:** `not started`, `in progress (2B closed)`, `awaiting review` (all checkpoints closed, reviewer has not passed it), `done` (reviewer passed it).

Names and signatures shared between tasks are in each task file's **Interfaces** block. If a task needs something from another task that its Interfaces block does not list, stop and report it; do not open the other task file and guess.

## Surviving interruptions

A session can end at any moment: the internet drops, usage runs out, or the context fills. The plan is built so that the most that can be lost is one unfinished checkpoint, and so that any session or model can pick up with nothing but the repo.

### Rules while working

1. **A checkpoint is the unit of work.** It is a handful of steps that ends with a verification command and a commit. An implementer may be given a whole task or a single checkpoint; a small-context local model should be given one checkpoint at a time.
2. **Closing a checkpoint is one commit** that holds all four of these together, so they can never disagree:
   - the code and docs the checkpoint produced;
   - the ticked step boxes (`- [x]`) in the task file;
   - this router's Status cell, for example `in progress (2B closed)`;
   - one new line in `.planning/<date>-foundation/progress.md`: date, checkpoint, the verification output in a few words, and the next action.
3. **A checkpoint closes only when its verification passes.** Tick a step's box when the step is done, but commit only at the close.
4. **Never start a checkpoint with uncommitted changes** from the one before.
5. **If you have to stop before the close** (usage or context running low, or you are blocked): commit what exists as `wip(2B): <what works, what does not>`, without changing the Status cell, and write the failing command and the next action in `progress.md` in that same commit. A `wip` commit on this branch is fine; the developer reviews the branch, not each commit.
6. **Git is the record.** Do not rely on chat history, a todo list, or memory of an earlier session. If it is not in a commit or the working tree, it did not happen.
7. **Every step is safe to run again.** Scripts in this plan clear their own leftovers before starting. If you write a step that is not safe to repeat, say so in the task's "If interrupted" list.

### Resuming (any session, any model)

1. Find the work: `git worktree list`, then change into the worktree on branch `feat/foundation`. If there is none, the plan has not started: create it and begin at Task 1.
2. Read the Status column above. The first task that is not `done` is the current one. `awaiting review` means: send it to a reviewer, do not re-implement it.
3. Run `git status --short` and `git log --oneline -5`, and read the last lines of `progress.md`.
4. Read the current task file's "If interrupted" list and do any clean-up it names.
5. Then, depending on what step 3 showed:

| Working tree | Last commit | Do this |
|---|---|---|
| Clean | a checkpoint close | Start the next checkpoint at its first unticked step. |
| Clean | `wip(...)` | Read the next action in `progress.md` and continue that checkpoint. |
| Has changes | anything | The session ended mid-checkpoint. **Do not discard or stash the changes.** Read `git diff`, then run the checkpoint's verification command. If it passes, close the checkpoint. If it fails, continue from the first step whose result is missing or broken. If the changes make no sense to you, stop and report to the developer. |

6. Before writing new code, run the verification command of the last closed checkpoint. If it fails, the environment changed (a container is still running, dependencies are missing); fix that first, using the "If interrupted" list.

### What needs the internet

Only these. Everything else works offline once they are done.

| Where | What | If offline |
|---|---|---|
| Checkpoint 1A | `npm install`, Playwright browser download | Stop; nothing later can start. |
| Checkpoint 2A | Base image pull and PocketBase download during the first image build | Stop; Tasks 3, 5 and 6 need the image. Task 4 can go ahead. |
| Task 7, Step 8 | `npm audit` | Note it in `progress.md` as still to run, and carry on. |
| Task 3, Step 6 | The run through Tailscale Funnel | The developer's step; never blocks. |
| After the plan | The first GitHub workflow run | Happens when the developer pushes. |

## Done when

- `npm test` passes on a clean clone with Docker running.
- `docs/decisions/0002-realtime-spike.md` says GO or NO-GO with numbers, and the Funnel run is done or explicitly waiting on the developer.
- Every row in the task table says `done`, no step box is unticked, and `git status` is clean.
- A whole-branch review of `feat/foundation` is complete and the developer has reviewed the branch. Agents do not merge or push.
