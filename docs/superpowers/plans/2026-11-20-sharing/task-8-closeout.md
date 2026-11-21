# Task 8: Close-out

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid
**Depends on:** Tasks 1 to 7 (or 1 to 5 if D1 moved 6 and 7)

Design 8: documentation is part of done, and the developer signs off from the manual checklist. This task brings the shared documents up to date and walks the whole plan once in both browsers.

**Files:**
- Modify: `docs/test-plan.md` (rows "Trash and recovery", "Share links", "Project JSON import and export" `covered` with their layers and spec files; a new row `Comments and presence | 5 | rules, unit, e2e | covered | 7`), `docs/security.md` (section 2: the links as built and the D2 grant; section 5: XSS and bad imports built, with the tests named; section 7: the purge; section 10: anything accepted here, at least "an author who lost access can still delete their own comment"), the ERD (status of `share_links`, `link_grants`, `comments`, `presence`), `docs/superpowers/plans/README.md` (Plan 7 `done`; the Plan 3 and 4 carry-overs marked; a "Carried over from Plan 7" table for what was left out, at least Plan 4's smaller review findings per D15), `docs/user/editor.md` and `docs/user/sharing.md` (read through once for anything stale), `.planning/2026-11-20-sharing/progress.md`

**Interfaces:** none

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 8A: Docs and the walk

- [x] **Step 1: Walk the Flow** below in Firefox and Chromium and record each step in `progress.md`. *(Not done by hand: the developer accepted the scripted walk, `e2e/sharing-flow.spec.ts` (case C2), on both browsers as the evidence for C1 on 2026-11-21 and will polish the screens later.)*
- [x] **Step 2: Update the docs** listed under **Files**.
- [x] **Step 3: Run** `npm test` and `npm run check:docs`. Expected: PASS. **Close checkpoint 8A** (commit `docs: close the sharing plan`). The whole-branch review follows; it is not part of this task.

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | the plan end to end | manual | the Flow below, in Firefox and Chromium | every step behaves as the user docs say (waived 2026-11-21: the developer accepted case C2 as the evidence) | |
| C2 | the Flow, scripted | e2e | the Flow below through the screens (only the seed story is made through the admin API), in Firefox and Chromium | every step behaves as the Flow says | e2e/sharing-flow.spec.ts :: the sharing plan end to end: export, links, comments, presence, revoke and trash |
### Probes
**Probe folder:** none
### Breaks
none
### Flow
With three accounts (owner, member, outsider) and one browser without an account: the owner makes a project with two chapters, a cross-chapter choice and an image; exports it and imports it into a second team; makes a live view link, a snapshot link, a comment link and an edit link; the person without an account opens the view and snapshot links (media plays); the outsider opens the comment link (signs in, comments) and the edit link (edits; the owner sees it live and the presence badge); the member comments and deletes their comment; the owner revokes every link and each holder's next action is refused; the member trashes a node and a chapter and restores them; the owner trashes and restores the project. Record what you saw in `progress.md`.
### Evidence
The full output of `npm run check:task` and the Flow record.
