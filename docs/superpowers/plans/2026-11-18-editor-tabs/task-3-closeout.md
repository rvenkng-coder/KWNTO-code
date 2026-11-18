# Task 3: Docs and close-out

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid
**Depends on:** Tasks 1 and 2

This task brings the docs in line with the new editor, records the later work, and runs the whole suite. The developer walks the editor.

**Files:**
- Modify:
  - `docs/user/editor.md`: the chapter tabs ("+", ▾ menu, "≡", rename by double-click) and adding nodes (button and double-click). Remove every mention of the left chapter list.
  - `docs/developer/editor.md`:
    - menus are portals placed by `menuPosition`
    - why a menu inside a scrolling strip must not be absolutely positioned
    - `canvasCommands` and `useAddNode`
  - `docs/superpowers/plans/README.md` (the roadmap):
    - Add a line under the plan table: "**Editor polish plan:** Editor tabs and Add node, status `done`", where the name links to `2026-11-18-editor-tabs/README.md`.
    - Remove the "Canvas width" row from "Carried over from Plan 3".
    - Add a "Later (developer decision, 2026-11-18)" table with two rows:
      - **Custom node colours (hex or RGB):** change `nodes.color` from an 8-value select to a validated hex text field, and pick black or white header text by contrast.
      - **Duplicate chapter:** copy nodes, lines, cues and connections, and decide what happens to cross-chapter links.
  - `docs/superpowers/plans/2026-11-18-editor-tabs/README.md`: the status cells.
  - `.planning/2026-11-18-editor-tabs/progress.md`

**Interfaces:** none

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 3A: Docs and the full run

- [x] **Step 3A.1: Update the docs** listed above. Run `npm run lint`, which includes the docs link check. Expect a PASS.
- [x] **Step 3A.2: Run `npm test`.** Expect a PASS, then run it a second time. If anything fails, stop and report; do not edit a failing test. Record both results in `progress.md`.
- [ ] **Step 3A.3: Hand the Flow below to the developer.** Record their result in `progress.md`. Mark the plan `done` only after they confirm.
- [ ] **Step 3A.4: Close the checkpoint** with one commit: `docs: close the editor tabs plan`.

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | the editor feels right to the developer | manual | the Flow below | the developer confirms | |
| C2 | docs match the screen | manual | read `docs/user/editor.md` beside the app | every control named in the doc exists, and none is missing | |
### Probes
**Probe folder:** none
### Breaks
none
### Flow
The developer, in Firefox and Chromium, light and dark:

1. Open a project and add three chapters with "+".
2. Rename one by double-click and one from its ▾ menu.
3. Move one left.
4. Close two tabs and reopen them from "≡".
5. Trash the open chapter.
6. Add nodes with `+ Add node` and by double-click.
7. Confirm that no menu is ever hidden.
### Evidence
The two `npm test` results, the full output of `npm run check:task`, and the developer's Flow result.
