# The editor: model, store and canvas

The editor's state is plain data with pure functions over it, plus one store that loads a project, applies edits at once, sends them through the backend door and applies teammates' live changes. Screens read and change content only through the store. Plan: [editor core](../superpowers/plans/2026-11-14-editor-core/README.md), Task 8.

## Where things are

| File (in `frontend/src/features/editor/`) | What |
|---|---|
| `model/ids.ts` | `newId()`: a 15-character `a-z0-9` id from `crypto.getRandomValues`. The browser makes every new record's id (undo re-creates a record with its id) |
| `model/sortOrder.ts` | Decimal sort order (decision D4): `sortOrderBetween`, `renumber`, `byOrder`, and `placeAt` and `insertAt` for moving and inserting in a list |
| `model/state.ts` | `ContentState` (records by id) and the "live" views over it |
| `model/remote.ts` | `applyRemote`: a teammate's change applied to the state |
| `store/editorStore.ts` | `editorStore`, `useEditor(selector)`; composes the two below |
| `store/editorSession.ts` | `open` and `close` |
| `store/editorEdits.ts` | `create`, `update`, `remove` with rollback |
| `model/fixtures.ts` | Record builders for tests only |

## The state

`ContentState` holds the open project, its settings, and the chapters, nodes, script lines, cues and connections **by id**, trashed ones included (undo and the trash need them). The views never mutate:

- `liveChapters`: not trashed, by `position` then id.
- `isLiveNode` / `liveNodes`: the node exists, is not trashed **and its chapter exists and is not trashed**. Trashing a chapter therefore hides its nodes without touching them.
- `liveConnections`: both ends are live nodes. A trashed node leaves no dangling edge.
- `linesOf` / `cuesOf`: of one node, by `sortOrder` then id.

## Sort order

Lines, cues and chapter tabs carry a decimal order. Inserting between two neighbours takes the midpoint; at an end it takes the neighbour plus or minus 1. When the midpoint is no longer strictly between the neighbours (after about 50 halvings in one gap) `sortOrderBetween` returns `null` and `placeAt` / `insertAt` answer with `{ kind: 'renumber', orders }`: the whole list as 1, 2, 3, ... The caller sends one update per record in that case.

## How an edit travels

1. A screen calls `update(kind, id, changes)` (or `create`, `remove`) on the store.
2. The store changes `content` at once and raises `saving`.
3. The door (`backend.content`) sends only the changed fields with the record's local `version` as the base. The server hook compares versions (decision 0002). On a 409 the door re-reads and retries by itself, up to 20 times.
4. On success the saved record replaces the local one **only if its version is higher**. On a refusal the fields of that edit go back to what they were (a later edit of another field stays) and `error` holds the message; the method resolves `false`.
5. The server's change event for our own save comes back through the subscription. Its version is not newer than the local copy, so `applyRemote` ignores it. A teammate's change has a higher version and is applied; a delete drops the record; an event of another project is ignored.

## Text fields: the save path

Text in the properties panel (`panel/`) does not go to the store on every keystroke. `useSavedText(kind, id, field, value)` keeps the text locally and schedules a save of that one field through `pendingEdits` (`store/pendingEdits.ts`), keyed `${kind}:${id}:${field}`:

- A new keystroke in the same field cancels the waiting save and starts the 800 ms wait again (`TEXT_SAVE_DELAY_MS`), so only the newest text is sent, once.
- `flush(key)` sends at once: on blur, before Enter adds a line, and when the field unmounts (another node selected, the row deleted).
- `EditorScreen` calls `pendingEdits.flushAll()` when the selection, chapter or project changes, when it unmounts and on `pagehide`. On `beforeunload` it flushes and then asks the browser to warn while `shouldWarnOnLeave(pendingEdits.size(), saving)`, that is while a save is still in flight.
- A teammate's value replaces the local text only while nothing of ours is waiting for that field, so a live event never overwrites what someone is typing.

Character, colour, cue type, order and delete are not text: they go straight to the store. New lines and cues get their `sortOrder` from `insertAt`, moves from `placeAt` (D4); `panel/ordering.ts` turns a placement into the writes, and after a renumber only the records whose order changed are sent.

## Undo history and the clipboard

From Task 12 screens change content only through `edits` (`store/edits.ts`), never the store's `create`, `update` and `remove` directly, so every change lands in the history (`model/history.ts`, D5):

