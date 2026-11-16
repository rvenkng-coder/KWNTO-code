# Task 3: The sync engine

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong
**Depends on:** Tasks 1 and 2

The one loop that sends outbox entries: in `seq` order, one at a time (D2), only in the tab holding the lock (D9), backing off while the server cannot be reached (D7), moving a refused entry to the failed list (D8) and stopping for the person on a real conflict (D12). Everything it touches is injected, so it is unit-tested with fakes: a memory outbox, a fake door, a fake clock and a fake lock.

**Files:**
- Create: `frontend/src/features/editor/sync/syncEngine.ts`, `frontend/src/features/editor/sync/syncSend.ts` (sending one entry, so each file stays under the limits), `frontend/src/features/editor/sync/syncEngine.test.ts`, `frontend/src/features/editor/sync/fakes.ts` (fake door, clock and lock for tests)

**Interfaces:**
- Consumes: `OutboxEntry`, `NewEntry`, `planAdd`, `classifyConflict`, `OutboxStorage`, `FailedEntry`, `nextDelay` (Task 1); `content.get`, `content.update` with `shouldRetry`, `EditConflict` (Task 2); `BackendError` (Plan 2).
- Produces, `sync/syncEngine.ts`:

```ts
export type SyncDoor = Pick<Backend['content'], 'get' | 'create' | 'update' | 'remove'>
export interface PendingConflict { entry: OutboxEntry; server: ContentRecords[ContentKind] | null; fields: string[]; deleted: boolean }
export interface SyncSnapshot {
  online: boolean; owner: boolean; waiting: number; sendingSeq: number | null
  failed: FailedEntry[]; conflict: PendingConflict | null; entries: OutboxEntry[]   // entries: waiting, by seq (the overlay reads them)
}
export interface SyncHooks {
  saved(entry: OutboxEntry, record: ContentRecords[ContentKind] | null): void   // null after a remove
  refused(entry: OutboxEntry, error: BackendError): void
  theirs(entry: OutboxEntry, server: ContentRecords[ContentKind] | null): void  // the person kept the server's version
}
export interface SyncDeps {
  userId: string; door: SyncDoor; storage: OutboxStorage; hooks: SyncHooks
  clock: { now(): number; setTimeout(fn: () => void, ms: number): unknown; clearTimeout(handle: unknown): void }
  lock(name: string, run: () => Promise<void>): Promise<void>     // navigator.locks.request in the app
  channel: { post(): void; listen(fn: () => void): () => void }    // BroadcastChannel 'kwnto-outbox' in the app: "the outbox changed"
}
export interface SyncEngine {
  start(): void                         // asks for the lock `kwnto-sync-<userId>`; sends while holding it
  stop(): Promise<void>                 // releases the lock; a send in flight finishes, nothing new starts
  add(entry: Omit<NewEntry, 'userId' | 'offline' | 'made'>): Promise<number>   // planAdd + storage; offline = !online; resolves with the seq once stored
  setOnline(online: boolean): void      // the window's online/offline events; true also resets the backoff and sends at once
  resolve(choice: 'mine' | 'theirs'): Promise<void>
  dismiss(seq: number): Promise<void>
  snapshot(): SyncSnapshot
  subscribe(listener: (s: SyncSnapshot) => void): () => void
}
export function createSyncEngine(deps: SyncDeps): SyncEngine
export const LOCK_PREFIX = 'kwnto-sync-'
```

- Sending one entry (`syncSend.ts`), by `op`:
  - `create`: `door.create`. If it rejects with `invalid` and `fields.id`, `door.get` the id: found in the same project → done (a lost answer); otherwise refused.
  - `update`: `door.update(kind, id, changes, baseVersion, { shouldRetry })` where `shouldRetry` is given only for an `offline` entry and is `(cur) => classifyConflict(entry, cur).type === 'none'`. `EditConflict` → conflict with `classifyConflict(entry, err.server)`. `not-found` → for a line, cue or connection of an `offline` entry, a `deleted` conflict; otherwise refused.
  - `remove`: for an `offline` entry first `door.get`: `null` → done; a `fields` conflict → conflict. Then `door.remove`; `not-found` → done.
  - Any `unreachable` → the entry is stored again with `offline: true`, the engine goes offline and waits `nextDelay(attempt)`. Any other error → `storage.fail(entry, error.message)`, `hooks.refused`, go on.
- `resolve('mine')`: `update` → the entry is stored again with `baseVersion` = `server.version` and each conflicting field's `baseValues` = the server's value, then sent like any entry (a further change by someone else raises a new dialog). `deleted` → replaced by a `create` of `entry.snapshot`. A `remove` conflict → `door.remove`. `resolve('theirs')` → the entry is removed and `hooks.theirs(entry, server)` is called; nothing is sent.

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 3A: Order, success, offline, lost answers

