# Task 1: Trash: server time, restore and the purge

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong
**Checkpoint 1A tier:** local
**Checkpoint 1C tier:** mid
**Depends on:** Plans 3, 4

Design 6.8: a trashed project, chapter or node can be restored for `trash_retention_days` (30), then a scheduled job deletes it for good, media files included. Plan 3 built the trashing; this task adds the server's own time (D11, Review Focus 2), the screens to restore, and the purge.

**Files:**
- Create: `backend/pb_hooks/lib/trash.js`, `tests/hooks/trash.unit.test.ts`, `backend/pb_hooks/trash.pb.js` (the purge job), `backend/pb_hooks/app-settings.pb.js` (D12), `tests/rules/trash.rules.test.ts`, `frontend/src/backend/appSettings.ts`, `frontend/src/features/trash/trashList.ts`, `frontend/src/features/trash/trashList.test.ts`, `frontend/src/features/trash/TrashPanel.tsx`, `frontend/src/features/trash/TeamTrash.tsx`, `e2e/trash.spec.ts`
- Modify: `backend/pb_hooks/content-guard.pb.js` (stamp `deleted_at`), `frontend/src/backend/projects.ts` (`listTrashed`, `restore`), `frontend/src/backend/client.ts` and `index.ts` (`appSettings`), the chapter `≡` menu (a last item `Trash`), `frontend/src/features/teams/TeamDetail.tsx` (owner: `TeamTrash`), `docs/user/editor.md` ("Projects": the trash is no longer "later"; a "Trash" section), `docs/admin/settings.md` (`trash_retention_days` used by Plan 7, the job), `docs/developer/backend.md` (hooks table, the route, the stamp)

**Interfaces:**
- Consumes: `cutoffIso(nowMs, days)` (`lib/retention.js`), `getSystemBehavior(app)` (`lib/settings.js`), the guard hook (`content-guard.pb.js`), `backend.content.update(kind, id, { deleted: false }, baseVersion)`, `ContentState`, `liveChapters` (`model/state.ts`), `memberProject`, `createNode`, `guardedUpdate`, `readAsAdmin` (`tests/rules/helpers/content.ts`), `uploadMedia` (`tests/rules/helpers/media.ts`).
- Produces, `lib/trash.js` (CommonJS):

```js
function serverDeletedAt(sent, nowIso) -> string   // '' when sent is '', null or undefined; otherwise nowIso
function isExpired(deletedAtIso, cutoffIso) -> boolean // false for ''; deletedAtIso < cutoffIso (ISO strings compare in time order)
module.exports = { serverDeletedAt, isExpired }
```

- Produces, the guard: when an update request's body has `deleted_at`, the hook replaces it with `serverDeletedAt(body.deleted_at, <server now ISO>)` before the changed fields are copied. Every guarded collection with a `deleted_at` (`projects`, `chapters`, `nodes`).
- Produces, job `purge_trash` at `30 3 * * *`: cutoff `cutoffIso(Date.now(), trashRetentionDays)`; in this order `projects`, `chapters`, `nodes`: `findRecordsByFilter(<name>, "deleted_at != '' && deleted_at < {:cutoff}", "", 200, 0, { cutoff })`, `$app.delete` each, loop until none.
- Produces, route `GET /api/kwnto/app-settings` (signed in, any verified state): `{ trashRetentionDays: number, presenceTimeoutSeconds: number }`; 401 signed out.
- Produces, door: `backend.projects.listTrashed(teamId): Promise<Project[]>` (owner only by the UI; the rules decide), `backend.projects.restore(project: Project): Promise<Project>` (`content.update('projects', id, { deleted: false }, version)`), `backend.appSettings.get(): Promise<{ trashRetentionDays: number; presenceTimeoutSeconds: number }>`.
- Produces, `features/trash/trashList.ts`:

