# Editor Cards, Choices and Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Choices become rows on the node card that may be empty and can be linked, re-linked and unlinked. Cues show on cards. A left tool strip holds Add node, Cut, Copy, Paste, Delete and Area select, with tooltips. The left panel collapses, the side panels scroll, and the editor gets the prototype's cleaner look.

**Architecture:**

- **Backend:** one migration makes `connections.to_node` optional, changeable within the project, and unique per node only when set.
- **The backend door** carries `toNodeId: string | null` and `created`.
- **The pure model** gains `choices.ts`, a `LinkedConnection` type and card data for choices and cues. Every reader of connections is checked against an empty target.
- **On the canvas**, each choice is its own source handle (`choice-<id>`), plus one `new-choice` handle per card.
- **Link mode, the tool strip state and the left panel's state** are small Zustand stores.

**Tech Stack:** PocketBase 0.40.6 (migrations, rules), `pocketbase` SDK, React 19, TypeScript, Zustand 5, `@xyflow/react` 12, Tailwind CSS 4, Vitest, Playwright. No new dependencies.

**Spec:** [Editor cards design](../../specs/2026-11-18-editor-cards-design.md). Also binding:

- the [Plan 3 router](../2026-11-14-editor-core/README.md) Global Constraints and decisions (D1 tokens, D7 and D8 markers, D11 clipboard, D12 shortcuts, D15 live events)
- [decision 0002](../../../decisions/0002-realtime-spike.md) (version guard)
- [decision 0003](../../../decisions/0003-canvas-performance.md) (3 s budget)
- [security.md](../../../security.md)

Executors read all of them.

**Standard:** test-plan-v1

## Global Constraints

Everything in the Plan 3 router "Global Constraints" still applies. The values this plan depends on:

- **Worktree:** branch `feat/editor-cards` in `../KWNTO-code-cards`, created from `feat/editor-tabs`. Progress is tracked in `.planning/2026-11-18-editor-cards/progress.md`.
- **Every task ends with:**

  ```
  npm run check:task -- --task docs/superpowers/plans/2026-11-18-editor-cards/task-<n>-<name>.md --base <sha at task start> --built-by strong
  ```

  Paste the full output in the report.
- **Migrations:**
  - The one new file is `backend/pb_migrations/1794370200_open_choices.js`.
  - `1794370100_nodes_lines_connections.js` is never edited.
  - No access rule becomes public.
- **Existing tests must keep passing unchanged,** except where the UI they drive moved:
  - `e2e/helpers/editor.ts` `connectNodes`: the source handle is now the card's `new-choice` handle.
  - `e2e/editor-add-node.spec.ts`: the hint is now the Add node tooltip.

  Any other failing test is stopped on and reported, never edited.
- **Copy, exactly:**

  | Where | Text |
  |---|---|
  | Duplicate choice message | `This node already has a choice to <title>.` (an untitled target reads `Untitled`) |
  | Link-mode banner | `Select a target node` |
  | Choice with no text | `Untitled` |
  | Choice status | `Linked → <target title>` / `Not linked` |
  | Cue tags | `Audio`, `Light`, `Other` |
  | Left panel tooltips | `Hide project panel` / `Show project panel` |

- **Tool strip tooltips,** where the shortcut text comes from `shortcutLabel`:

  | Button | Tooltip |
  |---|---|
  | Add node | `Add node (or double-click the canvas)` |
  | Cut | `Cut (Ctrl+X)` |
  | Copy | `Copy (Ctrl+C)` |
  | Paste | `Paste (Ctrl+V)` |
  | Delete | `Move to trash (Delete)` |
  | Area select | `Area select (or Shift+drag)` |

  On a Mac, `Ctrl+X` reads `⌘X`. Accessible names drop the part in brackets: `Add node`, `Cut`, `Copy`, `Paste`, `Move to trash`, `Area select`.
- **Every edit goes through `edits`,** so it is one undo step with the version guard:

  | Action | Undo label |
  |---|---|
  | Link | `Link choice` |
  | Unlink | `Unlink choice` |
  | Add | `Add choice` |
  | Delete | `Delete choice` |
  | Cut | `Cut` |

- **Styling:** theme tokens only (Plan 3 D1). New tokens go in `frontend/src/index.css`, in both light and dark. The prototype is reference only: match its look, never copy its code.

## Review Focus

These are the failure modes most likely to bite a person. Each is pinned by a test in the task named.

