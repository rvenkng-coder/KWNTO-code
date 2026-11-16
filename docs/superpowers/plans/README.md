# KWNTO roadmap

One detailed plan per subsystem, written when the plan before it lands (the real-time spike showed why: its result changed the data model). This page is the one place that shows what is done, what is next and what is only an outline. The build order comes from [design section 11](../specs/2026-11-11-kwnto-design.md); the deadline is the last week of November 2026.

**Status values:** `done`, `in progress`, `planned` (detailed plan written, not started), `outline` (no detailed plan yet).

| # | Plan | Design build step | Depends on | Status |
|---|---|---|---|---|
| 1 | [Foundation and real-time spike](2026-11-11-foundation/README.md) | 1 | none | done |
| 2 | [Accounts and teams](2026-11-12-accounts-teams/README.md) | 1 | 1 | done |
| 3 | [Editor core](2026-11-14-editor-core/README.md) | 1 | 2 | in progress |
| 4 | [Offline queue, sync and conflicts](2026-11-16-offline-sync/README.md) | 1 | 3 | planned |
| 5 | Media upload, quota and strict file checks | 1 | 3 | outline |
| 6 | Deployment | 1 | 2 (3 to 5 to test on) | outline |
| 7 | Trash, share links, comments, presence, JSON import and export | 2 | 3, 4 | outline |
| 8 | Export (PDF, Word, JPG, PNG) | 3 | 3 | outline |
| 9 | Player Mode | 4 | 3 | outline |
| 10 | Path analytics | 5 | 9 | outline |

**Tooling plan (not a product plan):** [Local-AI quality tooling](2026-11-13-local-ai-quality/README.md) (test strategy, project test plan, `check:task`), status `done`; built before Plan 3 so Plan 3's tasks can carry the Test plan block.

If time runs out, cut from the bottom (design section 11). Plans 8 to 10 are the first to go.

## Carried over from Plan 2

Found by the whole-branch review and the scripted walk of Task 10 (2026-11-13), and left out of Plan 2 on purpose. Each item names the plan whose task list it joins; when that plan is written, these go in as tasks, not as a separate plan. The source is `.planning/2026-11-12-accounts-teams/progress.md`.

**Plan 3 (editor core), first tasks, because every later screen builds on them**

| Item | What and why | Tier |
|---|---|---|
| App shell and styling | The app is unstyled HTML today (Tailwind is imported, no class is used). Decide the layout, spacing and theme tokens (light and dark, design 6) once, then restyle the sign-in, sign-up and teams screens with them. Includes phone width: the email field is cut off at 390 px. Needs a decision on how components share styles before any screen is restyled. | strong decides, local builds |
| Team screen polish | After Delete team the deleted team stays in the owner's list for a moment (delete through `useTeams.remove` so the list updates before leaving the detail screen); the team detail heading says "Team" instead of the team's name, and fetches the team list again for the owner flag (pass the `Team` from the list into `TeamDetail`); "Joined successfully!" stays on screen; the sign-up form stays filled after "Check your email" (show a plain confirmation instead). | local |
| Resend verification | A signed-in unverified user has no way to ask for another email (`backend.auth.requestVerification` exists, nothing calls it). Add the button to the gate text, and make Join and Accept show the same gate text as Create team instead of the server's wording. | local |
| Auth store listeners | `backend.auth.onChange` holds one listener (a second silently replaces the first) and does not notice a sign-in in another tab. Make it a set of listeners and update on every store change. Unit tests with a fake `pb`. | local |
| Keyboard and labels | Plan 2 fixed teams opening from the keyboard and the join and invite labels. Check the rest of the account screens: the "Sign up", "Sign in" and "Forgot password?" links are `<a href="#">` acting as buttons; error text uses `role="alert"` everywhere. | local |
| e2e flake | `wrong code and regenerate` failed once on Firefox (no error within 5 s) in about 7 full runs. Repeat it under load, find the cause (slow join response? ordering of the regenerate?) and fix the test or the code. Never raise the timeout to hide it. | strong |

**Plan 6 (deployment)**

