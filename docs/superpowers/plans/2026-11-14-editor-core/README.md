# Editor Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a team member open a project and write a branching script in it: chapters as tabs, nodes and connections on a canvas (including cross-chapter links), a properties panel for script lines and cues, search, undo/redo, copy/paste, multi-select, minimap and light/dark themes, every edit saved per attribute and safe against a teammate editing the same record at the same time. Before that, finish the six items carried over from Plan 2.

**Architecture:** Seven new PocketBase collections (`projects`, `project_settings`, `chapters`, `nodes`, `script_lines`, `cues`, `connections`), each with a `version` counter and one shared version-guarded update hook ([decision 0002](../../../decisions/0002-realtime-spike.md)). The browser reaches them only through `frontend/src/backend/` (`backend.projects`, `backend.content`), which turns HTTP 409 into a bounded re-read-and-retry. The editor is a Zustand store of normalized records plus pure modules (sort order, markers, search, history, clipboard, remote events), each unit-tested; React Flow draws the canvas.

**Tech Stack:** PocketBase 0.40.6 (JS hooks, migrations), `pocketbase` JS SDK 0.28, React 19, TypeScript, Zustand 5, `@xyflow/react` 12, Tailwind CSS 4, Vitest, Playwright. No new dependencies.

**Spec:** [Design](../../specs/2026-11-11-kwnto-design.md) (sections 5, 6.1, 6.2, 6.3, 6.6, 6.8, 8b, 9c) and [ERD](../../specs/2026-11-11-kwnto-erd.md). Also binding: [engineering.md](../../../engineering.md), [security.md](../../../security.md), [testing-strategy.md](../../../testing-strategy.md), [decision 0002](../../../decisions/0002-realtime-spike.md) and the [roadmap](../README.md) ("Plan 3" outline and "Carried over from Plan 2"). Executors read all of them.

**Standard:** test-plan-v1

## Global Constraints

Everything in the [Plan 1 router](../2026-11-11-foundation/README.md) "Global Constraints" still applies (zero cost, no new dependency, ask first, worktree, 300-line files, no `any`, deny by default, tests documented, prototype is reference only, secrets never in git, docs are part of done, Node 22, ports). Values this plan depends on:

- **Worktree and branch:** `feat/editor-core` in the sibling folder `../KWNTO-code-editor`, created from `main` (the plan itself is written there too; the main checkout stays on `main`). Tracking in `.planning/2026-11-14-editor-core/progress.md` (columns from [PROGRESS-TEMPLATE.md](../PROGRESS-TEMPLATE.md)). Resume as in the Plan 1 router ("Resuming").
- **Every task ends with** `npm run check:task -- --task docs/superpowers/plans/2026-11-14-editor-core/task-<n>-<name>.md --base <sha at task start> --built-by <local|strong>`, full output pasted in the report ([check-task.md](../../../developer/check-task.md)).
- **Probes are written by the controller, not the implementer**, before a task is dispatched, in the folder its Test plan names, from its Cases and the [catalogue](../../../testing-strategy.md) (section 4). A task whose Probe folder is `none` needs none.
- **The version guard (decision 0002) is mandatory** on every update of `projects`, `project_settings`, `chapters`, `nodes`, `script_lines`, `cues` and `connections`. A plain PATCH without `version` is refused. The client treats 409 as normal flow: re-read, re-apply only its own fields, retry, at most **20** tries, then the message `Could not save: too many people are editing this at once. Try again.`
- **Saving per attribute (design 5, engineering 9):** an update sends only the fields the person changed. Node positions save **on drag end**, never during the drag. Text fields save on blur and after **800 ms** without typing, and pending text is saved before the node, chapter or project changes and before the page unloads (Review Focus 3).
- **Delete is "move to trash" for projects, chapters and nodes** (design 6.8): it sets `deleted_at`; the trash screen, restore and purge are Plan 7. Script lines, cues and connections are deleted outright (undo covers them).
- **Only the team owner deletes a project** (design 5). Any member creates and edits projects, chapters, nodes, lines, cues and connections.
- **Records carry `project`** (ERD note), set on create and never changed; every reference (`chapter`, `node`, `from_node`, `to_node`, `start_node`) must point into the same project.
- **Client-made ids:** the browser makes every new content record's id (15 characters from `a-z0-9`, `crypto.getRandomValues`), so undo can re-create a deleted line with its id and Plan 4 can queue creates offline.
- **Missed live events are Plan 4's problem:** this plan subscribes to live changes but does not refetch after a reconnect (finding E). Do not build a partial version of it.
- **Canvas performance code carries `PERF:` comments** (engineering 1). Budget: a project with 500 nodes in one chapter and 5,000 lines shows every node within **3 s** of opening, in both browsers (Task 10).
- **Styling:** colours, spacing and radii come only from the theme tokens of Task 1; no hex colour or `style={{...}}` colour in a component (the node header palette in `frontend/src/features/editor/model/colors.ts` is the one exception).
- **Migrations:** new files from `1794370000_*` upward in `backend/pb_migrations/`. Each new collection needs `tests/rules/<name>.rules.test.ts` (the coverage check fails otherwise). No rule is public (`""`).

