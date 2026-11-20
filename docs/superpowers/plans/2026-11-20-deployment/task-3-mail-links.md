# Task 3: Mail links and the verify and reset screens

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong
**Depends on:** Task 1

Design 7c: sign-up needs a verified email, and resets go out by mail. PocketBase's default templates link to its own dashboard pages (`{APP_URL}/_/#/auth/confirm-verification/{TOKEN}`), and Task 1 makes `/_/` a 404 on the public address (Review Focus 1). This task points the links into the app (D9) and gives the app the two screens that finish the job. Plan 2's carried item "real mail" is walked by the developer in Task 6.

**Files:**
- Create: `backend/pb_migrations/1794390100_mail_links.js`, `tests/rules/mail-links.rules.test.ts`, `frontend/src/features/auth/VerifyEmailScreen.tsx`, `frontend/src/features/auth/ResetPasswordScreen.tsx`, `e2e/mail-links.spec.ts`, `e2e/helpers/tokens.ts`
- Modify: `frontend/src/features/shell/routes.ts`, `frontend/src/features/shell/routes.test.ts`, `frontend/src/backend/auth.ts`, `frontend/src/backend/auth.test.ts`, the shell component that chooses a screen by route (render the two new screens **before** the signed-in gate, signed in or not), `docs/user/accounts-and-teams.md` ("Verify your email", a new "Forgot your password"), `docs/developer/backend.md` ("Mail templates")

**Interfaces:**
- Consumes: `parseRoute`, `routeToHash`, `Route` (`routes.ts`); `backend.auth.refresh` and `BackendError` (the door); `checkPassword` copy reaches the browser as the server's 400 message (Plan 2).
- Produces, `routes.ts`: `Route` gains `{ name: 'verify'; token: string }` and `{ name: 'reset'; token: string }`, parsed from `#/verify/<token>` and `#/reset/<token>` where `<token>` matches `^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$` and is at most 2048 characters (a JWT); anything else falls back to `teams`. `routeToHash` writes them back.
- Produces, `backend.auth`: `confirmVerification(token: string): Promise<void>` and `confirmPasswordReset(token: string, password: string, passwordConfirm: string): Promise<void>`, each mapping errors to `BackendError` like the other methods.
- Produces, screens: `VerifyEmailScreen` calls `confirmVerification` once on mount (StrictMode-safe: a ref guards the second call), then shows the router's success or failure copy in `role="status"` or `role="alert"`, and a `Go to KWNTO` link to `#/`; on success while signed in it calls `backend.auth.refresh()`. `ResetPasswordScreen` has `New password` and `Repeat new password` inputs (`type="password"`, `autocomplete="new-password"`), a `Set password` button, the mismatch copy without a request, the server's message on a 400 (the password rules), and the success or failure copy.
- Produces, `e2e/helpers/tokens.ts` (only if Step 6 says it is possible): `mintToken(email: string, type: 'verification' | 'passwordReset'): Promise<string>`.

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 3A: Routes and the door

