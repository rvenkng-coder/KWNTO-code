# Task 6: Teams, members and team settings

Part of the [Accounts and Teams plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong  
**Depends on:** Task 3

**Files:**
- Create: `backend/pb_migrations/1794360400_teams.js`, `backend/pb_hooks/lib/join-code.js`, `backend/pb_hooks/teams.pb.js`, `tests/hooks/join-code.unit.test.ts`, `tests/rules/teams.rules.test.ts`, `tests/rules/team_members.rules.test.ts`, `tests/rules/team_settings.rules.test.ts`
- Modify: `tests/rules/helpers/pb.ts` (add `createTeam`), `docs/superpowers/specs/2026-11-11-kwnto-erd.md` (`team_members.user_name`), `docs/admin/settings.md`, `docs/developer/testing.md`

**Interfaces:**
- Consumes: `ensureUserRecords` is not needed; `logEvent` (Task 1); the verified rule fragment from Task 3.
- Produces, `backend/pb_hooks/lib/join-code.js`:

```js
// randomIndex(n) returns an integer in [0, n). Passed in so tests can control it; the hook passes a function
// backed by $security.randomStringByRegex or crypto-quality randomness (never Math.random).
generateJoinCode(randomIndex /* (n: number) => number */) // -> string of 8 characters from ABCDEFGHJKLMNPQRSTUVWXYZ23456789
```

- Produces, `tests/rules/helpers/pb.ts`: `createTeam(owner: TestUser, name?: string): Promise<{ id: string; joinCode: string }>` (creates through the owner's own API session, reads the join code as admin).
- Produces: collections
  - `teams`: `name` (text, 1 to 80), `owner` (relation to `users`, required, **no** cascade delete, so a user who owns a team cannot be deleted until the team is).
  - `team_members`: `team`, `user`, `role` (select `owner|member`), `user_name` (text, copy of the user's `name`, kept in step by a hook, D6). Unique on `(team, user)`.
  - `team_settings`: `team` (unique), `join_code` (text), `join_code_enabled` (bool, default `false`, D1).
  Deleting a team cascades to its members and settings.
- Produces: creating a team (signed in, verified) automatically creates the owner's `team_members` row (role `owner`) and a `team_settings` row with a generated code, in one transaction.

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 6A: Join code generation

- [x] **Step 1: Write the failing unit test** `tests/hooks/join-code.unit.test.ts`. Header comment: protects design 5 (join code) and decision D1 (8 characters, no look-alike letters).
  - with `randomIndex = () => 0` the code is `'AAAAAAAA'`; with `n => n - 1` it is `'99999999'` (the alphabet ends in `9`).
  - the code always has length 8 and only characters from the alphabet, over 1,000 calls with a pseudo-random `randomIndex`.
  - the alphabet has 32 distinct characters and contains none of `0`, `O`, `1`, `I`.
  - `randomIndex` is called with `32` each time.
- [x] **Step 2: Run** `npm run test:unit`. Expected: FAIL. **Step 3: Implement `lib/join-code.js`.** Run again; expected: PASS.
- [x] **Close checkpoint 6A.** Verify: Step 3 passed. Commit: `feat: join code generator`.

## Checkpoint 6B: The three collections and their rules

- [ ] **Step 4: Write the failing rule tests.** Header comment per test names the design sentence it protects (design 5: teams and roles; security.md section 2).
  - `teams.rules.test.ts`: a **verified** user creates a team and becomes its owner (one `team_members` row with role `owner`, one `team_settings` row whose `join_code` has 8 characters and `join_code_enabled === false`); an **unverified** user (`createUser({ verified: false })`) gets 403 creating a team (this pins the Task 3 rule fragment); creating a team with `owner` set to someone else's id is refused or overwritten with the caller's id; a member who is not the owner can list and view the team but cannot update (rename) or delete it; the owner can rename and delete it, and deleting removes its members and settings; an outsider and anonymous see nothing (list empty, view 404); a user in two teams lists both; injection string in a filter returns nothing.
  - `team_members.rules.test.ts`: a member lists the members of their team with `user_name` and **no `email` anywhere in the response**; an outsider sees none; **Review Focus 5:** a signed-in user cannot create a `team_members` row for themselves in someone else's team (403), nor change their own `role` to `owner`, nor update any row; the owner can delete another member and that person immediately loses access (their next `teams` list no longer shows the team); the owner cannot delete their own owner row (refused); the admin deleting a plain member's **user** removes their memberships, while deleting the user who **owns** a team is refused (the team keeps its owner; ERD note on deleting users); a plain member cannot delete anyone, including themselves (D8); `user_name` follows when a member changes their `name` (update the user as themselves, then list).
  - `team_settings.rules.test.ts`: only the owner can list or view the row; a plain member gets nothing (they must not see the join code); the owner can set `join_code_enabled` true; the owner cannot write `join_code` or `team` directly (refused: regeneration is Task 7's route); nobody can create or delete a row through the API.
- [ ] **Step 5: Run** `npm run test:rules`. Expected: the new files FAIL.
- [ ] **Step 6: Write `1794360400_teams.js`:** the three collections with the fields above, a unique index on `team_members (team, user)` and on `team_settings (team)`, cascade delete from `teams`. Rules (the first uses PocketBase's multi-match `?=` against `team_members`; check the exact syntax against the 0.40.6 docs and test it, including the outsider case): `teams` list and view: caller is a member; create: `@request.auth.id != '' && @request.auth.verified = true && @request.body.owner = @request.auth.id`; update and delete: `owner = @request.auth.id`. `team_members` list and view: caller is a member of that team; create and update `null`; delete: `team.owner = @request.auth.id && user != @request.auth.id`. `team_settings` list and view: `team.owner = @request.auth.id`; update: owner, `@request.body.join_code:isset = false` and `@request.body.team:isset = false`; create and delete `null`.
- [ ] **Step 7: Write `teams.pb.js`:** `onRecordAfterCreateSuccess` on `teams` creates the owner row and the settings row (using `generateJoinCode`, retrying on a unique clash up to 5 times) inside one `runInTransaction`; if it fails the team is deleted so no team exists without an owner row (and a test asserts there is no team with zero members after a forced failure, if that can be provoked; otherwise note it in `findings.md`). `onRecordAfterUpdateSuccess` on `users` refreshes `team_members.user_name` for that user when `name` changed.
- [ ] **Step 8: Run** `npm run test:rules`. Expected: PASS. Then `npm test`; expected: every layer passes.
- [ ] **Step 9: Add `createTeam` to the helpers**, update the ERD (`team_members.user_name`) and `docs/admin/settings.md` (`team_settings`: join code off by default), and note the new rule fragments in `docs/developer/testing.md`.
- [ ] **Close checkpoint 6B.** Verify: Step 8 passed. Commit: `feat: teams, members and team settings`.
