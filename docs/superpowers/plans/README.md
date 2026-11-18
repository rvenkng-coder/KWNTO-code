# KWNTO roadmap

One detailed plan per subsystem, written when the plan before it lands (the real-time spike showed why: its result changed the data model). This page is the one place that shows what is done, what is next and what is only an outline. The build order comes from [design section 11](../specs/2026-11-11-kwnto-design.md); the deadline is the last week of November 2026.

**Status values:** `done`, `in progress`, `planned` (detailed plan written, not started), `outline` (no detailed plan yet).

| # | Plan | Design build step | Depends on | Status |
|---|---|---|---|---|
| 1 | [Foundation and real-time spike](2026-11-11-foundation/README.md) | 1 | none | done |
| 2 | [Accounts and teams](2026-11-12-accounts-teams/README.md) | 1 | 1 | done |
| 3 | [Editor core](2026-11-14-editor-core/README.md) | 1 | 2 | done |
| 4 | Offline queue, sync and conflicts | 1 | 3 | outline |
| 5 | Media upload, quota and strict file checks | 1 | 3 | outline |
| 6 | Deployment | 1 | 2 (3 to 5 to test on) | outline |
| 7 | Trash, share links, comments, presence, JSON import and export | 2 | 3, 4 | outline |
| 8 | Export (PDF, Word, JPG, PNG) | 3 | 3 | outline |
| 9 | Player Mode | 4 | 3 | outline |
| 10 | Path analytics | 5 | 9 | outline |

**Editor polish plan:** [Editor tabs and Add node](2026-11-18-editor-tabs/README.md), status `done` (the developer accepted the branch on 2026-11-18).

**Editor cards plan:** [Editor cards, choices and tools](2026-11-18-editor-cards/README.md), status `done` (the developer closed it on 2026-11-18 and recorded the UI problems below for a later plan).

**Tooling plan (not a product plan):** [Local-AI quality tooling](2026-11-13-local-ai-quality/README.md) (test strategy, project test plan, `check:task`), status `done`; built before Plan 3 so Plan 3's tasks can carry the Test plan block.

If time runs out, cut from the bottom (design section 11). Plans 8 to 10 are the first to go.

## Carried over from Plan 2

Found by the whole-branch review and the scripted walk of Task 10 (2026-11-13), and left out of Plan 2 on purpose. Each item names the plan whose task list it joins; when that plan is written, these go in as tasks, not as a separate plan. The source is `.planning/2026-11-12-accounts-teams/progress.md`.

**Plan 6 (deployment)**

| Item | What and why |
|---|---|
| Rate limiter and trusted proxy | Enable PocketBase's built-in rate limiter (at least the `*:auth` rule) and set `trustedProxy`, so parallel wrong-password guesses cannot beat the lockout and the lockout counts per IP behind Caddy (developer decision 2026-11-13: handle it with the reverse proxy). Already listed in the outline; keep it. |
| Real mail | Nobody has tested a real verification or password-reset email. Set up SMTP (Gmail app password), then walk sign-up, verification and reset by hand with an address typed with capitals (a reset typed with capitals once sent no mail). |
| Unknown-email timing | PocketBase answers an unknown email faster than a known one (it skips the password hash). Accepted while internal; add one line to `docs/security.md` section 3 and re-judge before going public. |

## Carried over from Plan 3

Found while building the editor core (2026-11-14 to 2026-11-16) and left out of it on purpose. The source is `.planning/2026-11-14-editor-core/progress.md`, `findings.md` and the task reports. Each item names the plan whose task list it joins.

| Item | What and why | Plan |
|---|---|---|
| Live creates of teams and projects | A create hook that moves the record's own insert into a transaction (`e.app = txApp; e.next()`) makes PocketBase 0.40.6 send no realtime create event (found by Task 14 for nodes, fixed there). `teams.pb.js` and the project create hook in `projects.pb.js` still use it. Nothing subscribes to those creates today; a live team or project list (presence, Plan 7) would miss new ones. Restructure as the `nodes` hook does, with a rule test of the create event. | 7 |
| Watch for a card re-mount loop | Once (Tasks 11 to 13 `npm test`), after switching back to Chapter 1 a node card kept re-mounting for 60 s ("element was detached from the DOM"). Not reproduced in 106 runs. If it shows again, capture a trace before rerunning. | 4 |
| Hygiene checker false positives | `check:hygiene` reads `test.setTimeout(...)` and `test.info()` as new tests without a header, and `.fail` on any object (`fake.fail.next`) as Vitest's `.fail`. Match only test-defining calls. | tooling (next plan that touches it) |

## Later (developer decision, 2026-11-18)

Asked for while the editor tabs plan was designed and left out of it on purpose.

| Item | What and why |
|---|---|
| Custom node colours (hex or RGB) | Change `nodes.color` from an 8-value select to a validated hex text field, and pick black or white header text by contrast so it stays readable. |
| Duplicate chapter | Copy nodes, lines, cues and connections, and decide what happens to cross-chapter links. |

## UI problems found after the editor cards plan (developer, 2026-11-18)

The developer used the editor after the cards plan and found it better but not yet right. These go into a UI plan, designed with the developer before it is written (no detailed plan yet). The source is `.planning/2026-11-18-editor-cards/progress.md`.

