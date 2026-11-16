# Task 10: The canvas

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong
**Checkpoint 10A tier:** local
**Depends on:** Task 9

Design 6.1 on React Flow: dot-grid canvas, freeform nodes (D9), connections, start node (D7), end and unreachable markers (D8), multi-select, minimap. Positions save on drag end only. Canvas performance is a named risk (roadmap): Checkpoint 10D measures it and records the result.

**Files:**
- Create: `frontend/src/features/editor/model/markers.ts`, `markers.test.ts`, `flow.ts`, `flow.test.ts`, `colors.ts` (in `model/`); `frontend/src/features/editor/canvas/Canvas.tsx`, `NodeCard.tsx`, `CanvasToolbar.tsx`, `useSelection.ts` (in `canvas/`); `e2e/editor-canvas.spec.ts`, `e2e/helpers/seed.ts`, `e2e/editor-performance.spec.ts`, `docs/decisions/0003-canvas-performance.md`
- Modify: `frontend/src/features/editor/EditorScreen.tsx` (canvas in the centre), `frontend/src/index.css` (React Flow theme on tokens), `docs/user/editor.md`, `docs/developer/editor.md`, `docs/README.md` (link decision 0003)

**Interfaces:**
- Consumes: `ContentState`, `liveNodes`, `liveConnections`, `isLiveNode`, `linesOf`, `editorStore` (Task 8); `backend.preferences` (Task 1); `newId`.
- Produces, `model/markers.ts`:

```ts
export interface NodeMarker { isStart: boolean; isEnd: boolean; isUnreachable: boolean }
export function effectiveStart(s: ContentState): string | null           // project.startNodeId when that node is live, else null
export function nodeMarkers(s: ContentState): Map<string, NodeMarker>     // one entry per live node, all chapters
// end: no connection from it to a live node (a self-link counts as outgoing)
// unreachable: no connection into it from a live node other than itself, and it is not effectiveStart
```

- Produces, `model/flow.ts`:

```ts
export interface CrossLink { connectionId: string; targetNodeId: string; targetChapterId: string; text: string } // text: `→ ${chapterTitle}: ${nodeTitle || 'Untitled'}`
export interface NodeCardData { title: string; color: NodeColor; preview: string[]; more: number; marker: NodeMarker; crossLinks: CrossLink[] }
export const PREVIEW_LINES = 3, PREVIEW_CHARS = 80
export function crossLinksOf(s: ContentState, nodeId: string): CrossLink[]         // outgoing, to live nodes in another chapter
export function toFlowNodes(s: ContentState, chapterId: string, markers: Map<string, NodeMarker>): Node<NodeCardData>[] // React Flow Node, type 'card'
export function toFlowEdges(s: ContentState, chapterId: string): Edge[]             // live connections with both ends in this chapter; label = connection label
// preview line: `${character.toUpperCase()}: ${text}` or `text` when no character, cut to PREVIEW_CHARS with '…'
```

- Produces, `model/colors.ts`: `NODE_COLORS: Record<NodeColor, { light: string; dark: string }>` (the one place hex colours are allowed) and `DEFAULT_NODE_COLOR: NodeColor = 'blue'`.
- Produces, `canvas/useSelection.ts`: a zustand store `{ nodeIds: string[]; connectionId: string | null; set(nodeIds: string[], connectionId: string | null): void }` that the panel (Task 11), shortcuts (Task 12) and search (Task 13) read and set.
- Produces, `Canvas` behaviour: double-click on the empty canvas creates a node there (`New node`, `DEFAULT_NODE_COLOR`, client id); drag end sends one `update('nodes', id, { x, y })` per moved node; dragging from a node's handle to another node creates a connection (ignored when that pair exists); Delete or Backspace trashes selected nodes (`deleted: true`) and removes a selected connection (Task 12 later routes these through the history); the toolbar has `Make start node` when one node is selected and a minimap toggle saved with `backend.preferences.set({ minimapVisible })`; without a start node the canvas shows `No start node: select a node and choose "Make start node".` Node cards carry `data-testid="node-card"`, `data-node-id`, and badges with the texts `Start`, `End`, `Unreachable`. The canvas element carries `data-testid="canvas"`, `data-node-count` (live nodes in the chapter) and `data-ready="true"` once the first render with content is done.
- Produces, `e2e/helpers/seed.ts`: `seedLargeProject(teamId: string, nodes: number, linesPerNode: number): Promise<{ projectId: string; chapterId: string }>` (admin API, creates in chunks of 50).

