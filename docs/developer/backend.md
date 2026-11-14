# Backend developer guide

The backend is PocketBase, run in Docker. The image is `kwnto-pocketbase:dev`, built from [backend/Dockerfile](../../backend/Dockerfile).

## Start the dev backend

1. Copy `.env.example` to `.env` and set `KWNTO_ADMIN_EMAIL` and `KWNTO_ADMIN_PASSWORD` (10 or more characters). There is no default password: without both values the container refuses to start (exit code 64).
2. Run `npm run dev:backend`.
3. The API is at `http://127.0.0.1:8090/api/` and the dashboard at `http://127.0.0.1:8090/_/`. Sign in with the admin email and password from `.env`.

Data lives in the Docker volume `kwnto-dev-data`. `backend/pb_migrations` and `backend/pb_hooks` are bind-mounted, so edits apply without a rebuild (restart the container to run a new migration).

## How the admin is created

The migration [1794355200_initial_superuser.js](../../backend/pb_migrations/1794355200_initial_superuser.js) creates one superuser from `KWNTO_ADMIN_EMAIL` and `KWNTO_ADMIN_PASSWORD`. PocketBase runs each migration once per data folder, so a restart with different values never overwrites a password changed in the dashboard. A test pins this. Never edit that migration after it has run; add a new one instead.

To reset a lost password, use `docker compose -f compose.dev.yaml exec pocketbase /pb/pocketbase superuser upsert EMAIL PASSWORD --dir=/pb/pb_data`.

## Hooks and their helpers

Behaviour that access rules cannot express lives in JavaScript hooks in `backend/pb_hooks/`. PocketBase loads every `*.pb.js` file there; files in `lib/` are only loaded when a hook requires them.

