# Task report: Task 14 (live editing end-to-end and close-out)

Task file: docs/superpowers/plans/2026-11-14-editor-core/task-14-live-editing-closeout.md
Built by: strong. Graded 2026-11-16.

## What was built

- C1 in `tests/rules/content-guard.rules.test.ts`: four members, 10 rounds, `title`, `color`, `x`, `y` of one node at once.
- `e2e/editor-live.spec.ts`, C2 to C5: the owner and a member who joined by code, each in their own browser context, on one project.
- A fix for a bug the two-browser tests found (below), with a rule test.
- Docs: decision 0002 "Production check, Plan 3", test-plan rows, roadmap (Plan 3 `done`, "Carried over from Plan 3"), user guide "Working together", `backend.md` warning, docs index.

## Things to review

1. **A teammate's new node never appeared live (fixed).** All 8 e2e tests first failed at the same step: page B never showed a node page A made. A rule test with two doors (no browser, no Vite proxy) showed the member received node updates but no node creates, while chapter, line and connection creates arrived. Cause: the D7 hook in `projects.pb.js` moved the node's insert into its own transaction (`e.app = txApp; e.next()`), and PocketBase 0.40.6 then sends no realtime create event. The new rule test `a teammate's new records arrive as create events` failed first; the hook now calls `e.next()` first and sets the start node in a transaction after it. **Trade-off:** the node and the start-node update are no longer one transaction; if the second part fails the node stays and the project shows "No start node" (D7's existing state). D7 itself (first node becomes start; two at once cannot both win) is unchanged, and its rule test passes. Please confirm this is acceptable.
2. **`backend.md` recommended that pattern.** It now says the wrap costs the create event. Teams and projects still use it (nobody subscribes to those creates); carried to Plan 7.
3. **C2 is made deterministic** with `page.route`: B's PATCH is held until A's title save has answered, so B's save always meets a 409 and only `guardedSave`'s retry saves it.
4. **C1 and the version check:** with only `AND version = {:version}` removed, C1 still passes (per-field copy onto a freshly read record), as Task 5 found. It fails when the guard is a plain whole-record update.

## Break-once runs (Step 2)

Each failed in both browsers, then the code was restored (`git status` clean of the change):

| Case | Break | Failure |
|---|---|---|
| C1 | guard as a plain whole-record update | round 1 lost fields |
| C2 | `content.update` sends one PATCH without `guardedSave` | B shows the error banner |
| C3 | remote `nodes` updates ignored | trashed node still on A |
| C4 | failed save not rolled back | card keeps `New title` |
| C5 | project collections' rules opened to any signed-in user | no not-found text |

## Repeats (Step 4)

`e2e/editor-live.spec.ts --repeat-each=10`: Chromium 40 of 40, Firefox 40 of 40.

## npm test

After 14A: unit 581, container 5, rules 186, e2e 108, all pass.

After 14B's docs: **`npm test` fails 2 of 2 runs, on one test only**: `editor-performance.spec.ts` "a 500-node chapter opens within budget" in Firefox, 3,367 and 3,085 ms against the 3,000 ms budget (Chromium 1,719 ms). Everything else passes (unit 581, container 5, rules 186, e2e 107 of 108).

- Alone (`--workers=1 --repeat-each=3`): 1,158, 1,244 and 1,240 ms, as in Tasks 12 and 13.
- Full e2e without the four new live tests: 2,540 and 2,519 ms, pass. With them: 3,101 ms, fail.
- So the new two-browser tests (two contexts each) add enough load beside the performance test under four workers to push it past the budget. No product code on the load path changed in this task (only the `nodes` create hook on the server, which the timing does not cover).

The test is not changed (rules: never edit a failing test). **Developer decision (2026-11-18): run it alone.** `playwright.config.ts` leaves the spec out of `chromium` and `firefox` and runs it in `perf-chromium`, then `perf-firefox`, after both (Playwright `dependencies`). If any other test fails, Playwright skips the two perf projects. After the change: full e2e twice 108 of 108 (Firefox 1,203 and 1,187 ms, Chromium 738 and 726 ms); `npm test` passes (unit 581, container 5, rules 186, e2e 108; Firefox 1,189 ms). `testing.md` and decision 0003 give the command to run it alone (`--project perf-chromium --project perf-firefox --no-deps`).

## Flow (Test plan)

**Not walked.** The flow is the developer's own walk (two browsers, 10 minutes of real writing, light and dark, both browsers) and the look of M1 and M2. Step 5 stays unticked until the developer walks it.

## check:task output (`--base df26d25 --built-by strong`, after the config change)

```
PASS plan
PASS lint
PASS typecheck
PASS unit
PASS layers: rules: passed; e2e: passed; container: not required by this task's test plan
PASS hygiene
PASS quality: check:quality: ok
PASS coverage: 5 cases point at tests that exist
PASS breaks: run-breaks: no breaks listed
PASS probes: the Test plan names no probe folder (none)
INFO review: Review required: no (built by a strong model; the plan's own per-task review applies); escape rate 5 of 8 local tasks
check:task: PASS
```