| Item | What and why |
|---|---|
| Rate limiter and trusted proxy | Enable PocketBase's built-in rate limiter (at least the `*:auth` rule) and set `trustedProxy`, so parallel wrong-password guesses cannot beat the lockout and the lockout counts per IP behind Caddy (developer decision 2026-11-13: handle it with the reverse proxy). Already listed in the outline; keep it. |
| Real mail | Nobody has tested a real verification or password-reset email. Set up SMTP (Gmail app password), then walk sign-up, verification and reset by hand with an address typed with capitals (a reset typed with capitals once sent no mail). |
| Unknown-email timing | PocketBase answers an unknown email faster than a known one (it skips the password hash). Accepted while internal; add one line to `docs/security.md` section 3 and re-judge before going public. |

**Before Plan 3 starts (not a plan task):** the local-AI quality tooling (design `docs/superpowers/specs/2026-11-13-local-ai-quality-design.md`, in this branch, merged with it) (test strategy, project test plan, `check:task`), which the developer scheduled for after Plan 2.

## Carried over from the local-AI quality plan

Found by the whole-branch review of the tooling plan (2026-11-13) and left out of it on purpose. They join whichever plan next touches the tooling; none blocks Plan 3.

| Item | What and why | Tier |
|---|---|---|
| Typecheck of scripts, tests and e2e | `tsc -b` covers `frontend/src/` only, so these three folders are never typechecked. Add a tsconfig and fix the roughly 73 errors (mostly `noUncheckedIndexedAccess`). | mid |
| Progress `Review` column | `parseProgress` in escape-rate does not validate the `Review` column (`none`, `clean` or `found N`). Validate it, so a typo cannot lower the escape rate. | mid |
| Probe folder `none` and the bare root | `none` is allowed for any task and the bare root `tests/probes/` is accepted, but spec 6.3 says probes run on every task. Mirror the Breaks rule (no `none` for a local task or one with unit cases) and refuse the bare root. | mid |
| Duplication in scripts | `mergeBaseWithMain` exists three times (`check-task.ts`, `check-changed-quality.ts`, `check-test-hygiene.ts`) and the `--cwd` `parseArgs` is identical in `run-breaks.ts` and `run-probes.ts`; move both to `scripts/lib/`. `lib/test-raw.ts` and `lib/vitest-bin.ts` have no tests beside them. | local |
| Code fences in check-plan | Fence handling ignores the fence type and length: `~~~` containing a triple backtick fails open, and an unclosed fence swallows the file with a misleading message. Track the opening fence and match its close. | local |
| Coverage rules | Coverage accepts `test.todo` and `test.skip` titles and does not check the case's layer against the file's location. Refuse both, so a row cannot be covered by a test that never runs or sits in the wrong layer. | mid |
| Lockout window boundary | The lockout tests have no window-start boundary test (found by the Task 5 break proof: `time > windowStartMs` versus `>=` in `backend/pb_hooks/lib/lockout.js`). Add one at exactly the window start. | local |
| check:task robustness | The git calls in `hygiene` and `quality` have no timeout, a second Ctrl-C is ignored while waiting, and after a deadline kill of `test:rules` or `e2e` the compose container stays up until the next run's `down -v`. Add timeouts, honour the second signal and stop the container on a kill. | mid |

## Outlines

Each outline lists the goal, what must be decided before the detailed plan, and the constraints already fixed elsewhere. They are not tasks.

### 2. Accounts and teams (planned)
Sign-up with verification and password rules, sign-in protection (lockout, block, lockdown), the security log, incident controls, teams with join code and invites, and the sign-in and team screens. Settings tables for system, user and team scope. [Detailed plan](2026-11-12-accounts-teams/README.md).

