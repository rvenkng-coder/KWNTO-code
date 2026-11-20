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

- [x] **Step 1: Write the failing tests** C1 to C4 in `e2e/editor-conflicts.spec.ts` (two browser contexts for two people; two pages of one context for two tabs; wait for positive signals, never fixed sleeps).
- [x] **Step 2: Run** `npm run test:e2e -- e2e/editor-conflicts.spec.ts`. Expected: the tests FAIL or pass; any that pass at once must be shown to fail once by breaking the code they protect (C1: make `classifyConflict` return `NO_CONFLICT` always; C4: grant the lock to every tab), then restored, and said so in the report.
- [x] **Step 3: Fix** whatever they found, with its own test at the lowest layer that can show it. If a fix would change a decision of this plan, stop and report.
- [x] **Step 4: Run** `npm test`, then `npm run test:e2e -- e2e/editor-conflicts.spec.ts e2e/editor-offline.spec.ts --repeat-each=10`. Expected: PASS every time. **Close checkpoint 5A** (commit `test: offline conflicts and two tabs in the browser`).

## Checkpoint 5B: Funnel check and close-out

- [x] **Step 5: Funnel (manual, C5).** Ask the developer whether a Funnel host is available (the spike VM of decision 0002). If yes, walk C5 with them and record it in 0002. If not, record "not checked" and add it to the Plan 6 outline in the roadmap. Do not set up a host yourself (engineering 5: the server is ask-first).
- [x] **Step 6: Walk the Flow** below and record it in `progress.md`.
- [x] **Step 7: Update the docs** listed under **Files**.
- [x] **Step 8: Run** `npm test` and `npm run check:docs`. Expected: PASS. **Close checkpoint 5B** (commit `docs: close the offline sync plan`). The whole-branch review follows; it is not part of this task.

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | keep mine | e2e | A and B on one project; A offline renames N1 to `Mine`; B renames N1 to `Theirs`; A online | A sees the dialog `Someone else changed this while you were offline` with `Title`, `Yours: Mine`, `Theirs: Theirs`; `Keep mine` → both pages show `Mine`, also after reload | e2e/editor-conflicts.spec.ts :: keep mine overwrites the teammate's change after asking |
| C2 | keep theirs | e2e | as C1, also A recolours N1 offline (B does not); A chooses `Keep theirs` | both pages show title `Theirs` and A's colour (the non-conflicting field was sent) | e2e/editor-conflicts.spec.ts :: keep theirs keeps their change and still saves my other edits |
| C3 | deleted line | e2e | A offline edits a line's text; B deletes that line; A online, `Keep mine` | heading `Someone else deleted this script line while you were offline`; after `Keep mine` the line is back on both pages with A's text | e2e/editor-conflicts.spec.ts :: a line deleted by a teammate can be brought back |
| C4 | two tabs | e2e | one person, two tabs on one project; offline; tab 1 renames N1, tab 2 recolours N2, tab 1 adds a line; online | each change is sent exactly once (count the POST and PATCH requests in both tabs); both tabs end showing all three; the server has all three | e2e/editor-conflicts.spec.ts :: two tabs of one browser send each waiting change once |
| C6 | position conflict | e2e | A offline drags N1 right; B drags N1 down; A online | the dialog shows `Position` once with `Yours` and `Theirs`; `Keep theirs` leaves B's position on the server | e2e/editor-conflicts.spec.ts :: a node moved by both sides asks about its position once |
| C7 | refused choice | e2e | A offline links a choice from N1 to N2; B links N1 to N2 online; A online | A's change is taken back, listed as failed (`Show`, `Dismiss`); both pages show one choice | e2e/editor-conflicts.spec.ts :: a choice refused by the unique pair index lands in the failed list |
| C5 | reconnect through Funnel | manual | the app behind Funnel; drop the laptop's network for 10 s while a teammate edits; reconnect | the teammate's edit appears within a few seconds without a reload; edits made during the drop are saved | |
### Probes
**Probe folder:** none
### Breaks
none
### Flow
C5 above if a Funnel host exists. Then, in Firefox and Chromium, two people on one project for ten minutes: one switches the network off and on several times while both write; force at least one conflict of each kind (field, position, deleted line) and choose each answer once; offline, link a choice to a node a teammate links to from the same card meanwhile (the unique pair index refuses it: it must land in the failed list with the server's message). Watch for the card re-mount loop carried from Plan 3 (roadmap, "Carried over from Plan 3"): if a card keeps re-mounting after a chapter switch, save a Playwright trace or the browser's performance recording before anything else, and record it in `findings.md`. Record every surprise in `progress.md` and `findings.md`; each is fixed in 5A's way or carried in the roadmap.
### Evidence
The full output of `npm run check:task`, the 10-times repeat run, the break-once runs of Step 2, and the Flow record (with C5's result or the note that it moved to Plan 6).

### Record (2026-11-20)
- **5A:** C1 to C4 and the added C6 and C7 pass on Chromium and Firefox; both offline specs 10 times each (280 of 280); `npm test` exit 0. Break-once: `classifyConflict` always `NO_CONFLICT` fails C1 and C2 (C3 still passes: a deleted line comes from the server's 404); the lock granted to every tab fails C4. Found and fixed, each with a lower-layer test red first: `Keep theirs` dropped the fields that did not conflict; the engine's background storage errors were unhandled; after a reconnect the subscription was opened in parallel with the load, so a save could fall between them; my own saves that landed while a project was loading were lost to an older load.
- **C5 (Funnel):** run on 2026-11-20 on the dev machine through `tailscale serve` (tailnet only, not the public address): passed, and it found that a proxy answering a bare 404 was read as a missing record (fixed). The public address stays to confirm once in Plan 6 (test-plan M12). Details in [decision 0002](../../../decisions/0002-realtime-spike.md).
- **Flow:** the ten-minute two-person walk was not done by a person; the e2e specs cover field, position and deleted-line conflicts, the refused choice, two tabs, a stopped backend and a proxy outage. Carried in the roadmap ("Carried over from Plan 4"). No card re-mount was seen.

