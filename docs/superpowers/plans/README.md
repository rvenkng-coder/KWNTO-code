# KWNTO roadmap

One detailed plan per subsystem, written when the plan before it lands (the real-time spike showed why: its result changed the data model). This page is the one place that shows what is done, what is next and what is only an outline. The build order comes from [design section 11](../specs/2026-11-11-kwnto-design.md); the deadline is the last week of November 2026.

**Status values:** `done`, `in progress`, `planned` (detailed plan written, not started), `outline` (no detailed plan yet).

| # | Plan | Design build step | Depends on | Status |
|---|---|---|---|---|
| 1 | [Foundation and real-time spike](2026-11-11-foundation/README.md) | 1 | none | done |
| 2 | [Accounts and teams](2026-11-12-accounts-teams/README.md) | 1 | 1 | planned |
| 3 | Editor core | 1 | 2 | outline |
| 4 | Offline queue, sync and conflicts | 1 | 3 | outline |
| 5 | Media upload, quota and strict file checks | 1 | 3 | outline |
| 6 | Deployment | 1 | 2 (3 to 5 to test on) | outline |
| 7 | Trash, share links, comments, presence, JSON import and export | 2 | 3, 4 | outline |
| 8 | Export (PDF, Word, JPG, PNG) | 3 | 3 | outline |
| 9 | Player Mode | 4 | 3 | outline |
| 10 | Path analytics | 5 | 9 | outline |

If time runs out, cut from the bottom (design section 11). Plans 8 to 10 are the first to go.

## Outlines

Each outline lists the goal, what must be decided before the detailed plan, and the constraints already fixed elsewhere. They are not tasks.

### 2. Accounts and teams (planned)
Sign-up with verification and password rules, sign-in protection (lockout, block, lockdown), the security log, incident controls, teams with join code and invites, and the sign-in and team screens. Settings tables for system, user and team scope. [Detailed plan](2026-11-12-accounts-teams/README.md).

### 3. Editor core
**Goal:** projects, chapters, canvas, nodes, connections (including cross-chapter links), properties panel (script lines, cues), search, undo/redo, copy/paste, multi-select, minimap, light and dark themes, saving per attribute.
**Fixed already:** every concurrently edited collection (nodes, script lines, cues, connections, project settings) gets a `version` field and the guarded write from [decision 0002](../../decisions/0002-realtime-spike.md); the client treats HTTP 409 as normal flow (re-read, re-apply own field, retry, bounded). Canvas performance code needs `PERF:` comments. Only `src/backend/` imports `pocketbase`.
**Decide first:** how the guarded write hook is shared between collections; the decimal `sort_order` scheme for lines; undo history depth; `project_settings` (created with each project, rows made by a hook as in Plan 2).
**Risks:** performance at 500 nodes and 5,000 lines (measured fine on the backend side, not yet on the canvas); the 409 retry path.

### 4. Offline queue, sync and conflicts
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
**Goal:** Docker Compose with PocketBase, Caddy and Tailscale Funnel; backups with a restore test; first-run guide; incident runbook finished.
**Fixed already:** the admin dashboard and admin API paths are blocked on the public address, including `/api/kwnto/admin/` from Plan 2; non-root, no privileged mode, secrets in `.env`; data in volumes; real-time checked through Funnel; total disk-usage warning.
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
