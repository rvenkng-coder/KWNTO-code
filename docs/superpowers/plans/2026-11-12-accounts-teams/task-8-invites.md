# Task 8: Invite by email

Part of the [Accounts and Teams plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong  
**Depends on:** Task 6 (Task 7 for `isOverLimit`)

**Files:**
- Create: `backend/pb_migrations/1794360500_team_invites.js`, `backend/pb_hooks/teams-invites.pb.js`, `tests/rules/team_invites.rules.test.ts`, `tests/rules/teams.invites.rules.test.ts`
- Modify: `docs/superpowers/specs/2026-11-11-kwnto-erd.md` (`team_invites.team_name`, `invited_by_name`), `docs/security.md` (section 3 accepted risk), `docs/admin/settings.md`, `docs/developer/testing.md`

**Interfaces:**
- Consumes: `isOverLimit` (Task 7), `getSystemBehavior`, `logEvent` (Task 1); `teams`, `team_members` (Task 6).
- Produces: collection `team_invites`: `team`, `invited_user` (relation to `users`), `invited_by` (relation to `users`), `status` (select `pending|accepted|declined`), `team_name` and `invited_by_name` (text copies set by the hook, D6). Rules: list and view `invited_user = @request.auth.id`; create, update and delete `null`.
- Produces, routes (signed in and verified):

```
POST /api/kwnto/teams/{id}/invites      body { email: string }   (team owner only) -> 204, or
                                         404 "That user doesn't exist.", 409 "That person is already a member or has a pending invite.",
                                         429 "Too many attempts. Try again later."
POST /api/kwnto/invites/{id}/accept     (the invitee only) -> 200 { team: string, name: string }
POST /api/kwnto/invites/{id}/decline    (the invitee only) -> 204
```

- Produces: an `invite` event for every attempt (`detail: { ok: boolean, emailDomain: string }`; the full address is **not** stored, to keep the log from becoming a list of registered emails).

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 8A: The table and the rules

- [x] **Step 1: Write the failing rule tests** `tests/rules/team_invites.rules.test.ts`. Header comment: protects design 5 (an owner never sees an invitee's email list; the invitee sees the invite) and decision D7.
  - an invite created by the route (use Task 8B's route, or seed with the admin API in this checkpoint) is listed and viewable by the invited user, with `team_name` and `invited_by_name`, and by **nobody else**: not the owner who sent it, not another member, not an outsider, not anonymous.
  - nobody can create, update or delete an invite through the collection API, including the invited user (changing `status` directly is refused: only the routes change it).
  - the response of the invited user's list contains no `email` field for anyone.
  - injection string in a filter returns nothing.
- [x] **Step 2: Run** `npm run test:rules`; expected FAIL. **Step 3: Write `1794360500_team_invites.js`** (the collection only; a uniqueness rule for pending invites cannot be an index, so the route in Step 6 checks for a pending duplicate). Run `npm run test:rules`; expected PASS for the seeded cases.
- [x] **Close checkpoint 8A.** Verify: Step 3 passed. Commit: `feat: team invites table`.

## Checkpoint 8B: The invite, accept and decline routes

- [x] **Step 4: Write the failing rule tests** `tests/rules/teams.invites.rules.test.ts`. Header comment per test names the rule it protects.
  1. the owner invites an existing verified user's email: 204; that user lists one pending invite (team name, inviter name, no email); accepting returns `200`, the invitee is now a `member` with `user_name` set and sees the team; the invite's `status` is `accepted`.
  2. **Review Focus 5:** the invite request's response body and headers never contain the invitee's email; the owner's `team_members` list shows the accepted person by name and **no email**; before acceptance the owner can find no trace of the invitee in any collection they can read.
  3. an unknown email gives 404 `That user doesn't exist.`; the same email in different letter case as a real account is found (the comparison is case-insensitive).
  4. a plain member (not owner) inviting gets 403; an outsider gets 404; an unverified owner gets 403; anonymous gets 401.
  5. inviting a person who is already a member, or who already has a pending invite from this team, gives 409 with no new row.
  6. **Review Focus 5:** another user cannot accept or decline someone else's invite (404); an invite cannot be accepted twice (second call 409, one member row); declining sets `declined` and the person is not a member; a declined person can be invited again.
  7. an **unverified** invitee cannot accept (403) and stays invited.
  8. **rate limit:** with `team_attempts_per_hour` at 3, the owner's fourth attempt within the hour (existing or unknown email) gives 429; the limit is shared with join attempts (Task 7).
  9. the `invite` events exist for every attempt, and none of their `detail` values contains the full email address.
- [x] **Step 5: Run** `npm run test:rules`; expected FAIL. **Step 6: Implement `teams-invites.pb.js`:** the three routes; email lookup by `findAuthRecordByEmail("users", email.toLowerCase().trim())` and a catch for not found; copies `team_name` and `invited_by_name` into the invite when it is created; accept creates the member inside a transaction together with the status change.
- [x] **Step 7: Run** `npm run test:rules`, then `npm test`. Expected: PASS.
- [x] **Step 8: Document.** `docs/security.md` section 3 and 10: the invite flow as built, the accepted enumeration risk exactly as the design words it, and how the rate limit and the log limit it; `docs/admin/settings.md`.
- [x] **Close checkpoint 8B.** Verify: Step 7 passed. Commit: `feat: invite by email`.
