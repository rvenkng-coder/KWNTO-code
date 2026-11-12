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
| `registration_open` | `true` | When off, new people cannot sign up; existing accounts still sign in. | Task 3 |
| `lockdown` | `false` | When on, every app sign-in is refused. The admin dashboard keeps working. | Task 4 |
| `lockdown_message` | empty | The message shown to people refused during a lockdown. | Task 4 |

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
| `max_failed_logins` | `3` | Failed sign-ins (same account, same IP) before a lockout. | Task 4 |
| `lockout_minutes` | `5` | How long a lockout lasts. | Task 4 |
| `team_attempts_per_hour` | `20` | Join-code and invite attempts one user may make per hour. | Tasks 7, 8 |
