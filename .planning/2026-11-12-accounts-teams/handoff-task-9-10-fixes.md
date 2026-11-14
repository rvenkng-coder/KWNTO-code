# Hand-off: fixes to Tasks 9 and 10 (for the local model)

Give each checkpoint as its own `little-coder -p` run. Grade each with docs/developer/local-model-notes.md. Check the server answers first.

---

## Checkpoint A: the backend door (`frontend/src/backend/`)

Work in the worktree `KWNTO-code-accounts`, branch `feat/accounts-teams`. Read first: AGENTS.md, docs/engineering.md, docs/developer/backend.md.

The door has five bugs. Fix them with the smallest change each. Only touch the files listed. If you need any other file, stop and report.

Files you may change: `frontend/src/backend/teams.ts`, `frontend/src/backend/mappers.ts`, `frontend/src/backend/mappers.test.ts`, `frontend/src/backend/errors.ts`, `frontend/src/backend/errors.test.ts`.

1. **`invites()` filters on a field that does not exist.** In `teams.ts` it filters on `invitee`. The real field is `invited_user` (see `backend/pb_migrations/1794360500_team_invites.js`). Change the filter.
2. **`toTeamMember` reads the wrong field.** In `mappers.ts` it reads `record.user_id`. The real field on `team_members` is `user` (see `backend/pb_migrations/1794360400_teams.js`). Fix the mapper. Its test in `mappers.test.ts` builds the record with `user_id`, so it passes for the wrong reason: change the test's input to use `user` too. Do not change what the test expects.
3. **Three methods skip error mapping.** `join`, `acceptInvite` and `regenerateJoinCode` in `teams.ts` do not use `wrapped(...)`, so a refused request throws a raw PocketBase error instead of a `BackendError`. Wrap them like the other methods. Add a unit test in a new file `frontend/src/backend/teams.test.ts`, with a fake `pb` object whose `send` rejects with a `ClientResponseError` of status 404. Check that `join` rejects with `kind === 'not-found'`. Do the same for `acceptInvite` and `regenerateJoinCode`. Each test must fail if the `wrapped` call is removed: remove it once, watch the test fail, put it back.
4. **`list()` makes one request per team.** Replace the loop of `getOne` calls with one `getFullList` on `team_members` using `expand: 'team'`, then map `expand.team`. Keep the result the same: a `Team[]` with the right `isOwner`.
5. **`toPlain` and the casts.** `toPlain` copies keys into a plain object with casts. PocketBase records already behave as plain objects. Remove `toPlain` and pass the records to the mappers directly, with the least casting that typechecks. No `any`.

Do not touch the screens (`frontend/src/features/`). Do not edit any test in `tests/rules/`.

Finish with `npm run lint`, `npm run typecheck`, `npm run test:unit`, and `npm run test:rules`. Paste the output of each in your report. The invite test in `tests/rules/backend-door.rules.test.ts` fails now and must pass after your change; every other rules test passes. Commit once, message `fix: correct backend door field names, error mapping and list query`.

Report: what you changed per numbered item, and anything you could not do.

---

## Checkpoint B: the screens (`frontend/src/features/`)

Only after checkpoint A is committed and graded.

Files you may change: everything under `frontend/src/features/auth/` and `frontend/src/features/teams/`, plus one new file `frontend/src/features/errorMessage.ts`. If you need any other file, stop and report.

1. **One error helper.** The same try/catch with `const e = err as { kind?: string; message?: string }` appears in `useSession.ts`, `useTeams.ts` and `TeamDetail.tsx` (about ten times). Create `errorMessage(err: unknown, fallback: string): string` in `frontend/src/features/errorMessage.ts`. It returns `err.message` when `err` is an `Error` with a non-empty message, otherwise `fallback`. Add `frontend/src/features/errorMessage.test.ts` with cases: an `Error`, an `Error` with an empty message, a string, `null`, and an object with a `message` property that is not an `Error` (fallback). Use the helper everywhere the pattern appears. No `as` casts for errors.
2. **Use the real types.** In `useSession.ts`, `useTeams.ts` and `TeamDetail.tsx`, replace the inline `{ id: string; ... }` types with `AuthUser`, `Team`, `TeamMember` and `TeamSettings` from `frontend/src/backend/types.ts`. Export those types through `frontend/src/backend/index.ts` if they are not already.
3. **`TeamDetail` fails for plain members.** Only the owner may read team settings. Today `TeamDetail` loads settings for everyone, so for a member the call fails, an error shows and `isOwner` is never set. Load the members and the team list first and set `isOwner`; load settings only when `isOwner` is true.
4. **The Enable/Disable join code button does nothing.** Its handler is an empty function. Call `backend.teams.setJoinCodeEnabled(teamId, !settings.joinCodeEnabled)`, then update `settings` to match. Show the error from the helper if it fails.
5. **Lint.** Remove the unused `eslint-disable` directive that `npm run lint` warns about, so lint has no warnings.

Add or extend an end-to-end test in `e2e/accounts.spec.ts` for items 3 and 4: a member (not the owner) opens the team and sees the members list and no error and no join-code section; the owner switches the join code off and a second user who types the code is refused. If `e2e/accounts.spec.ts` would pass 300 lines, put the new tests in a new file `e2e/teams-detail.spec.ts` that reuses `e2e/helpers/admin.ts`. Each new test must fail without its fix: undo the fix once, watch it fail, restore it.

Do not edit any existing test to make it pass. If an existing test fails, stop and explain why.

Finish with `npm run lint`, `npm run typecheck`, `npm run test:unit` and `npm run test:e2e`, and paste each output. Commit once, message `fix: team detail for members, join code toggle, shared error helper`.

Report: what you changed per numbered item, which tests you proved by breaking the fix, and anything you could not do.

---

## Done by the controller

The sign-in test in `tests/rules/backend-door.rules.test.ts` is fixed (developer-approved): three wrong passwords each give `invalid` (max_failed_logins is 3), then the next attempt gives `locked`, even with the right password.