- A step is recorded **only after its writes succeed**. An update records the old values of exactly the fields it changed (`before`) and the new ones (`after`). Creating a chapter or node is recorded as `deleted` going from true to false, so undo trashes it and redo restores it; lines, cues and connections record the whole record, so undo of a delete re-creates it with its id (at version 0).
- `edits.group(label, run)` makes everything inside one step: a multi-node drag, trashing a selection, a paste, an insert that renumbers. An edit belongs to the group that was open **when it started**, so a text save that finishes while a group is open stays its own step.
- `undo()` and `redo()` flush waiting text and wait for every write still on its way (so Ctrl+Z pressed while a save finishes undoes that save), then check every change with `canApply` (the current values still equal `before`, the record to remove is unchanged in its editable fields, the record to create does not exist). If any change fails the check, the step is dropped with `UNDO_BLOCKED` / `REDO_BLOCKED` as the store's error, and nothing is written. Undo writes ordinary guarded updates, so the version guard still applies.
- 100 steps (`HISTORY_DEPTH`); a new step clears redo; `edits.reset()` runs when a project opens and closes.
- Copy and paste (`model/clipboard.ts`, D11) keep the clip in memory: live selected nodes, their lines and cues, and only the connections between them. A paste gives every record a new id, remaps the references and moves the nodes by 40 px times the paste count.
- `useShortcuts` (on `window`) maps keys with `shortcutFor` (`model/shortcuts.ts`); in an `input`, `textarea`, `select` or contenteditable only `search` is taken. React Flow's own `deleteKeyCode` is off; Delete goes through `trashSelection` (`canvas/selectionActions.ts`), so a trashed node keeps its connections.

## Chapter tabs and menus