| Path | What goes there |
|---|---|
| `backend/pb_hooks/*.pb.js` | Thin hooks, routes and scheduled jobs, for example [retention.pb.js](../../backend/pb_hooks/retention.pb.js) (the daily `purge_security_events` job), [users-defaults.pb.js](../../backend/pb_hooks/users-defaults.pb.js) (gives each new account its per-user rows), [users-signup.pb.js](../../backend/pb_hooks/users-signup.pb.js) (closed registration, the verified flag at sign-up, the password rules on sign-up, change and reset, and the `signup`, `verification` and `reset` log entries) [users-signin.pb.js](../../backend/pb_hooks/users-signin.pb.js) (lockdown, lockout, block and the `sign-in`, `failure` and `lockout` log entries) and [admin-controls.pb.js](../../backend/pb_hooks/admin-controls.pb.js) (the admin's sign-out routes, ending a blocked account's sessions, and the `admin` log entries for those and for settings changes) and [teams.pb.js](../../backend/pb_hooks/teams.pb.js) (a new team's owner row and settings row, in one transaction with the team; the `team_members.user_name` copy) and [teams-join.pb.js](../../backend/pb_hooks/teams-join.pb.js) (the join-by-code and regenerate-code routes, the attempt limit and the `join` log entries) and [teams-invites.pb.js](../../backend/pb_hooks/teams-invites.pb.js) (the invite, accept and decline routes, the `team_invites` name copies and the `invite` log entries). |
| `backend/pb_hooks/lib/*.js` | Shared helpers: [settings.js](../../backend/pb_hooks/lib/settings.js) reads the system settings, [security-log.js](../../backend/pb_hooks/lib/security-log.js) writes the security log, [retention.js](../../backend/pb_hooks/lib/retention.js) computes purge cut-offs, [user-records.js](../../backend/pb_hooks/lib/user-records.js) creates an account's missing per-user rows (`ensureUserRecords`), [password-rules.js](../../backend/pb_hooks/lib/password-rules.js) checks a new password (`checkPassword`) against the list in [common-passwords.js](../../backend/pb_hooks/lib/common-passwords.js), [lockout.js](../../backend/pb_hooks/lib/lockout.js) decides whether an account and IP pair is locked out (`decideLockout`), [join-code.js](../../backend/pb_hooks/lib/join-code.js) makes a team join code (`generateJoinCode`), [unused-join-code.js](../../backend/pb_hooks/lib/unused-join-code.js) picks one no team has yet with crypto-quality randomness (`unusedJoinCode`, used by team creation and regeneration), [rate-limit.js](../../backend/pb_hooks/lib/rate-limit.js) decides whether a user has used up their attempts (`isOverLimit`), [team-attempts.js](../../backend/pb_hooks/lib/team-attempts.js) counts a user's join and invite attempts from the security log and applies it (`teamAttemptLimitReached`, shared by both routes so they count alike), [invite-email.js](../../backend/pb_hooks/lib/invite-email.js) cleans a typed email, takes its domain for the log and keeps an exact-address safeguard from the time accounts could differ only in case (`typedEmail`, `normalisedEmail`, `emailDomain`, `chooseAccountIndex`), [team-invites.js](../../backend/pb_hooks/lib/team-invites.js) holds the invite routes' reads and writes (email lookup, creating an invite, answering one in a transaction with the member row). |

Rules for this code:

- **Hook handlers run in isolated scopes.** A handler cannot see variables or functions declared outside it in the same file. Load shared code inside the handler: `const { getSystemBehavior } = require(`${__hooks}/lib/settings.js`)`. (Migrations are different: a migration's top-level helpers are visible inside `migrate()`.)
- **`lib/` is CommonJS** (`module.exports`), so the same file runs in PocketBase and in Vitest. [backend/pb_hooks/package.json](../../backend/pb_hooks/package.json) says `"type": "commonjs"` because the project root is an ES module package; without it, Node refuses `module.exports` in these files.
- **Keep decisions pure and test them** in `tests/hooks/<name>.unit.test.ts` (part of `npm run test:unit`). Tests load a helper with `createRequire(import.meta.url)`. Where a helper needs a PocketBase global such as `Record`, the test provides a small fake (see `tests/hooks/security-log.unit.test.ts`).
- Settings are read at run time with `getSystemAccess($app)` and `getSystemBehavior($app)`, never copied into code. They throw if a settings record is missing, because that is a broken install. The tables and their defaults are described in [docs/admin/settings.md](../admin/settings.md).
- Write security events with `logEvent($app, type, userId, ip, detail)`. It never throws, so it is safe on a sign-in path. Inside a hook handler, pass the event's app (`logEvent(e.app, ...)`), not the global `$app`: the handler may run inside a transaction, and a write through `$app` would wait on the transaction's database lock until SQLite's busy timeout.
- **Looking an account up by email:** emails are case-insensitive (developer decision, 2026-11-13; final review I2). They are stored lower-case and trimmed (users-signup hook) and PocketBase's own unique email index is `COLLATE NOCASE` ([1794360700_users_email_collate_nocase.js](../../backend/pb_migrations/1794360700_users_email_collate_nocase.js)). That collation is what makes PocketBase's lookups (`findAuthRecordByEmail`, sign-in, password reset, verification) ignore case in 0.40.6: an index on `LOWER(email)` does not (a reset typed with a capital sent no mail). Only stray spaces are not ignored, so the sign-in hook looks an untrimmed address up again. Filters in hooks cannot say `COLLATE`; `email:lower = {:email}` works but scans the table (see `findUserByEmail` in [team-invites.js](../../backend/pb_hooks/lib/team-invites.js)).
- **A record create is not a transaction.** In PocketBase 0.40.6 the API saves a record without a transaction, and `onRecordAfterCreateSuccess` runs after the record is stored, so a failure there leaves the record behind. When related rows must exist together with a record (a team, its owner row and its settings row), do the work in the `onRecordCreate` model hook inside `e.app.runInTransaction((txApp) => { e.app = txApp; e.next(); ... })`: setting `e.app` moves the record's own insert into the transaction, and any error rolls back all of it (see [teams.pb.js](../../backend/pb_hooks/teams.pb.js)).

## Custom routes and the admin prefix

Custom routes live under `/api/kwnto/`. App routes so far: `POST /api/kwnto/teams/join` and `POST /api/kwnto/teams/{id}/regenerate-code` ([teams-join.pb.js](../../backend/pb_hooks/teams-join.pb.js)); `POST /api/kwnto/teams/{id}/invites`, `POST /api/kwnto/invites/{id}/accept` and `POST /api/kwnto/invites/{id}/decline` ([teams-invites.pb.js](../../backend/pb_hooks/teams-invites.pb.js)). What they answer is in [security.md section 3](../security.md#3-accounts-and-sign-in). They use `$apis.requireAuth("users")` (a signed-out caller gets 401) and check `e.auth.verified()` themselves (403). Inside a route, use `e.app` and pass every value from the request as a bound parameter (`{:name}`) in filters. Routes only the admin may call live under **`/api/kwnto/admin/`** (today: `POST /api/kwnto/admin/users/{id}/sign-out` and `POST /api/kwnto/admin/sign-out-all`, in [admin-controls.pb.js](../../backend/pb_hooks/admin-controls.pb.js); how to use them is the runbook in [security.md section 9](../security.md#9-if-you-suspect-a-compromise-the-incident-runbook)).

- Every admin route has the `$apis.requireSuperuserAuth()` middleware, so any other caller gets 401 or 403. Rule tests pin this (`tests/rules/admin-controls.rules.test.ts`).
- **The deployment plan must block `/api/kwnto/admin/` on the public address**, as it blocks the dashboard (`/_/`) and PocketBase's own admin API ([security.md section 6](../security.md#6-secrets-and-the-server)). The prefix exists so that one rule in the reverse proxy covers every admin route, present and future: the admin reaches them only through the private network, and a stolen admin password alone is not enough from the internet. Put every new admin-only route under this prefix, never elsewhere.

## Tests and the test backend

- `npm run test:container` builds the image and tests it with real containers (port `8093`, volume `kwnto-container-test`). It removes its own left-overs first, so it is safe to run again after a killed run.
- `docker compose -f compose.test.yaml up -d --build --wait` starts a throwaway backend on `127.0.0.1:8091` with the admin `admin@example.test` / `test-admin-password-1` and in-memory data. Stop it with `docker compose -f compose.test.yaml down -v`.

## Pinned version and how to bump it

PocketBase is pinned in `backend/Dockerfile` as build args `PB_VERSION` (currently `0.40.6`) and `PB_SHA256`. The image is verified with `sha256sum -c`, so the build fails if they disagree. To bump:

1. Choose the new version and read its release notes.
2. Copy the `pocketbase_<version>_linux_amd64.zip` line from that release's `checksums.txt`.
3. Change `PB_VERSION` and `PB_SHA256` together, then run `npm run test:container`.

The Alpine base image is pinned by digest in the same file.

## Password hashing

PocketBase v0.40.6 hashes passwords with **bcrypt, cost 10**. The password field type is documented as "storing bcrypt hashed strings" and hashes with `bcrypt.GenerateFromPassword(plain, cost)`, where an unset `Cost` falls back to `bcrypt.DefaultCost` ([core/field_password.go](https://github.com/pocketbase/pocketbase/blob/v0.40.6/core/field_password.go)). The default `_superusers` and auth `password` fields set no cost, and `bcrypt.DefaultCost` is 10 ([golang.org/x/crypto v0.58.0, bcrypt/bcrypt.go](https://github.com/golang/crypto/blob/v0.58.0/bcrypt/bcrypt.go)). bcrypt uses only the first 72 bytes of a password.

## The backend door (`frontend/src/backend/`)

The only place that imports `pocketbase`. Screens use `import { backend } from '../../backend'` and see only plain types from [types.ts](../../frontend/src/backend/types.ts) (`AuthUser`, `Team`, `TeamMember`, `TeamSettings`, `Invite`), never SDK records. `createBackend(baseUrl?)` in [client.ts](../../frontend/src/backend/client.ts) builds one with `auth` and `teams`; `backend` in [index.ts](../../frontend/src/backend/index.ts) is the app's lazily created one. The SDK's request auto-cancel is off, because screens load twice in development (StrictMode) and a cancelled request would show as "cannot be reached".

- **`backend.auth`:** `signUp`, `signIn`, `signOut`, `current`, `refresh`, `requestVerification`, `requestPasswordReset`, `onChange` (one listener). `refresh()` re-reads the stored session (the `verified` flag changes after the email link); it ends the session only on 401, 403 or 404, and keeps it when the server cannot be reached. The app calls it on load and when the window gets focus.
- **`backend.teams`:** `list`, `create`, `remove`, `members`, `removeMember`, `settings` (owner only), `setJoinCodeEnabled`, `regenerateJoinCode`, `join`, `invite`, `invites` (pending only), `acceptInvite`, `declineInvite`. `create` sends the signed-in user as `owner` (the rule requires it) and refuses an unverified user before asking the server.
- **Errors:** every method throws a `BackendError` ([errors.ts](../../frontend/src/backend/errors.ts)) with `kind`, `status`, `message` and, for `invalid`, `fields`. What the UI does for each kind:

| `kind` | From | UI |
|---|---|---|
| `invalid` | 400 | show `message`; show `fields[name]` beside the field |
| `locked` | 429 (lockout, rate limit) | show `message` (it says when to retry) |
| `forbidden` | 401, 403 (not verified, blocked, lockdown, not allowed) | show `message`; for an unverified account the verify gate text |
| `not-found` | 404 (also a wrong, disabled or unknown join code, an unknown invitee) | show `message`; never say more than the server did |
| `conflict` | 409 (invite already answered) | show `message` and reload the list |
| `unreachable` | no answer | "The server cannot be reached." and keep what is on screen |
| `unknown` | anything else | show `message` |

- **Tests:** unit tests beside the code (`errors.test.ts`, `mappers.test.ts`, `teams.test.ts`, `auth.test.ts`, fake `pb` objects); the chain door, routes and rules in `tests/rules/backend-door.rules.test.ts`.
