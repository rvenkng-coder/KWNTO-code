# Task 6: Presence

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong
**Checkpoint 6A tier:** local
**Checkpoint 6C tier:** mid
**Depends on:** Task 3

Design 5 and 9c: "someone else is editing this" on the node and field, so two people rarely edit the same attribute at once. It uses a short-lived presence collection with a heartbeat, cleaned by a scheduled job (D14). Design 8b asks for an e2e test of two browsers editing the same node with the indicator.

**Files:**
- Create: `backend/pb_hooks/lib/presence.js`, `tests/hooks/presence.unit.test.ts`, `backend/pb_migrations/1794400300_presence.js`, `backend/pb_hooks/presence.pb.js`, `tests/rules/presence.rules.test.ts`, `frontend/src/backend/presence.ts`, `frontend/src/features/presence/presenceModel.ts`, `frontend/src/features/presence/presenceModel.test.ts`, `frontend/src/features/presence/usePresence.ts`, `frontend/src/features/presence/EditingBadge.tsx`, `e2e/presence.spec.ts`
- Modify: `frontend/src/backend/client.ts`, `index.ts` (`presence`), `NodeCard.tsx` (the badge), the panel's title, script line, cue and choice label inputs (report focus and show the badge beside the field), `EditorScreen.tsx` (start and stop with the project), `docs/user/editor.md` ("Working together": the indicator), `docs/admin/settings.md` (`presence_timeout_seconds` used by Plan 7, the job), `docs/developer/backend.md`

**Interfaces:**
- Consumes: `getSystemBehavior(app).presenceTimeoutSeconds` (`lib/settings.js`), `cutoffIso` (`lib/retention.js`), `EDIT_GRANT` (Task 3), `backend.appSettings.get()` (Task 1), `useSelection`.
- Produces, `lib/presence.js`: `staleCutoffIso(nowMs, timeoutSeconds) -> string` (now minus twice the timeout, ISO with milliseconds, the format `cutoffIso` uses).
- Produces, collection `presence`: `project` (relation, cascade), `node` (relation, cascade), `user` (relation users, cascade), `user_name` (text, set by the hook), `field` (text, max 40), `beat` (number, `onlyInt`, `min: 0`), `updated` (autodate); unique index on (`user`, `project`). Rules: list and view `IS_MEMBER || EDIT_GRANT`; create the same `&& @request.body.user = @request.auth.id && @request.body.node.project = @request.body.project && @request.body.user_name:isset = false`; update `user = @request.auth.id && @request.body.user:isset = false && @request.body.project:isset = false && @request.body.user_name:isset = false && (@request.body.node:isset = false || @request.body.node.project = project)`; delete `user = @request.auth.id`. Job `purge_presence` at `* * * * *` deletes rows with `updated < staleCutoffIso(...)`.
- Produces, door `backend.presence`: `set(projectId, nodeId, field): Promise<void>` (creates the caller's row, or updates it with `beat + 1`), `clear(projectId): Promise<void>` (deletes the caller's row; a 404 is fine), `subscribe(projectId, onEvent): Promise<() => Promise<void>>`; `PresenceRow { id, userId, userName, nodeId, field }`.
- Produces, `presenceModel.ts`:

```ts
// seenAt: when this browser last received each row (its own clock, D14)
export function activeEditors(rows: PresenceRow[], seenAt: Record<string, number>, nowMs: number, timeoutMs: number, selfId: string): PresenceRow[]
export function editorsOf(active: PresenceRow[], nodeId: string, field?: string): string[] // names, sorted
export function editingLabel(names: string[]): string // '' for none, '<a> is editing', '<a> and <b> are editing', '<a> and 2 others are editing'
```

- Produces, `usePresence(projectId)`: subscribes; records `seenAt` on each event; re-renders every 5 s; while a reporting field has focus calls `set` at once and every 10 s, and `clear` on blur, on unmount and on `pagehide`; does nothing while offline.

**If interrupted:** the rules and e2e suites run on a throwaway backend; nothing persists.

## Sized for the local model
**May touch:** `backend/pb_hooks/lib/presence.js`, `tests/hooks/presence.unit.test.ts` (exhaustive: no other file)
**Must not change:** the signature of `staleCutoffIso`, and every existing test
Stop and report if you need to touch anything else.
**Model server:** run `npm run ping:model` first; if it says NOT answering, do not start the run (see [the runbook](../../../developer/local-model-runbook.md))
**Checkpoint given:** Checkpoint 6A only

## Checkpoint 6A: The cut-off