- [ ] **Step 1: Write the failing tests** C1 in `routes.test.ts` and C2 in `auth.test.ts` (fake `pb` as the file already does: `collection('users').confirmVerification` and `confirmPasswordReset` called with exactly the arguments; a 400 becomes `BackendError` `invalid` with the server's message).
- [ ] **Step 2: Run** `npx vitest run --project unit frontend/src/features/shell/routes.test.ts frontend/src/backend/auth.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the two routes and the two door methods. The token test is one constant `const TOKEN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/` used with `token.length <= 2048 && TOKEN.test(token)` (B1, B2).
- [ ] **Step 4: Run** it. Expected: PASS. **Close checkpoint 3A** (commit `feat: verify and reset routes in the door`).

## Checkpoint 3B: The templates

- [ ] **Step 5: Write the failing test** C3 in `tests/rules/mail-links.rules.test.ts`; run it, expect FAIL.
- [ ] **Step 6: Find out how a test can get a real token.** In 0.40.6, read how `NewVerificationToken` and `NewPasswordResetToken` sign (claims and key: expected `id`, `type`, `collectionId`, `email`, HS256 with the record's `tokenKey` followed by the collection's `verificationToken.secret` or `passwordResetToken.secret`), and whether a superuser can read the record's `tokenKey` and the collection's secrets through the API. Write what you found in the checkpoint's `progress.md` row. If both are readable, write `mintToken` with `node:crypto` (`createHmac('sha256', key)`; no new dependency) and C5 and C6 test real tokens. If not, C5 and C6 keep only their invalid-token halves and their valid halves move to M10 and M11 in Task 6; say so in the report.
- [ ] **Step 7: Write the migration**: on the `users` collection, set `verificationTemplate.body` and `resetPasswordTemplate.body` to a short HTML body each (`<p>Hello,</p><p>Confirm your email for KWNTO: <a href="{APP_URL}/#/verify/{TOKEN}">verify my email</a>.</p><p>If you did not sign up, ignore this mail.</p>` and the reset version with `/#/reset/{TOKEN}` and `set a new password`), and the subjects `Verify your KWNTO email` and `Reset your KWNTO password`. The down migration restores the bodies it replaced (read them before writing).
- [ ] **Step 8: Run** `npm run test:rules`. Expected: PASS. **Close checkpoint 3B** (commit `feat: mail links point into the app`).

## Checkpoint 3C: The screens

- [ ] **Step 9: Write the failing tests** C4 to C6 in `e2e/mail-links.spec.ts`; run `npm run test:e2e -- e2e/mail-links.spec.ts`, expect FAIL.
- [ ] **Step 10: Implement** both screens and the shell change. Theme tokens only (Plan 3 D1), labels on every input.
- [ ] **Step 11: Run** `npm run test:unit` and `npm run test:e2e`. Expected: PASS. Update the user and developer docs. **Close checkpoint 3C** (commit `feat: verify and reset screens`).

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | verify and reset routes | unit | `#/verify/aaa.bbb.ccc`; `#/reset/a-b.c_d.e`; `#/verify/` + 2049-character token of the right form; `#/verify/aaa.bbb`; `#/reset/a.b.c/extra`; `#/verify/<script>.b.c`; `routeToHash` of each valid route | the two routes with their tokens; `teams` for the four bad ones; the hash read back gives the same route | frontend/src/features/shell/routes.test.ts :: verify and reset links carry only a token-shaped value |
| C2 | door methods | unit | `confirmVerification('t')`; `confirmPasswordReset('t', 'p', 'q')`; a fake 400 `{ message: 'Password must ...' }` | the SDK called with exactly those arguments; `BackendError` kind `invalid` with that message | frontend/src/backend/auth.test.ts :: the door confirms verification and resets through the SDK |
| C3 | templates link into the app | rules | admin `GET /api/collections/users` | `verificationTemplate.body` contains `{APP_URL}/#/verify/{TOKEN}`, `resetPasswordTemplate.body` contains `{APP_URL}/#/reset/{TOKEN}`; neither body contains `/_/`; the two subjects | tests/rules/mail-links.rules.test.ts :: verification and reset mails link into the app, never the dashboard |
| C4 | a bad verify link | e2e | open `#/verify/aaa.bbb.ccc` signed out | the failure copy in `role="alert"`; `Go to KWNTO` leads to the sign-in screen | e2e/mail-links.spec.ts :: a bad verification link says so and offers the way back |
| C5 | verify through the link | e2e | a fresh unverified user, signed in; open `#/verify/<mintToken(email, 'verification')>` | the success copy; after `Go to KWNTO` the verify gate is gone (Create team enabled) without signing in again | e2e/mail-links.spec.ts :: the verification link verifies the account |
| C6 | reset through the link | e2e | `#/reset/<mintToken(email, 'passwordReset')>`; mismatched passwords; then `short1`; then a valid new password | mismatch copy and no request sent; the server's password-rule message; the success copy; signing in with the new password works and with the old one fails | e2e/mail-links.spec.ts :: the reset link sets a new password that follows the rules |
### Probes
**Probe folder:** `tests/probes/2026-11-20-deployment/task-3/`
### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | frontend/src/features/shell/routes.ts | `token.length <= 2048 && TOKEN.test(token)` | `TOKEN.test(token)` | frontend/src/features/shell/routes.test.ts |
| B2 | frontend/src/features/shell/routes.ts | `const TOKEN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/` | `const TOKEN = /^[^/]+$/` | frontend/src/features/shell/routes.test.ts |
### Flow
none (the real mail walk is Task 6, M10 and M11)
### Evidence
The full output of `npm run check:task`, the Step 6 findings, and the failing run of each break.
