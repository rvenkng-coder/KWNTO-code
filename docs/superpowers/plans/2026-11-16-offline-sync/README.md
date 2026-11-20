# Offline Queue, Sync and Conflicts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No edit is ever lost to a dropped connection or a closed tab: every edit is written to IndexedDB first and sent from there, the app shows `Offline, N changes waiting`, the project is fetched again after every reconnect, and an edit made offline that meets a teammate's change to the same attribute asks the person to keep theirs or mine.

**Architecture:** An **outbox** sits between the editor store and the backend door. The store applies an edit at once (as today), writes it to the outbox and returns; one app-wide **sync engine** sends outbox entries in order through `backend.content`, one at a time, and removes each only when the server has answered. Pure modules decide everything that can go wrong (merging queued edits, laying unsent edits over fresh server data, whether a 409 is a real conflict, backoff); the engine and the IndexedDB adapter are thin. After a reconnect the session reloads the project and lays the unsent edits back over it (decision 0002, finding E).

**Tech Stack:** React 19, TypeScript, Zustand 5, the browser's IndexedDB and Web Locks APIs (no wrapper library), `pocketbase` JS SDK 0.28, PocketBase 0.40.6, Vitest, Playwright. No new dependencies.

**Spec:** [Design](../../specs/2026-11-11-kwnto-design.md) sections 4, 5, 6.7, 8b and 8c; [editor cards design](../../specs/2026-11-18-editor-cards-design.md) (choices: a `connections` record whose target may be empty); [decision 0002](../../../decisions/0002-realtime-spike.md) findings E and G and "Requirements for Plans 3 and 4"; the [roadmap](../README.md) outline "4. Offline queue, sync and conflicts". Also binding: [engineering.md](../../../engineering.md) (section 9: "Never discard a queued edit"), [security.md](../../../security.md) section 7, [testing-strategy.md](../../../testing-strategy.md), [backend.md](../../../developer/backend.md) "Guarded writes" and "The backend door", [editor.md](../../../developer/editor.md). Executors read all of them, and the [editor core plan](../2026-11-14-editor-core/README.md) router, whose code this plan changes.

**Standard:** test-plan-v1

## Global Constraints

Everything in the [Plan 1 router](../2026-11-11-foundation/README.md) "Global Constraints" still applies (zero cost, no new dependency, ask first, worktree, 300-line files, no `any`, deny by default, tests documented, prototype is reference only, secrets never in git, docs are part of done, Node 22, ports). Values this plan depends on:

- **Worktree and branch:** `feat/offline-sync` in the sibling folder `../KWNTO-code-offline`, created from `feat/editor-core` at 2975e67 and brought up to date by merging `main` at d8b50f5 (2026-11-18: Plan 3, the editor tabs plan and the editor cards plan, all `done`). Merge `main` again before a task if it has moved; never rebase this pushed branch without the developer's approval (engineering 5). Tracking in `.planning/2026-11-16-offline-sync/progress.md` (columns from [PROGRESS-TEMPLATE.md](../PROGRESS-TEMPLATE.md)).
- **Every task ends with** `npm run check:task -- --task docs/superpowers/plans/2026-11-16-offline-sync/task-<n>-<name>.md --base <sha at task start> --built-by <local|strong>`, full output pasted in the report ([check-task.md](../../../developer/check-task.md)).
- **Probes are written by the controller, not the implementer**, before a task is dispatched, in the folder its Test plan names.
- **Strong model** for every task except the checkpoints marked otherwise (design 8c: "offline sync and conflicts" is strong-model work).
- **Never discard a queued edit** (engineering 9, design 6.7). An entry leaves the outbox only when the server accepted it, the server refused it (it then shows in the failed list until the person dismisses it), the person chose `Keep theirs`, or the person confirmed `Discard`.
- **The version is the counter, never `updated`** (decision 0002 finding G; this supersedes the "[my call]" in design 6.7). An outbox entry keeps the `version` it was based on and the **values** of its fields before the edit.
- **Refetch after every reconnect** (finding E): reload the project and lay the unsent edits over it. Never assume the event stream is complete.
- **Online, nothing changes for the person:** an edit made while connected that meets a 409 is retried silently as in Plan 3 (design 5, "the later write wins"). Only edits marked `offline` (D3) can raise the conflict dialog.
- **Media uploads are not queued** (design 6.7); that is Plan 5's concern.
- **Exact copy** (tests compare it):
  - Status: `Offline` (nothing waiting), `Offline, 1 change waiting`, `Offline, <n> changes waiting`, `Saving…` (online with entries waiting), nothing when online and the outbox is empty.
  - Failed: `<n> change could not be saved` / `<n> changes could not be saved`, button `Show`; each row shows the server's message and a `Dismiss` button.
  - Conflict dialog heading `Someone else changed this while you were offline`; one row per field `<label>`, `Yours: <value>`, `Theirs: <value>`; buttons `Keep mine` and `Keep theirs`. Deleted case heading: `Someone else deleted this <thing> while you were offline` (`<thing>`: `script line`, `cue`, `connection`).
  - Sign-out with waiting edits (D13, in the page, never `confirm()`): `<n> changes have not been saved yet. They will be saved the next time you sign in on this browser. Sign out anyway?` (`1 change has not been saved yet. It will be …` for one); buttons `Sign out anyway` and `Stay signed in`.
  - Undo or redo while offline with changes waiting (D11): `Undo waits until you are back online and your changes are saved.`
