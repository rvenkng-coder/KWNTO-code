# Task 4: The join-code e2e flake

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong
**Depends on:** none

Carried over from Plan 2 ("e2e flake"): `e2e/accounts.spec.ts :: wrong code and regenerate` failed once on Firefox (no error within 5 s) in about 7 full runs. This is a debugging task: use superpowers:systematic-debugging. **Never raise a timeout to hide it**, and never edit the test to make it pass unless the cause is shown to be in the test (then explain it in the commit and report, engineering.md section 3).

**Files:**
- Modify: whichever of `e2e/accounts.spec.ts`, `e2e/helpers/ui.ts`, `frontend/src/features/teams/*` or `frontend/src/backend/teams.ts` holds the cause (decided by Step 2's evidence)
- Create: `.planning/2026-11-14-editor-core/findings.md` entry "Task 4: join-code flake"

**Interfaces:** none

**If interrupted:** a stress run leaves only Playwright output under `test-results/`; delete nothing else.

## Checkpoint 4A: Reproduce, find the cause, fix

- [ ] **Step 1: Reproduce under load.** Run `npm run test:e2e -- e2e/accounts.spec.ts -g "wrong code and regenerate" --project=firefox --repeat-each=30 --workers=4`, then the same with `--workers=8`. Record the failure count of each run in `findings.md`. If 0 of 60 fail, add CPU load (a second run in parallel) and try once more before concluding.
- [ ] **Step 2: Find the cause** from a failing run's trace (`--trace=retain-on-failure`): which request was slow or out of order (the join response, the regenerate, the list refresh), and whether the error element was never rendered or rendered and replaced. Write the cause and the evidence in `findings.md`. Candidate classes to check (catalogue kinds `race-and-parallel`, `success-on-failure`): the regenerate's new code being typed before the regenerate response landed; a `list()` from an earlier action clearing `error` after the join failure set it (`useTeams.list` sets `error: null`).
- [ ] **Step 3: Write a test that fails deterministically** for that cause, if one can be made (for example a Playwright `page.route` that delays the regenerate response, or the list response, by 1 s). Run it; expected: FAIL.
- [ ] **Step 4: Fix the cause** in the code (or, only if the test is what races, in the test, with the reason in a comment).
- [ ] **Step 5: Verify.** The Step 3 test passes; Step 1's two stress runs give 0 failures; `npm run test:e2e` passes. **Close checkpoint 4A** (commit `fix: <the cause> in the join-code flow`).

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | wrong code then regenerate (existing test) | e2e | wrong code; regenerate; old code; new code | error for the wrong and old codes, join with the new | e2e/accounts.spec.ts :: wrong code and regenerate |
| C2 | the cause, made deterministic | e2e | the delay found in Step 2 | the error shows and stays | e2e/accounts.spec.ts :: wrong code error survives a slow response |
| C3 | stress | manual | Step 1 commands after the fix | 0 failures in 60 runs at 4 and at 8 workers | |
### Probes
**Probe folder:** none
### Breaks
none
### Flow
Step 1's two stress commands, before and after the fix, with the failure counts recorded in `findings.md`. If Step 3 cannot make the cause deterministic, C2's title is replaced by the closest deterministic test you could write, and the report says why.
### Evidence
The full output of `npm run check:task`, the before and after stress counts, and the `findings.md` entry.
