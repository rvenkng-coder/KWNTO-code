# Task 8: Editor model and store

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid
**Checkpoint 8A tier:** local
**Depends on:** Task 7

The editor's state as plain data with pure functions over it, and one store that loads a project, applies edits optimistically, sends them through the door and applies teammates' live changes. Screens (Tasks 9 to 13) read and change content only through this store.

**Files:**
- Create: `frontend/src/features/editor/model/ids.ts`, `ids.test.ts`, `sortOrder.ts`, `sortOrder.test.ts`, `state.ts`, `state.test.ts`, `remote.ts`, `remote.test.ts` (all in `frontend/src/features/editor/model/`); `frontend/src/features/editor/store/editorStore.ts`, `frontend/src/features/editor/store/editorStore.test.ts`
- Modify: `docs/developer/editor.md` (new: the model, the store, how an edit travels)

**Interfaces:**
- Consumes: the types and `backend.content` of Task 7.
- Produces, `model/ids.ts`: `newId(random?: (bytes: Uint8Array) => Uint8Array): string` (15 characters from `a-z0-9`; default `crypto.getRandomValues`; maps each byte to `ALPHABET[byte % 36]` with `const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'`; the slight modulo bias is irrelevant for ids).
- Produces, `model/sortOrder.ts` (decision D4):

```ts
export function sortOrderBetween(before: number | null, after: number | null): number | null
// (null, null) -> 1; (null, a) -> a - 1; (b, null) -> b + 1; (b, a) -> (b + a) / 2,
// or null ("renumber") when that midpoint is not strictly between b and a, or b >= a, or any value is not finite
export function renumber(count: number): number[]   // [1, 2, ..., count]; [] for 0
export function byOrder<T extends { sortOrder: number; id: string }>(a: T, b: T): number // sortOrder, then id

// Moving and inserting in an ordered list (chapter tabs use `position`, lines and cues `sortOrder`; callers map to `order`).
export interface Ordered { id: string; order: number }
export type Placement = { kind: 'one'; id: string; order: number } | { kind: 'renumber'; orders: Ordered[] }
export function placeAt(list: Ordered[], id: string, index: number): Placement | null
// list is in display order; moves id so it ends at `index` of the result. null when id is unknown, index is outside
// [0, list.length - 1], or id is already there. 'one' when sortOrderBetween finds room, else 'renumber' of the whole
// result list (1, 2, 3, ...)
export function insertAt(list: Ordered[], id: string, index: number): Placement
// id is new; index in [0, list.length] (clamped); same rule for 'one' versus 'renumber' (the renumbered list includes id)
```

- Produces, `model/state.ts`:

```ts
export interface ContentState {
  project: Project | null; settings: ProjectSettings | null
  chapters: Record<string, Chapter>; nodes: Record<string, StoryNode>; lines: Record<string, ScriptLine>
  cues: Record<string, Cue>; connections: Record<string, Connection>
}
export const EMPTY_STATE: ContentState
export function fromContent(content: ProjectContent): ContentState
export function liveChapters(s: ContentState): Chapter[]                     // not trashed; by position, then id
export function isLiveNode(s: ContentState, nodeId: string): boolean          // exists, not trashed, its chapter exists and is not trashed
export function liveNodes(s: ContentState, chapterId?: string): StoryNode[]  // isLiveNode, optionally of one chapter
export function liveConnections(s: ContentState): Connection[]               // both ends live
export function linesOf(s: ContentState, nodeId: string): ScriptLine[]       // byOrder
export function cuesOf(s: ContentState, nodeId: string): Cue[]               // byOrder
export function putRecord<K extends ContentKind>(s: ContentState, kind: K, record: ContentRecords[K]): ContentState // new object
export function dropRecord(s: ContentState, kind: ContentKind, id: string): ContentState
```