- [x] **Step 1: Write the failing test** C1 in `tests/hooks/presence.unit.test.ts`.
- [x] **Step 2: Run** `npx vitest run --project unit tests/hooks/presence.unit.test.ts`. Expected: FAIL.
- [x] **Step 3: Implement** `staleCutoffIso` (the multiplier line `const windowMs = timeoutSeconds * 2 * 1000`, B1).
- [x] **Step 4: Run** it. Expected: PASS. **Close checkpoint 6A** (commit `feat: presence cut-off`).

## Checkpoint 6B: The collection

- [x] **Step 5: Write the failing tests** C2 and C3 in `tests/rules/presence.rules.test.ts`; run, expect FAIL.
- [x] **Step 6: Write** the migration and `presence.pb.js` (the name hook, as Task 5's, and the job).
- [x] **Step 7: Run** `npm run test:rules`. Open the create rule once: C2 must fail; restore. Expected: PASS. **Close checkpoint 6B** (commit `feat: presence collection and cleanup`).

## Checkpoint 6C: The indicator

- [x] **Step 8: Write the failing tests** C4 in `presenceModel.test.ts` and C5, C6 in `e2e/presence.spec.ts`; run, expect FAIL.
- [x] **Step 9: Implement** the door, the model (`nowMs - seenAt[r.id]! < timeoutMs`, B2; own rows dropped by `r.userId !== selfId`, B3), the hook and `EditingBadge` (text `editingLabel`, `data-testid="editing-badge"`; on the card a small line under the title; in the panel beside the field).
- [x] **Step 10: Run** `npm run test:unit` and `npm run test:e2e`. Expected: PASS. Update the docs. **Close checkpoint 6C** (commit `feat: someone-is-editing indicator`).

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | stale cut-off | unit | `staleCutoffIso(Date.parse('2026-11-20T12:00:00.000Z'), 30)`; timeout 0 | `2026-11-20 11:59:00.000Z` (the `cutoffIso` format); the same instant as now | tests/hooks/presence.unit.test.ts :: presence rows go stale after twice the timeout |
| C2 | who writes presence | rules | a member sets a row; again (update `beat`); a second row for the same project (create); for another user; with `user_name`; a node of another project; an outsider; signed out; an edit-grant and a comment-grant holder; deleting another user's row | create and update 200 with `user_name` from the account; second create refused (unique); the rest refused except the edit-grant holder (200); comment-grant refused | tests/rules/presence.rules.test.ts :: people mark only themselves as editing, in a project they may edit |
| C3 | who sees presence, and cleanup | rules | a teammate's row on an open subscription; an outsider lists; a row whose `updated` is older than twice the timeout and a fresh row (timeout set to 1 s, wait 2.5 s for the first, then make the second), run `purge_presence` | the event arrives with `user_name`; outsider sees none; only the old row is removed | tests/rules/presence.rules.test.ts :: presence is seen by the team and old rows are removed |
| C4 | who counts as editing | unit | rows for self, Ana (seen 10 s ago), Ben (seen 31 s ago), Cy (no `seenAt`) with timeout 30 s; `editorsOf` by node and by field; `editingLabel` of 0, 1, 2, 3 names | Ana only; `['Ana']` for her node and field, `[]` for another field; `''`, `Ana is editing`, `Ana and Ben are editing`, `Ana and 2 others are editing` | frontend/src/features/presence/presenceModel.test.ts :: only fresh rows of other people show as editing |
| C5 | two browsers on one node (design 8b) | e2e | owner and member open the same node; the member focuses the title; then a script line; then blurs | the owner's card and title field show `<member name> is editing` within 12 s; then the badge moves beside that line; after blur it clears within 12 s; the member never sees their own name | e2e/presence.spec.ts :: a teammate editing a node shows on the card and the field |
| C6 | a closed tab stops showing | e2e | the member focuses the title, then closes the page | the owner's badge clears within 35 s (`pagehide` delete, or the timeout) | e2e/presence.spec.ts :: closing the tab clears the indicator |
### Probes
**Probe folder:** `tests/probes/2026-11-20-sharing/task-6/`
### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | backend/pb_hooks/lib/presence.js | `const windowMs = timeoutSeconds * 2 * 1000` | `const windowMs = timeoutSeconds * 1000` | tests/hooks/presence.unit.test.ts |
| B2 | frontend/src/features/presence/presenceModel.ts | `nowMs - seenAt[r.id]! < timeoutMs` | `nowMs - seenAt[r.id]! <= timeoutMs * 2` | frontend/src/features/presence/presenceModel.test.ts |
| B3 | frontend/src/features/presence/presenceModel.ts | `r.userId !== selfId` | `true` | frontend/src/features/presence/presenceModel.test.ts |
### Flow
In Firefox and Chromium side by side: edit the same node's title, a line and a choice label in turn; drop one browser's network for 20 s; close a tab. Record what you saw in `progress.md`.
### Evidence
The full output of `npm run check:task`, the Step 7 rule-opening run, the failing run of each break, and the Flow record.