## Review Focus

The failure modes the spec implies that are most likely to bite a person, each pinned by a test in the task named:

1. **Two people editing different attributes of the same node, line or chapter at the same moment both keep their edit**, and the guarded-write hook does not become a back door: an outsider or a signed-out caller is still refused, and `version` cannot be set by hand. (Tasks 5 and 6 rule tests; Task 14 two-browser e2e)
2. **A record pointing into another project is refused:** a node in another project's chapter, a line on another project's node, a connection to another project's node, a start node from another project, or moving a record to another project by update. (Tasks 5 and 6)
3. **Text typed and then left (switching node, chapter or project, or reloading at once) is saved**, not lost in the 800 ms wait. (Task 11)
4. **Undo after a teammate changed the same field does not overwrite their work**: the step is skipped with `Can't undo: someone else changed this since.` (Task 12)
5. **Trashing a node that is the start node, a connection's end or a cross-chapter link target leaves no dangling edge or tag and no crash**, markers update at once, and undo brings the node back with its connections. (Tasks 10 and 12)

Also covered, lower risk: inserting a line between the same two lines 60 times keeps the order (renumber, Task 8); search ignores case and accents (Task 13); a remote event older than the local record is ignored (Task 8); retry exhaustion shows the message above (Task 7).

## Decisions made in this plan (please review)

The roadmap's "Decide first" items and calls where the spec is silent. Each is cheap to change before the task that builds it.

