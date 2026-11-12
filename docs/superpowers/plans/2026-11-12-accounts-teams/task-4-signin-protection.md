# Task 4: Sign-in protection: lockout, block, lockdown

Part of the [Accounts and Teams plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong  
**Depends on:** Tasks 1 and 2

**Files:**
- Create: `backend/pb_hooks/lib/lockout.js`, `backend/pb_hooks/users-signin.pb.js`, `tests/hooks/lockout.unit.test.ts`, `tests/rules/users.signin.rules.test.ts`
- Modify: `docs/security.md` (section 3), `docs/admin/settings.md`, `docs/developer/testing.md`

**Interfaces:**
- Consumes: `getSystemAccess`, `getSystemBehavior`, `logEvent` (Task 1); `ensureUserRecords` (Task 2); the `user_status` rows (Task 2).
- Produces, `backend/pb_hooks/lib/lockout.js`:

```js
// failureTimesMs: times (ms since epoch) of the failed sign-ins of ONE account from ONE IP since that pair's last
// successful sign-in, in any order. Locked when at least maxFailed of them fall in the last lockoutMinutes.
decideLockout(failureTimesMs /* number[] */, nowMs /* number */, maxFailed /* number */, lockoutMinutes /* number */)
  // -> { locked: boolean, retryAfterSeconds: number }   retryAfterSeconds is 0 when not locked, else whole seconds
  //    until the maxFailed-th most recent failure leaves the window (rounded up)
```

- Produces: sign-in refusals with these exact messages: lockdown `<system_access.lockdown_message>` (status 403; if empty, `Sign-in is temporarily unavailable.`), blocked `Your account is blocked: <blocked_reason>` (403), lockout `Too many failed sign-in attempts. Try again after <N> minutes.` (429, `N` = `retryAfterSeconds` rounded up to whole minutes, at least 1).
- Produces: `security_events` rows of type `sign-in` (success), `failure` (wrong credentials), `lockout` (an attempt refused because of a lockout), each with `detail: { identity }` (lower-cased, trimmed email as typed) and the real IP.

**If interrupted:** nothing leaves state outside the working tree. Rule tests change global settings and restore them in `afterEach`; if a run was killed, `scripts/with-pocketbase.ts` resets the test container at the next start.

## Checkpoint 4A: The lockout decision as a pure function

- [x] **Step 1: Write the failing unit tests** `tests/hooks/lockout.unit.test.ts`. Header comment: protects design 7c (3 failures, 5 minutes) and the rule that a lockout must end by itself. With `now = 1_000_000_000_000` and minutes in ms:
  - no failures: `{ locked: false, retryAfterSeconds: 0 }`.
  - 2 failures in the window, max 3: not locked.
  - 3 failures in the last 5 minutes: locked; with the oldest of them 4 minutes ago, `retryAfterSeconds` is `60`.
  - 3 failures but the oldest is 6 minutes ago (only 2 in the window): not locked.
  - 5 failures in the window with max 3: `retryAfterSeconds` counts from the **3rd most recent** failure, not the oldest.
  - input order does not matter (shuffle the array).
  - `maxFailed` 1 locks after one failure; `lockoutMinutes` 1 uses 60-second windows.
- [x] **Step 2: Run** `npm run test:unit`. Expected: FAIL.
- [x] **Step 3: Implement `lib/lockout.js`** (`decideLockout`). Run `npm run test:unit`; expected: PASS.
- [x] **Close checkpoint 4A.** Verify: Step 3 passed. Commit: `feat: lockout decision`.

## Checkpoint 4B: The sign-in hooks

- [ ] **Step 4: Write the failing rule tests** `tests/rules/users.signin.rules.test.ts` (Task 3 made rule test files run one at a time; these tests rely on that because they change global settings). Each test restores any setting it changed in `afterEach`. Header comment per test names the rule it protects.
  1. **Lockout:** with the default settings, three sign-ins with a wrong password for a real user give status 400; the fourth, **with the correct password**, gives 429 and a message that contains `5 minutes`.
  2. **Review Focus 3, no enumeration:** the same three wrong attempts for an email that has no account give the same 429 status and the same message text on the fourth attempt.
  3. **Settings are live:** as admin set `max_failed_logins` to 2; two wrong attempts lock the account; restore to 3.
  4. **A lockout does not extend itself:** after the lockout in test 1, extra attempts add `lockout` events and no new `failure` events (count `failure` rows for that identity as admin: still 3).
  5. **A success resets the count:** two wrong attempts, one correct sign-in (200), two wrong attempts, then a correct sign-in still succeeds.
  6. **Block:** as admin set that user's `user_status` to `blocked: true, blocked_reason: 'Spamming'`; the correct password gives 403 and `Your account is blocked: Spamming`; a **wrong** password still gives the ordinary 400 and the reason does not appear in the response (no leak to someone who does not know the password).
  7. **Lockdown:** as admin set `lockdown: true, lockdown_message: 'Maintenance'`; a correct user sign-in gives 403 `Maintenance`; the superuser sign-in (`asAdmin()`) still works; restore.
  8. **Log:** a successful sign-in writes one `sign-in` event with `detail.identity` equal to the lower-cased email; each wrong attempt one `failure` event (read as admin).
  9. **Repair:** delete the user's `user_status` row as admin; after a correct sign-in the row exists again.
- [ ] **Step 5: Run** `npm run test:rules`. Expected: the new file FAILS.
- [ ] **Step 6: Implement `users-signin.pb.js`.** `onRecordAuthWithPasswordRequest` on `users`, in this order: (a) lockdown: refuse as above; (b) read the pair's failures: `security_events` of type `failure` with this `ip` and `detail.identity`, created after the pair's last `sign-in` event, mapped to ms, then `decideLockout`; if locked write a `lockout` event and refuse with 429; (c) call `e.next()` inside try/catch; on error write a `failure` event and rethrow. `onRecordAuthRequest` on `users` (success path): refuse blocked accounts (reading that user's `user_status`), then call `ensureUserRecords` and write a `sign-in` event. The identity and IP come from the request event (`e.identity`, `e.realIP()`; confirm both names in 0.40.6 and note any difference in `findings.md`). Why the block check is on success only: the reason is shown only to someone who proved they know the password.
- [ ] **Step 7: Run** `npm run test:rules`. Expected: PASS.
- [ ] **Step 8: Run** `npm test`. Expected: every layer passes.
- [ ] **Step 9: Document.** `docs/security.md` section 3: the lockout rule as built, including that it counts per account and IP pair (so someone elsewhere cannot lock a student out of their own computer) and the known gap that an attacker with many IPs can keep guessing; `docs/admin/settings.md`: `max_failed_logins`, `lockout_minutes`, `lockdown`, `lockdown_message`, and how to block a user. `docs/developer/testing.md`: rule tests that change global settings must restore them and run serially.
- [ ] **Close checkpoint 4B.** Verify: Step 8 passed. Commit: `feat: sign-in lockout, block and lockdown`.