- Produces, `model/remote.ts`: `applyRemote(s: ContentState, event: RemoteEvent): ContentState` (returns `s` itself when it ignores the event: another project, or a create/update whose `version` is not greater than the local copy's (D15); a delete drops the record).
- Produces, `store/editorStore.ts`:

```ts
export type EditorDoor = Pick<Backend['content'], 'load' | 'create' | 'update' | 'remove' | 'subscribe'>
export interface EditorStore {
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null                        // shown in a banner by Task 9
  saving: number                              // door calls in flight (create, update, remove); Task 11 warns before unload while > 0
  content: ContentState
  open(projectId: string): Promise<void>     // closes any open project, loads, subscribes
  close(): Promise<void>
  create<K extends CreatableKind>(kind: K, record: ContentRecords[K]): Promise<boolean>
  update<K extends ContentKind>(kind: K, id: string, changes: Partial<EditableFields[K]>): Promise<boolean>
  remove(kind: RemovableKind, id: string): Promise<boolean>
  dismissError(): void
}
export function createEditorStore(door: EditorDoor): StoreApi<EditorStore>   // zustand/vanilla createStore
export const editorStore: StoreApi<EditorStore>                              // createEditorStore(backend.content)
export function useEditor<T>(selector: (s: EditorStore) => T): T
```

  An edit is applied to `content` at once, then sent; `update` sends the local `version` as the base. On success the saved record replaces the local one only if its `version` is higher. On failure the record goes back to what it was before this edit and `error` is the `BackendError` message; the method resolves `false`.

**If interrupted:** nothing leaves state outside the working tree.

## Sized for the local model
**May touch:** `frontend/src/features/editor/model/ids.ts`, `ids.test.ts`, `sortOrder.ts`, `sortOrder.test.ts` in that folder (exhaustive: no other file)
**Must not change:** the signatures of `newId`, `sortOrderBetween`, `renumber`, `byOrder`, `placeAt`, `insertAt` and the `Ordered` and `Placement` types above
Stop and report if you need to touch anything else.
**Model server:** run `npm run ping:model` first; if it says NOT answering, do not start the run (see [the runbook](../../../developer/local-model-runbook.md))
**Checkpoint given:** Checkpoint 8A only

## Checkpoint 8A: Ids and sort order (local)

- [ ] **Step 1: Write the failing tests** C1 to C5 and C14 to C15.
- [ ] **Step 2: Run** `npx vitest run --project unit frontend/src/features/editor/model`. Expected: FAIL.
- [ ] **Step 3: Implement `ids.ts` and `sortOrder.ts`.** Write the midpoint check as `if (!(mid > before && mid < after)) return null` (break B1).
- [ ] **Step 4: Run** the same command. Expected: PASS. **Close checkpoint 8A** (commit `feat: client ids and decimal sort order`).

## Checkpoint 8B: State and remote events

- [ ] **Step 5: Write the failing tests** C6 to C9 in `state.test.ts` and `remote.test.ts`.
- [ ] **Step 6: Run** them. Expected: FAIL.
- [ ] **Step 7: Implement `state.ts` and `remote.ts`.** In `isLiveNode` write the chapter check as `chapter !== undefined && !chapter.deleted`; in `applyRemote` the version check as `existing.version >= event.record.version` (breaks B2, B3).
- [ ] **Step 8: Run** them. Expected: PASS. **Close checkpoint 8B** (commit `feat: editor state and remote events`).

## Checkpoint 8C: The store

- [ ] **Step 9: Write the failing tests** C10 to C13 in `editorStore.test.ts`, with a fake `EditorDoor` whose calls the test resolves by hand (deferred promises), so "before the answer" can be asserted.
- [ ] **Step 10: Run** them. Expected: FAIL.
- [ ] **Step 11: Implement `editorStore.ts`.** `open` keeps a counter `openToken`; a load or subscribe that finishes after a newer `open` or a `close` is dropped with `if (token !== openToken) return` (break B4) and its subscription closed.
- [ ] **Step 12: Run** `npm run test:unit`. Expected: PASS. Write `docs/developer/editor.md` (state shape, what "live" means, how an edit travels: store, door, guard, event echo). **Close checkpoint 8C** (commit `feat: editor store`).

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | ids | unit | `newId()` 1,000 times; `newId(() => bytes of 255)` | 15 characters of `a-z0-9`, no repeats; deterministic `'333333333333333'` (255 % 36 = 3) | frontend/src/features/editor/model/ids.test.ts :: newId makes 15-character PocketBase ids |
| C2 | ends and empty list | unit | `(null, null)`, `(null, 4)`, `(4, null)` | `1`, `3`, `5` | frontend/src/features/editor/model/sortOrder.test.ts :: sortOrderBetween handles an empty list and both ends |
| C3 | midpoint and no room | unit | `(1, 2)`; `(2, 2)`; `(3, 1)`; `(1, 1 + Number.EPSILON)`; `(NaN, 1)` | `1.5`; `null`; `null`; `null`; `null` | frontend/src/features/editor/model/sortOrder.test.ts :: sortOrderBetween returns null when there is no room |
| C4 | 60 inserts in one gap keep the order | unit | repeatedly insert right after the first of `[1, 2]`, renumbering on `null` | after each insert the list sorted by `byOrder` is the insertion order; at least one renumber happened | frontend/src/features/editor/model/sortOrder.test.ts :: repeated inserts in one gap keep the order |
| C5 | renumber and ties | unit | `renumber(0)`, `renumber(3)`; two items with equal sortOrder | `[]`, `[1,2,3]`; tie broken by id | frontend/src/features/editor/model/sortOrder.test.ts :: renumber and byOrder |
| C14 | moving in a list | unit | A 1, B 2, C 3: `placeAt(C, 0)`; `placeAt(A, 2)`; `placeAt(B, 1)`; `placeAt(X, 0)`; `placeAt(A, 3)`; A 1, B 1, C 3: `placeAt(C, 1)` | `one` C 0; `one` A 4; `null`; `null`; `null`; `renumber` A 1, C 2, B 3 | frontend/src/features/editor/model/sortOrder.test.ts :: placeAt moves an item and renumbers when there is no room |
| C15 | inserting in a list | unit | A 1, B 2: `insertAt(N, 1)`; `insertAt(N, 0)`; `insertAt(N, 9)`; empty list `insertAt(N, 0)`; A 1, B 1: `insertAt(N, 1)` | `one` N 1.5; `one` N 0; `one` N 3; `one` N 1; `renumber` A 1, N 2, B 3 | frontend/src/features/editor/model/sortOrder.test.ts :: insertAt places a new item and renumbers when there is no room |
| C6 | live records | unit | a trashed node; a live node in a trashed chapter; a connection to the trashed node | `liveNodes` and `liveConnections` exclude all three | frontend/src/features/editor/model/state.test.ts :: trashed nodes and chapters hide what they hold |
| C7 | ordering | unit | chapters at positions 2, 1, 1.5; lines out of order | `liveChapters` and `linesOf` sorted | frontend/src/features/editor/model/state.test.ts :: chapters and lines come back in order |
| C8 | remote versions | unit | update with version equal to, lower than and higher than local; create of an unknown id | ignored (same object), ignored, applied, added | frontend/src/features/editor/model/remote.test.ts :: only newer remote records replace local ones |
| C9 | remote delete and other projects | unit | delete event; update for another project id | record dropped; same object returned | frontend/src/features/editor/model/remote.test.ts :: deletes apply and other projects are ignored |
| C10 | optimistic edit | unit | `update('nodes', id, { title: 'B' })` with the door unresolved; then resolve with version 4 | title `B` before the answer; version 4 after | frontend/src/features/editor/store/editorStore.test.ts :: an edit shows at once and takes the saved version |
| C11 | failed edit is rolled back | unit | door rejects `forbidden` with message `m` | title back to `A`, `error` is `m`, resolves `false` | frontend/src/features/editor/store/editorStore.test.ts :: a refused edit is rolled back with its message |
| C12 | live events reach the state | unit | after `open`, the fake door emits an update with a newer version | `content` shows it | frontend/src/features/editor/store/editorStore.test.ts :: a teammate's change reaches the open project |
| C13 | a late load of an old project is dropped | unit | `open(A)`, `open(B)`, then A's load and subscribe resolve last | content is B's; A's subscription closed | frontend/src/features/editor/store/editorStore.test.ts :: a slow load of a project that was left is ignored |
### Probes
**Probe folder:** `tests/probes/2026-11-14-editor-core/task-8/`
### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | frontend/src/features/editor/model/sortOrder.ts | `if (!(mid > before && mid < after)) return null` | `if (false) return null` | frontend/src/features/editor/model/sortOrder.test.ts |
| B2 | frontend/src/features/editor/model/state.ts | `chapter !== undefined && !chapter.deleted` | `chapter !== undefined` | frontend/src/features/editor/model/state.test.ts |
| B3 | frontend/src/features/editor/model/remote.ts | `existing.version >= event.record.version` | `existing.version > event.record.version` | frontend/src/features/editor/model/remote.test.ts |
| B4 | frontend/src/features/editor/store/editorStore.ts | `if (token !== openToken) return` | `if (false) return` | frontend/src/features/editor/store/editorStore.test.ts |
### Flow
none (no screen yet)
### Evidence
The full output of `npm run check:task` and the failing run of each break.
