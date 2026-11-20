# Task 7: Carried over from Plans 3 and 4

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong
**Depends on:** Plans 3, 4 (nothing in this plan; may run earlier)

Four items the roadmap assigned to Plan 7 (D15): a team or project made by someone else reaches an open list live (Plan 3); the top bar shows `Offline` when the live connection drops, not only after a failed send; a waiting edit is sent as soon as the connection is back instead of on the backoff; and offline grouped edits close their undo step when they are stored locally (Plan 4). The source is the roadmap's "Carried over from Plan 3" and "Carried over from Plan 4" tables and `.planning/2026-11-16-offline-sync/progress.md`.

**Files:**
- Create: `frontend/src/features/editor/sync/connectionStatus.ts`, `frontend/src/features/editor/sync/connectionStatus.test.ts`
- Modify: `backend/pb_hooks/teams.pb.js` and `backend/pb_hooks/projects.pb.js` (the create hooks), `tests/rules/teams.rules.test.ts` and `tests/rules/projects.rules.test.ts` (new tests only), `frontend/src/backend/realtime.ts` and its test (`onConnectionChange`), `frontend/src/features/editor/sync/syncTypes.ts`, `syncEngine.ts` and a new or existing engine test file (`retryNow`), `frontend/src/features/editor/sync/syncStore.ts` (wire the status), `frontend/src/features/editor/store/edits.ts` and `edits.test.ts` (the group), `frontend/src/features/editor/store/editorSession.ts` (call `retryNow` from the existing `onReconnect`), `e2e/editor-offline.spec.ts` (new tests only), `docs/developer/backend.md` ("A record create is not a transaction": teams and projects now follow the nodes pattern), `docs/developer/editor.md` ("Offline and reconnect", "Undo while offline"), `docs/user/editor.md` ("Working offline": `Offline` when the connection drops), `docs/superpowers/plans/README.md` (the four items marked done in their tables)

**Interfaces:**
- Consumes: `subscribeProject(..., onReconnect)` (`backend/realtime.ts`), `SyncEngine` (`syncTypes.ts`: `start`, `stop`, `add`, `setOnline`, ...), `edits.group(label, run)` (`store/edits.ts`), the offline e2e helpers (`e2e/helpers/offline.ts`).
- Produces, the create hooks: `teams` and `projects` call `e.next()` **first** (the insert outside any transaction of ours, so PocketBase sends the live create event), then make the related rows in one `e.app.runInTransaction`. If that transaction fails, the hook deletes the new record with `e.app.delete(e.record)` and rethrows, so no team is left without its owner row and settings, and no project without its settings and `Chapter 1`.
- Produces, `backend.realtime.onConnectionChange(listener: (connected: boolean) => void): () => void`: `true` on every `PB_CONNECT`, `false` when the SDK reports the stream disconnected (`pb.realtime.onDisconnect`); only while at least one subscription is open; several listeners allowed.
- Produces, `connectionStatus.ts`:

```ts
// The engine is told 'offline' when the browser says so, or when the stream has been down for 3 s or more.
export function isOffline(browserOnline: boolean, streamConnected: boolean, downSinceMs: number | null, nowMs: number): boolean
export const STREAM_GRACE_MS = 3000
```

- Produces, `SyncEngine.retryNow(): void`: when online and an entry is waiting on the backoff, it is sent at once and the backoff restarts from its first step.
- Produces, the undo group: `edits.group` closes its step when every edit inside it has been **stored** (locally, in the outbox, when offline), not when the server answers. An offline `Add line` followed by an offline rename makes two undo steps.

**If interrupted:** the rules and e2e suites run on a throwaway backend; nothing persists.

## Checkpoint 7A: Live creates of teams and projects

- [x] **Step 1: Write the failing tests** C1 and C2 (new tests in the two rules files: a subscription opened before the create receives a `create` event, and the related rows exist).
- [x] **Step 2: Run** `npm run test:rules -- tests/rules/teams.rules.test.ts tests/rules/projects.rules.test.ts`. Expected: FAIL (no create event arrives).
- [x] **Step 3: Restructure** both hooks as the `nodes` hook in `projects.pb.js` is (Plan 3 Task 14), with the compensating delete. The delete path has no automated test (forcing the related step to fail would need test-only code in a hook, which is not allowed); say in the report how you checked it by reading, and keep it to the two lines `e.app.delete(e.record)` and `throw err`.
- [x] **Step 4: Run** `npm run test:rules`. Expected: PASS. **Close checkpoint 7A** (commit `fix: new teams and projects arrive as live create events`).

## Checkpoint 7B: Offline status and an immediate retry

