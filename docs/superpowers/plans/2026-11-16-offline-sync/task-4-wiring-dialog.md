# Task 4: Wiring, status, conflict dialog

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong
**Depends on:** Task 3

Puts the outbox into the app: the real IndexedDB storage (D1), one engine per signed-in user (D9, D10), every editor edit going through it (D11), the project reloaded and overlaid after a reconnect (D6), and the screens the person sees: the status in the top bar, the failed list and the conflict dialog (copy in the router).

**Files:**
- Create: `frontend/src/features/editor/sync/indexedDbOutbox.ts`, `frontend/src/features/editor/sync/syncStore.ts`, `frontend/src/features/editor/sync/syncLifecycle.ts`, `frontend/src/features/editor/sync/syncLifecycle.test.ts`, `frontend/src/features/editor/sync/SyncStatus.tsx`, `frontend/src/features/editor/sync/FailedList.tsx`, `frontend/src/features/editor/sync/ConflictDialog.tsx`, `frontend/src/features/editor/store/editorSync.ts`, `frontend/src/features/editor/store/editorSync.test.ts`, `e2e/editor-offline.spec.ts`, `e2e/helpers/offline.ts`
- Modify: `frontend/src/features/editor/store/editorStore.ts`, `editorEdits.ts`, `editorSession.ts`, `edits.ts`, `edits.test.ts` (in `store/`; D11); the top bar (`frontend/src/features/shell/TopBar.tsx`: `SyncStatus`, and the in-page sign-out question of D13); `frontend/src/features/editor/EditorScreen.tsx` (mounts `ConflictDialog`); `e2e/helpers/admin.ts` (`adminRecord`); `docs/user/editor.md` ("Working offline"); `docs/developer/editor.md` ("How an edit travels" rewritten for the outbox)

**Interfaces:**
- Consumes: `createSyncEngine`, `SyncEngine`, `SyncHooks`, `SyncSnapshot`, `LOCK_PREFIX` (Task 3); `OutboxStorage`, `createMemoryOutbox`, `overlay`, `statusText`, `failedText`, `fieldLabel` (Task 1); `content.get`, `subscribe(..., onReconnect)` (Task 2); `backend.auth.onChange`, `backend.auth.current` (Plan 2); `editorStore`, `restoreFields` logic of `editorEdits.ts` (Plan 3 Task 8).
- Produces:

```ts
// sync/indexedDbOutbox.ts
export const OUTBOX_DB = 'kwnto-outbox'
export function createIndexedDbOutbox(): OutboxStorage   // D1; every method one IndexedDB transaction; add resolves after the transaction's complete event
// sync/syncLifecycle.ts
export function createSyncLifecycle(
  onUser: (listener: (userId: string | null) => void) => () => void,
  makeEngine: (userId: string) => SyncEngine,
): { current(): SyncEngine | null; subscribe(fn: (e: SyncEngine | null) => void): () => void }
// a new user stops the old engine and starts a new one; null stops it; the same user twice does nothing
// sync/syncStore.ts
export const syncLifecycle: ReturnType<typeof createSyncLifecycle>   // IndexedDB, navigator.locks, BroadcastChannel('kwnto-outbox'), window online/offline
export function useSync<T>(selector: (s: SyncSnapshot | null) => T): T
// store/editorSync.ts: the store's port to the engine
export interface EditorSyncPort {
  add: SyncEngine['add']; snapshot(): SyncSnapshot | null; subscribe(fn: (s: SyncSnapshot | null) => void): () => void
  register(hooks: SyncHooks): () => void
}
export function directSync(door: EditorDoor): EditorSyncPort   // an engine on a memory outbox, always online, lock granted at once: the default in tests
export function appSync(): EditorSyncPort                      // the app's: follows syncLifecycle
```

  `store/edits.ts` (Plan 3): `createEdits(store, flush, undoPaused: () => string | null = () => null)`; `undo` and `redo` start with `const paused = undoPaused()` and the line `if (paused !== null) return store.setState({ error: paused })` (B3), before `settle`. The app's `edits` passes `undoPausedBy(appSync())` from `editorSync.ts`: `export const UNDO_PAUSED = 'Undo waits until you are back online and your changes are saved.'` and `export function undoPausedBy(port: EditorSyncPort): () => string | null` (the message while the snapshot is offline with `waiting > 0`, else `null`).
  `createEditorStore(door, sync?: EditorSyncPort)`: `sync` defaults to `directSync(door)`, so Plan 3's store tests run unchanged. `EditorDoor` gains `get`. `editorStore` is built with `appSync()`.
