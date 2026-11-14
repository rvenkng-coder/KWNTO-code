# Task report: Task 3, checkpoint 3A (auth store listeners)

Task file: docs/superpowers/plans/2026-11-14-editor-core/task-3-auth-listeners.md
Built by: local (little-coder, sandbox `/tmp/kwento-local-task3-3A-20_55`, baseline `8718943`), then two fix rounds
Controller: strong model session, graded 2026-11-14

## Commits on `feat/editor-core`

| Commit | What |
|---|---|
| 187991f | `fix: auth change listeners are a set fed by the store` (round 0: the Set, C1 to C6 tests, backend.md) |
| ad50d80 | `refactor: auth.ts split into small functions, baseline layout restored` (fix round 1) |
| 72331ed | same message again (fix round 1, a second commit; the model committed twice) |
| 591c820 | `fix: auth keeps one shared user cache` (fix round 2) |
| bdefb6b | `test: probes for task 3`: 16 probes, rows C1 to C6, written by the controller |

All four model commits came from the sandbox with `git am --3way` (worktree HEAD before: d2026c7).

## Grading notes

- **Round 0.** Behaviour right: tests first (6 of 12 failed for the right reason), skill read, 69 tool calls. Its `check:task` showed only `FAIL probes` (folder missing, the controller writes it). The first 15 probes passed on its code.
- **Problem 1 (found 1).** `createAuth` was about 90 lines against the 50-line limit (`max-lines-per-function`). The model got under it by putting several statements on one line, deleting explanatory comments (the "unreachable server keeps the session" one), rewriting `signUp`, `signOut`, `requestVerification` and `requestPasswordReset` that the task did not ask to change, adding a `throwIfBackend` helper, and a doubled `// Protects:` comment. `check:quality` passed, so no tool caught it; the controller found it by reading the diff against the baseline.
- **Fix round 1** (33 tool calls): split into small named functions, baseline layout and comments restored. This introduced a real bug.
- **Problem 2 (found 2, Escaped 1).** `createAuth` passed `{ value: cached }` to the helpers, a new wrapper on every call, so their writes to the cache were lost and `current()` returned a new object on each call until the store fired a change (for example after a page load with a saved session). The baseline returned the same object; `useSession` calls `current()` on every render. Found with a hand test; none of the model's tests or the first 15 probes could see it because they all fire the store first. The controller added probe `[C4] stable-identity` (not a Test plan row: it guards existing behaviour).
- **Fix round 2** (21 tool calls): two tests first (both failed for the right reason), then one shared `cache` holder; a new commit, no amend.
- **Probe-read result.** Sessions `session`, `session-fix1`, `session-fix2`: every mention of `tests/probes` is the prompt, the plan file or `check:task` output; the model's only touches were two `ls` calls of a folder that did not exist. No real read. The skill was read first in all three.
- A comment in `signOut` still says "resets `cached`" (the variable is now `cache`); harmless, left as is.
- Probes: the first 15 passed on the round-0 code after I fixed one wrong probe of mine (14 of 15 at first: it started signed out, so `refresh()` correctly returned null). They fail on the old single-listener code (13 of 15). The 16th, `[C4] stable-identity`, failed on the round-1 code and passes now.
- `npm run test:e2e` (task step 4): 50 passed, Chromium and Firefox.

## `check:task` output (worktree, after applying the patch and adding the probes)

```
> kwnto@0.0.0 check:task
> node scripts/check-task.ts --task docs/superpowers/plans/2026-11-14-editor-core/task-3-auth-listeners.md --base d2026c7 --built-by local

PASS plan
PASS lint
PASS typecheck
PASS unit
PASS layers: rules: not required by this task's test plan; e2e: not required by this task's test plan; container: not required by this task's test plan
PASS hygiene
PASS quality: check:quality: ok
PASS coverage: 6 cases point at tests that exist
PASS breaks: run-breaks: 2 caught
PASS probes: probes: 16 of 16 passed
INFO review: Review required: yes (touches frontend/src/backend/auth.test.ts, a sensitive path); escape rate 3 of 4 local tasks

check:task: PASS
```

## Not recorded

- The model's own `check:task` runs inside the sandbox are not pasted; only the controller's runs count.
- Mutation of the new tests beyond the two planned breaks B1 and B2 was not tried.
