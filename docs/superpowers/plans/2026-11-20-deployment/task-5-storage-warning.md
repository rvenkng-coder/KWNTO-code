# Task 5: The disk-usage warning

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid
**Checkpoint 5A tier:** local
**Depends on:** Task 2

Design 7c: sign-up is open on a public address and each team owner gets 2 GB, so "the plan must include a total disk-usage warning". D12: an hourly job adds up every stored file and tells the admin, at most once a day, when the total passes an admin setting.

**Files:**
- Create: `backend/pb_hooks/lib/storage-warning.js`, `tests/hooks/storage-warning.unit.test.ts`, `backend/pb_hooks/storage-check.pb.js`, `backend/pb_migrations/1794390200_storage_warning.js`, `tests/rules/storage-warning.rules.test.ts`
- Modify: `backend/pb_hooks/lib/settings.js` (`getSystemStorage` also returns `totalWarningBytes`), `tests/rules/system_storage.rules.test.ts` and `tests/rules/security_events.rules.test.ts` only by **adding** tests if the coverage check asks for the new field or type (no existing test changed), `docs/admin/settings.md` (`total_warning_bytes`; the `storage` log entry), `docs/developer/backend.md` (hooks table)

**Interfaces:**
- Consumes: `getSystemStorage(app)` (Plan 5), `formatBytes(bytes)` (`lib/media-check.js`), `logEvent(app, type, userId, ip, detail)` (`lib/security-log.js`).
- Produces, `lib/storage-warning.js` (CommonJS):

```js
// True when usedBytes > limitBytes and limitBytes > 0 and (lastWarnedMs is null or nowMs - lastWarnedMs >= 24 h).
function shouldWarn(usedBytes, limitBytes, lastWarnedMs, nowMs) -> boolean
// 'KWNTO storage warning: <formatBytes(used)> of <formatBytes(limit)> used'
function warningSubject(usedBytes, limitBytes) -> string
module.exports = { shouldWarn, warningSubject, DAY_MS: 86400000 }
```

- Produces, the migration: `system_storage.total_warning_bytes` (number, `onlyInt`, `min: 0`), filled with `21474836480` only where empty; `security_events.type` gains `storage`. `0` turns the warning off.
- Produces, `storage-check.pb.js`: cron `kwnto_storage_check` at `0 * * * *`. It reads `SELECT COALESCE(SUM(size_bytes), 0)` over `media`, the newest `security_events` row of type `storage` (its `created` is `lastWarnedMs`), and the setting; when `shouldWarn` it logs `storage` with `detail: { usedBytes, limitBytes }` and, if `$app.settings().smtp.enabled`, sends one mail to every `_superusers` email with `warningSubject` as subject and a one-paragraph body naming both numbers and pointing at `docs/admin/deployment.md` "When the disk fills". A mail failure is logged to stdout, never thrown.

**If interrupted:** the rules suite runs on a throwaway backend; nothing persists.

## Sized for the local model
**May touch:** `backend/pb_hooks/lib/storage-warning.js`, `tests/hooks/storage-warning.unit.test.ts` (exhaustive: no other file)
**Must not change:** the signatures of `shouldWarn` and `warningSubject` above, and every existing test
Stop and report if you need to touch anything else.
**Model server:** run `npm run ping:model` first; if it says NOT answering, do not start the run (see [the runbook](../../../developer/local-model-runbook.md))
**Checkpoint given:** Checkpoint 5A only

## Checkpoint 5A: The decision

- [x] **Step 1: Write the failing test** C1 in `tests/hooks/storage-warning.unit.test.ts`.
- [x] **Step 2: Run** `npx vitest run --project unit tests/hooks/storage-warning.unit.test.ts`. Expected: FAIL.
- [x] **Step 3: Implement.** The comparisons are `usedBytes > limitBytes` (B1), `limitBytes > 0` (B2) and `nowMs - lastWarnedMs >= DAY_MS` (B3).
- [x] **Step 4: Run** it. Expected: PASS. **Close checkpoint 5A** (commit `feat: storage warning decision`).

## Checkpoint 5B: The job

- [x] **Step 5: Write the failing tests** C2 and C3 in `tests/rules/storage-warning.rules.test.ts`. The test runs the job on demand through the admin API (`POST /api/crons/kwnto_storage_check`), sets `total_warning_bytes` with the restore pattern of `setStorageSetting` (Plan 5 helper) and uploads with `uploadMedia`.
- [x] **Step 6: Run, expect FAIL.**
- [x] **Step 7: Write the migration, the `settings.js` change and the job.**
- [x] **Step 8: Run** `npm run test:rules` and `npm run test:unit`. Expected: PASS. Update the docs. **Close checkpoint 5B** (commit `feat: hourly storage warning for the admin`).

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | when to warn | unit | `(101, 100, null, T)`; `(100, 100, null, T)`; `(101, 0, null, T)`; `(101, 100, T - DAY_MS + 1, T)`; `(101, 100, T - DAY_MS, T)`; `warningSubject(2147483648, 1073741824)` | true; false; false; false; true; `KWNTO storage warning: 2.0 GB of 1.0 GB used` | tests/hooks/storage-warning.unit.test.ts :: the storage warning fires over the limit at most once a day |
| C2 | the job logs a warning once | rules | `total_warning_bytes` 100; a member uploads `PNG_1PX` padded to 200 bytes; run the job twice | exactly one new `storage` entry with `detail.usedBytes` at least 200 and `detail.limitBytes` 100 | tests/rules/storage-warning.rules.test.ts :: over the total limit the admin is warned once |
| C3 | under the limit or off | rules | `total_warning_bytes` 0, run; then the default 20 GB, run | no new `storage` entry either time; the field's default reads `21474836480` | tests/rules/storage-warning.rules.test.ts :: no warning under the limit or when it is off |
### Probes
**Probe folder:** `tests/probes/2026-11-20-deployment/task-5/`
### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | backend/pb_hooks/lib/storage-warning.js | `usedBytes > limitBytes` | `usedBytes >= limitBytes` | tests/hooks/storage-warning.unit.test.ts |
| B2 | backend/pb_hooks/lib/storage-warning.js | `limitBytes > 0` | `limitBytes >= 0` | tests/hooks/storage-warning.unit.test.ts |
| B3 | backend/pb_hooks/lib/storage-warning.js | `nowMs - lastWarnedMs >= DAY_MS` | `nowMs - lastWarnedMs > DAY_MS` | tests/hooks/storage-warning.unit.test.ts |
### Flow
none
### Evidence
The full output of `npm run check:task` and the failing run of each break.