- **Migrations:** none. This plan adds no collection and changes no rule.

## Review Focus

The failure modes the spec implies that are most likely to bite a person, each pinned by a test in the task named:

1. **Typing and then reloading at once while offline keeps the text.** The edit reaches IndexedDB before the page goes, including the 800 ms pending text that Plan 3 flushes on `pagehide`. (Task 4 C9 e2e)
2. **A save whose answer was lost is not mistaken for a conflict or a duplicate.** The request reached the server, the connection dropped before the answer, the entry is sent again: a create whose id now exists, an update whose field already holds my value and a delete of a record already gone all count as done. (Task 1 C7, Task 3 C4)
3. **A teammate's change made while I was offline appears after I reconnect**, and my waiting edits still show on top of it, not underneath. (Task 1 C6, Task 4 C10)
4. **Two tabs of the same browser do not send the same entry twice or out of order.** Only the tab holding the Web Lock sends. (Task 3 C7, Task 5 C4)
5. **One refused entry does not block the queue forever** and is not silently dropped: it moves to the failed list with the server's message, the entries after it still go, and the person dismisses it. (Task 3 C5, Task 4 C11)

Also covered, lower risk: backoff stops growing at 30 s and resets on the browser's `online` event (Task 1 C1, Task 3 C3); an edit of a different field made offline is merged without a dialog (Task 1 C7, Task 2 C7); a live event for a record with waiting edits keeps the waiting fields on screen (Task 4 C5); a choice made offline to a target a teammate linked meanwhile is refused by the unique pair index and lands in the failed list (Task 5 Flow).

## Decisions made in this plan (please review)

The roadmap's "Decide first" items and calls where the spec is silent. Each is cheap to change before the task that builds it.

| # | Decision | Task |
|---|---|---|
| D1 | **Storage layout:** one IndexedDB database `kwnto-outbox`, version 1, two object stores: `entries` (auto-increment key `seq`, index `byUser`) and `failed` (key `seq`, index `byUser`, D8). An entry is `{ seq, userId, projectId, op, kind, id, changes?, record?, snapshot?, baseVersion?, baseValues?, offline, made }` (Task 1 Interfaces). The whole edit is in one entry; nothing else is stored. | 1, 4 |
| D2 | **Replay order:** strictly by `seq`, one request at a time, for the signed-in user's entries across all projects. No parallel sends: order is what makes "create before update" and "my later edit wins over my earlier one" hold. | 3 |
| D3 | **Which edits can conflict:** an entry is `offline: true` when it was made while the engine's state was `offline`, or when a send of it failed with `unreachable`. Only those are checked for conflicts on a 409; others retry silently as in Plan 3. | 1, 3 |
| D4 | **"Same attribute" (the dialog):** for an update, a field conflicts when the server's current value differs **both** from the entry's base value **and** from the entry's own value. `x` and `y` of a node are one attribute, `Position`. A line, cue or connection deleted meanwhile is a conflict (`Keep mine` re-creates it with its id); a project, chapter or node can only be trashed, which is an ordinary `deleted` field. | 1 |
| D5 | **Merging queued edits:** an update joins the newest waiting entry of the same record if no entry for another record came after it and that entry is not being sent. Fields are merged (newer value wins); each field keeps the **oldest** base value and the entry keeps the oldest `baseVersion`. A remove after waiting entries of the same line, cue or connection drops them; a remove of a record whose create is still waiting drops both. | 1 |
| D6 | **Reconnect:** the window's `offline` event closes the live subscriptions and puts the engine `offline`; the `online` event, or the SDK's `PB_CONNECT` arriving a second time on an open subscription, reloads the open project and lays the waiting edits over it (`overlay`), then the engine resumes at once. | 2, 4 |
| D7 | **Backoff** after an `unreachable` send: 1, 2, 4, 8, 16, 30, 30, … seconds; reset to 1 s by the `online` event and by any successful send. | 1, 3 |
| D8 | **A refused entry** (`invalid`, `forbidden`, `not-found` on an update of a project, chapter or node) leaves the outbox for the in-memory and stored **failed list** (object store `failed`, same database), its local change is undone from the server's copy, and the engine goes on with the next entry. The person dismisses each failed row. | 3, 4 |
| D9 | **Two tabs:** every tab writes to the shared outbox; only the tab holding the Web Lock `kwnto-sync-<userId>` sends. Another tab takes over when the holder closes. | 3, 4 |
| D10 | **Signing out** keeps the outbox (entries carry `userId`) and asks first when entries are waiting (copy above). Another account on the same browser never sends or sees them. Waiting edits on a shared computer are readable by anyone with the browser profile: an accepted risk while internal, added to security.md section 10. | 4 |
| D11 | **Promise of `editorStore.update` / `create` / `remove`:** unchanged from Plan 3. It resolves `true` when the server accepted the edit and `false` when the server refused it, so Plan 3's undo still records a step only after a write succeeds. Offline, it stays pending until the edit is sent; after a reload the promise is gone and only the outbox remains. Plan 3's `edits.undo` and `redo` first wait for every write in flight (`settle` in `store/edits.ts`), which offline would never end, so **while offline with changes waiting, undo and redo do nothing and show the D11 message**; they work again once the outbox is empty or the connection is back. Documented in the user guide. | 4 |
| D12 | **The conflict dialog is modal and stops the engine** until it is answered, so no later entry of that record is sent on a wrong base. One dialog per entry; the non-conflicting fields of that entry are sent with whichever choice. | 3, 4 |
| D13 | **No browser pop-ups** (the developer listed `prompt()` and `confirm()` as UI problems on 2026-11-18): the sign-out question and the conflict dialog are drawn in the page (`role="alertdialog"` and `role="dialog"`), with the theme tokens. | 4 |

