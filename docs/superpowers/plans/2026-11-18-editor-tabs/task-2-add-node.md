# Task 2: Add node button

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid
**Depends on:** Task 1

The left panel gains a visible way to add a node (design goal 4). The button adds a node at the centre of the visible canvas and selects it, so the properties panel opens. A hint says that a double-click also works.

The button sits outside the canvas's `ReactFlowProvider`, so the canvas registers an "add node" command in a small store and the button calls it.

**Files:**
- Create:
  - `frontend/src/features/editor/canvas/newNode.ts`
  - `frontend/src/features/editor/canvas/newNode.test.ts`
  - `frontend/src/features/editor/canvas/canvasCommands.ts`
  - `frontend/src/features/editor/canvas/useAddNode.ts`
  - `e2e/editor-add-node.spec.ts`
- Modify:
  - `frontend/src/features/editor/canvas/Canvas.tsx`:
    - `createAt` builds its record with `newNodeRecord`.
    - `CanvasView` calls `useAddNode` and gives the canvas `div` a ref.
  - `frontend/src/features/editor/EditorScreen.tsx`: the left panel gets the button and the hint.

**Interfaces:**
- Consumes:
  - `edits.create('nodes', record, 'Add node')` (store)
  - `newId` (model)
  - `DEFAULT_NODE_COLOR` (model/colors)
  - `liveNodes(content, chapterId)` (model)
  - `useSelection.getState().set(nodeIds, null)` (canvas)
  - `useReactFlow().screenToFlowPosition`
- Produces, `canvas/newNode.ts`:

```ts
export interface Point { x: number; y: number }
export const NODE_STEP = 40
/** A new live node of the chapter at `at` (rounded): title `New node`, colour DEFAULT_NODE_COLOR, version 0, a fresh id. */
export function newNodeRecord(projectId: string, chapterId: string, at: Point): StoryNode
export function freeSpot(at: Point, taken: readonly Point[]): Point
```

- Produces, `canvas/canvasCommands.ts`:

```ts
interface CanvasCommands { addNode: (() => void) | null; setAddNode(fn: (() => void) | null): void }
export const useCanvasCommands: UseBoundStore<StoreApi<CanvasCommands>>   // zustand `create`
```

- Produces, `canvas/useAddNode.ts`: `export function useAddNode(projectId: string, chapterId: string, canvas: RefObject<HTMLDivElement | null>): void`.
  - On mount it registers a function that does the following:
    1. Takes the centre of `canvas.current.getBoundingClientRect()`.
    2. Converts it with `screenToFlowPosition`.
    3. Applies `freeSpot` against the live nodes of the chapter.
    4. Calls `edits.create` with `newNodeRecord`.
    5. Selects the new id.
  - On unmount it sets the command back to `null`.

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 2A: The new node and its spot

- [x] **Step 2A.1: Write the failing tests** in `newNode.test.ts`:
  - `freeSpot rounds the point when nothing is there`: `freeSpot({ x: 10.6, y: 20.4 }, [])` is `{ x: 11, y: 20 }`.
  - `freeSpot steps 40 px right and down past taken spots`: `freeSpot({ x: 100, y: 100 }, [{ x: 100, y: 100 }, { x: 140, y: 140 }])` is `{ x: 180, y: 180 }`.
  - `freeSpot ignores nodes near the spot but not on it`: `freeSpot({ x: 100, y: 100 }, [{ x: 101, y: 100 }])` is `{ x: 100, y: 100 }`.
  - `newNodeRecord makes a titled node at the point`:
    - `newNodeRecord('p', 'c', { x: 10.4, y: -3.6 })` matches `{ projectId: 'p', chapterId: 'c', title: 'New node', color: 'blue', x: 10, y: -4, deleted: false, version: 0 }`.
    - Its `id` matches `/^[a-z0-9]{15}$/`.
- [x] **Step 2A.2: Run** `npx vitest run --project unit frontend/src/features/editor/canvas/newNode.test.ts`. Expect a FAIL.
- [x] **Step 2A.3: Implement `newNode.ts`.**
  - `newNodeRecord` is a plain object literal.
  - `freeSpot` is this exact text, which the Breaks table matches:

```ts
export function freeSpot(at: Point, taken: readonly Point[]): Point {
  let spot = { x: Math.round(at.x), y: Math.round(at.y) }
  while (taken.some((p) => p.x === spot.x && p.y === spot.y)) spot = { x: spot.x + NODE_STEP, y: spot.y + NODE_STEP }
  return spot
}
```

  Then change `createAt` in `Canvas.tsx` to call `newNodeRecord(projectId, chapterId, screenToFlowPosition(...))`. Its behaviour is unchanged.
- [x] **Step 2A.4: Run** the unit test and `npm run test:e2e -- e2e/editor-canvas.spec.ts`. Expect a PASS, which shows double-click is unchanged. Close the checkpoint with one commit: `feat: one place that builds a new node`.

