# Task 1: Empty choices: backend, door and model

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong
**Depends on:** none

A choice (a `connections` record) may have no target, and its target may change within the project. The browser carries `toNodeId: string | null` and `created`, and every reader of connections treats an empty target as "no link". There is no UI change in this task.

**Files:**
- Create:
  - `backend/pb_migrations/1794370200_open_choices.js`
  - `frontend/src/features/editor/model/choices.ts`
  - `frontend/src/features/editor/model/choices.test.ts`
- Modify:
  - `tests/rules/connections.rules.test.ts`: add tests only. Existing tests stay as they are.
  - `frontend/src/backend/content-types.ts`
  - `frontend/src/backend/content-mappers.ts`
  - `frontend/src/backend/content-mappers.test.ts`
  - `frontend/src/features/editor/model/state.ts`: `liveConnections` returns `LinkedConnection[]`.
  - `frontend/src/features/editor/model/markers.test.ts`
  - `frontend/src/features/editor/model/clipboard.ts`
  - `frontend/src/features/editor/model/clipboard.test.ts`
  - `frontend/src/features/editor/model/fixtures.ts`
  - every other file `tsc` reports after the type change. Expect `flow.ts`, `NodePicker.tsx` and `Canvas.tsx`; each one uses `hasChoiceTo` and `newChoice` instead of its own checks.

**Interfaces:**
- Produces, `frontend/src/backend/content-types.ts`:

```ts
export interface Connection { id: string; projectId: string; fromNodeId: string; toNodeId: string | null; label: string; created: string; version: number }
// EditableFields.connections becomes Pick<Connection, 'label' | 'toNodeId'>
```

- Produces, `content-mappers.ts`:
  - **The reader:**
    - `to_node` `''` becomes `toNodeId: null`.
    - `created` is normalised: `text(r.created).replace(' ', 'T')` (F2).
  - **`EDITABLE.connections`:** `['label', 'toNodeId']`. A `null` is sent as `''`, as it already is for every relation.
  - **`toCreateBody`:** skips `created`, and sends `toNodeId: null` as `to_node: ''`.
- Produces, `frontend/src/features/editor/model/state.ts`:

```ts
export type LinkedConnection = Connection & { toNodeId: string }
export function liveConnections(s: ContentState): LinkedConnection[]   // both ends live, target set
```

- Produces, `frontend/src/features/editor/model/choices.ts`:

```ts
/** The choices of a node: target empty or a live node; by `created`, then id (F1, F2). */
export function choicesOf(s: ContentState, nodeId: string): Connection[]
/** Whether `fromId` already has a choice to `toId`, ignoring the choice `exceptId`. */
export function hasChoiceTo(s: ContentState, fromId: string, toId: string, exceptId?: string): boolean
/** A new choice of `fromNodeId`; `created` is `now`. */
export function newChoice(projectId: string, fromNodeId: string, toNodeId: string | null, now: string, makeId?: () => string): Connection
export function duplicateChoiceMessage(targetTitle: string): string   // `This node already has a choice to ${targetTitle || 'Untitled'}.`
```

**If interrupted:** the migration runs only in the throwaway test containers. Nothing leaves state outside the working tree.

## Checkpoint 1A: The migration and its rules

- [ ] **Step 1A.1: Write the failing rule tests** in `tests/rules/connections.rules.test.ts`. Each gets a `// Protects:` comment naming the design's goal 1 and security.md section 2. Use the helpers already imported there (`memberProject`, `createNode`, `createProject`, `guardedUpdate`, `readAsAdmin`, `asUser`, `asAnonymous`, `createUser`, `expectCreateRefused`).
  - **`a choice may be empty and be linked, re-linked and unlinked later`**
    1. A member creates `{ project, from_node: a, to_node: '' , label: 'Wait' }`. The create succeeds, and `to_node` is `''`.
    2. A guarded update `{ version: 0, to_node: b }` returns 200. Then `{ version: 1, to_node: c }` returns 200. Then `{ version: 2, to_node: '' }` returns 200.
    3. `readAsAdmin` shows `{ to_node: '', label: 'Wait', version: 3 }`.
  - **`a choice cannot be linked into another project`**
    1. A create with a `to_node` in another project is refused.
    2. Updates of an empty choice in the member's project are each refused with 403 or 404: `{ to_node: foreign }`, `{ from_node: b }` and `{ project: other }`.
    3. An outsider's guarded update `{ to_node: b }` returns 403 or 404.
    4. An anonymous update is refused.
    5. Admin reads the choice unchanged.
  - **`a node may have many empty choices but one choice per target`**
    1. Two empty choices from `a` are both created.
    2. A choice `a → b` is created. A second `a → b` create is refused.
    3. Re-linking an empty choice of `a` to `b` returns a non-200.