| Item | What and why |
|---|---|
| The editor's left panel is empty | After chapters moved to tabs and Add node to the tool strip, the left panel holds only "Back to teams" and the project name. A whole column is spent on two controls. Decide what it is for, or remove it. |
| The teams screens feel clunky | The Teams page stacks Create team, the invites inbox, the join-code form and the team list in one column. A team's page stacks Members, Projects and the owner's join code, invite form and Delete team. Projects are plain links, and members read `Name (role)`. |
| Browser pop-ups | Create team asks for its name with `prompt()`. Moving a project to the trash and deleting a team confirm with `confirm()`. Both look out of place and can't be styled. |
| "Back to teams" goes too far | From the editor it opens the list of all teams, not the team the project belongs to. |
| The UI as a whole | The developer wants the whole UI fixed, not one screen. Before designing, ask what they open KWNTO to reach first: the answer decides whether the teams area becomes a home page with projects up front or stays a settings area. |
| Undo of a deleted choice, after a reload | It comes back in its place, but after a reload it is last, because PocketBase sets `created` itself (pinned by the rules test `a client cannot set the created time of a choice`). Not yet ruled on: accept, or keep an explicit order field. |
| Editor walks still owed | Plan 3 Task 14B asked for 10 minutes of real writing by two people on one project, and for the developer to sign off M1 and M2 (light and dark look, `docs/test-plan.md`). Neither has happened; do both once the UI plan has changed the look. |
| The link-mode banner covers a card | `Select a target node` sits at the top centre of the canvas, over whatever card is there (seen over Hall's header in the scripted walk). Move it off the canvas content, for example into the tab bar or a corner. |
| The error banner pushes the editor down | The duplicate-choice message (F3) is a full-width bar above the editor, so the whole canvas jumps down while it shows. Show it as a toast over the canvas instead. |
| Space spent on chrome | A `Backend: connected` line sits above the editor, and Undo, Redo and Show minimap are a separate row of large buttons above the canvas. Both take height from the canvas; Undo and Redo could join the tool strip. |
| Cue rows in the panel are bulky | Each cue has a type box, a text box and large Move up, Move down and Delete cue buttons, so four cues fill the panel. The type box reads `audio`, `lighting`, `other` while the card reads `Audio`, `Light`, `Other`. |
| Card connectors are small | The choice dots and the "+" connector are 6 px and the "+" row is faint, so they are hard to find and grab. A linked choice with no text reads `Untitled` on the card and its line has no label; showing the target's title would read better. |

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

### 3. Editor core (done; [detailed plan](2026-11-14-editor-core/README.md))
**Carried in from Plan 2:** the app shell and styling, team screen polish, resend verification, auth store listeners, keyboard and labels, and the e2e flake; all built as Tasks 1 to 4.
**Goal:** projects, chapters, canvas, nodes, connections (including cross-chapter links), properties panel (script lines, cues), search, undo/redo, copy/paste, multi-select, minimap, light and dark themes, saving per attribute.
**Fixed already:** every concurrently edited collection (nodes, script lines, cues, connections, project settings) gets a `version` field and the guarded write from [decision 0002](../../decisions/0002-realtime-spike.md); the client treats HTTP 409 as normal flow (re-read, re-apply own field, retry, bounded). Canvas performance code needs `PERF:` comments. Only `frontend/src/backend/` imports `pocketbase`.
**Decide first:** how the guarded write hook is shared between collections; the decimal `sort_order` scheme for lines; undo history depth; `project_settings` (created with each project, rows made by a hook as in Plan 2).
**Risks:** performance at 500 nodes and 5,000 lines (measured fine on the backend side, not yet on the canvas); the 409 retry path.

### 4. Offline queue, sync and conflicts
**Carried in from Plan 3:** the card re-mount watch (see [Carried over from Plan 3](#carried-over-from-plan-3)).
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
**Carried in from Plan 3:** live creates of teams and projects (see [Carried over from Plan 3](#carried-over-from-plan-3)).
**Goal:** the second build step in design section 11: trash and restore (30 days, scheduled purge), share links (view, comment, edit; live, snapshot; revocable), comments, presence with heartbeat, project JSON import and export.
**Fixed already:** "revoke all share links" is an incident control (security.md section 9) added to the Plan 2 runbook when `share_links` exists; view links work without an account and include media; comment and edit links need sign-in and the verified flag; JSON import is untrusted input, validated by schema with size limits (a `zod` dependency needs a decision record first).
**Decide first:** split into two plans if it is too large (share links and comments, then trash and import/export); how a link token is checked inside access rules.
**Risks:** the most security-sensitive plan after Plan 2: every rule needs tests for member, outsider, signed-out, revoked link, snapshot.

### 8. Export
PDF (`jsPDF`), Word (`docx`), JPG and PNG (`html-to-image`) of the branch map; current chapter by default, whole project optional. These libraries need decision records before use.

### 9. Player Mode
Node-by-node playback with transitions, media, screenplay-style lines, restart, back, history; works for viewers through share links. An empty choice (written but never linked) shows as a dead end (editor cards plan).

### 10. Path analytics
Anonymous per-choice counts with a random session id; not recorded for signed-in team members; retention from `system_behavior`.
