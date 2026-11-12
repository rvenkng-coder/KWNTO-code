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
| `backend/pb_hooks/*.pb.js` | Thin hooks, routes and scheduled jobs, for example [retention.pb.js](../../backend/pb_hooks/retention.pb.js) (the daily `purge_security_events` job), [users-defaults.pb.js](../../backend/pb_hooks/users-defaults.pb.js) (gives each new account its per-user rows) and [users-signup.pb.js](../../backend/pb_hooks/users-signup.pb.js) (closed registration, the verified flag at sign-up, the password rules on sign-up, change and reset, and the `signup`, `verification` and `reset` log entries). |
| `backend/pb_hooks/lib/*.js` | Shared helpers: [settings.js](../../backend/pb_hooks/lib/settings.js) reads the system settings, [security-log.js](../../backend/pb_hooks/lib/security-log.js) writes the security log, [retention.js](../../backend/pb_hooks/lib/retention.js) computes purge cut-offs, [user-records.js](../../backend/pb_hooks/lib/user-records.js) creates an account's missing per-user rows (`ensureUserRecords`), [password-rules.js](../../backend/pb_hooks/lib/password-rules.js) checks a new password (`checkPassword`) against the list in [common-passwords.js](../../backend/pb_hooks/lib/common-passwords.js). |

Rules for this code:

- **Hook handlers run in isolated scopes.** A handler cannot see variables or functions declared outside it in the same file. Load shared code inside the handler: `const { getSystemBehavior } = require(`${__hooks}/lib/settings.js`)`. (Migrations are different: a migration's top-level helpers are visible inside `migrate()`.)
- **`lib/` is CommonJS** (`module.exports`), so the same file runs in PocketBase and in Vitest. [backend/pb_hooks/package.json](../../backend/pb_hooks/package.json) says `"type": "commonjs"` because the project root is an ES module package; without it, Node refuses `module.exports` in these files.
- **Keep decisions pure and test them** in `tests/hooks/<name>.unit.test.ts` (part of `npm run test:unit`). Tests load a helper with `createRequire(import.meta.url)`. Where a helper needs a PocketBase global such as `Record`, the test provides a small fake (see `tests/hooks/security-log.unit.test.ts`).
- Settings are read at run time with `getSystemAccess($app)` and `getSystemBehavior($app)`, never copied into code. They throw if a settings record is missing, because that is a broken install. The tables and their defaults are described in [docs/admin/settings.md](../admin/settings.md).
- Write security events with `logEvent($app, type, userId, ip, detail)`. It never throws, so it is safe on a sign-in path. Inside a hook handler, pass the event's app (`logEvent(e.app, ...)`), not the global `$app`: the handler may run inside a transaction, and a write through `$app` would wait on the transaction's database lock until SQLite's busy timeout.

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
