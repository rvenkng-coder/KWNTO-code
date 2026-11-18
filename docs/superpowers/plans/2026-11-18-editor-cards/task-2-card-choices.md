# Task 2: Choices and cues on the card

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong
**Depends on:** Task 1

Each card lists its choices as rows, each with its own source handle, and a "+" handle that makes a new choice (design goal 1). It shows up to 2 cues (goal 2). Dragging a choice's handle to a node links or re-links that choice. A duplicate target is refused with the message.

**Files:**
- Modify:
  - `frontend/src/features/editor/model/flow.ts`
  - `frontend/src/features/editor/model/flow.test.ts`
  - `frontend/src/features/editor/canvas/NodeCard.tsx`
  - `frontend/src/features/editor/canvas/Canvas.tsx`: `onConnect` handles both kinds of handle.
  - `e2e/helpers/editor.ts`: `connectNodes` drags the `new-choice` handle.
- Create:
  - `frontend/src/features/editor/canvas/connectChoice.ts`: what a drag between handles does.
  - `e2e/editor-choices.spec.ts`

**Interfaces:**
- Consumes (Task 1): `choicesOf`, `hasChoiceTo`, `newChoice`, `duplicateChoiceMessage`, `LinkedConnection`, `cuesOf`.
- Produces, `model/flow.ts`:

```ts
export const CUE_LINES = 2
export const NEW_CHOICE_HANDLE = 'new-choice'
export const choiceHandleId = (connectionId: string): string => `choice-${connectionId}`
export interface CardChoice { id: string; text: string; untitled: boolean; linked: boolean; crossLink: CrossLink | null }
export interface CardCue { tag: 'Audio' | 'Light' | 'Other'; text: string }
// NodeCardData gains: choices: CardChoice[]; cues: CardCue[]; moreCues: number
// NodeCardData loses: crossLinks (now CardChoice.crossLink)
// toFlowEdges: every edge gets sourceHandle: choiceHandleId(c.id)
```

- Produces, `canvas/connectChoice.ts`:

```ts
/** A drag from `sourceHandle` on `fromId` to `toId`: creates (NEW_CHOICE_HANDLE) or re-links (choice-<id>); refuses a duplicate with the banner. */
export function connectChoice(projectId: string, fromId: string, sourceHandle: string | null, toId: string): void
/** Links an existing choice to `toId` ('Link choice'); refuses a duplicate. Returns whether it saved. */
export function linkChoice(choiceId: string, toId: string): boolean
```

  Both use `editorStore.setState({ error: duplicateChoiceMessage(title) })` on a duplicate (F3) and save nothing.

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 2A: Card data

- [x] **Step 2A.1: Write the failing tests** in `flow.test.ts`:
  - **`a card lists every choice in order, empty ones as not linked`.** For a node with choices `Go` (to `b`), `` (empty, created later) and `Away` (to a node in chapter 2), `choices` is:
    1. `{ text: 'Go', linked: true, crossLink: null, untitled: false }`
    2. `{ text: 'Untitled', untitled: true, linked: false, crossLink: null }`
    3. `{ text: 'Away', linked: true, crossLink: { text: '→ Chapter 2: <title>' … } }`
  - **`a card shows two cues then a count`.** A node with cues audio `Rain`, lighting `Dim` and other `Fog`, in sort order, has `cues` equal to `[{ tag: 'Audio', text: 'Rain' }, { tag: 'Light', text: 'Dim' }]` and `moreCues` equal to 1.
  - **`edges leave from their choice's handle and empty choices draw none`.** `toFlowEdges` gives one edge per linked in-chapter choice, with `sourceHandle: 'choice-<id>'`, and none for the empty choice or the cross-chapter one.
- [x] **Step 2A.2: Run** `npx vitest run --project unit frontend/src/features/editor/model/flow.test.ts`. Expect a FAIL.
- [x] **Step 2A.3: Implement in `flow.ts`.**
  - **Grouping:** build the choices and cues in one pass per kind over the chapter's node ids, keeping the `PERF:` pattern of `linesByNode`. Add a `PERF:` comment for each new pass.
  - **Cues:** use `.slice(0, CUE_LINES)` and `moreCues = cues.length - CUE_LINES` (at least 0).
  - **Tags:** `CUE_TAG = { audio: 'Audio', lighting: 'Light', other: 'Other' }`.
  - **Cross-chapter text:** stays as `crossLinksByNode` builds it today.
- [x] **Step 2A.4: Run.** Expect a PASS. Close the checkpoint with one commit: `feat: card data lists choices and cues`.

## Checkpoint 2B: Rows, handles and connecting

