# Task 2: Account and team screen fixes

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** local
**Depends on:** Task 1 (the screens are restyled and the team detail is a route)

Carried over from Plan 2: "Team screen polish", "Resend verification" and "Keyboard and labels" (roadmap, "Carried over from Plan 2"). Three independent checkpoints; each is a separate local-model run.

**Files:**
- Modify (2A): `frontend/src/features/teams/useTeams.ts`, `frontend/src/features/teams/TeamDetail.tsx`, `frontend/src/features/teams/TeamsScreen.tsx`, `frontend/src/features/teams/JoinByCodeForm.tsx`, `frontend/src/features/auth/SignUpForm.tsx`, `frontend/src/features/auth/AuthScreen.tsx`
- Create (2A): `e2e/teams-polish.spec.ts`
- Create (2B): `frontend/src/features/auth/VerifyGate.tsx`, `e2e/verify-gate.spec.ts`; Modify (2B): `frontend/src/features/teams/TeamsScreen.tsx`, `frontend/src/features/teams/JoinByCodeForm.tsx`, `frontend/src/features/teams/InvitesInbox.tsx`, `docs/user/accounts-and-teams.md`
- Create (2C): `tests/lint/screens-a11y.test.ts`; Modify (2C): `frontend/src/features/auth/AuthScreen.tsx`, `frontend/src/features/auth/SignInForm.tsx`, `e2e/helpers/ui.ts` (`getByRole('link', ...)` becomes `getByRole('button', ...)` for the three controls; planned change, not a test fix)

**Interfaces:**
- Consumes: `useRoute`, `navigate` (Task 1); `backend.auth.requestVerification(email: string): Promise<void>`; `backend.teams.*` (Plan 2).
- Produces, `useTeams` state gains `notice: string | null`; every action (`list` excepted) sets it to `null` when it starts; a successful `join` sets it to `Joined <team name>.`
- Produces, `frontend/src/features/auth/VerifyGate.tsx`: `VerifyGate({ email }: { email: string })` showing `Verify your email to create or join a team.` and a button `Resend verification email`; after a click, `Sent. Check your inbox.` (or the error, `role="alert"`).

**If interrupted:** nothing leaves state outside the working tree.

## Sized for the local model
**May touch:** only the files listed under **Files** for the checkpoint you are given (exhaustive: no other file)
**Must not change:** the `backend` door, any existing test file other than `e2e/helpers/ui.ts` in 2C, and the visible texts of Plan 2 screens except those this task names
Stop and report if you need to touch anything else.
**Model server:** run `npm run ping:model` first; if it says NOT answering, do not start the run (see [the runbook](../../../developer/local-model-runbook.md))
**Checkpoint given:** one of 2A, 2B or 2C per run, in that order

## Checkpoint 2A: Team screen polish

- [ ] **Step 1: Write the failing e2e tests** C1 to C4 in `e2e/teams-polish.spec.ts` (helpers from `e2e/helpers/ui.ts`; wait for a positive signal before asserting an absence, catalogue kind `vacuous-absence`).
- [ ] **Step 2: Run** `npm run test:e2e -- e2e/teams-polish.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Delete team calls `useTeams.getState().remove(id)` and navigates to `#/` only after it resolves. `TeamDetail` takes its `Team` from `useTeams` (calling `list()` once if the store is empty) and shows its name as the heading; it no longer calls `backend.teams.list()` itself. `JoinByCodeForm` shows `notice` from the store instead of its own `joined` flag. After a successful sign-up, `SignUpForm` is replaced by the text `Check your email to verify your account, then sign in.` and a `Sign in` control.
- [ ] **Step 4: Run** `npm run test:e2e`. Expected: PASS (all files). **Close checkpoint 2A** (commit `fix: team screen polish`).

## Checkpoint 2B: Resend verification and one gate text

- [ ] **Step 5: Write the failing e2e tests** C5 and C6 in `e2e/verify-gate.spec.ts`.
- [ ] **Step 6: Run** them. Expected: FAIL.
- [ ] **Step 7: Implement `VerifyGate`** and show it in `TeamsScreen` in place of the current gate paragraph. For an unverified user, the Join button and every invite's Accept button are disabled (Decline stays enabled), so the server's own wording never appears.
- [ ] **Step 8: Run** `npm run test:e2e`. Expected: PASS. Add the resend button to `docs/user/accounts-and-teams.md`. **Close checkpoint 2B** (commit `feat: resend verification email`).

## Checkpoint 2C: Keyboard and labels

- [ ] **Step 9: Write the failing test** `tests/lint/screens-a11y.test.ts` (C7, C8): it reads every `.tsx` file under `frontend/src/features/` as text.
- [ ] **Step 10: Run** `npx vitest run --project unit tests/lint/screens-a11y.test.ts`. Expected: FAIL (the `href="#"` links).
- [ ] **Step 11: Implement.** "Sign up", "Sign in" and "Forgot password?" become `<button type="button" className="link-button">`. Update `e2e/helpers/ui.ts` to find them as buttons.
- [ ] **Step 12: Write and run** e2e C9 (add it to `e2e/teams-polish.spec.ts`), then `npm run test:e2e`. Expected: PASS. **Close checkpoint 2C** (commit `fix: account links are buttons`).

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | a deleted team leaves the list at once | e2e | owner deletes a team from its detail screen | team list shown and the team is absent, without a reload | e2e/teams-polish.spec.ts :: a deleted team is gone from the list at once |
| C2 | detail heading names the team | e2e | open team `Crew 7` | heading `Crew 7` | e2e/teams-polish.spec.ts :: the team detail heading is the team name |
| C3 | join notice clears on the next action | e2e | join by code, then create a team | `Joined <name>.` shown, then gone after create | e2e/teams-polish.spec.ts :: the join notice clears on the next action |
| C4 | sign-up shows a confirmation, not a filled form | e2e | sign up | confirmation text; no password field on screen | e2e/teams-polish.spec.ts :: sign-up replaces the form with a confirmation |
| C5 | resend verification | e2e | unverified user clicks `Resend verification email` | one request to `request-verification` with their email; `Sent. Check your inbox.` | e2e/verify-gate.spec.ts :: an unverified user can resend the verification email |
| C6 | join and accept are gated like create | e2e | unverified user with a pending invite | Create, Join and Accept disabled (`toBeDisabled`); gate text shown once | e2e/verify-gate.spec.ts :: join and accept are disabled until verified |
| C7 | no link acts as a button | unit | every feature `.tsx` | no `href="#"` | tests/lint/screens-a11y.test.ts :: no feature screen uses a link as a button |
| C8 | every error paragraph is an alert | unit | every feature `.tsx` | each `data-testid="form-error"` element also has `role="alert"` | tests/lint/screens-a11y.test.ts :: every form error is announced |
| C9 | keyboard reaches the account controls | e2e | Tab to `Forgot password?`, press Enter | neutral message `If that account exists, we sent a link.` | e2e/teams-polish.spec.ts :: forgot password works from the keyboard |
### Probes
**Probe folder:** none
### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | frontend/src/features/auth/SignInForm.tsx | `<p data-testid="form-error" role="alert">` | `<p data-testid="form-error">` | tests/lint/screens-a11y.test.ts |
### Flow
none (each checkpoint's e2e tests are the flow; Task 14 walks the screens by hand)
### Evidence
The full output of `npm run check:task` for the checkpoint's run, and the failing run of B1 (2C only).
