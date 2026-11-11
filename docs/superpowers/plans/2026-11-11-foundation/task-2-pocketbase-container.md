# Task 2: PocketBase container with one-time admin bootstrap

Part of the [Foundation and Real-Time Spike plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong  
**Depends on:** Task 1

**Files:**
- Create: `backend/Dockerfile`, `backend/entrypoint.sh`, `backend/pb_migrations/1794355200_initial_superuser.js`, `backend/pb_hooks/.gitkeep`, `compose.dev.yaml`, `compose.test.yaml`, `tests/container/container.test.ts`, `docs/developer/backend.md`
- Modify: `package.json` (scripts)

**Interfaces:**
- Produces: image tag `kwnto-pocketbase:dev`; `compose.test.yaml` service `pocketbase` on host port `8091` with admin `admin@example.test` / `test-admin-password-1`; `compose.dev.yaml` on `8090` reading `.env`; npm scripts `dev:backend`, `test:container`.

**If interrupted** (see the router, "Surviving interruptions"):
- Left-over containers or the volume `kwnto-container-test` from a killed test run: the test file's `beforeAll` must remove them before it starts, so running the tests again is always safe. `docker ps -a --filter name=kwnto` shows what is left.
- 2A needs the internet once (base image and the PocketBase download). After the image is built, Docker's cache makes every later build work offline as long as `backend/Dockerfile` is unchanged.
- Never edit `1794355200_initial_superuser.js` after 2B is closed; it has run. A change needs a new migration.

## Checkpoint 2A: An image that refuses to start without credentials (needs network)

- [x] **Step 1: Write the first two failing tests** in `tests/container/container.test.ts`, driving Docker with `execFileSync`. Each test builds on image `kwnto-pocketbase:dev` (build it in `beforeAll`) and removes its own containers and volume `kwnto-container-test` in `afterAll`.

```ts
// Protects design 7c: "there is no default password". A start without credentials must stop.
test('refuses to start without admin credentials', () => {
  const run = spawnSync('docker', ['run', '--rm', 'kwnto-pocketbase:dev'], { encoding: 'utf8' })
  expect(run.status).toBe(64)
  expect(run.stderr).toContain('KWNTO_ADMIN_EMAIL and KWNTO_ADMIN_PASSWORD must be set')
})

// Protects design 7b container hardening: non-root user.
test('runs as a non-root user', () => {
  const uid = execFileSync('docker', ['run', '--rm', '--entrypoint', 'id', 'kwnto-pocketbase:dev', '-u'], { encoding: 'utf8' }).trim()
  expect(uid).not.toBe('0')
})
```

- [x] **Step 2: Run** `npx vitest run --project container`. Expected: FAIL (image does not build; no Dockerfile).
- [x] **Step 3: Write `backend/Dockerfile`.** `FROM alpine:<current stable, pinned by digest>`. Build args `PB_VERSION=0.40.6` and `PB_SHA256=<value for pocketbase_0.40.6_linux_amd64.zip from the release's checksums.txt>`; download the zip from the GitHub release, verify with `sha256sum -c`, unzip to `/pb/`. Create user `pocketbase` with uid `10001`, own `/pb`, `USER 10001`. Copy `pb_migrations/`, `pb_hooks/` and `entrypoint.sh`. `EXPOSE 8090`. `HEALTHCHECK` with `wget -qO- http://127.0.0.1:8090/api/health`.
- [x] **Step 4: Write `backend/entrypoint.sh`** (POSIX `sh`, `set -eu`): if either `KWNTO_ADMIN_EMAIL` or `KWNTO_ADMIN_PASSWORD` is empty, print `KWNTO_ADMIN_EMAIL and KWNTO_ADMIN_PASSWORD must be set` to stderr and `exit 64`. If the password is shorter than 10 characters, print `KWNTO_ADMIN_PASSWORD must be at least 10 characters` and `exit 64`. Otherwise `exec /pb/pocketbase serve --http=0.0.0.0:8090 --dir=/pb/pb_data --migrationsDir=/pb/pb_migrations --hooksDir=/pb/pb_hooks`.
- [x] **Close checkpoint 2A.** Verify: `npx vitest run --project container` shows `2 passed`. Commit: `feat: PocketBase image that refuses to start without admin credentials`.

## Checkpoint 2B: One-time admin bootstrap that survives restarts

- [x] **Step 5: Add the third failing test** to `tests/container/container.test.ts`:

```ts
// Protects design 7b: "updating a container never deletes data", and that a restart
// never overwrites a password the admin may have changed in the dashboard.
test('a restart on the same volume keeps data and the original admin password', async () => {
  await startOnVolume({ password: 'first-admin-password-1' })   // helper: docker run -d -v kwnto-container-test:/pb/pb_data -p 8093:8090, wait for /api/health
  await stopContainer()
  await startOnVolume({ password: 'second-admin-password-2' })
  expect(await superuserSignInStatus('first-admin-password-1')).toBe(200)
  expect(await superuserSignInStatus('second-admin-password-2')).toBe(400)
})
```

`superuserSignInStatus` posts to `/api/collections/_superusers/auth-with-password` on port `8093` and returns the HTTP status. Run `npx vitest run --project container`. Expected: the new test FAILS (sign-in returns 400, no superuser exists).
- [x] **Step 6: Write the migration** `1794355200_initial_superuser.js`: `migrate(up, down)` where `up` creates one `_superusers` record from `$os.getenv("KWNTO_ADMIN_EMAIL")` and `$os.getenv("KWNTO_ADMIN_PASSWORD")`, and `down` deletes that record if present. Migrations run once per data folder, which is what makes the third test pass. Follow "Creating initial superuser" in the PocketBase JS migrations docs for v0.40.
- [x] **Close checkpoint 2B.** Verify: `npx vitest run --project container` shows `3 passed`. Commit: `feat: create the admin account once, from the environment`.

## Checkpoint 2C: Compose files and scripts

- [x] **Step 7: Write the compose files.**
  - `compose.test.yaml`: service `pocketbase`, `build: ./backend`, `image: kwnto-pocketbase:dev`, ports `127.0.0.1:8091:8090`, the test admin credentials above inline (comment: test-only, data is discarded), `tmpfs: /pb/pb_data:uid=10001,gid=10001`, `read_only: true`, `cap_drop: [ALL]`, `security_opt: [no-new-privileges:true]`, and the healthcheck so `up --wait` works.
  - `compose.dev.yaml`: same service on `127.0.0.1:8090:8090`, `env_file: .env`, named volume `kwnto-dev-data:/pb/pb_data`, bind mounts of `backend/pb_migrations` and `backend/pb_hooks` so edits apply without a rebuild, same hardening options except `read_only`.
- [x] **Step 8: Scripts.** `dev:backend`: `docker compose -f compose.dev.yaml up --build`. `test:container`: `vitest run --project container`.
- [x] **Close checkpoint 2C.** Verify: `docker compose -f compose.test.yaml up -d --build --wait` exits 0 and `curl -s http://127.0.0.1:8091/api/health` returns code 200; then `docker compose -f compose.test.yaml down -v`. `npm run test:container` shows `3 passed`. Commit: `feat: dev and test compose files for PocketBase`.

## Checkpoint 2D: Document the backend

- [x] **Step 9: Confirm and record in `docs/developer/backend.md`:** how to start the dev backend, where the dashboard is (`http://127.0.0.1:8090/_/`), how the admin is created, the pinned version and how to bump it (version and checksum together), and the password hashing algorithm and cost PocketBase v0.40.6 uses (design 7c asks the builder to confirm this; cite the source file or docs page).
- [x] **Close checkpoint 2D.** Verify: `docs/developer/backend.md` exists and names the hashing algorithm and cost with its source. Commit: `docs: backend developer guide`.
