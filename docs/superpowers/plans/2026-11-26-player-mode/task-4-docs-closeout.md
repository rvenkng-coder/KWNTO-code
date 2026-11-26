# Task 4: The whole flow, docs and closeout

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid
**Depends on:** Task 3

**Files:**
- Create: `e2e/player-flow.spec.ts`, `docs/user/player.md`
- Modify: `docs/user/editor.md` (a link to the player guide), `docs/user/sharing.md` (view and comment links can be played), `docs/developer/editor.md` (a short "Player Mode" section: `story.ts`, `session.ts`, the media hook each host passes, the frozen story), `docs/test-plan.md`, `docs/superpowers/plans/README.md`, `docs/superpowers/plans/2026-11-26-player-mode/README.md` (task statuses), `.planning/2026-11-26-player-mode/progress.md`; any file under `frontend/src/features/player/` a failing case here shows is wrong (fix it, never the test)

**Interfaces:**
- Consumes: the helpers of `e2e/helpers/editor.ts` (`ownerWithProject`, `addNodeAt`, `connectNodes`, `card`), `e2e/helpers/share.ts` (`makeLink`) and `e2e/helpers/player.ts` (`openPlayer`); the way `e2e/editor-panel.spec.ts` types a node title and a script line in the properties panel.
- Produces: none

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 4A: the whole flow, by hand

- [ ] **Step 1: Write the test** `e2e/player-flow.spec.ts` (C1). Unlike Tasks 2 and 3 it seeds nothing through the admin API: everything is made in the app, so the editor's own start-node rule, choice creation and labels are what the player reads.
- [ ] **Step 2: Run**: `npm run test:e2e -- e2e/player-flow.spec.ts`. It covers code Tasks 2 and 3 built, so it may already pass; if it fails, fix `frontend/src/features/player/` (never the test) and keep the failing run for the report.
- [ ] **Step 3: Run, expect PASS**: `npm run test:e2e -- e2e/player-flow.spec.ts e2e/player.spec.ts e2e/player-share.spec.ts`. Commit `test: the whole Player Mode flow`.

## Checkpoint 4B: docs and closeout

- [ ] **Step 1: Write the docs.**
  - `docs/user/player.md`: opening the player (`Play` in the title bar, and on a view or comment link); it starts at the start node; choices, `Back`, `Restart`, `History`, `Close` and Escape; what it shows (title, lines, images, audio and video) and what it hides (cues, lighting notes, comments, links); an unlinked choice and what its note means; `The End`; chapter names; the story is read when the player opens, so close and open it to see new edits; nothing is saved or recorded; a project with no start node (how to set one: the node's panel); media that cannot load shows `Media removed`.
  - `docs/user/editor.md` and `docs/user/sharing.md`: one sentence and a link to the guide each.
  - `docs/developer/editor.md`: the "Player Mode" section named above.
- [ ] **Step 2: Update the records.**
  - `docs/test-plan.md`: the Player Mode row becomes `covered` for unit and e2e with the test files (`story.test.ts`, `session.test.ts`, `shareStory.test.ts`, `e2e/player.spec.ts`, `e2e/player-share.spec.ts`, `e2e/player-flow.spec.ts`) and says manual M3 is `open`; M3's text stays, with `open`.
  - `docs/superpowers/plans/README.md`: row 9 links this plan with status `awaiting developer review`; the Plan 9 outline says "detailed plan" with the link. Remove nothing from the carried-over tables.
  - This plan's README: every task `done`.
  - `.planning/2026-11-26-player-mode/progress.md`: one row per checkpoint, from `docs/superpowers/plans/PROGRESS-TEMPLATE.md`.
- [ ] **Step 3: Run**: `npm test` (lint, typecheck, unit, container, rules) and `npm run test:e2e` in both browsers. Report any failure with its output; do not edit a failing test.
- [ ] **Step 4: Close the checkpoint (one commit)** `docs: Player Mode guide and records`. Then list for the developer, in the report, the one manual item left: **M3**, with the Flow below.

## Test plan

### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | a story made by hand plays for the author and for a guest | e2e | an owner signs up, makes a project, adds two nodes, types the titles `Start` and `Finish` and a line in each (`Mara`, `Ready?` and `Done.`), connects `Start` to `Finish`, sets the choice text to `Go on`; clicks `Play` and `Go on`; then makes a view link and opens it in a fresh context and plays the same path | the author sees `Start` with the line `Ready?` and the choice `Go on`, then `Finish`, `Done.` and `The End`; the guest sees the same two screens; the first node needed no start-node setting | e2e/player-flow.spec.ts :: a story made by hand plays for its author and for a guest |
| C2 | the transitions look right | manual | the Flow below | M3 signed off in Firefox and Chromium | none |

### Probes
**Probe folder:** `none`

### Breaks
none

### Flow
**M3, done by the developer in Firefox and in Chromium** (the transitions are judged by eye):
1. Open a project with at least three nodes, two of them in different chapters, linked by choices. Click `Play`.
2. The first screen fades in. Click a choice: the next node slides in from the right. Click `Back`: it slides in from the left. Click `Restart`: it fades in.
3. Check at normal speed that nothing flickers, jumps or shows two nodes at once, and that audio from the node you left has stopped.
4. In the system settings turn on "reduce motion" (or `prefers-reduced-motion`) and repeat: the screens change with no movement.
5. Open a view link of the same project in a private window and repeat steps 2 and 3.
6. Mark M3 `done` with the date in `docs/test-plan.md`, naming the browsers.

### Evidence
The full output of `npm run check:task`, of `npm test` and of the e2e run.
