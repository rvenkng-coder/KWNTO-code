# Task 5: Incident controls and the runbook

Part of the [Accounts and Teams plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong  
**Depends on:** Task 4

**Files:**
- Create: `backend/pb_hooks/admin-controls.pb.js`, `tests/rules/admin-controls.rules.test.ts`
- Modify: `tests/rules/helpers/pb.ts` (add `adminSend`), `docs/security.md` (section 9 becomes the runbook), `docs/admin/settings.md`, `docs/developer/backend.md`

**Interfaces:**
- Consumes: `logEvent`, `getSystemAccess` (Task 1); the sign-in hooks and `user_status` (Tasks 2 and 4).
- Produces, superuser-only routes (any other caller gets 401 or 403):

```
POST /api/kwnto/admin/users/{id}/sign-out   // ends every session of that one user; 204; writes an `admin` event
POST /api/kwnto/admin/sign-out-all          // ends every session of every user (not the admin's); 204; `admin` event
```

- Produces: a `user_status` update that sets `blocked` to `true` ends that user's sessions, and a blocked user's token refresh is refused with the Task 4 blocked message.
- Produces, `tests/rules/helpers/pb.ts`: `adminSend(path: string, init?: { method?: string; body?: unknown }): Promise<Response>` (calls a route as the admin) and `rawSend(token: string | undefined, path: string, init?)` for calls with a given token (or none).

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 5A: Sessions can be ended

- [ ] **Step 1: Confirm the mechanisms** against PocketBase 0.40.6 before coding, and record the result in `.planning/2026-11-12-accounts-teams/findings.md` (design 7c: "the builder must confirm"). Questions: (a) does `record.refreshTokenKey()` (or changing the record's token key) make that user's existing tokens invalid at once; (b) does changing the `users` collection's auth-token secret invalidate every user token while superuser tokens keep working; (c) does `authRefresh` run the `onRecordAuthRefreshRequest` hook. Write a small throwaway probe route if the docs are unclear, run it, delete it, and quote its output in `findings.md`.
- [ ] **Step 2: Write the failing rule tests** `tests/rules/admin-controls.rules.test.ts`. Header comment per test: protects design 7c incident controls and security.md section 9.
  1. **Review Focus 4, sign out one:** user A and user B sign in and keep their tokens; `adminSend('/api/kwnto/admin/users/<A>/sign-out', { method: 'POST' })` returns 204; A's token then fails `authRefresh()` with 401 while B's still works.
  2. **Sign out everyone:** after `sign-out-all` both tokens fail; both users can sign in again with their passwords; the admin's own token still works.
  3. **Only the admin:** a signed-in user, an anonymous caller and a user token each get 401 or 403 on both routes, and no session is ended (the user's token still works afterwards).
  4. **Review Focus 4, block ends sessions:** a signed-in user holding a token; as admin set their `user_status.blocked` to `true`; their `authRefresh()` now fails (401 or the blocked 403) and a fresh sign-in is refused with the Task 4 message; setting `blocked` back to `false` lets them sign in again.
  5. **Unknown user id** on `sign-out` returns 404.
  6. **Log:** each of the two routes and each block write one `admin` event whose `detail.action` is `sign-out-user`, `sign-out-all` or `block`.
  7. **Settings changes are logged:** as admin change `system_behavior.lockout_minutes`; one `admin` event appears with `detail.action` `settings` and `detail.collection` `system_behavior`, listing the changed field names and old and new values (the settings hold no secrets). The same for `system_access`, `system_storage`, `user_limits` and `user_status`.
- [ ] **Step 3: Run** `npm run test:rules`. Expected: the new file FAILS.
- [ ] **Step 4: Implement `admin-controls.pb.js`:** both routes with the `$apis.requireSuperuserAuth()` middleware; `sign-out` loads the user and refreshes the token key; `sign-out-all` changes the `users` collection's auth-token secret (the way Step 1 confirmed) and saves the collection; an `onRecordAfterUpdateSuccess` hook on `user_status` that, when `blocked` changed to true, refreshes that user's token key and logs `block`; an `onRecordAuthRefreshRequest` hook on `users` that refuses a blocked account with the Task 4 message; `onRecordAfterUpdateSuccess` hooks on the five settings collections of test 7 that write the `settings` event (design 6.9: admin changes are logged). Use `try/finally` nowhere that would hide a failure; a failed sign-out must return an error, not 204.
- [ ] **Step 5: Run** `npm run test:rules`. Expected: PASS.
- [ ] **Close checkpoint 5A.** Verify: Step 5 passed. Commit: `feat: admin sign-out and block ends sessions`.

## Checkpoint 5B: The runbook

- [ ] **Step 6: Write `docs/security.md` section 9 as a runbook.** For each of the eight controls: when to use it, the exact steps (dashboard path or the `curl` for the two routes, with the admin token step shown), how to confirm it worked, how to undo it. Controls: 1 sign one account out; 2 sign everyone out; 3 block an account; 4 lockdown; 5 close sign-up; 6 revoke all share links; 7 reset a password by hand (dashboard, and the `pocketbase superuser upsert` command already in `backend.md` is for admins only, so say so); 8 restore from a backup. Controls 6 and 8 are marked `(arrives with plan 7)` and `(arrives with the deployment plan)` (D9). Remove the "(planned)" and "(confirm)" tags this task settled; keep the others.
- [ ] **Step 7: Walk the runbook once** against `npm run dev:backend` as an admin would: do controls 1 to 5 and 7 exactly as written, note any step that was wrong and fix the text. Record what you did and saw in `progress.md` (engineering.md section 6, "full flow" evidence).
- [ ] **Step 8: Note in `docs/developer/backend.md`** that `/api/kwnto/admin/` is the prefix the deployment plan must block on the public address, and why the prefix exists.
- [ ] **Close checkpoint 5B.** Verify: `npm run check:docs` is clean and Step 7 is recorded. Commit: `docs: incident runbook`.