1. **Opening `to_node` leaks across projects.** Linking or re-linking a choice into another project, or changing `from_node` or `project`, must still be refused, and an outsider must not touch `to_node`. (Task 1 rule tests)
2. **An empty choice crashes a reader.** Markers, card data, edges, cross-chapter tags, copy and paste and the node picker must all treat `toNodeId === null` as "no link", not as a node id. (Task 1 unit tests; the type change makes TypeScript list every reader)
3. **A re-link or a teammate's edit reorders the choice list.** The order is by `created`, so it is stable under re-link, unlink, label edits and live updates. (Task 1 unit test; Task 2 e2e)
4. **A second link to the same target slips through.** This includes a drag, link mode, a re-link, a paste and the cross-chapter picker. The client refuses first with the message, and the unique index refuses at the server. (Tasks 1, 2 and 3)
5. **The extra rows and cues slow the canvas past 3 s at 500 nodes.** (Task 5 runs the performance spec alone, in both browsers)

## Decisions made in this plan (please review)

| # | Decision | Task |
|---|---|---|
| F1 | **A choice whose target is trashed** is hidden on the card and in the panel, as connections to trashed nodes are today. Restoring the target brings it back. Only a choice with no target at all is "empty". | 1 |
| F2 | **`created` is compared as text** after the mapper normalises PocketBase's `2026-11-18 10:00:00.000Z` to ISO `2026-11-18T10:00:00.000Z`. A choice made in this browser uses `new Date().toISOString()` until the server's copy arrives. Ties are broken by id. | 1 |
| F3 | **The duplicate message** uses the editor's existing error banner (`editorStore.setState({ error })`), with Dismiss. | 2 |
| F4 | **Paste is disabled until something is copied** in this tab. The store gains `hasClip: boolean`, set by copy and cut. | 4 |
| F5 | **Area select on** sets React Flow `selectionOnDrag` on and `panOnDrag` off. Off restores both. It is not remembered. | 4 |
| F6 | **The left panel's state** is kept in `localStorage` under the key `kwnto.leftPanel` (`shown` or `hidden`; anything else counts as shown). Every access is inside try/catch. | 4 |

## File structure

| Path | Responsibility |
|---|---|
| `backend/pb_migrations/1794370200_open_choices.js` | `to_node` optional, partial unique index, create and update rules |
| `tests/rules/connections.rules.test.ts` | Empty, link, re-link and unlink rules |
| `frontend/src/backend/content-types.ts`, `content-mappers.ts` | `toNodeId: string \| null`, `created`, editable `toNodeId` |
| `frontend/src/features/editor/model/choices.ts` | Pure: the choices of a node, duplicate check, new choice record |
| `frontend/src/features/editor/model/flow.ts` | Card data: choices, cues; edges from choice handles |
| `frontend/src/features/editor/canvas/NodeCard.tsx` | Choice rows with handles, cues, the "+" handle |
| `frontend/src/features/editor/canvas/linkMode.ts` | Link mode store and banner text |
| `frontend/src/features/editor/panel/Choices.tsx`, `ChoiceRow.tsx` | The panel's Choices section |
| `frontend/src/features/editor/canvas/ToolStrip.tsx`, `ToolButton.tsx`, `icons.tsx` | The left tool strip, tooltips, inline SVG icons |
| `frontend/src/features/editor/model/shortcutLabel.ts` | Pure: `Ctrl+X` or `⌘X` |
| `frontend/src/features/editor/useLeftPanel.ts` | Left panel shown or hidden, in this browser |

## Tasks

| # | Task | Tier | Depends on | Checkpoints | Status |
|---|---|---|---|---|---|
| 1 | [Empty choices: backend, door and model](task-1-empty-choices.md) | strong | none | 1A 1B | done |
| 2 | [Choices and cues on the card](task-2-card-choices.md) | strong | 1 | 2A 2B | done |
| 3 | [Choices in the panel and link mode](task-3-panel-choices.md) | mid | 2 | 3A | done |
| 4 | [Tool strip, Cut, left panel and scrolling](task-4-tool-strip.md) | mid | 1 | 4A 4B | done |
| 5 | [The cleaner look](task-5-look.md) | mid | 2, 3, 4 | 5A | not started |
| 6 | [Docs and close-out](task-6-closeout.md) | mid | 1 to 5 | 6A | not started |

**Status values:** `not started`, `in progress`, `awaiting review`, `done`. Run the tasks one at a time, in order.

If a task needs a name or signature that its **Interfaces** block does not list, stop and report it rather than guess.

**Closing a checkpoint** follows the Plan 1 router, "Rules while working": one commit, the ticked boxes, this table's Status cell and one `progress.md` row. Replace its `<date>-foundation` with `2026-11-18-editor-cards`.

## Done when

- `npm test` passes, and `npm run check:task` passed for every task.
- Every row above says `done`, `git status` is clean, and the developer has walked the Flow of Task 6.
- The roadmap records:
  - this plan as `done`
  - "Player Mode shows an empty choice as a dead end" in Plan 9's outline
- Agents do not merge or push.
