# Task 3: Choices in the panel and link mode

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid
**Depends on:** Task 2

The selected node's panel gets a **Choices** section (design goal 1): write a choice first, then Link, Re-link, Unlink or Delete it. Link mode lets the next node click pick the target.

**Files:**
- Create:
  - `frontend/src/features/editor/canvas/linkMode.ts`
  - `frontend/src/features/editor/panel/Choices.tsx`
  - `frontend/src/features/editor/panel/ChoiceRow.tsx`
  - `e2e/editor-choices-panel.spec.ts`
- Modify:
  - `frontend/src/features/editor/panel/NodeFields.tsx`: renders `Choices` after the cues.
  - `frontend/src/features/editor/canvas/Canvas.tsx`: link mode is applied on node click, cancelled by a pane click, Escape or a chapter change, and its banner is shown.

**Interfaces:**
- Consumes:
  - from Task 1: `choicesOf`, `newChoice`
  - from Task 2: `linkChoice`
  - `edits.update`, `edits.create`, `edits.remove`, `useSavedText`
  - the existing "Link to a node in another chapter" picker (`NodePicker`)
- Produces, `canvas/linkMode.ts`:

```ts
export const LINK_BANNER = 'Select a target node'
interface LinkMode { choiceId: string | null; start(choiceId: string): void; stop(): void }
export const useLinkMode: UseBoundStore<StoreApi<LinkMode>>
```

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 3A: The Choices section

- [x] **Step 3A.1: Write the failing e2e tests** in `e2e/editor-choices-panel.spec.ts`. Give each a `// Protects:` header. The panel is `getByTestId('editor-panel')`, and each choice there is `getByTestId('panel-choice')`.
  - **`a choice can be written first and linked later`**
    1. Select `a` and click `Add choice`. Wait for the POST.
    2. The new choice's `Choice text` box is focused. Type `Open the door` and blur. Wait for the PATCH.
    3. It shows `Not linked`, and `a`'s card row reads `Open the door` with no edge.
    4. Click `Link`. The banner `Select a target node` shows.
    5. Click `b`'s card. Wait for the PATCH.
    6. The banner is gone, the status reads `Linked → New node`, and there is 1 edge.
  - **`unlink empties a choice and removes its line`**
    1. Take a linked choice and click `Unlink`.
    2. The status is `Not linked`, the edge count is 0, and the row still reads its text.
    3. After a reload, the same holds.
  - **`link mode is cancelled with Escape and a click on empty canvas`**
    1. Click `Link` and press Escape. The banner count is 0.
    2. Click `Link` again and click the canvas at `{ x: 20, y: 20 }`. The banner count is 0, and no PATCH was sent.
  - **`a node with only empty choices is marked End`**
    1. Give a start node `a` only an empty choice.
    2. `a`'s card has the badge `End`.
  - **`a deleted choice comes back in its place with undo`**
    1. Take choices `One`, `Two` and `Three`. Delete `Two`.
    2. Press Ctrl+Z outside a text field.
    3. The panel and card list `One`, `Two`, `Three` in that order.
  - **`linking to a node that already has the choice shows the message`**
    1. Take `a → b` linked and an empty choice of `a`. Click `Link` on the empty choice, then click `b`.
    2. The alert reads `This node already has a choice to New node.`, and the empty choice stays `Not linked`.
- [x] **Step 3A.2: Run** `npm run test:e2e -- e2e/editor-choices-panel.spec.ts`. Expect a FAIL.
- [x] **Step 3A.3: Implement.**
  - **`Choices`:**
    - A heading `Choices`, then one `ChoiceRow` per `choicesOf(content, node.id)`.
    - **`Add choice`** creates `newChoice(projectId, node.id, null, new Date().toISOString())` with `Add choice` and focuses the new row's text box (pass the new id to focus).
    - The cross-chapter link action follows.
  - **`ChoiceRow`** (`data-testid="panel-choice"`):
    - a `Choice text` field through `useSavedText('connections', id, 'label', …)`
    - the status `Linked → <title>` or `Not linked`
    - `Link` (`Re-link` when linked), which calls `useLinkMode.getState().start(id)`
    - `Unlink` (when linked): `edits.update(..., { toNodeId: null }, 'Unlink choice')`
    - `Delete`: `edits.remove('connections', id, 'Delete choice')`
  - **`Canvas.tsx`:**
    - **While `choiceId` is set:**
      - `onNodeClick` calls `linkChoice(choiceId, node.id)`, then `stop()`.
      - `onPaneClick` calls `stop()`, and so does Escape on `window`.
      - The banner `LINK_BANNER` shows at the top centre of the canvas (`role="status"`).
    - **Unmount or a chapter change** calls `stop()`.
- [x] **Step 3A.4: Run** the new spec, then `npm run test:e2e -- e2e/editor-panel.spec.ts e2e/editor-choices.spec.ts`, plus lint and typecheck. Expect a PASS. Close the checkpoint with one commit: `feat: write, link and unlink choices in the panel`.

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | write first, link later | e2e | Add choice, type, Link, click b | empty row, then linked with one edge | e2e/editor-choices-panel.spec.ts :: a choice can be written first and linked later |
| C2 | unlink | e2e | Unlink, reload | `Not linked`, no edge, text kept | e2e/editor-choices-panel.spec.ts :: unlink empties a choice and removes its line |
| C3 | cancel link mode | e2e | Escape; pane click | banner gone, no PATCH | e2e/editor-choices-panel.spec.ts :: link mode is cancelled with Escape and a click on empty canvas |
| C4 | End marker | e2e | start node with only an empty choice | `End` badge | e2e/editor-choices-panel.spec.ts :: a node with only empty choices is marked End |
| C5 | undo restores order | e2e | delete the middle of three, undo | One, Two, Three | e2e/editor-choices-panel.spec.ts :: a deleted choice comes back in its place with undo |
| C6 | duplicate by link mode | e2e | Link an empty choice to an existing target | message; still `Not linked` | e2e/editor-choices-panel.spec.ts :: linking to a node that already has the choice shows the message |
### Probes
**Probe folder:** none
### Breaks
none
### Flow
1. Write three choices before making any target, then link them one by one using Link and using drags.
2. Unlink one and re-link it.
3. Do this in Firefox and in Chromium.

Record what you saw in `progress.md`.
### Evidence
The full output of `npm run check:task`, the failing run of Step 3A.2, and the Flow record.