```ts
export function daysLeft(deletedAtIso: string, retentionDays: number, nowMs: number): number // ceil of days to deleted + retention, never below 0
export function trashLabel(days: number): string   // '1 day left', '<n> days left', 'Removed tonight' for 0
export function trashedItems(s: ContentState): { chapters: Chapter[]; nodes: { node: StoryNode; chapterTrashed: boolean }[] } // newest deleted first; nodes of a trashed chapter listed with chapterTrashed true
```

  `ContentState` needs each record's `deleted_at` time, not only `deleted: boolean`: add `deletedAt: string | null` to the mapped `Project`, `Chapter` and `StoryNode` (`content-mappers.ts`) without changing `deleted`.

**If interrupted:** the rules and e2e suites run on a throwaway backend; nothing persists.

## Sized for the local model
**May touch:** `backend/pb_hooks/lib/trash.js`, `tests/hooks/trash.unit.test.ts` (exhaustive: no other file)
**Must not change:** the signatures of `serverDeletedAt` and `isExpired` above, and every existing test
Stop and report if you need to touch anything else.
**Model server:** run `npm run ping:model` first; if it says NOT answering, do not start the run (see [the runbook](../../../developer/local-model-runbook.md))
**Checkpoint given:** Checkpoint 1A only

## Checkpoint 1A: The decisions

- [x] **Step 1: Write the failing test** C1 in `tests/hooks/trash.unit.test.ts`.
- [x] **Step 2: Run** `npx vitest run --project unit tests/hooks/trash.unit.test.ts`. Expected: FAIL.
- [x] **Step 3: Implement** `lib/trash.js`. The expiry test is `deletedAtIso !== '' && deletedAtIso < cutoffIso` (B1); the stamp test is `if (sent === '' || sent === null || sent === undefined) return ''` (B2).
- [x] **Step 4: Run** it. Expected: PASS. **Close checkpoint 1A** (commit `feat: trash time and expiry decisions`).

## Checkpoint 1B: The server

