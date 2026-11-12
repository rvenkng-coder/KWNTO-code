# Accounts and Teams Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let people sign up, verify, sign in safely and form teams (join code, invites), with the settings tables, security log and admin incident controls behind them, and screens for all of it.

**Architecture:** Collections and settings are PocketBase migrations; behaviour the rules cannot express (password rules, lockout, block, lockdown, joining, invites) is JavaScript hooks and custom routes in `backend/pb_hooks/`, with every pure decision in `backend/pb_hooks/lib/` so Vitest can test it without PocketBase. The browser reaches all of it only through `src/backend/`. Access is proven by rule tests against a live PocketBase, as in Plan 1.

**Tech Stack:** PocketBase 0.40.6 (JS hooks and migrations), `pocketbase` JS SDK, React, TypeScript, Zustand, Vitest, Playwright. No new dependencies.

**Spec:** [Design](../../specs/2026-11-11-kwnto-design.md) (sections 5, 7c, 9c) and [ERD](../../specs/2026-11-11-kwnto-erd.md). Also binding: [engineering.md](../../../engineering.md), [security.md](../../../security.md) and [decision 0002](../../../decisions/0002-realtime-spike.md). Executors read all five. The [roadmap](../README.md) shows where this plan sits.

## Global Constraints

Everything in the [Plan 1 router](../2026-11-11-foundation/README.md) "Global Constraints" still applies (zero cost, no new dependency, ask first, worktree, 300-line files, no `any`, deny by default, tests documented, prototype is reference only, secrets never in git, docs are part of done, Node 22, ports). Values this plan depends on, copied from the spec:

- **Worktree and branch:** `feat/accounts-teams`, created from `main`. Tracking in `.planning/2026-11-12-accounts-teams/`. Resume with the steps in the Plan 1 router ("Resuming"), using this plan's files.
- **Password rules (design 7c, my proposal):** at least 10 characters, with a letter and a number; very common passwords rejected.
- **Sign-in protection (design 7c):** after 3 failed sign-ins, "try again after 5 minutes". Counted per account and IP together. Both numbers are admin settings (`system_behavior.max_failed_logins` default 3, `lockout_minutes` default 5).
- **Defaults (ERD):** `registration_open` true, `lockdown` false; `default_quota_bytes` 2 GB; `max_video_mb` 200, `max_audio_mb` 50, `max_image_mb` 50; `trash_retention_days` 30; `security_retention_days` 365; `presence_timeout_seconds` 30 and `analytics_retention_days` 365 (my calls; the spec gives no value), `team_attempts_per_hour` 20.
- **Settings are typed fields, not key/value.** Defaults come from migrations that fill missing values and never overwrite edits.
- **Emails are private** to everyone except the admin. A team owner learns only whether an account exists for an email; the invitee must accept; owners never see an invitee's email list, only the name of someone who has accepted. Invite attempts are rate limited and logged.
- **Only the team owner** removes members, regenerates or disables the join code, deletes projects and deletes the team. Members create projects, edit, upload, comment and create share links.
- **Verified email is required** to create or join teams, upload media or use share links that need sign-in.
- **The admin dashboard is not an app account.** Hooks and rules on `users` never touch `_superusers`.
- **Hook code runs in isolated scopes.** A PocketBase hook handler cannot see variables outside its own function; shared code is loaded inside the handler with `require(`${__hooks}/lib/<name>.js`)`. Pure helpers are CommonJS (`module.exports`) so Vitest can load them too.
- **Collection names** are exactly: `system_access`, `system_storage`, `system_behavior`, `security_events`, `user_preferences`, `user_limits`, `user_status`, `teams`, `team_members`, `team_settings`, `team_invites`. Each needs `tests/rules/<name>.rules.test.ts` (the coverage check fails otherwise).
- **Custom routes** live under `/api/kwnto/`. Admin-only routes live under `/api/kwnto/admin/` so Plan 6 can block that one prefix on the public address.

## Review Focus

Failure modes the spec implies that are most likely to bite, each pinned by a test in the task named:

1. **Signing up with `verified: true` in the request body must not create a verified account.** (Task 3)
2. **The password rules must hold on every path that sets a password**: sign-up, password change, and password reset, not only sign-up. (Task 3)
3. **Lockout must not reveal which accounts exist** (same message for a real and an unknown email) **and must not let one person lock another out from a different IP.** (Task 4)
4. **Blocking an account or signing it out must end its existing sessions**, not only refuse the next sign-in. (Task 5)
5. **Team and invite responses must never contain another person's email**, an owner must not see pending invitees, and a user must not be able to add themselves to a team by writing `team_members` directly. (Tasks 6 and 8)

Also covered, lower risk: join-code guessing is rate limited (Task 7); a removed member loses access at once (Task 6).

## Decisions made in this plan (please review)

These are my calls where the spec is silent. Say so if any is wrong; each is cheap to change before the task that builds it.

