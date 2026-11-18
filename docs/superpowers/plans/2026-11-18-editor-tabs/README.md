# Editor Tabs and Add Node Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**

- Make the chapter tab bar work like draw.io's page tabs: "+", a ▾ menu per tab, and "≡" for all chapters.
- Make the tab menus visible above the canvas.
- Replace the left chapter list with an "Add node" button.

**Architecture:** front-end only, with no backend change.

- **Menus:** they render through a React portal into `document.body`, at a fixed position computed by a pure `menuPosition` function. A scrolling tab strip can then no longer clip them.
- **Add node:** the canvas registers an "add node" command in a small Zustand store. The left panel's button calls it.

**Tech Stack:** React 19 (`createPortal`), TypeScript, Zustand 5, `@xyflow/react` 12, Tailwind CSS 4, Vitest, Playwright. No new dependencies.

**Spec:** [Editor tabs design](../../specs/2026-11-18-editor-tabs-design.md). Also binding:

- [engineering.md](../../../engineering.md)
- [testing-strategy.md](../../../testing-strategy.md)
- the [Plan 3 router](../2026-11-14-editor-core/README.md) Global Constraints and decision D10 (closable, resizable tabs)

Executors read all of them.

**Standard:** test-plan-v1

## Global Constraints

Everything in the [Plan 3 router](../2026-11-14-editor-core/README.md) "Global Constraints" still applies. The values this plan depends on:

- **Worktree and branch:**
  - The branch is `feat/editor-tabs`, in the sibling folder `../KWNTO-code-tabs`, created from `feat/editor-core`. Plan 3 is not merged into `main` yet.
  - Progress is tracked in `.planning/2026-11-18-editor-tabs/progress.md`.
- **Every task ends with:**

  ```
  npm run check:task -- --task docs/superpowers/plans/2026-11-18-editor-tabs/task-<n>-<name>.md --base <sha at task start> --built-by strong
  ```

  Paste the full output in the report.
- **Backend:** no backend, migration or rule change. Chapter edits go through the existing `chapterActions.ts` (`addChapter`, `renameChapter`, `trashChapter`, `shiftChapter`). Node creation goes through `edits.create('nodes', …)`.
- **Accessible names that existing e2e specs rely on stay the same:**
  - `Add chapter` (now the "+" button)
  - `Menu for <title>`
  - `Move left`
  - `Move right`
  - `Move to trash`
  - `Close <title>`
  - `Chapter title` (the rename box)
  - `Resize tab`

  Only `e2e/editor-chapters.spec.ts` changes, because the left chapter list it drives is removed. Each changed line must drive the same behaviour through the new place.
- **Copy, exactly:**
  - the trash confirm is `Move "<title>" to the trash?` (unchanged)
  - the button is `Add node`, shown as `+ Add node`
  - the hint is `or double-click the canvas`
  - the "≡" button and its menu are named `All chapters`
  - each tab's menu is named `Chapter menu`
- **Styling:** theme tokens only (Plan 3 D1). No inline colour.
- **No new dependencies.** There is no popover library: a portal does the job.

## Review Focus

These are the failure modes most likely to bite a person. Each is pinned by a test in the task named.

1. **A menu opened near the window's right or bottom edge stays fully inside the window.** It flips above the tab when there is no room below. (Task 1, `menuPosition` unit tests)
2. **A menu never sits under the canvas or React Flow controls.** Every item is the topmost element at its own centre, so a click reaches it. (Task 1 e2e)
3. **Trashing the open chapter from its tab menu shows its neighbour**, not an empty canvas. (Task 1 e2e)
4. **Clicking "Add node" twice without moving the view does not stack two nodes exactly on top of each other**, which would look like one node. The second node goes 40 px right and down. (Task 2, `freeSpot` unit tests and e2e)
5. **"Add node" is disabled when no chapter is open** (every tab closed) instead of failing silently. (Task 2 e2e)

## Decisions made in this plan (please review)

| # | Decision | Task |
|---|---|---|
| E1 | **Menus close** on Escape, on a pointer press outside the menu, on window resize and on any scroll (capture listener). Closing on scroll is simpler than following the anchor. | 1 |
| E2 | **Renaming a tab:** double-click its title, or choose Rename in its menu. Both open the same `Chapter title` box (`InlineText`, made controllable). | 1 |
| E3 | **The "≡" list** shows every live chapter in order. The open chapter is marked `aria-current="true"`. A click reopens a closed tab and switches to it. | 1 |
| E4 | **A new node from the button** has its top-left corner at the centre of the visible canvas. If a live node of that chapter already sits at exactly that point, it steps 40 px right and down until the spot is free. The new node is then selected. Double-click keeps its current behaviour: the node goes at the pointer and is not selected. | 2 |

## File structure

| Path | Responsibility |
|---|---|
| `frontend/src/features/editor/chapters/menuPosition.ts` | Pure: where a menu goes, given its anchor, its size and the window |
| `frontend/src/features/editor/chapters/Popover.tsx` | Portal menu: positioning and the closing rules (E1) |
| `frontend/src/features/editor/chapters/TabMenu.tsx` | A tab's ▾ menu: Rename, Move left, Move right, Move to trash |
| `frontend/src/features/editor/chapters/AllChaptersMenu.tsx` | "≡": every chapter, reopens closed tabs |
| `frontend/src/features/editor/chapters/ChapterTabs.tsx` | The strip: ≡, tabs (title, ▾, ×, resize), + |
| `frontend/src/features/editor/chapters/InlineText.tsx` | Gains controlled editing and a `tab` role |
| `frontend/src/features/editor/chapters/ChapterList.tsx` | Deleted |
| `frontend/src/features/editor/canvas/newNode.ts` | Pure: new node record, free spot |
| `frontend/src/features/editor/canvas/canvasCommands.ts` | The "add node" command the canvas registers |
| `frontend/src/features/editor/EditorScreen.tsx` | Left panel: Back to teams, project name, Add node, hint |

## Tasks

| # | Task | Tier | Depends on | Checkpoints | Status |
|---|---|---|---|---|---|
| 1 | [Draw.io-style tab bar](task-1-tab-bar.md) | mid | none | 1A 1B | in progress |
| 2 | [Add node button](task-2-add-node.md) | mid | 1 | 2A 2B | not started |
| 3 | [Docs and close-out](task-3-closeout.md) | mid | 1, 2 | 3A | not started |

**Status values:** `not started`, `in progress`, `awaiting review`, `done`. Run the tasks in order: Tasks 1 and 2 both change `EditorScreen.tsx`.

If a task needs a name or signature that its **Interfaces** block does not list, stop and report it rather than guess.

**Closing a checkpoint** follows the Plan 1 router, "Rules while working": one commit holding the code and docs, the ticked boxes, this table's Status cell and one new `progress.md` row. Replace its `<date>-foundation` with `2026-11-18-editor-tabs`.

## Done when

- `npm test` passes, and `npm run check:task` passed for every task, with its output in the reports.
- Every row above says `done`, `git status` is clean, and the developer has walked the Flow of Task 3.
- The roadmap shows this plan as `done`:
  - "Canvas width" is removed from "Carried over from Plan 3".
  - "Custom node colours" and "Duplicate chapter" are listed as later work.
- Agents do not merge or push.
