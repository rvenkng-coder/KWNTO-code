# Task report: Task 1, checkpoint 1A (hash routes)

Task file: docs/superpowers/plans/2026-11-14-editor-core/task-1-shell-theme-routes.md
Built by: local (little-coder, sandbox `/tmp/kwento-local-task1-1A-12_37`, baseline `ab95a69`), then one fix round
Controller: strong model session, graded 2026-11-14

## Commits on `feat/editor-core`

| Commit | What |
|---|---|
| ff52dc3 | `feat: hash routes` (routes.ts, routes.test.ts), from the sandbox with `git am --3way` |
| 54f7a8a | `fix: reject extra segments after a project chapter` (fix round 1), same way |
| ccb3d73 | `test: probes for task 1 (hash routes)`: 19 probes, rows C1 to C7, written by the controller |

## Grading notes

- Round 1 (the model's first run): its own `check:task` showed FAIL coverage and FAIL probes, which it called expected. Coverage C8 to C11 is (later checkpoints); probes was not: the folder did not exist yet.
- The controller found a bug by running `parseRoute` on edge inputs: `#/project/<id>/chapter/<id>/extra` returned a project route (`parts.length >= 4`). The model's own tests had not tried extra segments on a project route. Counted as Escaped 1.
- Fix round: the model added 2 tests first (1 failed for the right reason), then changed `>= 4` to `=== 4`, one new commit, no amend.
- Probes before the fix (at 58669e7): `FAIL C3`, `FAIL C4` (both `relative-of-fixed-case`), 17 of 19 passed. After: 19 of 19.
- Session log of the fix round: skill read; the only mentions of `tests/probes` are in the prompt, the plan file and the `check:task` output, no read of the folder.
- Two runs started from the controller's shell stalled (no session file, GPU idle, slots empty); the successful run was started from the developer's own terminal.

## `check:task` output (real checkout, after applying the patch and adding the probes)

```
> kwnto@0.0.0 check:task
> node scripts/check-task.ts --task docs/superpowers/plans/2026-11-14-editor-core/task-1-shell-theme-routes.md --base 78a468b --built-by local

PASS plan
PASS lint
PASS typecheck
PASS unit
PASS layers: rules: not required by this task's test plan; e2e: passed; container: not required by this task's test plan
PASS hygiene
PASS quality: check:quality: ok
FAIL coverage
PASS breaks: run-breaks: 1 caught
PASS probes: probes: 19 of 19 passed
INFO review: Review required: no (not in the sample (1 in 3)); no .planning/2026-11-14-editor-core/progress.md; escape rate 0

FAIL coverage:
  C8: test file frontend/src/backend/preferences.test.ts does not exist or cannot be read
  C9: test file e2e/shell.spec.ts does not exist or cannot be read
  C10: test file e2e/shell.spec.ts does not exist or cannot be read
  C11: test file e2e/shell.spec.ts does not exist or cannot be read

check:task: FAIL (1 steps)
```

The one `FAIL coverage` is C8 to C11, which belong to checkpoints 1B and 1C. Verdict for checkpoint 1A: accepted.

## Not recorded here

- The Task 1 Evidence section also asks for the failing run of B1 and the Flow record. `check:task` shows `1 caught` for B1 but its failing output was not saved. The Flow (sign up, theme, 1280 and 390 px) belongs to checkpoints 1B and 1C.
- The review line printed `no .planning/.../progress.md` because the file did not exist when the check ran; it was created afterwards.
