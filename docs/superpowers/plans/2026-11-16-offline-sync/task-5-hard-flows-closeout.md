# Task 5: Hard flows and close-out

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong
**Depends on:** Tasks 1 to 4

Design 8b asks for "produce a conflict and confirm the keep-mine/keep-theirs prompt" end-to-end, and Review Focus 4 (two tabs) needs a browser to be believed. Then the paperwork: docs, the test plan, the roadmap, and the Funnel reconnect check the roadmap asks for.

**Files:**
- Create: `e2e/editor-conflicts.spec.ts`
- Modify: `docs/security.md` (section 7: offline edits built; section 10: D10's accepted risk), `docs/decisions/0002-realtime-spike.md` (a short "Plan 4" section: the reconnect signal found in Task 2 Step 1, and the Funnel check or that it moved to Plan 6), `docs/test-plan.md` (row "Offline queue, sync and conflicts" `covered`: unit, rules, e2e), `docs/superpowers/plans/README.md` (Plan 4 `done`; anything found and left out goes in a "Carried over from Plan 4" table naming its plan; if Funnel was not checked, add it to the Plan 6 outline), `docs/README.md` (link the new user section if it lists sections)

**Interfaces:**
- Consumes: everything earlier; `goOffline`, `goOnline` (Task 4); the Plan 3 e2e helpers for a second, verified member who joins by code; `ownerWithProject` (Plan 3 Task 9).
- Produces: none.

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 5A: Conflicts and two tabs in the browser

- [ ] **Step 1: Write the failing tests** C1 to C4 in `e2e/editor-conflicts.spec.ts` (two browser contexts for two people; two pages of one context for two tabs; wait for positive signals, never fixed sleeps).
- [ ] **Step 2: Run** `npm run test:e2e -- e2e/editor-conflicts.spec.ts`. Expected: the tests FAIL or pass; any that pass at once must be shown to fail once by breaking the code they protect (C1: make `classifyConflict` return `NO_CONFLICT` always; C4: grant the lock to every tab), then restored, and said so in the report.
- [ ] **Step 3: Fix** whatever they found, with its own test at the lowest layer that can show it. If a fix would change a decision of this plan, stop and report.
- [ ] **Step 4: Run** `npm test`, then `npm run test:e2e -- e2e/editor-conflicts.spec.ts e2e/editor-offline.spec.ts --repeat-each=10`. Expected: PASS every time. **Close checkpoint 5A** (commit `test: offline conflicts and two tabs in the browser`).

## Checkpoint 5B: Funnel check and close-out

- [ ] **Step 5: Funnel (manual, C5).** Ask the developer whether a Funnel host is available (the spike VM of decision 0002). If yes, walk C5 with them and record it in 0002. If not, record "not checked" and add it to the Plan 6 outline in the roadmap. Do not set up a host yourself (engineering 5: the server is ask-first).
- [ ] **Step 6: Walk the Flow** below and record it in `progress.md`.
- [ ] **Step 7: Update the docs** listed under **Files**.
- [ ] **Step 8: Run** `npm test` and `npm run check:docs`. Expected: PASS. **Close checkpoint 5B** (commit `docs: close the offline sync plan`). The whole-branch review follows; it is not part of this task.

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | keep mine | e2e | A and B on one project; A offline renames N1 to `Mine`; B renames N1 to `Theirs`; A online | A sees the dialog `Someone else changed this while you were offline` with `Title`, `Yours: Mine`, `Theirs: Theirs`; `Keep mine` → both pages show `Mine`, also after reload | e2e/editor-conflicts.spec.ts :: keep mine overwrites the teammate's change after asking |
| C2 | keep theirs | e2e | as C1, also A recolours N1 offline (B does not); A chooses `Keep theirs` | both pages show title `Theirs` and A's colour (the non-conflicting field was sent) | e2e/editor-conflicts.spec.ts :: keep theirs keeps their change and still saves my other edits |
| C3 | deleted line | e2e | A offline edits a line's text; B deletes that line; A online, `Keep mine` | heading `Someone else deleted this script line while you were offline`; after `Keep mine` the line is back on both pages with A's text | e2e/editor-conflicts.spec.ts :: a line deleted by a teammate can be brought back |
| C4 | two tabs | e2e | one person, two tabs on one project; offline; tab 1 renames N1, tab 2 recolours N2, tab 1 adds a line; online | each change is sent exactly once (count the POST and PATCH requests in both tabs); both tabs end showing all three; the server has all three | e2e/editor-conflicts.spec.ts :: two tabs of one browser send each waiting change once |
| C5 | reconnect through Funnel | manual | the app behind Funnel; drop the laptop's network for 10 s while a teammate edits; reconnect | the teammate's edit appears within a few seconds without a reload; edits made during the drop are saved | |
### Probes
**Probe folder:** none
### Breaks
none
### Flow
C5 above if a Funnel host exists. Then, in Firefox and Chromium, two people on one project for ten minutes: one switches the network off and on several times while both write; force at least one conflict of each kind (field, position, deleted line) and choose each answer once. Record every surprise in `progress.md` and `findings.md`; each is fixed in 5A's way or carried in the roadmap.
### Evidence
The full output of `npm run check:task`, the 10-times repeat run, the break-once runs of Step 2, and the Flow record (with C5's result or the note that it moved to Plan 6).