- [x] **Step 5: Write the failing tests** C3 in `connectionStatus.test.ts`, C4 in the engine's test file (fake clock: an entry on the 30 s backoff, `retryNow`, it is sent at once), C5 and C6 in `e2e/editor-offline.spec.ts` (stop the event stream with `page.route('**/api/realtime', (r) => r.abort())` and close the open stream, without `setOffline`).
- [x] **Step 6: Run** `npx vitest run --project unit frontend/src/features/editor/sync` and `npm run test:e2e -- e2e/editor-offline.spec.ts`. Expected: FAIL.
- [x] **Step 7: Implement** `isOffline` (the grace test is `nowMs - downSinceMs >= STREAM_GRACE_MS`, B1), `onConnectionChange`, `retryNow`, the wiring in `syncStore.ts` (a 1 s check while the stream is down) and the call in `editorSession.ts`.
- [x] **Step 8: Run** them and every existing offline and conflict spec in both browsers. Expected: PASS. **Close checkpoint 7B** (commit `fix: offline follows the live connection and reconnect retries at once`).

## Checkpoint 7C: The offline undo group

- [x] **Step 9: Write the failing tests** C7 in `edits.test.ts` (a store whose writes resolve "stored" at once and "answered" only when the test says so) and C8 in `e2e/editor-offline.spec.ts`.
- [x] **Step 10: Run, expect FAIL.**
- [x] **Step 11: Implement.** Find how the store's offline write tells "stored in the outbox" apart from "answered by the server" (the engine's `add` resolves once stored); the group waits only for the first. Online behaviour must not change (an online group still closes after the answers, so a refused write is not recorded).
- [x] **Step 12: Run** `npm run test:unit` and `npm run test:e2e`. Expected: PASS. Update the docs and the roadmap tables. **Close checkpoint 7C** (commit `fix: offline edits close their undo step when stored`).

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | a new team arrives live | rules | a user subscribes to `teams` and creates a team | a `create` event for it arrives; the owner row and settings row exist | tests/rules/teams.rules.test.ts :: a new team arrives as a live create event with its rows |
| C2 | a new project arrives live | rules | a teammate subscribes to `projects`; a member creates a project | a `create` event arrives; `project_settings` and `Chapter 1` exist | tests/rules/projects.rules.test.ts :: a new project arrives as a live create event with its settings and first chapter |
| C3 | when the engine counts as offline | unit | `(false, true, null, t)`; `(true, true, null, t)`; `(true, false, t - 2999, t)`; `(true, false, t - 3000, t)`; `(true, false, null, t)` | true; false; false; true; false | frontend/src/features/editor/sync/connectionStatus.test.ts :: a dropped live connection counts as offline after three seconds |
| C4 | retry now | unit | an entry failed twice as unreachable (next try in 4 s on the fake clock); `retryNow()` | sent at once; a further failure waits 1 s (the backoff restarted) | frontend/src/features/editor/sync/syncEngineRetries.test.ts :: retryNow sends a waiting edit at once |
| C5 | `Offline` without a send | e2e | the editor open, no edit made; the event stream is cut while the browser stays online | the top bar shows `Offline` within 5 s; after the stream is let through again it clears without a reload | e2e/editor-offline-connection.spec.ts :: a dropped live connection shows Offline without an edit |
| C6 | the waiting edit goes at once | e2e | backend requests blocked; rename a node (waits); unblock and let the stream reconnect | the rename is saved within 3 s of the reconnect (not on the 30 s backoff) | e2e/editor-offline-connection.spec.ts :: a waiting edit is sent as soon as the connection is back |
| C7 | the group closes when stored | unit | offline: `group('Add line', ...)` whose create is stored but not answered; then an `update` rename; `undo()` once | two steps in history; the one undo takes back only the rename | frontend/src/features/editor/store/edits.test.ts :: an offline group closes when its edits are stored |
| C8 | offline undo steps | e2e | offline: `Add line`, type in it, rename the node; back online and saved; Ctrl+Z once | only the rename is undone; the line and its text stay | e2e/editor-offline-connection.spec.ts :: edits made offline undo one step at a time after reconnecting |
### Probes
**Probe folder:** `tests/probes/2026-11-20-sharing/task-7/`
### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | frontend/src/features/editor/sync/connectionStatus.ts | `nowMs - downSinceMs >= STREAM_GRACE_MS` | `nowMs - downSinceMs > STREAM_GRACE_MS` | frontend/src/features/editor/sync/connectionStatus.test.ts |
### Flow
In Firefox and Chromium: stop the backend container with the editor open and no edit (the top bar says `Offline` within a few seconds); start it again (it clears); repeat with a waiting edit (it saves within seconds); make three edits offline, reconnect, undo three times one by one. A teammate creates a team and a project while you watch the lists. Record what you saw in `progress.md`.
### Evidence
The full output of `npm run check:task`, the failing run of the break, and the Flow record.