**If interrupted:** 10D's seeded project lives in the test backend, which `with-pocketbase` recreates; nothing else.

## Sized for the local model
**May touch:** `frontend/src/features/editor/model/markers.ts`, `frontend/src/features/editor/model/markers.test.ts` (exhaustive: no other file)
**Must not change:** the `NodeMarker` type and the signatures of `effectiveStart` and `nodeMarkers`, and `model/state.ts`
Stop and report if you need to touch anything else.
**Model server:** run `npm run ping:model` first; if it says NOT answering, do not start the run (see [the runbook](../../../developer/local-model-runbook.md))
**Checkpoint given:** Checkpoint 10A only

## Checkpoint 10A: Markers (local)

- [x] **Step 1: Write the failing tests** C1 to C4 in `markers.test.ts` (build states with `fromContent`).
- [x] **Step 2: Run** `npx vitest run --project unit frontend/src/features/editor/model/markers.test.ts`. Expected: FAIL.
- [x] **Step 3: Implement `markers.ts`.** Count an incoming connection only when `c.fromNodeId !== c.toNodeId` and the source is live; write the result as `isUnreachable: !hasIncoming && id !== start` (breaks B1, B2).
- [x] **Step 4: Run** it. Expected: PASS. **Close checkpoint 10A** (commit `feat: start, end and unreachable markers`).

## Checkpoint 10B: Flow mapping and the canvas

- [ ] **Step 5: Write the failing tests** C5 to C7 in `flow.test.ts`.
- [ ] **Step 6: Run** them. Expected: FAIL.
- [ ] **Step 7: Implement `flow.ts`** (edge filter written as `from.chapterId === chapterId && to.chapterId === chapterId`, break B3), `colors.ts`, `useSelection.ts`, `NodeCard`, `CanvasToolbar`, `Canvas`. React Flow: `BackgroundVariant.Dots` on `--canvas-dot`, `MiniMap`, `Controls`, `onlyRenderVisibleElements`, `nodeTypes` defined outside the component. Node positions live in React Flow's local state during a drag and are committed on `onNodeDragStop`. Each optimisation carries a `PERF:` comment (what, why, trade-off).
- [ ] **Step 8: Run** `npm run test:unit`. Expected: PASS. **Close checkpoint 10B** (commit `feat: canvas with nodes, connections and markers`).

## Checkpoint 10C: Canvas flows in the browser

- [ ] **Step 9: Write the failing e2e tests** C8 to C11 in `e2e/editor-canvas.spec.ts` (use `ownerWithProject`).
- [ ] **Step 10: Run** `npm run test:e2e -- e2e/editor-canvas.spec.ts`; fix until it passes; then `npm run test:e2e`. Expected: PASS.
- [ ] **Step 11:** Add "Nodes and connections" to `docs/user/editor.md` (create, connect, move, start, end and unreachable markers, minimap). **Close checkpoint 10C** (commit `test: canvas flows`).

## Checkpoint 10D: Performance at 500 nodes and 5,000 lines