## Checkpoint 2B: The button

- [ ] **Step 2B.1: Write the failing e2e tests** in `e2e/editor-add-node.spec.ts`. Give each a `// Protects:` header. Use `ownerWithProject`, `readyCanvas`, `cards`, `nodePosition` and `waitForSave` from `e2e/helpers/editor.ts`. The `Title` field is `getByTestId('editor-panel').getByLabel('Title', { exact: true })`.
  - **`the Add node button puts a selected node in the middle of the canvas`**
    1. The text `or double-click the canvas` is visible in `editor-left`.
    2. Click `Add node`. Wait for the nodes POST. `cards` has count 1.
    3. The `Title` field has the value `New node`.
    4. The card's top-left corner is within 40 px of the centre of `getByTestId('canvas')` on both axes.
    5. After a reload, `readyCanvas(page, 1)` passes.
  - **`adding twice places the second node 40 px right and down`**
    1. Click `Add node` twice, waiting for each POST.
    2. The second node's `nodePosition` minus the first's is `{ x: 40, y: 40 }`.
  - **`Add node is disabled when no chapter is open`**
    1. Click `Close Chapter 1`.
    2. `Add node` is disabled, and the hint is still visible.
- [ ] **Step 2B.2: Run** `npm run test:e2e -- e2e/editor-add-node.spec.ts`. Expect a FAIL, because there is no button yet.
- [ ] **Step 2B.3: Implement.**
  - Add `canvasCommands.ts` and `useAddNode.ts` as in Interfaces, and call `useAddNode(projectId, chapterId, ref)` in `CanvasView`.
  - **In `EditorFrame`'s left panel**, under the project name:

    ```tsx
    <button className="btn-primary" disabled={addNode === null} onClick={() => addNode?.()}>+ Add node</button>
    <p className="text-muted">or double-click the canvas</p>
    ```

    Here `addNode` is `useCanvasCommands((s) => s.addNode)`.
  - **Accessible name:** set `aria-label="Add node"` so the "+" is not read out.
- [ ] **Step 2B.4: Run** the new spec, `npm run test:e2e -- e2e/editor-canvas.spec.ts e2e/editor-tabs.spec.ts`, `npm run lint` and `npm run typecheck`. Expect a PASS in both browsers. Close the checkpoint with one commit: `feat: an Add node button in the left panel`.

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | free spot rounds | unit | `{ x: 10.6, y: 20.4 }`, nothing taken | `{ x: 11, y: 20 }` | frontend/src/features/editor/canvas/newNode.test.ts :: freeSpot rounds the point when nothing is there |
| C2 | taken spots are skipped | unit | `{ 100, 100 }`, taken `{ 100, 100 }` and `{ 140, 140 }` | `{ 180, 180 }` | frontend/src/features/editor/canvas/newNode.test.ts :: freeSpot steps 40 px right and down past taken spots |
| C3 | near is not taken | unit | `{ 100, 100 }`, taken `{ 101, 100 }` | `{ 100, 100 }` | frontend/src/features/editor/canvas/newNode.test.ts :: freeSpot ignores nodes near the spot but not on it |
| C4 | new node record | unit | `'p'`, `'c'`, `{ 10.4, -3.6 }` | `New node`, `blue`, 10, -4, live, version 0, 15-character id | frontend/src/features/editor/canvas/newNode.test.ts :: newNodeRecord makes a titled node at the point |
| C5 | the button adds and selects a node at the centre | e2e | click `Add node`, reload | one card near the canvas centre, its Title shown; still there after reload; hint visible | e2e/editor-add-node.spec.ts :: the Add node button puts a selected node in the middle of the canvas |
| C6 | no stacking | e2e | click `Add node` twice | second node 40, 40 from the first | e2e/editor-add-node.spec.ts :: adding twice places the second node 40 px right and down |
| C7 | no chapter open | e2e | close the only tab | `Add node` disabled | e2e/editor-add-node.spec.ts :: Add node is disabled when no chapter is open |
### Probes
**Probe folder:** none
### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | frontend/src/features/editor/canvas/newNode.ts | `p.x === spot.x && p.y === spot.y` | `false` | frontend/src/features/editor/canvas/newNode.test.ts |
| B2 | frontend/src/features/editor/canvas/newNode.ts | `y: spot.y + NODE_STEP` | `y: spot.y` | frontend/src/features/editor/canvas/newNode.test.ts |
### Flow
1. Pan and zoom the canvas, then click `+ Add node`. The node appears in the middle of what you see, and its properties open.
2. Click it again. The second node is offset and not hidden under the first.
3. Do this in Firefox and in Chromium.

Record what you saw in `progress.md`.
### Evidence
The full output of `npm run check:task`, the failing runs of Steps 2A.2 and 2B.2, and the Flow record.