- [ ] **Step 5: Write the failing tests** C2 to C5 in `tests/rules/trash.rules.test.ts` (the job is run with the admin's `POST /api/crons/purge_trash`; retention set through the admin with restore in `afterEach`).
- [ ] **Step 6: Run** `npm run test:rules -- tests/rules/trash.rules.test.ts`. Expected: FAIL.
- [ ] **Step 7: Implement** the stamp in the guard, `trash.pb.js` and `app-settings.pb.js`.
- [ ] **Step 8: Run** `npm run test:rules`. Expected: PASS, including every existing content and offline door test (a trash made offline is now stamped at send time; say so in `docs/developer/editor.md` "Undo while offline" if it changes anything there). **Close checkpoint 1B** (commit `feat: server-stamped trash and the nightly purge`).

## Checkpoint 1C: Restoring

- [ ] **Step 9: Write the failing tests** C6 in `trashList.test.ts` and C7 to C9 in `e2e/trash.spec.ts`.
- [ ] **Step 10: Run** `npx vitest run --project unit frontend/src/features/trash/trashList.test.ts` and `npm run test:e2e -- e2e/trash.spec.ts`. Expected: FAIL.
- [ ] **Step 11: Implement** the mapper field, the door methods, `trashList.ts` (`daysLeft` ends in `Math.max(0, Math.ceil(...))`, B3), `TrashPanel` (opened from the `≡` menu's `Trash`; one row per trashed chapter and node, title, `trashLabel`, `Restore`; a node of a trashed chapter shows `Restore the chapter <title> first.` instead of the button) and `TeamTrash` (owner only, under the projects list; trashed projects, `trashLabel`, `Restore`). Restoring is an ordinary edit through the editor store, so it is undoable and queued offline like any other.
- [ ] **Step 12: Run** `npm run test:unit` and `npm run test:e2e`. Expected: PASS. Update the docs. **Close checkpoint 1C** (commit `feat: trash panels and restore`).

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | stamp and expiry | unit | `serverDeletedAt('', N)`, `(null, N)`, `('1970-01-01 00:00:00.000Z', N)`; `isExpired('', c)`, `isExpired(c, c)`, `isExpired(<1 ms before c>, c)`, `isExpired(<1 ms after c>, c)` | `''`, `''`, `N`; false, false, true, false | tests/hooks/trash.unit.test.ts :: the server's own time is used and only older items expire |
| C2 | the client cannot choose the trash time | rules | a member trashes a node sending `deleted_at` `1970-01-01 00:00:00.000Z` (guarded update); then the job runs with retention 30 | the stored `deleted_at` is within 10 s of the server's now; the node survives the job | tests/rules/trash.rules.test.ts :: a trash time sent by the browser is replaced by the server's |
| C3 | the purge removes expired items and what hangs on them | rules | retention 0; a project with chapter A (trashed, with a node, a line, a cue and an uploaded image), node N in chapter B (trashed) that is the target of a choice from node M and is the start node, and a trashed project P2; run the job | A, its node, line, cue and media row are gone and the media file URL no longer serves; N is gone, the choice from M has an empty `to_node`, `start_node` is empty; P2 and its chapters are gone; M and chapter B remain | tests/rules/trash.rules.test.ts :: the purge deletes expired trash with its contents and files |
| C4 | the purge keeps what is not expired | rules | retention 30; the same set-up; run the job | nothing is deleted | tests/rules/trash.rules.test.ts :: the purge keeps trash younger than the retention |
| C5 | who restores and the settings route | rules | a member restores a trashed node and chapter; a member tries to restore a trashed project; the owner restores it; an outsider restores a node; `GET /api/kwnto/app-settings` signed in and signed out | node and chapter restored; the member's project restore refused; the owner's works; outsider refused; `{ trashRetentionDays: 30, presenceTimeoutSeconds: 30 }`; 401 | tests/rules/trash.rules.test.ts :: members restore chapters and nodes and only the owner restores a project |
| C6 | trash list helpers | unit | `daysLeft` with deleted now and 30 days; 29.5 days ago; 31 days ago; `trashLabel(1)`, `(5)`, `(0)`; `trashedItems` with a trashed chapter holding a live node, a trashed node in a live chapter, and an older trashed node | 30; 1; 0; `1 day left`, `5 days left`, `Removed tonight`; chapters [the chapter]; nodes newest first, the chapter's node with `chapterTrashed` true | frontend/src/features/trash/trashList.test.ts :: the trash lists items newest first with the days left |
| C7 | restore a node | e2e | trash a node with a line; open `≡`, `Trash`; `Restore`; reload | the row reads `30 days left`; after `Restore` the node is back on the canvas with its line, and after the reload too; the trash panel is empty | e2e/trash.spec.ts :: a trashed node comes back from the trash with its contents |
| C8 | a node of a trashed chapter | e2e | trash a chapter holding node X; open `Trash` | X's row says `Restore the chapter <title> first.` with no button; restoring the chapter brings X back | e2e/trash.spec.ts :: a node comes back with its chapter |
| C9 | the owner restores a project | e2e | the owner moves a project to the trash; the team page's `Trash` lists it; `Restore`; a member's team page | listed with `30 days left`; after `Restore` it is back in the projects list; the member sees no `Trash` section | e2e/trash.spec.ts :: only the owner sees trashed projects and restores them |
### Probes
**Probe folder:** `tests/probes/2026-11-20-sharing/task-1/`
### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | backend/pb_hooks/lib/trash.js | `deletedAtIso !== '' && deletedAtIso < cutoffIso` | `deletedAtIso <= cutoffIso` | tests/hooks/trash.unit.test.ts |
| B2 | backend/pb_hooks/lib/trash.js | `if (sent === '' \|\| sent === null \|\| sent === undefined) return ''` | `if (sent === '') return ''` | tests/hooks/trash.unit.test.ts |
| B3 | frontend/src/features/trash/trashList.ts | `Math.max(0,` | `Math.max(-1,` | frontend/src/features/trash/trashList.test.ts |
### Flow
In Firefox and Chromium: trash a node, a chapter and (as owner) a project; restore each from its trash; undo a restore; trash a node offline and come back online (it reaches the trash with the server's time). Record what you saw in `progress.md`.
### Evidence
The full output of `npm run check:task`, the failing run of each break, and the Flow record.