| # | Decision | Task |
|---|---|---|
| D1 | The join code is **off by default** for a new team; the owner turns it on. 8 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. | 6 |
| D2 | Failed sign-ins are **counted in `security_events`** (no extra table). A lockout applies to one account **from one IP**; a successful sign-in resets that pair. | 4 |
| D3 | Two new `system_behavior` fields: `team_attempts_per_hour` (default 20, covers join-code and invite attempts per user). The ERD is updated in Task 1. | 1 |
| D4 | `security_events.type` values: `signup`, `verification`, `sign-in`, `failure`, `lockout`, `reset`, `invite`, `join`, `admin` (ERD lists fewer). | 1 |
| D5 | Admin incident actions are **superuser-only routes** (`/api/kwnto/admin/...`) instead of dashboard tricks, so they are testable and documented. Blocking is done by editing `user_status` in the dashboard; a hook then ends that user's sessions. | 5 |
| D6 | `team_members.user_name` and the invite's `team_name` and `invited_by_name` are **copies kept by hooks**, because the users rule hides other people's records and names must still show. | 6, 8 |
| D7 | Only the invitee sees an invite. The owner gets a success or failure answer when inviting and later sees the member by name once accepted; no pending list. Owners cannot cancel an invite in the MVP. | 8 |
| D8 | A member **cannot leave** a team in the MVP (design: only the owner removes members). The owner cannot be removed. | 6 |
| D9 | "Revoke all share links" (security.md section 9, step 6) is added to the runbook when `share_links` exists (Roadmap plan 7). The runbook says so. | 5 |
| D10 | Screens are minimal: sign-in, sign-up, team list, create, join, invite, invites inbox, members. No theme toggle yet (Plan 3). | 10 |

## File structure

| Path | Responsibility |
|---|---|
| `backend/pb_migrations/*.js` | One migration per concern (tables, defaults, rules). Never edit one after it has run. |
| `backend/pb_hooks/lib/*.js` | Pure CommonJS helpers: `settings.js`, `security-log.js`, `password-rules.js`, `common-passwords.js`, `lockout.js`, `join-code.js`, `rate-limit.js`. |
| `backend/pb_hooks/*.pb.js` | Thin hooks and routes: `retention`, `users-defaults`, `users-signup`, `users-signin`, `admin-controls`, `teams`, `teams-join`, `teams-invites`. |
| `tests/hooks/*.unit.test.ts` | Vitest tests of `lib/` (added to the `unit` project in Task 1). |
| `tests/rules/<collection>.rules.test.ts` | One per collection, as the coverage check requires. |
| `src/backend/` | `auth.ts`, `teams.ts`, `errors.ts`, `types.ts`; `index.ts` exposes `backend.auth` and `backend.teams`. |
| `src/features/auth/`, `src/features/teams/` | Screens and stores. |
| `docs/admin/settings.md`, `docs/security.md`, `docs/developer/backend.md`, `docs/developer/testing.md` | Docs updated by the task that changes behaviour. |

## Tasks

| # | Task | Tier | Depends on | Checkpoints | Status |
|---|---|---|---|---|---|
| 1 | [System settings tables and the security log](task-1-settings-and-log.md) | strong | none | 1A 1B | in progress |
| 2 | [Per-user records](task-2-user-records.md) | strong | 1 | 2A | not started |
| 3 | [Sign-up, verification and password rules](task-3-signup-passwords.md) | strong | 1, 2 | 3A 3B | not started |
| 4 | [Sign-in protection: lockout, block, lockdown](task-4-signin-protection.md) | strong | 1, 2 | 4A 4B | not started |
| 5 | [Incident controls and the runbook](task-5-incident-controls.md) | strong | 4 | 5A 5B | not started |
| 6 | [Teams, members and team settings](task-6-teams.md) | strong | 3 | 6A 6B | not started |
| 7 | [Join by code](task-7-join-by-code.md) | strong | 6 | 7A | not started |
| 8 | [Invite by email](task-8-invites.md) | strong | 6 | 8A 8B | not started |
| 9 | [The backend door for accounts and teams](task-9-backend-door.md) | mid | 3, 4, 6, 7, 8 | 9A 9B | not started |
| 10 | [Sign-in and team screens, end-to-end](task-10-screens-e2e.md) | mid | 9 | 10A 10B | not started |

**Status values:** `not started`, `in progress`, `awaiting review` (all checkpoints closed, reviewer has not passed it), `done` (reviewer passed it). Tasks 3 and 4 can run side by side once 1 and 2 are done; so can 7 and 8 once 6 is done.

Names and signatures shared between tasks are in each task file's **Interfaces** block. If a task needs something its Interfaces block does not list, stop and report it; do not guess.

**Closing a checkpoint** follows the Plan 1 router, "Rules while working" (one commit holding the code and docs, the ticked boxes, this table's Status cell and one new `progress.md` line). Replace its `<date>-foundation` with `2026-11-12-accounts-teams`.

## Done when

- `npm test` passes on a clean clone with Docker running.
- Every row above says `done`, no step box is unticked, `git status` is clean.
- `docs/security.md` section 9 has a tested step for each incident control that can exist today (D9).
- `docs/admin/settings.md` names every setting these tables add, with its default and what it does.
- A whole-branch review of `feat/accounts-teams` is complete and the developer has reviewed the branch. Agents do not merge or push.