- Screens: `SyncStatus` (`data-testid="sync-status"`, the `statusText`, and when `failed` is not empty the `failedText` with a `Show` button opening `FailedList`, one row per entry: `fieldLabel`s, the message, `Dismiss`); `ConflictDialog` (`role="dialog"`, copy from the router; values shown as text; a colour as its name; `Position` as `x, y`; a `Choice target` as the target node's title, or `No target` for an empty choice).

**If interrupted:** nothing leaves state outside the working tree. The e2e tests leave IndexedDB data only in Playwright's throwaway browser profiles.

## Checkpoint 4A: Storage and the engine's lifecycle

- [x] **Step 1: Write the failing tests** C1 (`e2e/editor-offline.spec.ts`: the page imports `/src/features/editor/sync/indexedDbOutbox.ts` through the Vite dev server inside `page.evaluate`) and C2 (`syncLifecycle.test.ts`).
- [x] **Step 2: Run** `npx vitest run --project unit frontend/src/features/editor/sync/syncLifecycle.test.ts` and `npm run test:e2e -- e2e/editor-offline.spec.ts`. Expected: FAIL.
- [x] **Step 3: Implement** `indexedDbOutbox.ts`, `syncLifecycle.ts` and `syncStore.ts`. The user switch is the line `if (userId === currentUser) return` (B1).
- [x] **Step 4: Run** them. Expected: PASS. **Close checkpoint 4A** (commit `feat: browser outbox and one sync engine per account`).

## Checkpoint 4B: The store goes through the outbox

- [x] **Step 5: Write the failing tests** C3 to C7 in `editorSync.test.ts` and C13 in `edits.test.ts` (a store from `createEditorStore` with Plan 3's fake door plus `get`, and a port built on `createSyncEngine` with a memory outbox the test can pre-fill).
- [x] **Step 6: Run** `npx vitest run --project unit frontend/src/features/editor/store`. Expected: the new tests FAIL; Plan 3's `editorStore.test.ts` passes.
- [x] **Step 7: Implement.** `editorEdits.ts`: apply locally as today, then `sync.add` an entry (`baseVersion` and `baseValues` from the record before the edit; `snapshot` for lines, cues and connections); keep each edit's resolver and `before` by seq, resolve on `hooks.saved` / `hooks.refused`; a refusal with no `before` in memory (an entry from before a reload) takes `door.get`'s record, or drops the record when it is `null`. `editorSession.ts`: after the load, `overlay` with the snapshot's entries; every remote event is applied with `applyRemote` and then overlaid again, written as the line `content: overlay(applyRemote(st.content, event), waitingEntries())` (B2); on `onReconnect`, and when the snapshot's `online` turns from false to true, load again and overlay; when it turns to false, close the subscriptions (D6) and open them again on the way back.
- [x] **Step 8: Run** `npm run test:unit`. Expected: PASS. **Close checkpoint 4B** (commit `feat: editor edits go through the outbox`).

## Checkpoint 4C: Screens and flows

- [x] **Step 9: Write the failing tests** C8 to C12 and C14 in `e2e/editor-offline.spec.ts`. `e2e/helpers/offline.ts`: `goOffline(context)` and `goOnline(context)` (`context.setOffline`, then wait for `sync-status` to show or hide `Offline`). `adminRecord(collection, id)` in `e2e/helpers/admin.ts` reads a record as the admin.
- [x] **Step 10: Run** `npm run test:e2e -- e2e/editor-offline.spec.ts`. Expected: FAIL.
- [x] **Step 11: Implement** `SyncStatus`, `FailedList`, `ConflictDialog`, the top-bar wiring and the in-page sign-out question (D13: `role="alertdialog"`, the router's copy, `Sign out anyway` and `Stay signed in`; only when `waiting > 0`).
- [x] **Step 12: Run** `npm run test:unit` and `npm run test:e2e`. Expected: PASS. Write "Working offline" in `docs/user/editor.md` (the indicator, what survives closing the tab, the dialog, the failed list, undo after sync, D10's shared-computer note) and the outbox in `docs/developer/editor.md`. **Close checkpoint 4C** (commit `feat: offline status, failed list and conflict dialog`).

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | browser outbox survives a reload | e2e | in the page: add 3 entries for user U and 1 for user V; fail the second; reload; list U, failed U | list [1, 3]; failed [2 with its message]; V's entry not in U's list | e2e/editor-offline.spec.ts :: the browser outbox keeps entries across a reload |
| C2 | one engine per account | unit | `onUser` gives `u1`, `u1`, `u2`, `null` | engines made for u1 then u2; u1's stopped before u2's starts; `current()` null at the end; no second engine for the repeated u1 | frontend/src/features/editor/sync/syncLifecycle.test.ts :: each account gets its own sync engine |
| C3 | an edit is queued with its base | unit | node n1 version 4 title `A`; `update('nodes','n1',{title:'B'})` | the outbox holds an update with `baseVersion` 4, `baseValues` `{title:'A'}`; the store shows `B` at once; the promise resolves `true` after the door answers | frontend/src/features/editor/store/editorSync.test.ts :: an edit is stored with the version and value it started from |
| C4 | waiting edits show after opening | unit | outbox pre-filled with an update of n1 color `blue`; `open` loads n1 color `red` | n1 shows `blue`; then it is sent and the store keeps `blue` with the new version | frontend/src/features/editor/store/editorSync.test.ts :: waiting edits are shown over a freshly loaded project |
| C5 | a live event keeps the waiting field | unit | an entry for n1 color waits (door not answering); event: n1 title `Theirs`, version 9 | title `Theirs`, color still mine | frontend/src/features/editor/store/editorSync.test.ts :: a teammate's live change does not hide my waiting edit |
| C6 | reconnect reloads | unit | after `open`, the fake door's `onReconnect` is called; the second load has n2 added and n1 title changed | `load` called twice; n2 shown; n1 title the new one, with waiting fields still mine | frontend/src/features/editor/store/editorSync.test.ts :: a reconnect reloads the project and keeps waiting edits |
| C7 | refused after a reload | unit | an entry from before (no resolver) is refused; `door.get` returns the server node | the store shows the server node; the failed list has the entry | frontend/src/features/editor/store/editorSync.test.ts :: a refused edit from before a reload shows the server's copy |
| C8 | offline edits wait and then save | e2e | open a project with 3 nodes; go offline; rename one, recolour one, add a line to the third | status `Offline, 3 changes waiting`; no request reached the server (admin read shows the old values); go online: status gone; after reload every change is there | e2e/editor-offline.spec.ts :: edits made offline are saved when the connection returns |
| C9 | closing the tab offline keeps typed text | e2e | go offline; type a new title and close the page at once (`runBeforeUnload`); admin read shows the old title; go online; open a new page and the project | the new title on screen and, by `expect.poll`, on the server | e2e/editor-offline.spec.ts :: text typed just before closing an offline tab is not lost |
| C10 | teammate's offline-time change appears | e2e | A and B (member) on one project; A offline; B renames N1 and adds a line to N2; A recolours N1; A online | A shows B's title with A's colour and B's new line without a reload; B shows A's colour | e2e/editor-offline.spec.ts :: after reconnecting a teammate's changes show and mine are kept |
| C11 | refused change is shown, not lost | e2e | `page.route` answers the next node PATCH with 403 `{"message":"Not allowed."}`; rename a node; then rename another node | status `1 change could not be saved`; `Show` lists `Not allowed.`; the first node shows the server's title; the second rename saves; `Dismiss` clears the list | e2e/editor-offline.spec.ts :: a refused change goes to the failed list and later changes still save |
| C12 | sign-out warns while changes wait | e2e | offline, one edit, click `Sign out`; then `Stay signed in` | an `alertdialog` with `1 change has not been saved yet. It will be saved the next time you sign in on this browser. Sign out anyway?`; no browser dialog fires (`page.on('dialog')` fails the test); still signed in | e2e/editor-offline.spec.ts :: signing out with waiting changes asks first |
| C13 | undo pauses offline | unit | `createEdits` with `undoPaused` returning `UNDO_PAUSED`; a recorded rename; `undo()`; then `undoPaused` returning `null` and `undo()` | first: no store write, store error `UNDO_PAUSED`, the step stays in the history; second: the rename is undone | frontend/src/features/editor/store/edits.test.ts :: undo waits while offline changes are waiting |
| C14 | undo after reconnecting | e2e | offline, rename a node, Ctrl+Z; go online; wait for `sync-status` to clear; Ctrl+Z | first Ctrl+Z shows `Undo waits until you are back online and your changes are saved.` and keeps the new title; after sync the second restores the old title | e2e/editor-offline.spec.ts :: undo works again once offline changes are saved |
### Probes
**Probe folder:** `tests/probes/2026-11-16-offline-sync/task-4/`
### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | frontend/src/features/editor/sync/syncLifecycle.ts | `if (userId === currentUser) return` | `if (false) return` | frontend/src/features/editor/sync/syncLifecycle.test.ts |
| B3 | frontend/src/features/editor/store/edits.ts | `if (paused !== null) return store.setState({ error: paused })` | `if (false) return store.setState({ error: paused })` | frontend/src/features/editor/store/edits.test.ts |
| B2 | frontend/src/features/editor/store/editorSession.ts | `content: overlay(applyRemote(st.content, event), waitingEntries())` | `content: applyRemote(st.content, event)` | frontend/src/features/editor/store/editorSync.test.ts |
### Flow
In Firefox and Chromium with the dev backend: open a project, switch the network off in the browser's developer tools, make ten edits of every kind (rename, recolour, move, lines, cues, connect, trash), watch the count, close the tab, reopen it online and check every edit. Record what you saw in `progress.md`.
### Evidence
The full output of `npm run check:task`, the failing run of each break, and the Flow record.