Plan: [editor tabs](../superpowers/plans/2026-11-18-editor-tabs/README.md). All chapter actions live in the tab bar (`chapters/ChapterTabs.tsx`): `≡` (`AllChaptersMenu`), the tabs (title as an `InlineText` with `role="tab"`, `TabMenu`'s `▾`, `×`, the resize handle) and `+`. The left panel only has Back to teams, the project name and Add node.

**Menus are portals, placed by `menuPosition`.** `Popover` renders into `document.body` at `position: fixed` with `z-50`, measures itself after its first render and takes its place from `menuPosition(anchorBox, menuSize, windowSize)` (`chapters/menuPosition.ts`, pure and unit-tested): below the anchor, left edges aligned; above it when there is no room below; always `MENU_MARGIN` (8 px) inside the window.

**Why a menu in a scrolling strip must not be absolutely positioned.** The tab strip is `overflow-x-auto`. Per CSS, when one overflow axis is not `visible` the other computes to `auto` too, so the strip also clips vertically and an absolutely positioned child is cut off inside its 30 px height (the first version of the tab menu opened hidden under the canvas). A portal moves the menu out of the strip, and `fixed` takes it out of every ancestor's clipping and stacking. The anchor's `getBoundingClientRect()` is the only link back to the tab.

**Closing rules (decision E1).** Escape (focus returns to the button), a `pointerdown` outside the menu and its button (capture phase, so the canvas still gets the click but nothing is added by it), a window `resize`, and a `scroll` (capture, so the strip's scroll is seen) **that moved the button**. The last condition matters: Chromium fires the scroll that brings a half-hidden `▾` into view one frame after the click that opened the menu, and closing on that scroll made such a menu vanish at once (`e2e/editor-tabs.spec.ts`, "the menu of a scrolled-off tab stays open and works").

`InlineText` is controlled when given `editing` and `onEditingChange`, which is how a tab's Rename item starts the same `Chapter title` box that a double-click opens.

## Add node

The Add node button sits in the left panel, outside the canvas's `ReactFlowProvider`, so it cannot call React Flow. The canvas registers a command instead: `useAddNode(projectId, chapterId, canvasRef)` (called by `CanvasView`) puts a function in `useCanvasCommands` (`canvas/canvasCommands.ts`, a Zustand store) on mount and sets it back to `null` on unmount. The button is disabled while `addNode` is `null` (no chapter open).

The command takes the centre of the canvas element, converts it with `screenToFlowPosition`, passes it through `freeSpot` (steps 40 px right and down while a live node of the chapter sits exactly there) and builds the record with `newNodeRecord` (`canvas/newNode.ts`, shared with the double-click `createAt`). It creates the node through `edits.create` and selects it.

**The queued first fit.** `<ReactFlow fitView>` keeps a fit queued until the first node exists. In a chapter that was empty when opened, that fit would run when the new node appears and move the view by half a card, so the node would not be at the centre and a second click would not be 40 px from the first. `useAddNode` therefore sets `fitViewQueued: false` in React Flow's store before it creates the node. The double-click path keeps the fit (`e2e/editor-panel.spec.ts` lays out its nodes assuming it).

## Opening and closing

`open(projectId)` closes any open project and starts loading and subscribing **together**. Events that arrive before the load is applied wait in a buffer and are applied after it (the version check drops stale ones). Every `open` and `close` bumps a token; a load or subscription that finishes for an older token is dropped and its subscription closed, so a slow project A can never overwrite project B. A failed load or subscribe gives `status: 'error'` and closes whatever did open.

Missed events after a lost connection are not recovered here (that is Plan 4).

## The canvas

Plan Task 10. React Flow (`@xyflow/react`) draws one chapter; the store stays the only source of content.

| File (in `frontend/src/features/editor/`) | What |
|---|---|
| `model/markers.ts` | `effectiveStart` (the start node if live, else `null`) and `nodeMarkers`: Start, End and Unreachable per live node, over all chapters (decisions D7, D8) |
| `model/flow.ts` | `toFlowNodes`, `toFlowEdges`, `crossLinksOf`: what React Flow draws for a chapter (cards with 3 preview lines, edges inside the chapter, tags for links into other chapters) |
| `model/colors.ts` | `NODE_COLORS`, the node header palette: the one place a hex colour is allowed |
| `canvas/Canvas.tsx` | The canvas: React Flow's state, the edits it makes, the minimap preference |
| `canvas/NodeCard.tsx` | One node card (`data-testid="node-card"`, `data-node-id`, badges) |
| `canvas/CanvasToolbar.tsx` | **Make start node**, the minimap toggle, the no-start note |
| `canvas/useSelection.ts` | The selection store (`nodeIds`, `connectionId`, `set`) the panel, shortcuts and search share |

**Two copies of the nodes.** React Flow needs its own node objects (it adds measured sizes, and moves positions while dragging). `useFlowState` merges the store's nodes into that copy during render whenever the content or the selection changes: an unchanged node keeps its object, a node being dragged keeps its local position. React Flow's own changes (`onNodesChange`) apply only to the local copy.

**Edits** go through `editorStore`: double-click on the empty pane creates a node (`New node`, client id); `onConnect` creates a connection unless the pair exists; `onNodeDragStop` sends one `update('nodes', id, { x, y })` per moved node, nothing during the drag; Delete or Backspace trash nodes (`deleted: true`) and remove a *selected* connection. The delete runs in `onBeforeDelete`, which returns `false`: left to itself React Flow would also delete the connections of a trashed node, but a trashed node keeps them (they are hidden by `liveConnections`, and undo brings them back). Task 12 routes these through the history.

**Selection** flows both ways: `onSelectionChange` sets `useSelection`, and the merge marks the store's selection on the nodes, so search or the panel can select a node. `set` ignores an unchanged selection, so the two cannot echo each other.

**Test hooks.** The canvas element has `data-testid="canvas"`, `data-node-count` (live nodes in the chapter) and `data-ready="true"` once React Flow is initialised and its nodes match the store. The e2e helpers `addNodeAt`, `connectNodes` and `nodePosition` are in `e2e/helpers/editor.ts`; `seedLargeProject` in `e2e/helpers/seed.ts` seeds a large project through the admin API.

**Theme.** `index.css` sets React Flow's `--xy-*` variables on `.kwnto-canvas` from the theme tokens; the dot grid uses `--canvas-dot`.

**Performance** is measured in [decision 0003](../decisions/0003-canvas-performance.md): 500 nodes and 5,000 lines open in about 0.7 s (Chromium) and 1.1 s (Firefox) against a 3 s budget. Every optimisation carries a `PERF:` comment.

### Selection, search jumps and focus (Task 13)

- The canvas takes the selection from React Flow only from the `select` changes in `onNodesChange` and `onEdgesChange` (`canvas/selectionChanges.ts`), never from `onSelectionChange`. That callback also reports selections the canvas pushed in itself, one update late; a selection set from outside (a search jump) and that echo flipped back and forth until React stopped with "Maximum update depth exceeded". A select change also drops ids that are not on the canvas shown (a node left selected in another chapter).
- `jumpToNode` (`search/jump.ts`) reopens the chapter's tab, navigates and puts a request in `useCanvasFocus`. It does not select: the canvas of the target chapter selects the node and centres on it (`setCenter`, current zoom) once `useNodesInitialized` is true, then clears the request. Selecting before the old canvas is gone caused the same loop.
- Search is `model/search.ts` (`searchNodes`, case, accents and spaces ignored); the header box and the link picker share `search/useSearch.ts`.
