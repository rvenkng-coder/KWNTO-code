# Task 1: System settings tables and the security log

Part of the [Accounts and Teams plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong  
**Depends on:** none

**Files:**
- Create: `backend/pb_migrations/1794360000_system_settings.js`, `backend/pb_migrations/1794360100_security_events.js`, `backend/pb_hooks/lib/settings.js`, `backend/pb_hooks/lib/security-log.js`, `backend/pb_hooks/lib/retention.js`, `backend/pb_hooks/retention.pb.js`, `tests/hooks/retention.unit.test.ts`, `tests/rules/system_access.rules.test.ts`, `tests/rules/system_storage.rules.test.ts`, `tests/rules/system_behavior.rules.test.ts`, `tests/rules/security_events.rules.test.ts`, `docs/admin/settings.md`
- Modify: `vitest.config.ts` (add `'tests/hooks/**/*.unit.test.ts'` to the `unit` include), `tests/container/container.test.ts`, `docs/superpowers/specs/2026-11-11-kwnto-erd.md`, `docs/developer/backend.md`, `docs/developer/testing.md`, `docs/README.md`

**Interfaces:**
- Produces, `backend/pb_hooks/lib/settings.js` (CommonJS; `app` is the PocketBase app object, `$app` inside a hook):

```js
getSystemAccess(app)   // -> { registrationOpen: boolean, lockdown: boolean, lockdownMessage: string }
getSystemBehavior(app) // -> { presenceTimeoutSeconds, analyticsRetentionDays, trashRetentionDays,
                       //      securityRetentionDays, maxFailedLogins, lockoutMinutes, teamAttemptsPerHour } (all numbers)
```

- Produces, `backend/pb_hooks/lib/security-log.js`:

```js
// type is one of: signup, verification, sign-in, failure, lockout, reset, invite, join, admin
logEvent(app, type, userId /* string, "" if none */, ip /* string */, detail /* plain object */) // -> void, never throws
```

- Produces, `backend/pb_hooks/lib/retention.js`: `cutoffIso(nowMs: number, days: number): string` (PocketBase datetime text `YYYY-MM-DD HH:mm:ss.SSSZ`, `days` before `nowMs`).
- Produces: collections `system_access`, `system_storage`, `system_behavior` (each exactly one record, all four rules `null`), `security_events` (all rules `null`).

**If interrupted** (see the router and the Plan 1 router):
- Migrations run once per data folder. If you must change one that has already run on your dev volume, add a new migration instead; for a throwaway test volume, `docker compose -f compose.test.yaml down -v` resets it.

## Checkpoint 1A: Settings tables with defaults

- [x] **Step 1: Unit project picks up hook tests.** In `vitest.config.ts` add `'tests/hooks/**/*.unit.test.ts'` to the `unit` include. Run `npm run test:unit`; expected: still green.
- [x] **Step 2: Write the failing rule tests**, one file per collection (`system_access`, `system_storage`, `system_behavior`). Each file, for anonymous, a signed-in user and the admin:
  - anonymous and user: list, view, create, update and delete are all refused (`list` returns 0 rows or 403; the others 403/404). Use `expect(...).rejects.toMatchObject({ status })` as in `users.rules.test.ts`.
  - admin: `getFullList()` returns **exactly 1** record.
  - injection: a filter containing `' OR 1=1 --` returns nothing for the user.
  - `system_access.rules.test.ts` also asserts the defaults: `registration_open === true`, `lockdown === false`, `lockdown_message === ''`.
  - `system_storage.rules.test.ts` asserts `default_quota_bytes === 2147483648`, `max_video_mb === 200`, `max_audio_mb === 50`, `max_image_mb === 50`, `allowed_types` equals `['wav','mp3','mov','mp4','jpeg','png']`.
  - `system_behavior.rules.test.ts` asserts `presence_timeout_seconds === 30`, `analytics_retention_days === 365`, `trash_retention_days === 30`, `security_retention_days === 365`, `max_failed_logins === 3`, `lockout_minutes === 5`, `team_attempts_per_hour === 20`.
  Header comment of each: protects design 7c and security.md section 2 (admin-only settings, defaults from the spec).
- [x] **Step 3: Run** `npm run test:rules`. Expected: the new files FAIL (collections do not exist) and the coverage test is unaffected.
- [x] **Step 4: Write `1794360000_system_settings.js`.** Creates the three base collections with the typed fields of the ERD (`number` for counts and sizes, `bool` for switches, `json` for `allowed_types`, `text` for `lockdown_message`), every rule `null`, and one record each with the defaults from Step 2. Add `team_attempts_per_hour` to `system_behavior` (decision D3). Down migration deletes the three collections.
- [x] **Step 5: Run** `npm run test:rules`. Expected: the three new files PASS.
- [x] **Step 6: Write `lib/settings.js`** (`getSystemAccess`, `getSystemBehavior`): read the single record with `app.findFirstRecordByFilter(name, "id != ''")` and map snake_case fields to the camelCase result. If the record is missing it throws (a missing settings row is a broken install, not something to guess a default for).
- [x] **Step 7: Write the restart test** in `tests/container/container.test.ts`, next to the existing restart test: start on a volume, set `system_behavior.max_failed_logins` to `7` as admin, stop, start again on the same volume, assert it is still `7` and there is still exactly one record. Header comment: protects design 7c, "defaults never overwrite edits".
- [x] **Step 8: Run** `npm run test:container`. Expected: PASS.
- [x] **Step 9: Update the ERD** (`system_behavior` gets `team_attempts_per_hour`; defaults note). Add `docs/admin/settings.md` with a table of every field of the three tables: name, default, what it does, which task uses it (leave the "used by" cell `Task N` for the ones this plan uses, `later` for the rest).
- [x] **Close checkpoint 1A.** Verify: Step 5 and Step 8 passed. Commit: `feat: system settings tables with defaults`.

## Checkpoint 1B: Security log and its retention

- [ ] **Step 10: Write the failing unit test** `tests/hooks/retention.unit.test.ts` (load the module with `createRequire(import.meta.url)`):
  - `cutoffIso(Date.UTC(2026, 10, 12, 8, 30, 0), 365)` equals `'2025-11-12 08:30:00.000Z'`.
  - `cutoffIso(Date.UTC(2026, 2, 1, 0, 0, 0), 1)` equals `'2026-02-28 00:00:00.000Z'` (month boundary).
  - `cutoffIso(Date.UTC(2026, 0, 1, 0, 0, 0), 0)` equals `'2026-01-01 00:00:00.000Z'`.
  Header comment: protects design 6.9, retention is a setting and the cut-off must be exact.
- [ ] **Step 11: Run** `npm run test:unit`. Expected: FAIL (module missing).
- [ ] **Step 12: Implement `lib/retention.js`** `cutoffIso(nowMs, days)`. Run `npm run test:unit`; expected: PASS.
- [ ] **Step 13: Write the failing rule test** `tests/rules/security_events.rules.test.ts`: anonymous and user cannot list, view, create, update or delete; admin can list; an event written by the app is visible to the admin only. Add one assertion that **creating an event through the public API as a user is refused** (events come from hooks, never from clients).
- [ ] **Step 14: Write `1794360100_security_events.js`:** base collection `security_events` with `type` (select, the nine values in `logEvent`'s comment), `user` (relation to `users`, optional, **no** cascade delete so a deleted user does not erase the log), `ip` (text), `detail` (json), `created` (autodate); all rules `null`; an index on `(type, created)`. Run `npm run test:rules`; expected: PASS.
- [ ] **Step 15: Write `lib/security-log.js`** `logEvent`: creates the record with `app.save`; wraps everything in try/catch and writes to `console.error` on failure, because a logging failure must never block a sign-in or a join.
- [ ] **Step 16: Write `retention.pb.js`:** `cronAdd("purge_security_events", "0 3 * * *", ...)` that deletes `security_events` older than `cutoffIso(Date.now(), getSystemBehavior($app).securityRetentionDays)`. Write a rule test in `security_events.rules.test.ts` that the admin API `GET /api/crons` lists a job with id `purge_security_events` (via `asAdmin()` and `pb.crons.getFullList()` or `pb.send('/api/crons')`).
- [ ] **Step 17: Run** `npm test`. Expected: every layer passes.
- [ ] **Step 18: Document** in `docs/admin/settings.md` (the log, who reads it, retention) and `docs/developer/backend.md` (hooks layout, the isolated-scope rule with `require(`${__hooks}/lib/...`)`, `lib/` is pure CommonJS tested in `tests/hooks/`). Add the new test folder to `docs/developer/testing.md`.
- [ ] **Close checkpoint 1B.** Verify: Step 17 passed and `npm run check:docs` is clean. Commit: `feat: security log with retention`.
