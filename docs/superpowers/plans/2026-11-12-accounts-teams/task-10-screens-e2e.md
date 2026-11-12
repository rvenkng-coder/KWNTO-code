# Task 10: Sign-in and team screens, end-to-end

Part of the [Accounts and Teams plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid  
**Depends on:** Task 9

**Files:**
- Create: `src/features/auth/useSession.ts`, `src/features/auth/AuthScreen.tsx`, `src/features/auth/SignInForm.tsx`, `src/features/auth/SignUpForm.tsx`, `src/features/teams/useTeams.ts`, `src/features/teams/TeamsScreen.tsx`, `src/features/teams/CreateTeamForm.tsx`, `src/features/teams/JoinByCodeForm.tsx`, `src/features/teams/TeamDetail.tsx`, `src/features/teams/InviteForm.tsx`, `src/features/teams/InvitesInbox.tsx`, `e2e/helpers/admin.ts`, `e2e/accounts.spec.ts`, `docs/user/accounts-and-teams.md`
- Modify: `src/App.tsx` (keeps the `KWNTO` heading and the `backend-status` line; adds the gate), `docs/user/` index in `docs/README.md`, `docs/developer/testing.md`

**Interfaces:**
- Consumes: `backend.auth` and `backend.teams` from Task 9 (names and error kinds there).
- Produces, `e2e/helpers/admin.ts`: `verifyByEmail(email: string): Promise<void>` (signs in to the test PocketBase as admin and sets that user's `verified` to true; the e2e stand-in for the verification mail) and `uniqueEmail(): string`.
- Produces: the visible texts the tests rely on: `Sign in`, `Sign up`, `Create team`, `Join with code`, `Send invite`, `Sign out`, and test ids `session-user`, `team-list`, `member-list`, `invite-inbox`, `join-code`, `form-error`.

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 10A: Sign-in and sign-up screens

- [ ] **Step 1: Write the failing end-to-end tests** in `e2e/accounts.spec.ts` (header comment per test: protects the flow named; each uses its own unique emails so tests can run in parallel):
  1. **Sign-up and verification gate:** sign up with a good password; the screen says to check email; signing in works but the `Create team` form shows `Verify your email to create or join a team.`; after `verifyByEmail` and a reload, `Create team` is available.
  2. **Weak password** shows the server's message in `form-error` and creates no account.
  3. **Lockout:** three wrong passwords, then the correct one, shows `Try again after 5 minutes.` in `form-error`.
  4. **Session:** after sign-in a reload keeps the user (`session-user` shows the name); `Sign out` returns to the sign-in screen and a reload stays signed out.
- [ ] **Step 2: Run** `npm run test:e2e`; expected: the new tests FAIL in both browsers (the existing smoke test still passes).
- [ ] **Step 3: Implement** `useSession` (a Zustand store that reads `backend.auth.current()`, subscribes with `onChange`, and exposes `signIn`, `signUp`, `signOut`, `error`), `AuthScreen`, `SignInForm` (with a `Forgot password?` link that calls `requestPasswordReset` and shows a neutral `If that account exists, we sent a link.`), `SignUpForm` (email, name, password, with the rules text shown next to the field), and the gate in `App.tsx`. Render server messages as plain text only. Each file stays under 300 lines.
- [ ] **Step 4: Run** `npm test`. Expected: every layer passes; end-to-end shows the four new tests per browser.
- [ ] **Close checkpoint 10A.** Verify: Step 4 passed. Commit: `feat: sign-in and sign-up screens`.

## Checkpoint 10B: Team screens

- [ ] **Step 5: Write the failing end-to-end tests** (same file; two browser contexts for two people where needed). Header comment per test names the design sentence it protects.
  1. **XSS as text (security.md section 5):** create a team named `<script>window.__xss=1</script>`; the team list shows that exact text and `window.__xss` is undefined.
  2. **Join by code:** the owner turns the code on, reads it from `join-code`, a second verified user enters it under `Join with code` and sees the team; the member's page never shows the owner's email, and the owner's `member-list` shows the member's name only.
  3. **Wrong code** shows `That join code is not valid.`; **regenerate** makes the old code fail.
  4. **Invite:** the owner enters an unknown email and sees `That user doesn't exist.`; enters the second user's email and sees a success note that does **not** repeat the address; the second user's `invite-inbox` shows team name and inviter name; accepting adds the team; the owner then sees the member by name.
  5. **Remove and delete:** the owner removes the member (the member's list loses the team after a reload); the owner deletes the team after a confirmation and it disappears for both.
  6. **Only the owner sees owner controls:** a plain member sees no `join-code`, no invite form, no remove buttons and no delete button.
- [ ] **Step 6: Run** `npm run test:e2e`; expected: the new tests FAIL.
- [ ] **Step 7: Implement** `useTeams`, `TeamsScreen` (team list with `Create team` and `Join with code`, the invites inbox), `TeamDetail` (members, and for the owner the join-code on/off switch, the code with a `Regenerate` button, `InviteForm`, remove buttons, delete with a confirm step). Map error kinds to messages: `locked` and `invalid` show the server text; `unreachable` shows `The server cannot be reached. Try again.`; `forbidden` on create or join shows the verification message of 10A when the account is unverified.
- [ ] **Step 8: Run** `npm test`, then **try it as a user would** (engineering.md section 6): `npm run dev:backend` and `npm run dev`, sign up, verify the account in the PocketBase dashboard, create a team, join it from a second browser profile by code and by invite. Record what you did and saw in `progress.md`.
- [ ] **Step 9: Write `docs/user/accounts-and-teams.md`** for students (sign up, verify, sign in, forgot password, create a team, join by code, invites, what only the owner can do) in plain language, and link it from `docs/README.md`.
- [ ] **Close checkpoint 10B.** Verify: Step 8 passed and `npm run check:docs` is clean. Commit: `feat: team screens`.
