# Task 2: Door: read, conflict-aware update, reconnect

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong
**Depends on:** Plan 3 (`backend.content`, `guardedSave`, `subscribeProject`)

The sync engine needs three things the door does not give today: reading one record (to check a remove or a create whose answer was lost), stopping the 409 retry when an offline edit meets a real conflict (decision 0002: "on replay a 409 means someone changed it meanwhile and follows the same retry rule, or the conflict dialog"), and a signal when the live connection comes back (finding E, D6). Online saves keep working exactly as in Plan 3.

**Files:**
- Modify: `frontend/src/backend/guarded.ts`, `frontend/src/backend/guarded.test.ts`, `frontend/src/backend/errors.ts`, `frontend/src/backend/content.ts`, `frontend/src/backend/realtime.ts`, `frontend/src/backend/index.ts` (export `EditConflict`, `EDIT_CONFLICT`), `docs/developer/backend.md` ("The backend door": `get`, the `shouldRetry` option, `onReconnect`)
- Create: `frontend/src/backend/realtime.test.ts`, `tests/rules/content-door-offline.rules.test.ts`

**Interfaces:**
- Consumes: `guardedSave`, `GuardedIO`, `MAX_SAVE_TRIES`, `TOO_BUSY` (Plan 3 Task 7); `memberProject`, `createNode`, `createLine`, `guardedUpdate`, `clientId` from `tests/rules/helpers/content.ts`.
- Produces, `errors.ts`:

```ts
export const EDIT_CONFLICT = 'Someone else changed this while you were offline.'
export class EditConflict<R = unknown> extends BackendError { server: R }  // kind 'conflict', status 409, message EDIT_CONFLICT
```

- Produces, `guarded.ts`: `guardedSave(io, body, baseVersion, shouldRetry?: (current: R) => boolean)`. After a 409 it reads the record; when `shouldRetry` is given and returns `false` for it, it throws `new EditConflict(current)` at once; otherwise it retries as before (20 tries, then `TOO_BUSY`).
- Produces, `backend.content`:

```ts
get<K extends ContentKind>(kind: K, id: string): Promise<ContentRecords[K] | null>   // 404 -> null; any other error throws BackendError
update<K extends ContentKind>(kind: K, id: string, changes: Partial<EditableFields[K]>, baseVersion: number,
  options?: { shouldRetry?: (current: ContentRecords[K]) => boolean }): Promise<ContentRecords[K]>
subscribe(projectId: string, onEvent: (event: RemoteEvent) => void, onReconnect?: () => void): Promise<() => Promise<void>>
// onReconnect: called each time the SDK's PB_CONNECT arrives after the first one while the subscription is open; never after close
```

- Pinned behaviour the engine relies on: `create` with an id that already exists rejects with `BackendError` kind `invalid` and `fields.id` set (C6).

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 2A: Stop on conflict, reconnect signal (unit)

- [x] **Step 1: Confirm the reconnect event.** Read `node_modules/pocketbase/src/services/RealtimeService.ts` (or the built `dist` file): find where the SDK sends `PB_CONNECT` to subscribers and whether it does so again after an automatic reconnect. Write the finding (file and lines) in the checkpoint's `progress.md` row. If the SDK does not tell subscribers about a reconnect, stop and report: D6 needs another signal.
- [x] **Step 2: Write the failing tests** C1 to C3 (`guarded.test.ts` with a fake `GuardedIO`; `realtime.test.ts` with a fake `pb` whose `collection(...).subscribe` and `realtime.subscribe('PB_CONNECT', cb)` record the callbacks).
- [x] **Step 3: Run** `npx vitest run --project unit frontend/src/backend`. Expected: the new tests FAIL.
- [x] **Step 4: Implement** `EditConflict` and `EDIT_CONFLICT` in `errors.ts`; the `shouldRetry` parameter in `guarded.ts`, with the check written as the one line `if (shouldRetry !== undefined && !shouldRetry(current)) throw new EditConflict(current)` (B1); `onReconnect` in `realtime.ts`: one extra subscription to `PB_CONNECT` opened with the others and closed by the same close function, counting connects with `if (connects > 1) onReconnect?.()` (B2).
- [x] **Step 5: Run** them. Expected: PASS, and the Plan 3 tests in `frontend/src/backend` still pass. **Close checkpoint 2A** (commit `feat: door stops a retry on a real conflict and reports reconnects`).