- [x] **Step 2B.1: Write the failing e2e tests** in `e2e/editor-choices.spec.ts`. Give each a `// Protects:` header. Use `ownerWithProject`, `readyCanvas`, `addNodeAt`, `card` and `waitForSave`. Choice rows are `card(page, id).getByTestId('choice-row')`.
  - **`a choice dragged from the plus connector appears as a row with its own line`**
    1. Take nodes `a` and `b`. `connectNodes(page, a, b)`.
    2. `a` has 1 `choice-row` with the text `Untitled`.
    3. One `.react-flow__edge` exists, and its source handle element is inside that row: `[data-handleid="choice-<id>"]` is inside the row.
  - **`dragging a choice's dot to another node re-links it and keeps its text`**
    1. Link `a → b`, then set the label `Go` through the selected connection's `Choice text` field.
    2. Drag `[data-handleid="choice-<id>"]` onto `c`'s target handle. Wait for the PATCH.
    3. The row still reads `Go`, the choice's id is unchanged (the same `data-handleid`), and the edge now ends at `c`.
    4. After a reload, the same holds.
  - **`a second choice to the same node is refused with a message`**
    1. Link `a → b`, then drag `a`'s `new-choice` handle to `b` again.
    2. The alert reads `This node already has a choice to New node.`
    3. Still 1 row, and no POST was sent: count the requests with `page.on('request')`.
  - **`cues show on the card`**
    1. Add cues `Rain` (Audio), `Dim` (Lighting) and `Fog` (Other) to a node through the panel.
    2. The card shows `Audio`, `Rain`, `Light`, `Dim` and `+1 more`, and does not show `Fog`.
- [x] **Step 2B.2: Run** `npm run test:e2e -- e2e/editor-choices.spec.ts`. Expect a FAIL.
- [x] **Step 2B.3: Implement.**
  - **`NodeCard`:**
    - **Each row** (`data-testid="choice-row"`) shows the text as a small pill, muted and italic when it is untitled, or the cross-chapter tag button for a `crossLink`. It has `<Handle type="source" position={Position.Right} id={choiceHandleId(id)} />` positioned on that row, hollow when `!linked`.
    - **Below the rows** is a "+" `<Handle type="source" id={NEW_CHOICE_HANDLE} data-testid="new-choice-handle" />`.
    - **Below the script preview,** cues show as `<tag> <text>` lines, then `+N more`.
    - The single unnamed source handle is removed, and the card stays `memo`.
  - **`Canvas.tsx`:** `onConnect={(c) => connectChoice(projectId, c.source, c.sourceHandle, c.target)}`.
  - **`connectChoice`:**
    - `NEW_CHOICE_HANDLE` checks `hasChoiceTo`, then `edits.create('connections', newChoice(projectId, from, to, new Date().toISOString()), 'Add choice')`.
    - `choice-<id>` calls `linkChoice(id, to)`, which checks `hasChoiceTo(s, from, to, id)`, then `edits.update('connections', id, { toNodeId: to }, 'Link choice')`.
  - **`connectNodes` helper:** drag `[data-node-id="<from>"] [data-testid="new-choice-handle"]`. Keep its doc comment true.
- [x] **Step 2B.4: Run** the new spec, then `npm run test:e2e -- e2e/editor-canvas.spec.ts e2e/editor-live.spec.ts e2e/editor-undo-paste.spec.ts e2e/editor-search-links.spec.ts`, and `npm run test:e2e -- --project perf-firefox --project perf-chromium --no-deps`, plus lint and typecheck. Expect a PASS. Close the checkpoint with one commit: `feat: choices and cues on the node card`.

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | card choices | unit | linked, empty, cross-chapter choice | three rows in order with the right text and link state | frontend/src/features/editor/model/flow.test.ts :: a card lists every choice in order, empty ones as not linked |
| C2 | card cues | unit | three cues | two tagged cues, `moreCues` 1 | frontend/src/features/editor/model/flow.test.ts :: a card shows two cues then a count |
| C3 | edges per choice | unit | linked, empty, cross-chapter | one edge with `sourceHandle` `choice-<id>` | frontend/src/features/editor/model/flow.test.ts :: edges leave from their choice's handle and empty choices draw none |
| C4 | new choice by dragging "+" | e2e | drag a's "+" to b | one `Untitled` row; edge from its handle | e2e/editor-choices.spec.ts :: a choice dragged from the plus connector appears as a row with its own line |
| C5 | re-link keeps text and id | e2e | drag the `Go` row's dot to c, reload | still `Go`, same id, edge to c | e2e/editor-choices.spec.ts :: dragging a choice's dot to another node re-links it and keeps its text |
| C6 | duplicate refused | e2e | second drag a → b | message shown, no POST, one row | e2e/editor-choices.spec.ts :: a second choice to the same node is refused with a message |
| C7 | cues on card | e2e | three cues | two shown with tags, `+1 more` | e2e/editor-choices.spec.ts :: cues show on the card |
| C8 | 500 nodes still in budget | e2e | the performance spec, run alone | within 3 s in both browsers | e2e/editor-performance.spec.ts :: a 500-node chapter opens within budget |
### Probes
**Probe folder:** none
### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | frontend/src/features/editor/model/flow.ts | `.slice(0, CUE_LINES)` | `` | frontend/src/features/editor/model/flow.test.ts |
| B2 | frontend/src/features/editor/model/flow.ts | `sourceHandle: choiceHandleId(c.id)` | `sourceHandle: null` | frontend/src/features/editor/model/flow.test.ts |
### Flow
1. On a node with five choices (two empty, one to another chapter), check that every line leaves from its own row.
2. Re-link one and drag the card around.
3. Do this in Firefox and in Chromium.

Record what you saw in `progress.md`.
### Evidence
The full output of `npm run check:task`, the failing runs of Steps 2A.2 and 2B.2, the performance run, and the Flow record.