- [ ] **Step 1A.2: Run** `npm run test:rules -- connections`. Expect a FAIL on the three new tests, while the existing three pass.
- [ ] **Step 1A.3: Write `1794370200_open_choices.js`.** The up step finds the `connections` collection and:
  - **`to_node`:** sets `required: false` and `cascadeDelete: false`, so a purged target leaves an empty choice.
  - **The pair index:** replaces `idx_connections_pair` with `CREATE UNIQUE INDEX idx_connections_pair ON connections (from_node, to_node) WHERE to_node != ''`.
  - **The create rule:** `IS_MEMBER + VERSION_UNSET + sameProject("from_node") + " && (@request.body.to_node:isset = false || @request.body.to_node = '' || @request.body.to_node.project = @request.body.project)"`.
  - **The update rule:** `IS_MEMBER + UPDATE_GUARDED + unset("from_node") + " && (@request.body.to_node:isset = false || @request.body.to_node = '' || @request.body.to_node.project = project)"`.

  Copy the `IS_MEMBER`, `VERSION_UNSET`, `UPDATE_GUARDED`, `sameProject` and `unset` fragments verbatim from the Plan 3 migration, and say so in a comment. The down step restores the Plan 3 field, index and rules exactly.
- [ ] **Step 1A.4: Run** `npm run test:rules`. Expect all PASS, including `coverage.rules.test.ts`. Close the checkpoint with one commit: `feat: a choice may be empty and re-linked within its project`.

## Checkpoint 1B: The door and the model

- [ ] **Step 1B.1: Write the failing unit tests.**
  - **`choices.test.ts`:**
    - **`choicesOf lists a node's choices by when they were made, empty ones included`:**
      - Choices of `a` with `created` `…T10:00:02`, `…T10:00:01` (empty) and `…T10:00:01` (a larger id) come back in the order 01 (smaller id), 01 (larger id), 02.
      - A choice of another node is absent.
      - A choice whose target is trashed is absent.
    - **`choicesOf keeps the order when a choice is re-linked`:** after `putRecord` changes one choice's `toNodeId`, the ids keep the same order.
    - **`hasChoiceTo finds a duplicate target but not the choice itself`:**
      - With `a → b` as choice `x`, `hasChoiceTo(s, 'a', 'b')` is `true`.
      - `hasChoiceTo(s, 'a', 'b', 'x')` is `false`.
      - `hasChoiceTo(s, 'a', 'c')` is `false`.
    - **`newChoice makes an empty or linked choice at version 0`:** `newChoice('p', 'a', null, '2026-11-18T10:00:00.000Z', () => 'id1')` equals `{ id: 'id1', projectId: 'p', fromNodeId: 'a', toNodeId: null, label: '', created: '2026-11-18T10:00:00.000Z', version: 0 }`.
  - **`markers.test.ts`:** **`an empty choice is not an outgoing link`**. With nodes `a` (start) and `b`, and only an empty choice from `a`:
    - `a` is End.
    - `b` is Unreachable.
  - **`clipboard.test.ts`:** **`copy keeps a node's empty choices and paste keeps them empty`**. Copy `a` with one empty choice and one choice to an uncopied node. The clip holds only the empty one, and the paste gives it a new id with `toNodeId: null`.
  - **`content-mappers.test.ts`:**
    - **`an empty to_node reads as null and created is ISO`:** the record `{ to_node: '', created: '2026-11-18 10:00:00.000Z', … }` gives `toNodeId: null` and `created: '2026-11-18T10:00:00.000Z'`.
    - **`a choice is created and unlinked with an empty to_node`:** `toCreateBody` of a choice with `toNodeId: null` has `to_node: ''` and no `created`. `toUpdateBody('connections', { toNodeId: null })` is `{ to_node: '' }`.
- [ ] **Step 1B.2: Run** `npx vitest run --project unit frontend/src/features/editor/model frontend/src/backend/content-mappers.test.ts`. Expect a FAIL.
- [ ] **Step 1B.3: Implement** the types, mappers and `liveConnections` as in Interfaces. `choicesOf` and `hasChoiceTo` are this exact text, which the Breaks table matches:

```ts
export function choicesOf(s: ContentState, nodeId: string): Connection[] {
  return Object.values(s.connections)
    .filter((c) => c.fromNodeId === nodeId && (c.toNodeId === null || isLiveNode(s, c.toNodeId)))
    .sort((a, b) => a.created.localeCompare(b.created) || a.id.localeCompare(b.id))
}

export function hasChoiceTo(s: ContentState, fromId: string, toId: string, exceptId?: string): boolean {
  return Object.values(s.connections).some((c) => c.id !== exceptId && c.fromNodeId === fromId && c.toNodeId === toId)
}
```

  Next:
  1. Run `npm run typecheck` and fix every reader it lists.
  2. `Canvas.tsx`'s `connectionExists` is replaced by `hasChoiceTo`.
  3. `NodePicker.tsx` uses `hasChoiceTo` and `newChoice`.
  4. `clipboard.ts` copies a choice when its target is `null` or among the copied nodes.
  5. Add `created` to the fixtures.
- [ ] **Step 1B.4: Run** `npm run lint`, `npm run typecheck`, `npm run test:unit` and `npm run test:e2e -- e2e/editor-canvas.spec.ts e2e/editor-search-links.spec.ts e2e/editor-undo-paste.spec.ts e2e/editor-live.spec.ts`. Expect a PASS: nothing the person sees has changed. Close the checkpoint with one commit: `feat: the editor reads choices that may be empty`.

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | empty, link, re-link, unlink | rules | create empty; link b; re-link c; unlink | each 200; ends `to_node ''`, label kept, version 3 | tests/rules/connections.rules.test.ts :: a choice may be empty and be linked, re-linked and unlinked later |
| C2 | no reach into another project | rules | foreign target on create and update; change from_node or project; outsider; anonymous | all refused; record unchanged | tests/rules/connections.rules.test.ts :: a choice cannot be linked into another project |
| C3 | uniqueness only for linked choices | rules | two empty; two `a → b`; re-link to b | empties allowed; duplicate refused | tests/rules/connections.rules.test.ts :: a node may have many empty choices but one choice per target |
| C4 | choice order | unit | three choices with created times and ids | by created, then id; trashed target absent | frontend/src/features/editor/model/choices.test.ts :: choicesOf lists a node's choices by when they were made, empty ones included |
| C5 | order stable under re-link | unit | change one choice's target | same order | frontend/src/features/editor/model/choices.test.ts :: choicesOf keeps the order when a choice is re-linked |
| C6 | duplicate check | unit | `a → b` as x | true; false excepting x; false for c | frontend/src/features/editor/model/choices.test.ts :: hasChoiceTo finds a duplicate target but not the choice itself |
| C7 | new choice record | unit | `newChoice('p','a',null,t,…)` | the exact record | frontend/src/features/editor/model/choices.test.ts :: newChoice makes an empty or linked choice at version 0 |
| C8 | markers ignore empty choices | unit | start a with only an empty choice; b | a End; b Unreachable | frontend/src/features/editor/model/markers.test.ts :: an empty choice is not an outgoing link |
| C9 | copy and paste | unit | copy a with an empty choice and an outside link | only the empty one, pasted empty with a new id | frontend/src/features/editor/model/clipboard.test.ts :: copy keeps a node's empty choices and paste keeps them empty |
| C10 | read mapping | unit | `to_node ''`, PocketBase time | `null`, ISO time | frontend/src/backend/content-mappers.test.ts :: an empty to_node reads as null and created is ISO |
| C11 | write mapping | unit | create and update with `toNodeId: null` | `to_node: ''`, no `created` | frontend/src/backend/content-mappers.test.ts :: a choice is created and unlinked with an empty to_node |
### Probes
**Probe folder:** none
### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | frontend/src/features/editor/model/choices.ts | `a.created.localeCompare(b.created) \|\| ` | `` | frontend/src/features/editor/model/choices.test.ts |
| B2 | frontend/src/features/editor/model/choices.ts | `c.toNodeId === null \|\| ` | `` | frontend/src/features/editor/model/choices.test.ts |
| B3 | frontend/src/features/editor/model/choices.ts | `c.id !== exceptId && ` | `` | frontend/src/features/editor/model/choices.test.ts |
### Flow
none
### Evidence
The full output of `npm run check:task`, the failing runs of Steps 1A.2 and 1B.2, and the full `npm run test:rules` result.