| # | Decision | Task |
|---|---|---|
| D1 | **Styles:** theme tokens are CSS variables in `frontend/src/index.css` (`--color-bg`, `--color-panel`, `--color-border`, `--color-text`, `--color-muted`, `--color-accent`, `--color-danger`, `--radius`, `--shadow`), mapped into Tailwind with `@theme inline`; components use Tailwind utilities on those tokens, and a few shared classes (`.btn`, `.btn-primary`, `.btn-danger`, `.field`, `.panel`, `.link-button`) live in `@layer components`. Dark mode is `data-theme="dark"` on `<html>`. One accent, `#2563eb` light and `#3b82f6` dark (design 6.6). No component library. | 1 |
| D2 | **Navigation** is a hash route of our own (`#/`, `#/team/<id>`, `#/project/<id>` and `#/project/<id>/chapter/<id>`), so a reload keeps the place. No router dependency. | 1 |
| D3 | **The guard is shared** as one hook file `backend/pb_hooks/content-guard.pb.js` that registers `onRecordUpdateRequest` for the seven content collections, with its pure parts in `backend/pb_hooks/lib/content-guard.js`. The update rule of each collection requires `@request.body.version:isset = true`; the create rule requires `version` unset (it starts at 0). | 5 |
| D4 | **Sort order** for lines, cues and chapter tabs: a decimal number; insert between two neighbours takes the midpoint, at an end takes neighbour ± 1. When the midpoint is no longer strictly between them (floating point runs out after about 50 halvings), the whole list is renumbered 1, 2, 3, … in one go. | 8 |
| D5 | **Undo history:** 100 steps per open project, of this person's own edits only, cleared when the project closes. A step whose fields someone else has changed since is skipped with a message, never forced. | 12 |
| D6 | **`project_settings`** is made with each project by a hook (as `team_settings` in Plan 2), with `analytics_enabled` **false** by default; the same transaction makes the first chapter, `Chapter 1`. | 5 |
| D7 | **Start node:** the first node created in a project becomes its start node (a hook sets `projects.start_node` when it is empty). "Make start node" changes it. If the start node is trashed, the project has no start until one is marked; the canvas shows `No start node: select a node and choose "Make start node".` | 6, 10 |
| D8 | **Unreachable** means what design 6.1 says: no incoming connection from a live node and not the start node. A connection from a node to itself does not count as incoming. **End** means no outgoing connection to a live node. | 10 |
| D9 | **Nodes** show the title, the header colour (8-colour palette) and the first 3 script lines (`+N more` after). The ERD's `nodes.height` is dropped (React Flow measures it); nodes cannot move between chapters (cut and paste instead). | 6, 10 |
| D10 | **Chapter tabs** can be closed (hidden from the tab strip in this browser only, reopened from the chapter list on the left) and resized (drag a tab's right edge, 80 to 320 px, kept in memory). Deleting a chapter is a separate action that moves it to the trash. | 9 |
| D11 | **Copy and paste** use an in-app clipboard (not the system clipboard): selected nodes with their lines, cues and the connections between them; each paste lands 40 px further right and down; works across chapters and projects in the same tab. | 12 |
| D12 | **Shortcuts:** Ctrl/⌘+Z undo, Ctrl/⌘+Shift+Z and Ctrl+Y redo, Ctrl/⌘+C copy, Ctrl/⌘+V paste, Delete or Backspace trash/delete, Ctrl/⌘+K search, Ctrl/⌘+A select all in the chapter. Inside a text field only Ctrl/⌘+K is taken; the rest stay with the browser. | 12 |
| D13 | **Deleting a team removes its projects** (cascade), so the owner's confirm dialog says how many projects go with it. The alternative (refuse while projects exist) would block deletion for 30 days after trashing them. | 5, 9 |
| D14 | **`deleted_at` is the browser's clock** when trashing. Plan 7's purge only needs day precision. | 7 |
| D15 | **Live changes** arrive through one subscription per collection filtered by project (finding D); an event whose `version` is not newer than the local copy is ignored (it is our own echo or out of order). | 7, 8 |

## File structure

| Path | Responsibility |
|---|---|
| `backend/pb_migrations/17943700xx_*.js` | `projects` + `project_settings` + `chapters` (Task 5); `nodes` + `script_lines` + `cues` + `connections` (Task 6) |
| `backend/pb_hooks/lib/content-guard.js` | Pure: guarded collection list, changed-field list, version check |
| `backend/pb_hooks/content-guard.pb.js` | The guarded update for the seven collections |
| `backend/pb_hooks/projects.pb.js` | New project gets settings and `Chapter 1`; first node becomes start node |
| `frontend/src/backend/` | `content-types.ts`, `content-mappers.ts`, `guarded.ts`, `projects.ts`, `content.ts`, `realtime.ts`, `preferences.ts` |
| `frontend/src/features/shell/` | App shell, top bar, theme, hash routes |
| `frontend/src/features/projects/` | Project list of a team |
| `frontend/src/features/editor/model/` | Pure editor logic: ids, sort order, state, remote events, markers, search, characters, history, clipboard, shortcuts, colours, flow mapping |
| `frontend/src/features/editor/store/` | The editor store and the operations that call the door |
| `frontend/src/features/editor/{canvas,panel,chapters,search}/` | Screens |
| `e2e/editor-*.spec.ts`, `e2e/helpers/editor.ts` | Browser flows |
| `docs/user/editor.md`, `docs/developer/editor.md`, `docs/developer/backend.md`, `docs/decisions/0003-canvas-performance.md` | Docs |

## Tasks

| # | Task | Tier | Depends on | Checkpoints | Status |
|---|---|---|---|---|---|
| 1 | [App shell, theme and routes](task-1-shell-theme-routes.md) | mid (1A local) | none | 1A 1B 1C | done |
| 2 | [Account and team screen fixes](task-2-account-team-fixes.md) | local | 1 | 2A 2B 2C | done |
| 3 | [Auth store listeners](task-3-auth-listeners.md) | local | none | 3A | done |
| 4 | [The join-code e2e flake](task-4-e2e-flake.md) | strong | none | 4A | done |
| 5 | [Guarded write, projects, chapters, project settings](task-5-guard-projects-chapters.md) | strong | none | 5A 5B 5C | done |
| 6 | [Nodes, script lines, cues, connections](task-6-nodes-lines-connections.md) | strong | 5 | 6A 6B | done |
| 7 | [The content door](task-7-content-door.md) | strong | 5, 6 | 7A 7B 7C | done |
| 8 | [Editor model and store](task-8-editor-model-store.md) | mid (8A local) | 7 | 8A 8B 8C | done |
| 9 | [Projects, editor layout and chapters](task-9-projects-layout-chapters.md) | mid | 1, 8 | 9A 9B | done |
| 10 | [The canvas](task-10-canvas.md) | strong (10A local) | 9 | 10A 10B 10C 10D | done |
| 11 | [Properties panel](task-11-properties-panel.md) | mid (11A local) | 10 | 11A 11B 11C | not started |
| 12 | [Undo/redo, copy/paste, shortcuts](task-12-undo-copy-shortcuts.md) | mid (12A local) | 11 | 12A 12B 12C | not started |
| 13 | [Search and cross-chapter links](task-13-search-cross-links.md) | mid (13A local) | 10, 12 | 13A 13B | not started |
| 14 | [Live editing end-to-end and close-out](task-14-live-editing-closeout.md) | strong | 1 to 13 | 14A 14B | not started |

**Status values:** `not started`, `in progress`, `awaiting review`, `done`. Tasks 1, 3, 4 and 5 have no dependency on each other; run tasks one at a time (implementers never run in parallel). The carried-over items (Tasks 1 to 4) go first, as the roadmap asks.

Names and signatures shared between tasks are in each task file's **Interfaces** block. If a task needs something its Interfaces block does not list, stop and report it; do not guess.

**Closing a checkpoint** follows the Plan 1 router, "Rules while working" (one commit holding the code and docs, the ticked boxes, this table's Status cell and one new `progress.md` row). Replace its `<date>-foundation` with `2026-11-14-editor-core`.

## Done when

- `npm test` passes on a clean clone with Docker running, and `npm run check:task` passed for every task (output in the reports).
- Every row above says `done`, no step box is unticked, `git status` is clean.
- [test-plan.md](../../../test-plan.md) rows "Canvas and nodes", "Properties panel: script lines, cues, lighting notes", "Chapters" and "Look and feel" say `covered` for their automated layers; M1 and M2 are walked by the developer.
- The roadmap marks Plan 3 `done` and its "Carried over from Plan 2" Plan 3 rows are removed.
- A whole-branch review of `feat/editor-core` is complete and the developer has reviewed the branch. Agents do not merge or push.
