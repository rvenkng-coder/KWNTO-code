# Task 7: Join by code

Part of the [Accounts and Teams plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong  
**Depends on:** Task 6

**Files:**
- Create: `backend/pb_hooks/lib/rate-limit.js`, `backend/pb_hooks/teams-join.pb.js`, `tests/hooks/rate-limit.unit.test.ts`, `tests/rules/teams.join.rules.test.ts`
- Modify: `docs/security.md` (section 3), `docs/admin/settings.md`, `docs/developer/testing.md`

**Interfaces:**
- Consumes: `generateJoinCode`, `createTeam` and the collections (Task 6), `signUp` (Task 3), `getSystemBehavior(app).teamAttemptsPerHour`, `logEvent` (Task 1); the collections of Task 6.
- Produces, `backend/pb_hooks/lib/rate-limit.js` (Task 8 uses it too):

```js
isOverLimit(timesMs /* number[] */, nowMs /* number */, windowMs /* number */, max /* number */) // -> boolean
// true when at least `max` of the times fall within the last windowMs
```

- Produces, routes (signed in and verified, else 401 and 403):

```
POST /api/kwnto/teams/join                  body { code: string }  -> 200 { team: string, name: string }
POST /api/kwnto/teams/{id}/regenerate-code  (owner only)           -> 200 { join_code: string }
```

- Produces: errors `That join code is not valid.` (404; the same for a wrong code, a disabled code and a code that never existed), `Too many attempts. Try again later.` (429). Every attempt writes a `join` event (`detail: { ok: boolean }`, never the code).

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 7A: Rate limit and the join routes

- [ ] **Step 1: Write the failing unit tests** `tests/hooks/rate-limit.unit.test.ts`. Header comment: protects the guess limit on join codes and invites (design 5, security.md section 3). `isOverLimit([], now, 3_600_000, 20)` is `false`; 19 times inside the window is `false`; 20 inside is `true`; 20 times of which one is older than the window is `false`; `max` 1 with one time inside the window is `true`.
- [ ] **Step 2: Run** `npm run test:unit`. Expected: FAIL. **Step 3: Implement `lib/rate-limit.js`.** Run again; expected: PASS.
- [ ] **Step 4: Write the failing rule tests** `tests/rules/teams.join.rules.test.ts`. Header comment per test: protects design 5 (join by code), security.md section 3 (rate limit), section 2 (owner-only code control).
  1. owner enables the code (`join_code_enabled: true`); a second verified user posts the code and becomes a `member` of that team (role `member`, `user_name` set); the response has the team id and name and **nothing else about the team or its members**.
  2. the code works in lower case and with surrounding spaces.
  3. posting the code again as the same user is `200` and creates no duplicate member.
  4. a disabled code, a wrong code and an empty body all give the same 404 and the same message.
  5. an **unverified** user gets 403; anonymous gets 401.
  6. regenerate: the owner gets a new code; the old code now gives 404 and the new one works; a plain member gets 403; an outsider gets 404; `team_settings.join_code` as read by the owner equals the returned code.
  7. **rate limit:** set `team_attempts_per_hour` to 3 as admin; a user's fourth attempt within the hour (right or wrong code) gives 429; another user is unaffected; restore the setting. Attempts of type `invite` count toward the same limit (seed one `invite` event as admin first).
  8. each attempt writes one `join` event and no event's `detail` contains the code.
- [ ] **Step 5: Run** `npm run test:rules`. Expected: the new file FAILS.
- [ ] **Step 6: Implement `teams-join.pb.js`:** `routerAdd` for both routes with `$apis.requireAuth("users")`; check `verified`; count the caller's `join` and `invite` events in the last hour with `isOverLimit`; look up an enabled `team_settings` row by the normalised code with a bound parameter (never string concatenation); create the member in a transaction that tolerates the unique-index race (two simultaneous joins give one row).
- [ ] **Step 7: Run** `npm run test:rules`, then `npm test`. Expected: PASS.
- [ ] **Step 8: Document.** `docs/security.md` section 3: join codes are guessable in principle (about 40 bits), the rate limit and its setting, and that the owner can disable or regenerate; `docs/admin/settings.md`: `team_attempts_per_hour`.
- [ ] **Close checkpoint 7A.** Verify: Step 7 passed. Commit: `feat: join a team by code`.
