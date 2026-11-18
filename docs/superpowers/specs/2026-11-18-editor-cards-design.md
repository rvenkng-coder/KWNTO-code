# Editor cards, choices and tools: design

Date: 2026-11-18. Status: draft for the developer's approval. Builds on `feat/editor-tabs` and is built on branch `feat/editor-cards` in `../KWNTO-code-cards`.

## Intent

The developer compared the editor with the original prototype (`branching_narrative_tool.tsx`) and found it harder to read and use.

**Choices are hidden.**
- A node's choices (the connections leaving it) only show as lines.
- Their text can only be edited by clicking a line.
- A choice cannot exist before it points somewhere.
- In the prototype, a choice is a labelled row on the card with its own connector. It can be written first and linked later, and the choices decide where the story goes.

**Cues are invisible on the canvas.**
- Cues (audio, lighting, other) exist, but only the properties panel shows them.

**The panels do not scroll, and the tools are hidden.**
- The side panels grow with their content instead of scrolling.
- Cut does not exist. Copy, paste, delete and area select are keyboard-only (area select is Shift+drag), with nothing on screen to say so.
- Add node is a large text button.

**The look is heavy.** The prototype's cleaner look (soft rounded cards, quiet panels, small uppercase section labels) is wanted.

The deadline is still the last week of November 2026.

## Goals

**1. Choices on the card, and a choice may be empty (developer decision).**

**Data.** A choice is still a `connections` record, but its target (`to_node`) becomes optional:
- An empty choice has text and no target, like the prototype's "Empty".
- **Link** gives it a target, **Re-link** changes the target, and **Unlink** empties it again.
- The choice keeps its id, its text and its place in the list throughout.

**On the card:**
- Each choice of a node is a row, linked or not, in the order the choices were created. There is no cap: the card grows with its choices.
- The row shows the choice text, or `Untitled` in muted text when it has none.
- Each row has its own connector dot on the right edge. A linked choice's line leaves from that dot. An empty choice's dot is hollow and has no line.

**Linking from the card:**
- **A choice's dot:** dragging from it to a node links the choice, or re-links it if it was already linked.
- **The "+" connector:** below the rows, a "+" on the card's right edge makes a new choice when dragged to a node. It is created already linked, with empty text.

**Choices to another chapter** show their target as the existing cross-chapter tag (`→ Chapter 2: The Door`), and clicking it jumps there. No line is drawn.

**The properties panel** of a node gets a **Choices** section, listed in the same order as the card. Each choice has:
- its text box (saved per attribute)
- a status: `Linked → <target title>` or `Not linked`
- **Link** (or **Re-link**), which starts link mode for that choice. A banner says `Select a target node`, and Esc or a click on empty canvas cancels.
- **Unlink**, shown only when the choice is linked
- **Delete**

Below the list:
- **Add choice:** creates an empty choice at once and focuses its text box.
- The existing "Link to a node in another chapter" action.

**One choice per target.** A node cannot have two choices that lead to the same node (developer decision). Any number of empty choices is allowed. A drag, link or re-link that would make a duplicate shows `This node already has a choice to <title>.` and changes nothing.

**Markers.** An empty choice is not an outgoing link:
- a node whose choices are all empty is marked **End**
- an empty choice never makes another node reachable

**The selected-connection panel** (`ConnectionFields`) stays as it is.

**2. Cues on the card.**
- Under the script preview, show up to 2 cues, each prefixed by its type (`Audio`, `Light`, `Other`) in the accent colour, then `+N more` if there are more.
- Cues are for the crew. Player Mode still does not show them (design 6.4).

**3. Panels and the tool strip.**

**Scrolling.** The left panel, the canvas column and the right panel each fill the window height. Each side panel scrolls on its own, and the page itself never scrolls.

**The left panel collapses (developer decision).**
- A panel button at the far left of the tab bar, before "≡", hides or shows the left panel (Back to teams, project name).
- Its tooltip is `Hide project panel` or `Show project panel`.
- The canvas takes the freed width.
- The state is remembered in this browser (`localStorage`, read and written inside try/catch, with "shown" as the default).
- The right properties panel is always shown.

**The tool strip.** A narrow vertical strip at the right edge of the canvas, always visible, holds icon buttons in this order:
- **Add node:** the existing command, moved here as a small icon (developer decision). The text button and hint in the left panel go.
- **Cut:** a new action. It copies the selected nodes and moves them to the trash as one undo step.
- **Copy**
- **Paste**
- **Delete:** moves the selected nodes to the trash.
- **Area select:** a toggle. While it is on, dragging on empty canvas draws a selection box instead of panning.

**Button state.** Cut, Copy and Delete are disabled with nothing selected. Paste is disabled with an empty clipboard.

**Tooltips.** Each button shows its tooltip on hover and on keyboard focus. The tooltip carries the shortcut:

| Button | Tooltip |
|---|---|
| Add node | `Add node (or double-click the canvas)` |
| Cut | `Cut (Ctrl+X)` |
| Copy | `Copy (Ctrl+C)` |
| Paste | `Paste (Ctrl+V)` |
| Delete | `Move to trash (Delete)` |
| Area select | `Area select (or Shift+drag)` |

On a Mac, `Ctrl` reads `⌘`. Each button's accessible name is its tooltip text without the part in brackets.

