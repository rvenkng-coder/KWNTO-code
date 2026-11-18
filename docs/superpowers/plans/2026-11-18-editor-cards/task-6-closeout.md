# Task 6: Docs and close-out

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid
**Depends on:** Tasks 1 to 5

This task brings the docs in line, records what moved to later plans, runs the whole suite twice and hands the walk to the developer.

**Files:**
- Modify:
  - **`docs/user/editor.md`:**
    - choices: writing them, Link, Re-link, Unlink, Delete, the "+" connector, and one choice per target
    - cues on cards
    - the tool strip and its shortcuts, including Cut
    - hiding the project panel
  - **`docs/developer/editor.md`:**
    - choice handles and `connectChoice`
    - link mode
    - `choicesOf` ordering (F1, F2)
    - the tool strip
    - `useLeftPanel`
  - **`docs/developer/backend.md`:** the `1794370200_open_choices.js` migration and why `to_node` has no cascade.
  - **`docs/test-plan.md`:** the "Canvas and nodes" and "Properties panel" rows name the new specs.
  - **`docs/superpowers/plans/README.md`:**
    - a line "**Editor cards plan:** Editor cards, choices and tools, status `done`", where the name links to `2026-11-18-editor-cards/README.md`
    - in Plan 9's outline, "Player Mode shows an empty choice as a dead end (editor cards plan)"
  - `docs/superpowers/plans/2026-11-18-editor-cards/README.md`: the status cells.
  - `.planning/2026-11-18-editor-cards/progress.md`

**Interfaces:** none

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 6A: Docs and the full run

- [ ] **Step 6A.1: Update the docs** listed above. Run `npm run lint`, which includes the docs link check. Expect a PASS.
- [ ] **Step 6A.2: Run `npm test` twice.** Expect a PASS both times. If anything fails, stop and report; do not edit a failing test. Record both results in `progress.md`.
- [ ] **Step 6A.3: Hand the Flow below to the developer.** Record their result. Mark the plan `done` only after they confirm.
- [ ] **Step 6A.4: Close the checkpoint** with one commit: `docs: close the editor cards plan`.

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | the editor works the way the developer wants | manual | the Flow below | the developer confirms | |
| C2 | docs match the screen | manual | `docs/user/editor.md` beside the app | every control named exists, and none is missing | |
### Probes
**Probe folder:** none
### Breaks
none
### Flow
The developer, in Firefox and Chromium, light and dark:

1. **Choices:** write a scene with three nodes. Give the first node two choices written before linking, then link them by drag and by Link. Re-link one, unlink one, and try a duplicate.
2. **Cues:** add cues and check the cards.
3. **Tools:** use each tool and read each tooltip, Cut and paste a node, then area-select two nodes and move them to the trash.
4. **Panels:** hide the project panel and reload.
5. **Two browsers:** edit choices in two browsers at once.
### Evidence
The two `npm test` results, the full output of `npm run check:task`, and the developer's Flow result.
