# Task report: Task 4, checkpoint 4A (join-code e2e flake)

Task file: docs/superpowers/plans/2026-11-14-editor-core/task-4-e2e-flake.md
Built by: strong (base `e852ba7`)

## Cause

`useTeams.list()` set `error: null` on success. `TeamsScreen`'s mount-time list (two calls under StrictMode) could land after a fast-failing join and wipe its error. Evidence, the trace timings and the stress counts are in [findings.md](../findings.md), "Task 4: join-code flake".

## Changes

- `frontend/src/features/teams/useTeams.ts`: `list()` leaves `error` alone; `create`, `remove` and `join` clear `error` when they start.
- `e2e/accounts.spec.ts`: new test `wrong code error survives a slow response` (C2). It failed in both browsers before the fix (error shown, then gone after the delayed list) and passes after. The existing test (C1) is unchanged.

## Stress (C3)

| Run | Before | After |
|---|---|---|
| firefox, 30 repeats, 4 workers | 1 failed | 0 failed |
| firefox, 30 repeats, 8 workers | 1 failed | 0 failed |

Full `npm run test:e2e` after the fix: 52 passed.

## `check:task` output

```
> kwnto@0.0.0 check:task
> node scripts/check-task.ts --task docs/superpowers/plans/2026-11-14-editor-core/task-4-e2e-flake.md --base e852ba7 --built-by strong

PASS plan
PASS lint
PASS typecheck
PASS unit
PASS layers: rules: not required by this task's test plan; e2e: passed; container: not required by this task's test plan
PASS hygiene
PASS quality: check:quality: ok
PASS coverage: 3 cases point at tests that exist
PASS breaks: run-breaks: no breaks listed
PASS probes: the Test plan names no probe folder (none)
INFO review: Review required: no (built by a strong model; the plan's own per-task review applies); escape rate 4 of 5 local tasks

check:task: PASS
```
