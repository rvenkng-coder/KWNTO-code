# Task 1: The outbox model

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong
**Checkpoint 1A tier:** local
**Depends on:** Plan 3 (`ContentState`, `getRecord`, `putRecord`, `dropRecord` in `frontend/src/features/editor/model/state.ts`; the types in `frontend/src/backend/content-types.ts`)

Every decision the outbox makes, as pure functions: how a new edit joins the waiting ones (D5), how waiting edits are laid over data fresh from the server (D6, finding E), whether a 409 met by an offline edit is a real conflict (D3, D4), the backoff (D7) and the words the person sees. Design 8b names "the offline edit queue and conflict detection" as a unit-test priority.

**Files:**
- Create: `frontend/src/features/editor/sync/outbox.ts`, `frontend/src/features/editor/sync/outbox.test.ts`, `frontend/src/features/editor/sync/outboxText.ts`, `frontend/src/features/editor/sync/outboxText.test.ts`, `frontend/src/features/editor/sync/outboxStorage.ts`, `frontend/src/features/editor/sync/outboxStorage.test.ts`

**Interfaces:**
- Consumes: `ContentState`, `getRecord`, `putRecord`, `dropRecord` (Plan 3 Task 8); `ContentKind`, `CreatableKind`, `RemovableKind`, `ContentRecords` (Plan 3 Task 7).
- Produces, `sync/outboxText.ts` (checkpoint 1A):

```ts
export const BASE_DELAY_MS = 1000
export const MAX_DELAY_MS = 30000
export function nextDelay(attempt: number): number            // attempt 1 -> 1000, 2 -> 2000, ... capped at 30000; attempt < 1 -> 1000
export function statusText(online: boolean, waiting: number): string | null
// offline: 'Offline' (0), 'Offline, 1 change waiting', 'Offline, <n> changes waiting'; online: 'Saving…' when waiting > 0, else null
export function failedText(count: number): string             // '1 change could not be saved', '<n> changes could not be saved'
export function fieldLabel(kind: ContentKind, field: string): string
// title 'Title', color 'Colour', x and y 'Position', deleted 'In trash', character 'Character', text 'Text', sortOrder 'Order',
// type 'Cue type', label 'Choice text', toNodeId 'Choice target', name 'Name', startNodeId 'Start node', analyticsEnabled 'Analytics', position 'Tab order'; anything else: the field name
```

- Produces, `sync/outbox.ts` (checkpoint 1B):

