# Task report: Task 2, checkpoint 2C (keyboard and labels)

Task file: docs/superpowers/plans/2026-11-14-editor-core/task-2-account-team-fixes.md
Built by: local (little-coder, sandbox `/tmp/kwento-local-task1-2C-20_06`, baseline `b747167`), no fix round
Controller: strong model session, graded 2026-11-14

## Commits on `feat/editor-core`

| Commit | What |
|---|---|
| cb9dd93 | `fix: account links are buttons`: C7 and C8 (`tests/lint/screens-a11y.test.ts`), C9 (`e2e/teams-polish.spec.ts`), Sign up, Sign in and Forgot password? as `link-button` buttons, `e2e/helpers/ui.ts`; from the sandbox with `git am --3way` |
| 516c1dc | `test: older e2e specs find account links as buttons`: controller commit, see below |

## Grading notes

- All 5 changed files were in "May touch" (the C9 test and the selector edits in `teams-polish.spec.ts` are the plan's step 12). The `backend` door and the visible texts are untouched.
- **Plan gap, not a model fault.** In the sandbox `check:task` failed on `layers` (e2e): 14 tests (7 per browser) in `accounts.spec.ts`, `teams-detail.spec.ts` and `verify-gate.spec.ts` still looked for Sign up and Sign in as links (8 lines). The plan allowed only `e2e/helpers/ui.ts`, so the model stopped there and left them failing. With the developer's agreement I changed those 8 lines as a separate commit: `getByRole('link')` to `getByRole('button')`, and `.first()` on the five Sign in clicks made right after sign-up (the confirmation and the "Already have an account?" line each have a Sign in button, so the locator was ambiguous). No assertion was added, removed or weakened. The plan's Files list was amended.
- Same kind of `.first()` in the model's `teams-polish.spec.ts` C4 (the Sign in button visible check); accepted for the same reason.
- Session log (56 tool calls): skill read first; test file written before the code; first run errored on a `glob` import, then the model rewrote it with `readdirSync`. After the first commit it ran `git stash` and `git checkout b747167 -- .` to compare with the baseline, then restored `938264c`; the sandbox ended clean and the patch is exactly that one commit. A `.pi/tasks` file was left out of the commit by the model.
- Controller checks of the tests (the failing run asked for in the Evidence section):
  - C7 fails on the 2B code (`frontend/src/features/auth` from `fb223ac`: `expected [ …(2) ] to deeply equal []`), passes on the new code.
  - C8 passes on the old code too: every `form-error` already had `role="alert"`, so it is a guard against regression, not a failing-first test. B1 (remove `role="alert"` in `SignInForm.tsx`) makes it fail at `SignInForm.tsx:52`; file restored.
  - C9 passes on links too (an `<a href="#">` is also tab-reachable), so it guards the keyboard path after the change.
- Review of the diff: clean (no bug found). Escaped 0.
- Probe-read result: no probe folder for this task; the only `tests/probes` mentions are in the prompt.

## `check:task` output (real checkout, after applying the patch and the selector commit)

```
> kwnto@0.0.0 check:task
> node scripts/check-task.ts --task docs/superpowers/plans/2026-11-14-editor-core/task-2-account-team-fixes.md --base fb223ac --built-by local

PASS plan
PASS lint
PASS typecheck
PASS unit
PASS layers: rules: not required by this task's test plan; e2e: passed; container: not required by this task's test plan
PASS hygiene
PASS quality: check:quality: ok
PASS coverage: 9 cases point at tests that exist
PASS breaks: run-breaks: 1 caught
PASS probes: the Test plan names no probe folder (none)
INFO review: Review required: yes (escape rate 1 is above 0.25; every local task is reviewed); escape rate 3 of 3 local tasks

check:task: PASS
```

## Not recorded here

- The full `npm run test:e2e` run on both browsers was done inside `check:task` (layers: e2e passed); its per-test list is not kept.
- Task 2 is complete after this checkpoint; Task 14 walks the screens by hand.