## Checkpoint 2B: Against a live PocketBase (rules)

- [x] **Step 6: Write the failing tests** C4 to C7 in `tests/rules/content-door-offline.rules.test.ts`, through `createBackend(PB_URL)` signed in as members of one project (a fresh project per test).
- [x] **Step 7: Run** `npm run test:rules -- tests/rules/content-door-offline.rules.test.ts`. Expected: C4, C5, C7 FAIL (`get` missing, option ignored); C6 may pass at once: then show it fails once by making `content.create` swallow the error (return the record sent), restore, and say so in the report.
- [x] **Step 8: Implement** `content.get` and the `options` of `content.update` (passed to `guardedSave` as `shouldRetry`; the read inside is the existing `io.read`).
- [x] **Step 9: Run** `npm run test:rules` and `npm run test:unit`. Expected: PASS. Update `docs/developer/backend.md`. **Close checkpoint 2B** (commit `feat: door reads a record and reports offline conflicts`).

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | stop on a real conflict | unit | `write` answers 409 once; `read` gives `{ version: 5, title: 'C' }`; `shouldRetry` returns false | rejects with `EditConflict` whose `server` is that record; one write, one read | frontend/src/backend/guarded.test.ts :: a retry stops when the caller sees a real conflict |
| C2 | keep retrying when told to | unit | the same with `shouldRetry` true, then without `shouldRetry` | second write sent with version 5 and resolves; behaviour without the option is Plan 3's (20 tries then `TOO_BUSY`) | frontend/src/backend/guarded.test.ts :: a retry goes on when the caller sees no conflict |
| C3 | reconnect signal | unit | fake `pb`: `PB_CONNECT` callback called once, then twice more; then close; then once more | `onReconnect` called 2 times (not for the first connect, not after close); close also removes the `PB_CONNECT` subscription | frontend/src/backend/realtime.test.ts :: a reconnect is reported but the first connect is not |
| C4 | get | rules | member gets an existing line; gets an id that does not exist; an outsider gets the line | the mapped line; `null`; `null` (the view rule hides it as 404) | tests/rules/content-door-offline.rules.test.ts :: get returns a record or null |
| C5 | conflict through the door | rules | member A reads node (version v); member B changes `title`; A updates `title` with base v and `shouldRetry: (cur) => cur.title === 'base title'` | A's call rejects with `EditConflict`, `server.title` is B's; the stored title is B's | tests/rules/content-door-offline.rules.test.ts :: an offline edit that meets a change to the same field is stopped |
| C6 | duplicate id on create | rules | member creates a line with id X twice | second call rejects with kind `invalid` and `fields.id` set; one line X stored | tests/rules/content-door-offline.rules.test.ts :: creating an id that exists is refused on the id field |
| C7 | different field still merges | rules | as C5 but B changes `color` and A sends `title` with the same `shouldRetry` | A resolves; stored title A's, color B's; version +2 | tests/rules/content-door-offline.rules.test.ts :: an offline edit of another field is merged without a conflict |
### Probes
**Probe folder:** `tests/probes/2026-11-16-offline-sync/task-2/`
### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | frontend/src/backend/guarded.ts | `if (shouldRetry !== undefined && !shouldRetry(current)) throw new EditConflict(current)` | `if (false) throw new EditConflict(current)` | frontend/src/backend/guarded.test.ts |
| B2 | frontend/src/backend/realtime.ts | `if (connects > 1) onReconnect?.()` | `if (connects > 0) onReconnect?.()` | frontend/src/backend/realtime.test.ts |
### Flow
none
### Evidence
The full output of `npm run check:task`, the failing run of each break, the Step 1 finding, and (if C6 passed at once) its break-once run.
