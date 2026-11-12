# Task 3: Sign-up, verification and password rules

Part of the [Accounts and Teams plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong  
**Depends on:** Tasks 1 and 2

**Files:**
- Create: `backend/pb_migrations/1794360300_users_password_policy.js`, `backend/pb_hooks/lib/password-rules.js`, `backend/pb_hooks/lib/common-passwords.js`, `backend/pb_hooks/users-signup.pb.js`, `tests/hooks/password-rules.unit.test.ts`, `tests/rules/users.signup.rules.test.ts`
- Modify: `tests/rules/helpers/pb.ts` (add `signUp`), `docs/security.md` (section 3), `docs/admin/settings.md`, `docs/developer/testing.md`

**Interfaces:**
- Consumes: `getSystemAccess(app)`, `logEvent(app, type, userId, ip, detail)` from Task 1.
- Produces, `backend/pb_hooks/lib/password-rules.js`:

```js
checkPassword(password /* string */) // -> null when acceptable, otherwise a short user-facing message string
```

- Produces, in `tests/rules/helpers/pb.ts`:

```ts
// Creates a user through the public sign-up API (not the admin API); the result is NOT verified.
export function signUp(email: string, password: string, extra?: Record<string, unknown>): Promise<{ id: string }>
```

- Produces: the rule that **verified-only actions use `@request.auth.verified = true`** in access rules (Tasks 6 to 8 follow it).

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 3A: Password rules as a pure function

- [x] **Step 1: Write the failing unit tests** `tests/hooks/password-rules.unit.test.ts`. Header comment: protects design 7c and security.md section 3 (at least 10 characters, a letter and a number, very common passwords rejected). Cases (`checkPassword(x)` equals `null` unless stated, otherwise assert it is a non-empty string):
  - `'abcdefghi1'` (10 chars) passes; `'abcdefgh1'` (9 chars) is rejected.
  - `'abcdefghijk'` (no number) is rejected; `'12345678901'` (no letter) is rejected.
  - `'Password123'` is rejected as too common (case-insensitive: `'PASSWORD123'` too); `'qwertyuiop1'` is rejected as too common.
  - A 100-character valid password passes; `''` is rejected.
  - Non-ASCII letters count as letters: `'contraseña12'` passes.
  - Whitespace is allowed inside: `'correct horse 1 battery'` passes.
- [x] **Step 2: Run** `npm run test:unit`. Expected: FAIL (module missing).
- [x] **Step 3: Implement `lib/password-rules.js`** (`checkPassword`) and **`lib/common-passwords.js`** (`module.exports` an array of lower-case strings: the commonly used passwords that are at least 10 characters long and contain a letter and a number, for example variants of `password123`, `qwertyuiop1`, `iloveyou123`, `welcome1234`; about 200 entries; shorter or letter-only ones are already refused by length and letter rules). Comparison is on the lower-cased password. Messages: `Use at least 10 characters.`, `Include at least one letter.`, `Include at least one number.`, `That password is too common.`
- [x] **Step 4: Run** `npm run test:unit`. Expected: PASS.
- [x] **Close checkpoint 3A.** Verify: Step 4 passed. Commit: `feat: password rules`.

## Checkpoint 3B: Sign-up, verification and the password paths

- [ ] **Step 5: Add `signUp` to `tests/rules/helpers/pb.ts`** (public `users` create with `passwordConfirm`; returns `{ id }`). Header comment: sign-up goes through the same door a visitor uses.
- [ ] **Step 6: Make rule test files run one at a time.** Add `fileParallelism: false` to the `rules` project in `vitest.config.ts`: from this task on, rule tests change global settings (`registration_open`, later lockdown and rate limits) and restore them in `afterEach`, which is only safe when files do not overlap.
- [ ] **Step 7: Write the failing rule tests** `tests/rules/users.signup.rules.test.ts` (extra file next to `users.rules.test.ts`; the coverage check wants only `users.rules.test.ts`, so this is additional). Header comment per test names the rule it protects:
  1. sign-up with a good password succeeds and the account is **not verified** (`verified === false`).
  2. **Review Focus 1:** `signUp(email, pw, { verified: true })` either fails with 400/403 or creates an account whose `verified` is `false`; assert the final stored value is `false` (read it as admin).
  3. sign-up with `'short1'` fails with 400 and the message from `checkPassword`; with `'Password123'` fails (too common).
  4. **Review Focus 2, password change:** a signed-in user changing their password to `'short1'` (with `oldPassword`) fails with 400 and the `checkPassword` message; to `'Password123'` fails; to a good one succeeds and the new password signs in.
  5. with `registration_open = false` (set as admin, restored in `afterEach`), sign-up fails with 403 and the body message `Sign-up is closed.`; an **existing** user can still sign in.
  6. each successful sign-up writes one `security_events` row of type `signup` (read as admin); a refused one (closed or weak) writes none.
  7. `users.createRule` is still the only public rule: the coverage test stays green.
- [ ] **Step 8: Run** `npm run test:rules`. Expected: the new tests FAIL.
- [ ] **Step 9: Implement.** `1794360300_users_password_policy.js`: set the `users` password field `min` to 10 and keep `emailVisibility` private. `users-signup.pb.js`: `onRecordCreateRequest` on `users` that (a) refuses with `ApiError(403, "Sign-up is closed.")` when `getSystemAccess($app).registrationOpen` is false and the caller is not a superuser, (b) forces `verified` to `false` for non-superusers, (c) calls `checkPassword` and refuses with `ApiError(400, msg, { password: { code, message } })`; `onRecordUpdateRequest` on `users` runs the same `checkPassword` when a new password is present; the password-reset confirm hook (`onRecordConfirmPasswordResetRequest`) does too. After success, `onRecordAfterCreateSuccess` writes a `signup` event, `onRecordAfterConfirmVerificationRequest` (name to confirm in 0.40.6) writes `verification`, and the reset-confirm hook writes `reset`. Admin-created users (as `createUser()` does) skip rules (a) and (b).
- [ ] **Step 10: Run** `npm run test:rules`. Expected: PASS. The password-reset path cannot be driven here (its token arrives by mail, and the mail setup belongs to the deployment plan). Check it by hand in Task 5's runbook walk (Step 7: reset a password with a weak value through the dashboard flow and see it refused) and say in `progress.md` that this path is covered by that manual check, not by an automated test.
- [ ] **Step 11: Document.** `docs/security.md` section 3: replace the "proposal, planned" password line with the exact rules and where they are enforced; note that the SMTP guide for verification mail arrives with the deployment plan. `docs/admin/settings.md`: `registration_open`. Note in `docs/developer/testing.md` how to create a verified user (`createUser()`) versus a public sign-up (`signUp()`).
- [ ] **Close checkpoint 3B.** Verify: Step 10 passed (`npm test` also green). Commit: `feat: sign-up rules, verification flag and password policy`.
