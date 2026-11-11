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