```ts
interface EntryBase { seq: number; userId: string; projectId: string; id: string; offline: boolean; made: number }
export type OutboxEntry =
  | (EntryBase & { op: 'create'; kind: CreatableKind; record: ContentRecords[CreatableKind] })
  | (EntryBase & { op: 'update'; kind: ContentKind; changes: Record<string, unknown>; baseVersion: number;
      baseValues: Record<string, unknown>; snapshot: ContentRecords[RemovableKind] | null })  // snapshot: full record after the edit, lines/cues/connections only
  | (EntryBase & { op: 'remove'; kind: RemovableKind; record: ContentRecords[RemovableKind] })  // the local copy when removed
export type NewEntry = OutboxEntry extends infer E ? (E extends OutboxEntry ? Omit<E, 'seq'> : never) : never
export interface AddPlan { append: NewEntry | null; replace: OutboxEntry | null; drop: number[] }
export function planAdd(queue: OutboxEntry[], entry: NewEntry, sendingSeq: number | null): AddPlan
export function overlay(state: ContentState, queue: OutboxEntry[]): ContentState
export type ConflictCheck = { type: 'none' } | { type: 'fields'; fields: string[] } | { type: 'deleted' }
export function classifyConflict(entry: OutboxEntry, server: ContentRecords[ContentKind] | null): ConflictCheck
export function sameValue(a: unknown, b: unknown): boolean   // JSON comparison
```

  `planAdd` rules (D5): an `update` merges into the **last** entry of `queue` when that entry is an `update` of the same `kind` and `id` and its `seq` is not `sendingSeq` (result in `replace`: changes merged, newer value wins; `baseValues` keep the older entry's value per field; `baseVersion` the older; `offline` true if either is; `snapshot` the newer). A `remove` drops every waiting `update` of that record that is not being sent; if the record's `create` is waiting and not being sent, it drops that too and appends nothing. Otherwise `append` is the entry.
  `overlay` applies, in `seq` order, only entries whose `projectId` is the state's project: `create` puts the record if no record with that id exists; `update` merges `changes` into an existing record and keeps the record's `version`; `remove` drops it.
  `classifyConflict` (D4): `none` when the entry is not `offline`; for an `update`, `deleted` when `server` is `null`, otherwise the fields of `changes` whose server value differs from both the base value and the entry's value (when `x` or `y` is listed, every one of `x` and `y` in `changes` is listed); for a `remove`, `none` when `server` is `null`, otherwise the editable fields where `server` differs from `entry.record`; `create` is always `none`.
- Produces, `sync/outboxStorage.ts`:

```ts
export interface FailedEntry { entry: OutboxEntry; message: string }
export interface OutboxStorage {
  list(userId: string): Promise<OutboxEntry[]>          // by seq
  add(entry: NewEntry): Promise<number>                 // the new seq; stored before it resolves
  put(entry: OutboxEntry): Promise<void>                // replace by seq
  remove(seqs: number[]): Promise<void>
  fail(entry: OutboxEntry, message: string): Promise<void>  // moves it from entries to failed, one transaction
  failed(userId: string): Promise<FailedEntry[]>
  dismiss(seq: number): Promise<void>
}
export function createMemoryOutbox(): OutboxStorage    // seq starts at 1 and never repeats
```

**If interrupted:** nothing leaves state outside the working tree.

## Sized for the local model
**May touch:** `frontend/src/features/editor/sync/outboxText.ts`, `frontend/src/features/editor/sync/outboxText.test.ts` (exhaustive: no other file)
**Must not change:** the names and signatures in the `sync/outboxText.ts` Interfaces block above, and the exact copy in the router's Global Constraints
Stop and report if you need to touch anything else.
**Model server:** run `npm run ping:model` first; if it says NOT answering, do not start the run (see [the runbook](../../../developer/local-model-runbook.md))
**Checkpoint given:** Checkpoint 1A only

## Checkpoint 1A: Backoff and words (local)

- [x] **Step 1: Write the failing tests** C1 to C3 in `outboxText.test.ts`, each with a `// Protects:` header.
- [x] **Step 2: Run** `npx vitest run --project unit frontend/src/features/editor/sync/outboxText.test.ts`. Expected: FAIL (module not found).
- [x] **Step 3: Implement `outboxText.ts`.** The cap is the line `return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (attempt - 1))` (break B1); the plural is `waiting === 1 ? 'change' : 'changes'` (break B2).
- [x] **Step 4: Run** it. Expected: PASS. **Close checkpoint 1A** (commit `feat: outbox backoff and status words`).

## Checkpoint 1B: Merge, overlay, conflicts, storage (strong)

- [x] **Step 5: Write the failing tests** C4 to C8 (`outbox.test.ts` with the record builders of `model/fixtures.ts`; `outboxStorage.test.ts`).
- [x] **Step 6: Run** `npx vitest run --project unit frontend/src/features/editor/sync`. Expected: the new tests FAIL.
- [x] **Step 7: Implement `outbox.ts` and `outboxStorage.ts`.** Write these decisions as single lines so the breaks can find them: the base-value merge `baseValues: { ...entry.baseValues, ...last.baseValues }` (B3); the field test `!sameValue(serverValue, entry.baseValues[field]) && !sameValue(serverValue, entry.changes[field])` (B4); the first line of `classifyConflict` `if (!entry.offline) return NO_CONFLICT` (B5); in `overlay`, a create is skipped with `if (getRecord(s, entry.kind, entry.id) !== undefined) return s` (B6).
- [x] **Step 8: Run** them. Expected: PASS. **Close checkpoint 1B** (commit `feat: outbox merge, overlay and conflict rules`).

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | backoff | unit | `nextDelay` of 0, 1, 2, 3, 5, 6, 7, 50 | 1000, 1000, 2000, 4000, 16000, 30000, 30000, 30000 | frontend/src/features/editor/sync/outboxText.test.ts :: backoff doubles from one second and stops at thirty |
| C2 | status and failed words | unit | `statusText` of (false, 0), (false, 1), (false, 12), (true, 3), (true, 0); `failedText` of 1 and 4 | `Offline`, `Offline, 1 change waiting`, `Offline, 12 changes waiting`, `Saving…`, `null`; `1 change could not be saved`, `4 changes could not be saved` | frontend/src/features/editor/sync/outboxText.test.ts :: the status words count changes |
| C3 | field labels | unit | `fieldLabel('nodes','x')`, `('nodes','y')`, `('nodes','color')`, `('connections','label')`, `('connections','toNodeId')`, `('cues','type')`, `('nodes','weird')` | `Position`, `Position`, `Colour`, `Choice text`, `Choice target`, `Cue type`, `weird` | frontend/src/features/editor/sync/outboxText.test.ts :: each field has a readable label |
| C4 | merging waiting edits | unit | queue [update n1 title A→B (base 3)]; add update n1 title B→C and color; then the same with the first entry being sent; then with an update of n2 after the first | one entry: title C, color new, baseValues.title A, baseVersion 3; when sending: appended; with n2 in between: appended | frontend/src/features/editor/sync/outbox.test.ts :: an edit joins the last waiting edit of the same record only |
| C5 | removes cancel waiting work | unit | queue [create line L, update L text]; add remove L; queue [update L (sending), update L]; add remove L | first: drop both, append nothing; second: drop only the not-sending update, append the remove | frontend/src/features/editor/sync/outbox.test.ts :: removing a record cancels its waiting edits but never one being sent |
| C6 | overlay | unit | server state with node n1 title `Theirs` version 7 and color red; queue for this project [update n1 color blue, create line L, create line K (the server already has K with other text: my lost answer), remove line M] plus one entry of another project | n1 title `Theirs`, color blue, version 7; L present; K keeps the server's text; M gone; the other project's entry ignored | frontend/src/features/editor/sync/outbox.test.ts :: waiting edits are laid over fresh server data |
| C7 | conflict rules | unit | offline update title base `A` mine `B`: server `C`; server `B` (my lost answer); server `A`; color untouched by me changed on server; x conflicting with y also in changes; server null; the same entry not offline with server `C` | fields [title]; none; none; none; [x, y]; deleted; none | frontend/src/features/editor/sync/outbox.test.ts :: only a change by someone else to the same attribute is a conflict |
| C8 | remove and create conflicts | unit | offline remove of line L whose server text differs; server null; equal server; create entry | fields [text]; none; none; none | frontend/src/features/editor/sync/outbox.test.ts :: a removed record edited by someone else is a conflict |
| C9 | memory storage | unit | add three entries; put one; fail the second with `nope`; remove the first; list; failed; dismiss; add again | seqs 1, 2, 3, 4 (never reused); list [3, 4]; failed [{2, `nope`}] then []; entries of another user not listed | frontend/src/features/editor/sync/outboxStorage.test.ts :: the memory outbox keeps order and moves failed entries |
### Probes
**Probe folder:** `tests/probes/2026-11-16-offline-sync/task-1/`
### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | frontend/src/features/editor/sync/outboxText.ts | `return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (attempt - 1))` | `return BASE_DELAY_MS * 2 ** (attempt - 1)` | frontend/src/features/editor/sync/outboxText.test.ts |
| B2 | frontend/src/features/editor/sync/outboxText.ts | `waiting === 1 ? 'change' : 'changes'` | `'changes'` | frontend/src/features/editor/sync/outboxText.test.ts |
| B3 | frontend/src/features/editor/sync/outbox.ts | `baseValues: { ...entry.baseValues, ...last.baseValues }` | `baseValues: { ...last.baseValues, ...entry.baseValues }` | frontend/src/features/editor/sync/outbox.test.ts |
| B4 | frontend/src/features/editor/sync/outbox.ts | `!sameValue(serverValue, entry.baseValues[field]) && !sameValue(serverValue, entry.changes[field])` | `!sameValue(serverValue, entry.baseValues[field])` | frontend/src/features/editor/sync/outbox.test.ts |
| B5 | frontend/src/features/editor/sync/outbox.ts | `if (!entry.offline) return NO_CONFLICT` | `if (false) return NO_CONFLICT` | frontend/src/features/editor/sync/outbox.test.ts |
| B6 | frontend/src/features/editor/sync/outbox.ts | `if (getRecord(s, entry.kind, entry.id) !== undefined) return s` | `if (false) return s` | frontend/src/features/editor/sync/outbox.test.ts |
### Flow
none
### Evidence
The full output of `npm run check:task` and the failing run of each break.