### 3. Editor core (in progress; [detailed plan](2026-11-14-editor-core/README.md))
**Carried in from Plan 2:** the app shell and styling, team screen polish, resend verification, auth store listeners, keyboard and labels, and the e2e flake (see [Carried over from Plan 2](#carried-over-from-plan-2)); do these first.
**Goal:** projects, chapters, canvas, nodes, connections (including cross-chapter links), properties panel (script lines, cues), search, undo/redo, copy/paste, multi-select, minimap, light and dark themes, saving per attribute.
**Fixed already:** every concurrently edited collection (nodes, script lines, cues, connections, project settings) gets a `version` field and the guarded write from [decision 0002](../../decisions/0002-realtime-spike.md); the client treats HTTP 409 as normal flow (re-read, re-apply own field, retry, bounded). Canvas performance code needs `PERF:` comments. Only `frontend/src/backend/` imports `pocketbase`.
**Decide first:** how the guarded write hook is shared between collections; the decimal `sort_order` scheme for lines; undo history depth; `project_settings` (created with each project, rows made by a hook as in Plan 2).
**Risks:** performance at 500 nodes and 5,000 lines (measured fine on the backend side, not yet on the canvas); the 409 retry path.

### 4. Offline queue, sync and conflicts (planned; [detailed plan](2026-11-16-offline-sync/README.md))
**Goal:** edits go to IndexedDB first, sync later; keep-mine/keep-theirs on conflict; an "offline, N changes waiting" indicator.
**Fixed already:** events missed while disconnected are not replayed, so refetch after every reconnect (finding E); `updated` alone is not a version, use the counter (finding G); queued writes carry the version they were based on. Confirm reconnect behaviour once through Funnel.
**Decide first:** queue storage layout and replay order; what counts as "same attribute" for the dialog.
**Risks:** highest-risk part of the editor (design 6.7); needs its own unit and Playwright tests (offline, reconnect, forced conflict). Strong model.

### 5. Media upload, quota and strict file checks
**Goal:** upload WAV, MP3, MOV, MP4, JPEG, PNG with magic-byte checks, generated file names, `nosniff` headers, the per-user quota (`user_limits` override, else `system_storage` default) and per-file limits from `system_storage`.
**Fixed already:** `system_storage` and `user_limits` tables exist from Plan 2; trashed media counts toward quota until purged; snapshots reference media and never count.
**Decide first:** where the byte check runs (hook on upload request) and how a refused upload reports which limit it hit.
**Risks:** large uploads through Funnel; quota race when two uploads arrive together.

### 6. Deployment
**Carried in from Plan 2:** the rate limiter and trusted proxy, a real-mail walk, and the unknown-email timing note (see [Carried over from Plan 2](#carried-over-from-plan-2)).
**Goal:** Docker Compose with PocketBase, Caddy and Tailscale Funnel; backups with a restore test; first-run guide; incident runbook finished.
**Fixed already:** the admin dashboard and admin API paths are blocked on the public address, including `/api/kwnto/admin/` from Plan 2; non-root, no privileged mode, secrets in `.env`; PocketBase's built-in rate limiter is enabled (at least the `*:auth` rule, which covers auth-with-password), because the sign-in lockout cannot stop guesses sent in parallel (see [security.md](../../security.md) section 3); data in volumes; real-time checked through Funnel; total disk-usage warning.
**Decide first:** backup destination and default schedule; the SMTP setup guide (Gmail app password).
**Risks:** Funnel bandwidth for video (fallback: Cloudflare Tunnel).

### 7. Trash, share links, comments, presence, JSON import and export
**Goal:** the second build step in design section 11: trash and restore (30 days, scheduled purge), share links (view, comment, edit; live, snapshot; revocable), comments, presence with heartbeat, project JSON import and export.
**Fixed already:** "revoke all share links" is an incident control (security.md section 9) added to the Plan 2 runbook when `share_links` exists; view links work without an account and include media; comment and edit links need sign-in and the verified flag; JSON import is untrusted input, validated by schema with size limits (a `zod` dependency needs a decision record first).
**Decide first:** split into two plans if it is too large (share links and comments, then trash and import/export); how a link token is checked inside access rules.
**Risks:** the most security-sensitive plan after Plan 2: every rule needs tests for member, outsider, signed-out, revoked link, snapshot.

### 8. Export
PDF (`jsPDF`), Word (`docx`), JPG and PNG (`html-to-image`) of the branch map; current chapter by default, whole project optional. These libraries need decision records before use.

### 9. Player Mode
Node-by-node playback with transitions, media, screenplay-style lines, restart, back, history; works for viewers through share links.

### 10. Path analytics
Anonymous per-choice counts with a random session id; not recorded for signed-in team members; retention from `system_behavior`.