- [ ] **Step 12: Write `e2e/helpers/seed.ts` and `e2e/editor-performance.spec.ts`** (C12): seed 500 nodes in one chapter on a 25 × 20 grid with 10 lines each and 499 connections; open the project; measure from `page.goto` to `data-ready="true"` with `data-node-count="500"`; then drag one node and count `PATCH` requests to `nodes` records. Test timeout 180 s for the seed.
- [ ] **Step 13: Run** it 3 times per browser. Expected: every load under 3,000 ms and exactly 1 PATCH per drag. If the budget is missed, do not loosen it: profile, fix with `PERF:`-commented code, and if it still fails stop and report the numbers.
- [ ] **Step 14: Write `docs/decisions/0003-canvas-performance.md`** (environment, the six load times, what was optimised and why) and the canvas section of `docs/developer/editor.md`. **Close checkpoint 10D** (commit `perf: canvas measured at 500 nodes`).

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | start, end, unreachable | unit | A start → B; C alone | A: start, not end; B: end; C: end and unreachable | frontend/src/features/editor/model/markers.test.ts :: markers for a start, a target and a lone node |
| C2 | self-link | unit | C → C only | C not end, but unreachable | frontend/src/features/editor/model/markers.test.ts :: a self-link is outgoing but not incoming |
| C3 | trashed nodes do not count | unit | A → B with B trashed; start node trashed | A is end; no node is start and every node without incoming is unreachable; trashed nodes have no entry | frontend/src/features/editor/model/markers.test.ts :: trashed nodes neither link nor start |
| C4 | links across chapters count | unit | node in chapter 1 → node in chapter 2 | target not unreachable; source not end | frontend/src/features/editor/model/markers.test.ts :: cross-chapter connections count as links |
| C5 | edges stay in the chapter | unit | connections inside chapter 1, across chapters, to a trashed node | only the inside one is an edge of chapter 1 | frontend/src/features/editor/model/flow.test.ts :: only connections inside the chapter become edges |
| C6 | cross-chapter tags | unit | link to `Chapter 2` node `The Door`; to an untitled node; to a trashed node | `→ Chapter 2: The Door`; `→ Chapter 2: Untitled`; no tag | frontend/src/features/editor/model/flow.test.ts :: cross-chapter links become tags |
| C7 | preview lines | unit | 5 lines, one 120 characters long, one without character | 3 preview lines, `more` 2, long one cut to 80 with `…`, `NARRATOR`-style upper case only when a character is set | frontend/src/features/editor/model/flow.test.ts :: node previews show three lines and count the rest |
| C8 | create, connect, reload | e2e | double-click twice, connect A to B, reload | 2 cards and 1 edge after reload | e2e/editor-canvas.spec.ts :: nodes and a connection survive a reload |
| C9 | drag saves once, on drop | e2e | drag a node 200 px | exactly 1 PATCH to that node; position kept after reload | e2e/editor-canvas.spec.ts :: dragging a node saves its position once when dropped |
| C10 | markers and trash | e2e | A → B, lone C; trash A (the start) | badges as in C1; then the no-start note, no edge drawn, no error banner | e2e/editor-canvas.spec.ts :: markers follow connections and trashing the start node |
| C11 | minimap preference | e2e | hide the minimap, reload | minimap still hidden | e2e/editor-canvas.spec.ts :: the minimap choice follows the account |
| C12 | performance budget | e2e | 500 nodes, 5,000 lines | ready in under 3,000 ms; 1 PATCH per drag | e2e/editor-performance.spec.ts :: a 500-node chapter opens within budget |
### Probes
**Probe folder:** `tests/probes/2026-11-14-editor-core/task-10/`
### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | frontend/src/features/editor/model/markers.ts | `c.fromNodeId !== c.toNodeId` | `true` | frontend/src/features/editor/model/markers.test.ts |
| B2 | frontend/src/features/editor/model/markers.ts | `isUnreachable: !hasIncoming && id !== start` | `isUnreachable: !hasIncoming` | frontend/src/features/editor/model/markers.test.ts |
| B3 | frontend/src/features/editor/model/flow.ts | `from.chapterId === chapterId && to.chapterId === chapterId` | `from.chapterId === chapterId` | frontend/src/features/editor/model/flow.test.ts |
### Flow
In Firefox and Chromium, light and dark: create ten nodes, connect them, select several with a box and drag them, mark a start node, trash it and see the note, toggle the minimap; then open the seeded 500-node project and pan around. Record what you saw and how panning felt in `progress.md`.
### Evidence
The full output of `npm run check:task`, the failing run of each break, the six load times of 10D, and the Flow record.