## File structure

| Path | Responsibility |
|---|---|
| `frontend/src/features/editor/sync/outbox.ts` | Pure: entry types, `addEntry` (merge, D5), `overlay` (waiting edits over server state), `classifyConflict` (D4), `nextDelay` (D7), `statusText`, `fieldLabel` |
| `frontend/src/features/editor/sync/outboxStorage.ts` | The `OutboxStorage` interface and `createMemoryOutbox()` |
| `frontend/src/features/editor/sync/indexedDbOutbox.ts` | `createIndexedDbOutbox()` (D1) |
| `frontend/src/features/editor/sync/syncEngine.ts` | `createSyncEngine`: sends entries in order, backoff, failed list, conflicts, lock |
| `frontend/src/features/editor/sync/syncStore.ts` | The app-wide engine instance and `useSync(selector)` for screens |
| `frontend/src/features/editor/sync/SyncStatus.tsx`, `ConflictDialog.tsx`, `FailedList.tsx` | Screens |
| `frontend/src/backend/content.ts`, `guarded.ts`, `realtime.ts`, `errors.ts` | `get`, conflict-aware `update`, `onReconnect` |
| `frontend/src/features/editor/store/editorEdits.ts`, `editorSession.ts`, `editorStore.ts` | Edits go to the outbox; reconnect reload |
| `e2e/editor-offline.spec.ts`, `e2e/helpers/offline.ts` | Browser flows |
| `docs/user/editor.md`, `docs/developer/editor.md`, `docs/developer/backend.md`, `docs/security.md`, `docs/test-plan.md` | Docs |

## Tasks

| # | Task | Tier | Depends on | Checkpoints | Status |
|---|---|---|---|---|---|
| 1 | [The outbox model](task-1-outbox-model.md) | strong (1A local) | Plan 3 | 1A 1B | done |
| 2 | [Door: read, conflict-aware update, reconnect](task-2-door-conflicts.md) | strong | Plan 3 | 2A 2B | done |
| 3 | [The sync engine](task-3-sync-engine.md) | strong | 1, 2 | 3A 3B | done |
| 4 | [Wiring, status, conflict dialog](task-4-wiring-dialog.md) | strong | 3 | 4A 4B 4C | done |
| 5 | [Hard flows and close-out](task-5-hard-flows-closeout.md) | strong | 1 to 4 | 5A 5B | awaiting review |

**Status values:** `not started`, `in progress`, `awaiting review`, `done`. Tasks 1 and 2 have no dependency on each other; run tasks one at a time (implementers never run in parallel).

Names and signatures shared between tasks are in each task file's **Interfaces** block. If a task needs something its Interfaces block does not list, stop and report it; do not guess.

**Closing a checkpoint** follows the Plan 1 router, "Rules while working" (one commit holding the code and docs, the ticked boxes, this table's Status cell and one new `progress.md` row). Replace its `<date>-foundation` with `2026-11-16-offline-sync`.

## Done when

- `npm test` passes on a clean clone with Docker running, and `npm run check:task` passed for every task (output in the reports).
- Every row above says `done`, no step box is unticked, `git status` is clean.
- [test-plan.md](../../../test-plan.md) row "Offline queue, sync and conflicts" says `covered` for unit, rules and e2e.
- Reconnect through Funnel (roadmap: "confirm once") is either recorded in [decision 0002](../../../decisions/0002-realtime-spike.md) or carried to Plan 6 in the roadmap, if no Funnel host exists yet.
- The roadmap marks Plan 4 `done`.
- A whole-branch review of `feat/offline-sync` is complete and the developer has reviewed the branch. Agents do not merge or push.
