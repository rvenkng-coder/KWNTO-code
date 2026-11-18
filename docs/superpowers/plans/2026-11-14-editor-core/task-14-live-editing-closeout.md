# Task 14: Live editing end-to-end and close-out

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong
**Depends on:** Tasks 1 to 13

Design 8b asks for "two browsers editing the same node" end-to-end, and decision 0002 left two things unmeasured: the guard with more than two simultaneous writers, and the 409 path seen by a person. This task proves both, then closes the plan's paperwork.

**Files:**
- Create: `e2e/editor-live.spec.ts`
- Modify: `tests/rules/content-guard.rules.test.ts` (add C1), `docs/decisions/0002-realtime-spike.md` (a short "Production check, Plan 3" section with C1's result), `docs/test-plan.md`, `docs/superpowers/plans/README.md` (Plan 3 `done`; Plan 3 rows of "Carried over from Plan 2" removed; anything found and left out goes in a new "Carried over from Plan 3" table naming its plan), `docs/user/editor.md` (a short "Working together" section), `docs/README.md`

**Interfaces:**
- Consumes: everything earlier; `ownerWithProject` (Task 9); `TOO_BUSY` (Task 7); e2e helpers of Plan 2 for a second, verified member who joins by code.
- Produces: none.

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 14A: Many writers and two browsers

- [x] **Step 1: Write the failing tests:** C1 in `tests/rules/content-guard.rules.test.ts`; C2 to C5 in `e2e/editor-live.spec.ts` (two browser contexts, owner and member of one team, same project; wait for positive signals on both pages, never fixed sleeps).
- [x] **Step 2: Run** `npm run test:rules` and `npm run test:e2e -- e2e/editor-live.spec.ts`. Expected: the new tests FAIL or pass; any that pass at once must be shown to fail once by breaking the code they protect (for C2: send the PATCH without going through `guardedSave`), then restored.
- [x] **Step 3: Fix** whatever they found, with its own test at the lowest layer that can show it. If a fix would change a decision of this plan, stop and report.
- [x] **Step 4: Run** `npm test`. Run `e2e/editor-live.spec.ts` 10 times per browser (`--repeat-each=10`). Expected: PASS every time. **Close checkpoint 14A** (commit `test: live editing in two browsers`).

## Checkpoint 14B: Walk and close-out

- [x] **Step 5: Walk the Flow** below and record it in `progress.md`. **Done another way (2026-11-18):** the developer closed the plan without this walk. The screens it covers were since changed by the [editor tabs](../2026-11-18-editor-tabs/README.md) and [editor cards](../2026-11-18-editor-cards/README.md) plans, and their walks stand in for it:
  - the cards plan's 8-step Flow, walked by script in Firefox and Chromium, light and dark, including two browsers editing one node's choices
  - C2 to C5 of this task, which pass in both browsers
  
  **The developer's own walk (2026-11-18):** the developer went through the system with real writing in one browser and found nothing beyond the UI problems already on the roadmap. They signed off M1 and M2.

  **Still owed,** carried in the roadmap's "UI problems found after the editor cards plan": the same two-browser writing session in the other browser.

- [x] **Step 6: Update the docs** listed under **Files**: test-plan rows "Canvas and nodes", "Properties panel: script lines, cues, lighting notes", "Chapters" and "Look and feel" to `covered` with the layers that now have tests (M1 and M2 stay `open` until the developer signs them); the 0002 production-check section; the roadmap.
- [x] **Step 7: Run** `npm test` and `npm run check:docs`. Expected: PASS. **Close checkpoint 14B** (commit `docs: close the editor core plan`). The whole-branch review follows; it is not part of this task.

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | four writers on one node | rules | 10 rounds; four members at once update `title`, `color`, `x` and `y` of one node, each retrying on 409 as the door does | all four values kept every round; version +4 per round | tests/rules/content-guard.rules.test.ts :: four people editing one node at once all keep their change |
| C2 | same node, two browsers | e2e | page A types a new title while page B drags the same node, both committed within the same second | both pages show A's title and B's position, also after reload | e2e/editor-live.spec.ts :: two people editing one node both keep their change |
| C3 | a teammate's work appears live | e2e | B adds a line, adds a node and connects it, trashes another node | A shows each change without a reload | e2e/editor-live.spec.ts :: a teammate's edits appear without a reload |
| C4 | the retry runs out | e2e | A's page answers every node PATCH with 409 (`page.route`); A renames a node | banner `Could not save: too many people are editing this at once. Try again.`; title back to the old one; B never sees the new title | e2e/editor-live.spec.ts :: when saving keeps conflicting the person is told and nothing half-saves |
| C5 | a member removed from the team loses the project | e2e | owner removes the member while the member has the project open; member reloads | member sees the not-found text of Task 9; no content | e2e/editor-live.spec.ts :: a removed member can no longer open the project |
### Probes
**Probe folder:** none
### Breaks
none
### Flow
Superseded on 2026-11-18; see Step 5. The original Flow:

The developer's walk of design sections 6.1, 6.2, 6.3 and 6.6 in Firefox and Chromium, light and dark, with two browsers on one project for 10 minutes of real writing (two people, or one person in two windows). Record every surprise in `progress.md` and `findings.md`; each one is fixed in 14A's way or carried in the roadmap. Ask the developer to look at M1 and M2.
### Evidence
The full output of `npm run check:task`, the 10 × 2 repeat runs of `e2e/editor-live.spec.ts`, the break-once runs of Step 2, and the Flow record.