- [ ] **Step 1: Write `fakes.ts` and the failing tests** C1 to C4. The fake door records each call and answers from a script; the fake clock runs timers when the test says; the fake lock grants one holder per name at a time and queues the rest.
- [ ] **Step 2: Run** `npx vitest run --project unit frontend/src/features/editor/sync/syncEngine.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `syncEngine.ts` and `syncSend.ts` for C1 to C4. Write the lost-create rule as the line `if (isIdTaken(error)) return confirmCreated(entry)` (B1) and the retry delay as `const delay = nextDelay(attempt)` after `attempt += 1`, with `let attempt = 0` at the start and the reset after any successful send written as the line `attempt = 0 // reset after a success` (B2).
- [ ] **Step 4: Run** it. Expected: PASS. **Close checkpoint 3A** (commit `feat: sync engine sends the outbox in order`).

## Checkpoint 3B: Refusals, conflicts, two tabs

- [ ] **Step 5: Write the failing tests** C5 to C8.
- [ ] **Step 6: Run** them. Expected: the new tests FAIL.
- [ ] **Step 7: Implement** them. The loop stops for a conflict with the line `if (conflict !== null) return` at the top of each pass (B3).
- [ ] **Step 8: Run** `npm run test:unit`. Expected: PASS. **Close checkpoint 3B** (commit `feat: sync engine handles refusals, conflicts and two tabs`).

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | strict order, one at a time | unit | add create node, update node, create line; the door answers each after the test releases it | calls in that order; the second starts only after the first answer; `waiting` 3, 2, 1, 0; each entry removed from storage only after its answer | frontend/src/features/editor/sync/syncEngine.test.ts :: entries are sent in order one at a time |
| C2 | success | unit | update answered with version 8 | `hooks.saved` with the saved record; storage empty; snapshot `waiting` 0 | frontend/src/features/editor/sync/syncEngine.test.ts :: a saved entry leaves the outbox and reports the record |
| C3 | offline and backoff | unit | door rejects `unreachable` 3 times then accepts; a second entry then rejected `unreachable` once; clock advanced; then `setOnline(false)`, an add, `setOnline(true)` | waits 1000, 2000, 4000 ms between tries, and 1000 again for the second entry (reset by the success); `online` false while failing; the entry stored with `offline: true`; after `setOnline(true)` the send happens without advancing the clock | frontend/src/features/editor/sync/syncEngine.test.ts :: an unreachable server is retried with backoff and at once when back online |
| C4 | lost answers | unit | create rejected `invalid` with `fields.id` and `get` returns the record; offline remove where `get` returns null; offline update where the door's `shouldRetry` is asked with a record already holding my value | each counts as done (`hooks.saved`), nothing refused, no conflict; for the update `shouldRetry` returned true | frontend/src/features/editor/sync/syncEngine.test.ts :: a save whose answer was lost counts as done |
| C5 | refused entry | unit | three entries; the second rejected `forbidden` `Not allowed.` | the third is still sent; `failed` holds the second with `Not allowed.`; `hooks.refused` called once; `dismiss` empties `failed` (and storage's failed list) | frontend/src/features/editor/sync/syncEngine.test.ts :: a refused entry goes to the failed list and the queue goes on |
| C6 | conflict and the two choices | unit | offline update of title; door rejects `EditConflict` with server title `Theirs` version 9; then an update of another record waiting behind it; `resolve('mine')`; again with `resolve('theirs')`; a line update rejected `not-found` then `resolve('mine')` | snapshot `conflict` with fields [title] and nothing else sent while it is open; mine: the entry re-sent with base version 9 and then the next entry; theirs: no send, `hooks.theirs` with the server record, entry gone; deleted line: a `create` of the snapshot is sent | frontend/src/features/editor/sync/syncEngine.test.ts :: a real conflict waits for the person and then keeps their choice |
| C7 | two tabs | unit | two engines, one memory storage, one fake lock, one fake channel; tab B adds 3 entries while tab A holds the lock; A stops; B then adds 1 more | A sends B's 3 entries (woken by the channel), each once; after A stops, B takes the lock and sends the 4th; no entry sent twice | frontend/src/features/editor/sync/syncEngine.test.ts :: only the tab holding the lock sends and another takes over |
| C8 | online edits never conflict | unit | entry made online (`offline: false`) meets 409s inside the door | `door.update` called without `shouldRetry`; no conflict; Plan 3's `TOO_BUSY` refusal goes to the failed list like any refusal | frontend/src/features/editor/sync/syncEngine.test.ts :: an edit made online is retried silently as before |
### Probes
**Probe folder:** `tests/probes/2026-11-16-offline-sync/task-3/`
### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | frontend/src/features/editor/sync/syncSend.ts | `if (isIdTaken(error)) return confirmCreated(entry)` | `if (false) return confirmCreated(entry)` | frontend/src/features/editor/sync/syncEngine.test.ts |
| B2 | frontend/src/features/editor/sync/syncEngine.ts | `attempt = 0 // reset after a success` | `attempt = attempt // reset after a success` | frontend/src/features/editor/sync/syncEngine.test.ts |
| B3 | frontend/src/features/editor/sync/syncEngine.ts | `if (conflict !== null) return` | `if (false) return` | frontend/src/features/editor/sync/syncEngine.test.ts |
### Flow
none
### Evidence
The full output of `npm run check:task` and the failing run of each break.
