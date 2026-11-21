# System settings

Everything an admin can tune lives in settings tables, edited in the PocketBase dashboard (`/_/`, sign in as the admin). They are typed fields, not key/value pairs, so a typo cannot silently do nothing. The design is in [design section 7c](../superpowers/specs/2026-11-11-kwnto-design.md#7c-admin-console-and-settings-dev-decision) and the [ERD](../superpowers/specs/2026-11-11-kwnto-erd.md).

## How the settings work

- **Admin only.** The three `system_*` tables have every access rule locked (`null`), so only the admin can read or change them. App users cannot see them at all.
- **One record each.** Each table holds exactly one record. Edit that record; do not add a second one or delete it. A missing record is a broken install: the server code that reads it fails instead of guessing a value.
- **Changes apply at once.** The server reads these values at run time, so a change needs no restart or redeploy.
- **Defaults never overwrite edits.** The defaults are written by the migration [1794360000_system_settings.js](../../backend/pb_migrations/1794360000_system_settings.js), which PocketBase runs only once per data folder. Restarting or updating the container keeps your values. A container test pins this.
- Numbers are whole numbers, 0 or more.

"Used by" names the task of the [accounts and teams plan](../superpowers/plans/2026-11-12-accounts-teams/README.md) that makes the server read the setting. `later` means a later plan uses it; until then, changing it has no effect.

## `system_access`

| Field | Default | What it does | Used by |
|---|---|---|---|
| `registration_open` | `true` | When off, new people cannot sign up (they see "Sign-up is closed."); existing accounts still sign in, and you can still add an account in the dashboard. | Task 3 |
| `lockdown` | `false` | When on, every app sign-in is refused (status 403) with `lockdown_message`. The admin dashboard keeps working: you still sign in there to turn it off. | Task 4 |
| `lockdown_message` | empty | The message shown to people refused during a lockdown. When empty they see "Sign-in is temporarily unavailable." PocketBase adds a full stop if the message has no closing punctuation. | Task 4 |

## `system_storage`

| Field | Default | What it does | Used by |
|---|---|---|---|
| `default_quota_bytes` | `2147483648` (2 GB) | Upload space per user, unless that user has an override in `user_limits`. | Plan 5 (media upload) |
| `max_video_mb` | `200` | Largest video file, in MB. | Plan 5 (media upload) |
| `max_audio_mb` | `50` | Largest audio file, in MB. | Plan 5 (media upload) |
| `max_image_mb` | `50` | Largest image file, in MB. | Plan 5 (media upload) |
| `allowed_types` | `["wav","mp3","jpeg","png"]` | File types that can be uploaded. Video is off by decision (plan node-links): large uploads did not finish through Funnel, and writers link a video instead. Add `mov` and `mp4` to switch it back on. | Plan 5 (media upload), node-links |
| `total_warning_bytes` | `21474836480` (20 GB) | The disk-usage warning: when all uploaded files together pass this many bytes, you are warned. The job `kwnto_storage_check` runs every hour; it writes a `storage` entry to the security log and, if outgoing mail is set up, mails every admin account. At most one warning a day. `0` turns the warning off. It counts uploaded files only; watch the VM's own free space with `df -h` and the Proxmox dashboard. | Plan 6 (deployment) |

## `system_behavior`

| Field | Default | What it does | Used by |
|---|---|---|---|
| `presence_timeout_seconds` | `30` | How long after the last heartbeat someone stops showing as editing a node. Read at run time: browsers use it to decide who is still editing, and the `purge_presence` job (every minute) removes rows not refreshed for twice this time. | Plan 7 |
| `analytics_retention_days` | `365` | How long play-through analytics are kept. | later |
| `trash_retention_days` | `30` | How long deleted projects, chapters and nodes stay recoverable before they are removed for good. The job `purge_trash` (every day at 03:30 UTC) deletes what was trashed longer ago than this, with its lines, cues, choices and media files. | Plan 7 |
| `security_retention_days` | `365` | How long security log entries are kept. | Task 1 |
| `max_failed_logins` | `3` | Failed sign-ins of one account from one IP within `lockout_minutes` before that account is locked out from that IP. A successful sign-in resets the count. `0` turns the lockout off. | Task 4 |
| `lockout_minutes` | `5` | The window in which failures are counted, and so how long a lockout lasts: it ends when the oldest counted failure is this many minutes old. The person is told "Try again after N minutes." `0` turns the lockout off. | Task 4 |
| `team_attempts_per_hour` | `20` | Join-code and invite attempts one user may make per hour, counted together (by a verified user; a join code is guessable in principle, so this keeps guessing slow). Every attempt counts, right code or wrong, and every invite, whether an account has the email or not (inviting is how an owner could test which emails are registered, so this also caps that, at 20 emails an hour by default); the next one within the hour is refused with 429 "Too many attempts. Try again later." Refused attempts do not count, so the limit ends an hour after the attempts that caused it. Read at each attempt, so a change applies at once. `0` refuses every attempt (a way to pause joining and inviting), it does not turn the limit off. | Tasks 7, 8 |

## The security log (`security_events`)

The server records security-relevant events here: sign-ups and email verification, sign-ins, failed sign-ins and lockouts, password resets, invite and join attempts, and admin actions. Each entry has a `type`, the account involved (`user`, empty when there is none), the caller's `ip`, a `detail` object and the time it was `created`. Which events are written arrives with the tasks that build sign-up, sign-in, teams and invites. So far: `signup` (a visitor created an account; accounts you add in the dashboard are not logged as sign-ups), `verification` (the first time an account confirms its email), `reset` (a password was changed through the reset link), `sign-in` (a successful app sign-in), `failure` (a wrong email or password), `lockout` (a sign-in refused because of a lockout) and `join` (an attempt to join a team by code: `detail.ok` says whether it worked, a successful one has the `detail.team` joined, and one refused by `team_attempts_per_hour` has `detail.limited`; the code typed is never logged), and `invite` (an attempt by a team owner, or anyone else, to invite someone by email: `detail.ok` says whether an invite was made, `detail.team` is the team (empty when the id matched no team), `detail.emailDomain` is the part of the email after the `@`, and one refused by `team_attempts_per_hour` has `detail.limited`; the full email is never logged, so this log cannot become a list of registered addresses). To spot someone testing which emails exist, filter by `type = "invite" && detail.ok = false` and look for one `user` with many entries. `storage` (the hourly disk-usage check found the uploaded files over `total_warning_bytes`: `detail.usedBytes` and `detail.limitBytes`; at most one a day; the mail, when mail is set up, goes to every admin and is described in the [deployment guide](deployment.md#when-the-disk-fills)). Accepting or declining an invite is not logged. `sign-in`, `failure` and `lockout` have `detail.identity`, the email as typed, lower-cased; `failure` and `lockout` have it even when no account has that email, and then `user` is empty. To see one email's attempts, filter by `detail.identity = "someone@example.com"`. A lockdown or a block refusal is not logged. Your own actions are logged as `admin` entries, with `detail.action` saying which: `sign-out-user` (with that `user`) and `sign-out-all` (the sign-out routes of the [incident runbook](../security.md#9-if-you-suspect-a-compromise-the-incident-runbook)), `block` (with the `user` and `detail.reason`), and `settings` for every change to `system_access`, `system_storage`, `system_behavior`, `user_limits` or `user_status`, with `detail.collection`, `detail.record` and `detail.changes` (each changed field's `old` and `new` value). To see all your changes, filter by `type = "admin"`. Edits to `users` records (for example a password you set by hand) are not in this log; the dashboard's Logs show the request.

- **Who reads it:** only the admin, in the dashboard (Collections, `security_events`). Every access rule is locked, so no app user can read it, and no client can write to it: entries come only from the server.
- **Deleting an account keeps its entries.** The `user` field is emptied; the entry stays.
- **Retention:** a job named `purge_security_events` runs every day at 03:00 UTC and removes entries older than `security_retention_days` (default 365). Change that setting to keep entries for longer or shorter; the next run uses the new value. Setting it to `0` erases the whole log at the next 03:00 run. To purge at once, run the job from the dashboard (Settings, Crons).
- A failure to write an entry never blocks the sign-in or join it describes; it is reported in the server output (`docker logs`) as `security log: could not record ...`.

## Per-user records

Every account has one row in each of three tables, linked by the `user` field. The server creates them when the account is created, and the [1794360200_user_records.js](../../backend/pb_migrations/1794360200_user_records.js) migration created them for accounts that already existed. Deleting an account deletes its three rows. Do not add a second row for a user or delete a row; edit the existing one (Collections, then the table, then filter by `user`).

### `user_preferences` (the user's own)

| Field | Default | What it does |
|---|---|---|
| `theme` | `dark` | `light` or `dark`. |
| `minimap_visible` | `true` | Whether the minimap shows on the map. |

The user can read and change their own row from the app (not the `user` field), and nobody else's. Usually the admin has no reason to edit it.

### `user_limits` (admin only)

| Field | Default | What it does |
|---|---|---|
| `quota_override_bytes` | empty (`0`) | Upload space for this user, in bytes, instead of `system_storage.default_quota_bytes`. Empty or `0` means "use the system default". Used by Plan 5 (media upload). |

### `user_status` (admin only)

| Field | Default | What it does |
|---|---|---|
| `blocked` | `false` | When on, this account cannot sign in. |
| `blocked_reason` | empty | The message the blocked user sees, after "Your account is blocked: ". Write it for them, not for yourself. Only someone who types the right password sees it. |
| `blocked_at` | empty | When you blocked the account, for your own records. |

**To block a user:** open their `user_status` row, turn on `blocked`, write `blocked_reason`, set `blocked_at` to now, and save. To unblock, turn `blocked` off. Saving the block ends the account's existing sessions at once, and from then on every sign-in is refused (status 403, "Your account is blocked: <reason>"), and so is any renewal of a session. Unblocking lets the person sign in again. The full procedure, and what to do if saving reports that sessions could not be ended, is control 3 of the [incident runbook](../security.md#9-if-you-suspect-a-compromise-the-incident-runbook).

App users cannot see `user_limits` or `user_status` at all, so a user cannot raise their own quota or unblock themselves.

## Team settings (`team_settings`)

Every team has one row, made by the server together with the team (and removed with it). The team's owner edits it from the app; you can edit it in the dashboard (Collections, `team_settings`, filter by `team`).

| Field | Default | What it does |
|---|---|---|
| `join_code` | 8 random characters | The code people type to join the team (from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, so no 0/O or 1/I mix-ups; case and surrounding spaces do not matter when typed). Unique across teams. Only the owner and you can read it. The owner cannot type a code of their own; the owner's "new code" action (the route `POST /api/kwnto/teams/{id}/regenerate-code`) generates a new one, and the old one stops working at once. |
| `join_code_enabled` | `false` | Whether the code works. **Off by default**: the owner turns it on when they want people to join by code, and off again afterwards. |

Teams themselves are in `teams` (name and owner) and their members in `team_members` (`role` is `owner` or `member`; `user_name` is a copy of the member's name, kept up to date by the server). An account that owns a team cannot be deleted until its team is deleted; deleting any other account removes it from its teams.

## Project settings (`project_settings`)

Every project has one row, made by the server together with the project (and removed with it); the same step also gives the project its first chapter, `Chapter 1`. Any member of the project's team edits it from the app; you can edit it in the dashboard (Collections, `project_settings`, filter by `project`). Nobody can add or delete a row through the API.

| Field | Default | What it does |
|---|---|---|
| `analytics_enabled` | `false` | Whether play-through analytics are recorded for this project's shared links (design 6.6). **Off by default**; used by a later plan. |
| `version` | `0` | A counter the server raises on every save, so two people saving at once cannot overwrite each other (see [backend.md, "Guarded writes"](../developer/backend.md#guarded-writes)). Do not change it by hand. If someone saved the row after you opened it in the dashboard, your save should be refused with "This record was changed by someone else": reload and save again. |