**Keyboard.** `Ctrl/⌘+X` becomes a shortcut, with the same text-field rule as the other shortcuts (decision D12).

**4. The cleaner look.**

- **Node cards:**
  - larger radius
  - a soft shadow
  - a header tinted with the node colour
  - roomier padding
  - script preview at a smaller size
  - choice rows as small pill labels
- **Panels:**
  - section headings as small uppercase muted labels (`SCRIPT`, `CUES`, `CHOICES`)
  - quieter secondary buttons
  - consistent spacing
- **Tokens only.** Everything comes from the theme tokens (Plan 3 D1). New tokens may be added, for example `--radius-lg` and `--shadow-card`, with the same care in light and dark.
- **Prototype is reference only (AGENTS.md).** Match the look; do not copy its code.

## Non-goals

- **Notes or comments.** These stay in Plan 7.
- **Reordering choices.** This would need a sort field.
- **Player Mode's handling of an empty choice.** That is Plan 9, which shows it as a dead end, as the prototype does. It is recorded on the roadmap.
- **Custom node colours and duplicate chapter.** Both are already on the roadmap as later work.
- **A new icon or tooltip library.** Icons are hand-written inline SVG in one file, and the tooltip is a small component of our own.

## Anti-goals

- **No hidden feature.** Every action in the strip still works by keyboard, and every shortcut is named on screen.
- **No connector a person cannot tell apart.** Each choice row's dot lines up with its own row.
- **No back door.** Opening `to_node` must not allow a choice into another project, a change of `from_node` or `project`, or an update without the version guard.
- **No slowdown at 500 nodes.** The 3 s budget of decision 0003 must still hold in both browsers.

## Constraints

- **AGENTS.md hard rules:**
  - one door to the backend
  - 300 lines per file
  - no `any`
  - no new dependencies
  - never edit a failing test
  - deny by default
  - ask before pushing
- **Backend: one new migration**, `backend/pb_migrations/1794370200_*`. The Plan 3 migration file is never edited after it has run. The migration does four things:
  - **`to_node` becomes optional,** with no cascade delete: purging a target node (Plan 7) leaves an empty choice instead of deleting it.
  - **The unique pair index applies only to linked choices:** `CREATE UNIQUE INDEX … ON connections (from_node, to_node) WHERE to_node != ''`.
  - **The create rule** accepts `to_node` unset, empty, or a node of the same project.
  - **The update rule** still refuses `from_node` and `project`. It accepts `to_node` unset, empty, or a node whose project is the record's own (`@request.body.to_node.project = project`).

  Rule tests in `tests/rules/` cover:
  - create empty
  - create linked in the same project
  - create linked into another project (refused)
  - re-link in the same project
  - re-link into another project (refused)
  - unlink
  - two empty choices on one node (allowed)
  - two links to the same target (refused)
  - each for a member, an outsider and an anonymous caller
- **Front end, in `frontend/src/backend/` (the one door):**
  - `Connection.toNodeId` becomes `string | null`.
  - `Connection` gains `created` (the stored time; a browser-made choice uses the browser's time until the server answers).
  - `EditableFields.connections` becomes `label | toNodeId`.
- **Every reader of connections handles an empty target.** The builder lists and checks each one:
  - markers (`markers.ts`)
  - card and edge mapping (`flow.ts`)
  - live state (`state.ts`)
  - cross-chapter links (`NodePicker.tsx`, `crossLinksOf`)
  - copy and paste (`clipboard.ts`, which keeps empty choices)
  - the canvas
  - search
- **Existing e2e tests change only where the UI moved:** the left panel's `Add node` button moves to the strip with the same accessible name, and tests that assume one handle per card. A failing test that did not move is stopped on and reported, never edited.
- **Performance:** keep the `PERF:` comments and memoised cards. Choice rows and cues come from the derived card data (`toFlowNodes`).

## Approaches

For choices there were two ways:

- **A: a choice is created by linking it.** No backend change, but no empty choices, and re-linking would have needed either a rule change or delete-and-recreate, which reshuffles the order. Chosen at first, then replaced.
- **B (chosen): a choice may be empty.** This needs one migration and its rule tests, but gives the prototype's workflow: write, then link, unlink or re-link. The choice keeps its id and its place throughout, which the developer judged easier and closer to what writers expect.

For the rest there was one sensible way:

- extend the existing card, panel and frame
- reuse the clipboard and selection actions
- add one tool strip

The rejected alternatives were:

- **An icon library:** this needs a decision record, and about eight icons do not justify it.
- **A collapsible right panel:** the developer chose the left one.

## Decided by the developer

- **Choices** may be empty.
- **One choice per target:** a node never has two choices to the same node.
- **No cap on choice rows:** every choice gets its own row and dot.
- **Add node** is an icon in the right tool strip, with a tooltip.
- **The tools** sit on the right side.
- **The left panel** collapses.
- **Notes** are dropped from this work.

## Left to the builder (my calls; correct any)

- **The collapsed state** is kept in this browser only, not on the account.
- **The left panel** keeps Back to teams and the project name, and narrows to fit them.
- **When link mode ends:** after a successful link, with Esc, with a click on empty canvas, or when the chapter changes.
- **The tooltip** appears after about 300 ms on hover, and at once on focus.
- **A choice made with the "+" connector** starts with empty text, so the row reads `Untitled` until it is named.
- **Exact icon drawings and exact token values.**
