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

- [x] **Step 6A.1: Update the docs** listed above. Run `npm run lint`, which includes the docs link check. Expect a PASS.
- [x] **Step 6A.2: Run `npm test` twice.** Expect a PASS both times. If anything fails, stop and report; do not edit a failing test. Record both results in `progress.md`.
- [ ] **Step 6A.3: Hand the Flow below to the developer.** It gathers every walk Tasks 2 to 5 left to the developer, so no other task's Flow is walked separately. Record their result per step in `progress.md`, including their ruling on step 7. Anything they reject becomes a fix (with its own failing test) or a roadmap line, as they choose. Mark the plan `done` only after they confirm.
- [ ] **Step 6A.4: Close the checkpoint** with one commit: `docs: close the editor cards plan`.

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | the editor works the way the developer wants | manual | the Flow below, steps 1 to 6 and 8 | the developer confirms | |
| C2 | docs match the screen | manual | `docs/user/editor.md` beside the app | every control named exists, and none is missing | |
| C3 | the reload order of an undone delete is ruled on | manual | Flow step 7 | the developer accepts it or asks for a fix | |
### Probes
**Probe folder:** none
### Breaks
none
### Flow
The developer walks this in Firefox and in Chromium, in light and in dark mode, with the hosted prototype open beside the editor. It replaces the Flows of Tasks 2 to 5.

1. **Choices on the card (Task 2):**
   - Write a scene with three nodes.
   - Give the first node five choices: two empty, one to a node in another chapter, and two linked by dragging from the "+" dot.
   - Every line leaves from its own row. The cross-chapter choice has no line: its row shows a `→ <chapter>: <title>` tag, and clicking the tag jumps there.
   - Re-link one by dragging its dot to another node, then drag the card around: the lines follow their rows.
   - Drag a second choice to a target the node already has: the message `This node already has a choice to <title>.` shows and nothing changes.
2. **Choices in the panel (Task 3):**
   - Write three choices before any target exists, then link them one by one, some with Link and some by dragging.
   - Unlink one (it reads `Not linked`, keeps its text and loses its line), then Re-link it.
   - Start Link and cancel it with Escape, then again with a click on empty canvas.
   - A start node with only empty choices shows `End`.
3. **Cues:** add an audio, a light and an other cue, and then a fourth. The card shows the first two with their tags and a count of the rest.
4. **Tools (Task 4):**
   - Hover and Tab to each tool in the strip and read its tooltip.
   - Use each tool by mouse and by keyboard (Tab to the strip, then Enter).
   - Cut a node and paste it, then undo twice.
   - Area-select two nodes and move them to the trash.
5. **Panels (Task 4):**
   - Hide the project panel, reload, and check it is still hidden. Show it again.
   - Fill a node with many lines, cues and choices, and scroll each side panel. The page itself never scrolls.
6. **The look (Task 5):** compare cards, panels, the tool strip and tooltips with the prototype, in both themes.
7. **Known limit, for a ruling:** delete the middle of three choices and undo. It comes back in its place. Reload, and it is now last, because PocketBase sets `created` itself (pinned by the rules test `a client cannot set the created time of a choice`). The developer accepts this for now or asks for a fix.
8. **Two browsers:** edit choices of the same node in two browsers at once. Each sees the other's changes, and the order matches in both.

### Evidence
The two `npm test` results, the full output of `npm run check:task`, and the developer's Flow result.
