# Editor tabs and Add node: design (short)

Date: 2026-11-18. Status: approved by the developer. Builds on Plan 3 (editor core), branch `feat/editor-tabs` from `feat/editor-core`.

## Intent

The developer finds the editor hard to work in:

- **Hidden node creation.** Adding a node is only possible by double-clicking empty canvas, and nothing says so.
- **Chapter controls in two places.** They are split between the left panel (rename, trash, add) and the tab strip (a menu with Move left and Move right).
- **Unreadable tab menu.** The tab menu opens hidden under the canvas.

The goal is a chapter tab bar that works like draw.io's page tabs, a visible way to add a node, and a usable editor width.

## Goals

1. **Full window when a project is open.** No 1024 px cap, and the canvas fills the window height. This is already built and is carried over uncommitted from `feat/editor-core`. It closes the roadmap item "Canvas width".
2. **The tab bar at the top works like draw.io's page tabs:**
   - **"+" at the end of the tabs** adds a chapter and opens it.
   - **Each tab has a ▾ menu** with Rename, Move left, Move right and Move to trash. Move to trash keeps the existing confirm.
   - **Double-clicking a tab's name** renames it in place.
   - **"≡" at the start of the bar** lists every chapter, including closed tabs, and opens the one clicked. The left chapter list is the only way to reopen a closed tab today, and this replaces it.
   - Resizing and closing tabs (D10) stay as they are.
3. **Tab menus and the "≡" list are fully visible above the canvas.**
   - The bug: the tab strip is `overflow-x-auto`, which also clips vertically, so the absolutely positioned menu is cut off inside the 30 px strip.
   - The fix: the menus render outside the scrolling strip, in a layer positioned at the button that opened them. The strip keeps its horizontal scroll.
4. **The left panel loses the chapter list and its buttons.** It keeps Back to teams and the project name, and gains:
   - **"+ Add node":** creates a node at the centre of the visible canvas and selects it, so the properties panel opens.
   - **A hint below the button:** "or double-click the canvas".

```
┌ left panel ──────┐ ┌ ≡ │ Chapter 1 ▾ × │ Chapter 2 ▾ × │ + ─────┐ ┌ right ┐
│ Back to teams    │ │ Undo  Redo  Hide minimap                  │ │ props │
│ Story            │ │                                            │ │       │
│ [+ Add node]     │ │              canvas                        │ │       │
│ or double-click  │ │                                            │ │       │
│ the canvas       │ │                                            │ │       │
└──────────────────┘ └────────────────────────────────────────────┘ └───────┘
```

## Non-goals

- **Moving the chapter tabs to the bottom.** The developer decided against it and they stay at the top.
- **Custom node colours (hex or RGB).** This goes on the roadmap as later work. It needs the `color` field to change from an 8-value select to a validated hex text field, and the header text to switch between black and white so it stays readable.
- **Duplicate chapter.** This also goes on the roadmap as later work. It means copying every node, line, cue and connection, and deciding what happens to cross-chapter links.

## Anti-goals

- **No chapter action may become unreachable.** That covers add, rename, move, trash and reopening a closed tab.
- **A menu must never again open where it cannot be seen or clicked.**

## Constraints

- **Hard rules from AGENTS.md apply:**
  - one door to the backend
  - 300 lines per file
  - no `any`
  - no new dependencies (no popover library, so use a React portal)
  - never edit a failing test
- **Backend:** no change. These are front-end changes only. The existing chapter actions (`chapterActions.ts`) and node creation (`createAt` in `Canvas.tsx`) are reused.
- **Tests that drive the left chapter list move to the tab bar.** The reason is that the UI moved; a test is never changed to hide a failure.
- **The deadline is the last week of November 2026**, so this stays small.

## Approaches

There was one sensible approach: rework the existing `ChapterTabs` and the left panel in place. The alternatives were dropped for these reasons:

- **Bottom tabs:** the developer declined them.
- **A new tool palette:** not asked for.
- **A popover dependency:** this would need a decision record, and a portal does the job.

## Calls left to the builder

- **Menu keyboard behaviour.** Esc closes a menu, and so does a click outside it.
- **How a new node is placed.** It goes at the centre of the visible canvas, converted to flow coordinates, using the same path as a double-click.
- **Visual details:**
  - the exact styling of the tab bar and the "+", "▾" and "≡" buttons
  - the wording of the hint, as long as it names the double-click
