# Task 2: Per-user records

Part of the [Accounts and Teams plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong  
**Depends on:** Task 1

**Files:**
- Create: `backend/pb_migrations/1794360200_user_records.js`, `backend/pb_hooks/lib/user-records.js`, `backend/pb_hooks/users-defaults.pb.js`, `tests/rules/user_preferences.rules.test.ts`, `tests/rules/user_limits.rules.test.ts`, `tests/rules/user_status.rules.test.ts`
- Modify: `docs/admin/settings.md`, `docs/superpowers/specs/2026-11-11-kwnto-erd.md` (only if a field changes)

**Interfaces:**
- Consumes: nothing from Task 1 except the migration order.
- Produces, `backend/pb_hooks/lib/user-records.js`:

```js
ensureUserRecords(app, userId) // -> void. Idempotent: creates the user's user_preferences, user_limits and
                               // user_status rows if missing; never changes an existing row.
```

- Produces: collections `user_preferences` (`user`, `theme` select `light|dark` default `dark`, `minimap_visible` bool default `true`), `user_limits` (`user`, `quota_override_bytes` number, empty means "use the system default"), `user_status` (`user`, `blocked` bool default `false`, `blocked_reason` text, `blocked_at` date). Each has a unique `user` relation with cascade delete.

**If interrupted:** nothing leaves state outside the working tree; a test volume is reset with `docker compose -f compose.test.yaml down -v`.

## Checkpoint 2A: The three per-user tables

- [ ] **Step 1: Write the failing rule tests.** Header comment on each: protects design 7c (a user may change their theme but not their own quota or block status) and security.md section 2.
  - `user_preferences.rules.test.ts`: a new user (from `createUser()`) has exactly one row, readable by that user with `theme === 'dark'` and `minimap_visible === true`; user A cannot list or view user B's row (list returns only A's; view of B's id is 404); user A can update their own `theme` to `'light'`; updating `theme` to `'neon'` is rejected with 400; user A cannot change the `user` field of their row to B's id; user A cannot create or delete a row; anonymous gets nothing.
  - `user_limits.rules.test.ts` and `user_status.rules.test.ts`: a new user has one row of each (visible to the admin through `getFullList({ filter: 'user = "<id>"' })`); the user themselves cannot list, view, create, update or delete it (this includes `blocked` and `quota_override_bytes`); anonymous cannot either; injection string in a filter returns nothing.
  - One test in `user_status.rules.test.ts`: deleting the user as admin deletes their three rows (cascade).
- [ ] **Step 2: Run** `npm run test:rules`. Expected: the three files FAIL.
- [ ] **Step 3: Write `1794360200_user_records.js`.** Creates the three collections. Rules: `user_preferences` list and view `user = @request.auth.id`, update `user = @request.auth.id && @request.body.user:isset = false`, create and delete `null`; the other two all `null`. The same migration creates the missing rows for users that already exist (a loop over `app.findAllRecords("users")` that skips users who already have a row).
- [ ] **Step 4: Write `lib/user-records.js`** (`ensureUserRecords`) and **`users-defaults.pb.js`** calling it from `onRecordAfterCreateSuccess` on `users`. Why a separate idempotent helper: Task 4 also calls it at sign-in, so a user whose hook failed or whose rows were deleted by hand is repaired on the next sign-in rather than breaking.
- [ ] **Step 5: Run** `npm run test:rules`. Expected: PASS. Also run `npm run test:unit` (the coverage check must still be green: each new collection has its test file).
- [ ] **Step 6: Document** the three tables and what the admin may edit in `docs/admin/settings.md`: blocking a user is done by setting `blocked`, `blocked_reason` and `blocked_at` on that user's `user_status` row in the dashboard (Task 4 and Task 5 make it take effect).
- [ ] **Close checkpoint 2A.** Verify: Step 5 passed. Commit: `feat: per-user preferences, limits and status`.
