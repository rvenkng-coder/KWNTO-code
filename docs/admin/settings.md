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
| `default_quota_bytes` | `2147483648` (2 GB) | Upload space per user, unless that user has an override in `user_limits`. | later |
| `max_video_mb` | `200` | Largest video file, in MB. | later |
| `max_audio_mb` | `50` | Largest audio file, in MB. | later |
| `max_image_mb` | `50` | Largest image file, in MB. | later |
| `allowed_types` | `["wav","mp3","mov","mp4","jpeg","png"]` | File types that can be uploaded. | later |

## `system_behavior`

| Field | Default | What it does | Used by |
|---|---|---|---|
| `presence_timeout_seconds` | `30` | How long after the last heartbeat someone stops showing as editing a node. | later |
| `analytics_retention_days` | `365` | How long play-through analytics are kept. | later |
| `trash_retention_days` | `30` | How long deleted projects, chapters and nodes stay recoverable before they are removed for good. | later |
| `security_retention_days` | `365` | How long security log entries are kept. | Task 1 |
| `max_failed_logins` | `3` | Failed sign-ins of one account from one IP within `lockout_minutes` before that account is locked out from that IP. A successful sign-in resets the count. `0` turns the lockout off. | Task 4 |
| `lockout_minutes` | `5` | The window in which failures are counted, and so how long a lockout lasts: it ends when the oldest counted failure is this many minutes old. The person is told "Try again after N minutes." `0` turns the lockout off. | Task 4 |
| `team_attempts_per_hour` | `20` | Join-code and invite attempts one user may make per hour. | Tasks 7, 8 |

## The security log (`security_events`)

The server records security-relevant events here: sign-ups and email verification, sign-ins, failed sign-ins and lockouts, password resets, invite and join attempts, and admin actions. Each entry has a `type`, the account involved (`user`, empty when there is none), the caller's `ip`, a `detail` object and the time it was `created`. Which events are written arrives with the tasks that build sign-up, sign-in, teams and invites. So far: `signup` (a visitor created an account; accounts you add in the dashboard are not logged as sign-ups), `verification` (the first time an account confirms its email), `reset` (a password was changed through the reset link), `sign-in` (a successful app sign-in), `failure` (a wrong email or password) and `lockout` (a sign-in refused because of a lockout). The last three have `detail.identity`, the email as typed, lower-cased; `failure` and `lockout` have it even when no account has that email, and then `user` is empty. To see one email's attempts, filter by `detail.identity = "someone@example.com"`. A lockdown or a block refusal is not logged.

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
| `quota_override_bytes` | empty (`0`) | Upload space for this user, in bytes, instead of `system_storage.default_quota_bytes`. Empty or `0` means "use the system default". Used by a later plan. |

### `user_status` (admin only)

| Field | Default | What it does |
|---|---|---|
| `blocked` | `false` | When on, this account cannot sign in. |
| `blocked_reason` | empty | The message the blocked user sees, after "Your account is blocked: ". Write it for them, not for yourself. Only someone who types the right password sees it. |
| `blocked_at` | empty | When you blocked the account, for your own records. |

**To block a user:** open their `user_status` row, turn on `blocked`, write `blocked_reason`, set `blocked_at` to now, and save. To unblock, turn `blocked` off. From the next sign-in attempt the account is refused (status 403, "Your account is blocked: <reason>"), and so is any renewal of a session it already has. Ending its existing sessions at once arrives with Task 5 of the [accounts and teams plan](../superpowers/plans/2026-11-12-accounts-teams/README.md).

App users cannot see `user_limits` or `user_status` at all, so a user cannot raise their own quota or unblock themselves.
