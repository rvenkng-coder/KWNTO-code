# Task 1: The production stack and the proxy

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong
**Depends on:** Plans 1 to 5

Design 7b: one Compose file starts everything; the dashboard and admin paths are blocked on the public address; the proxy adds security headers and request-size limits; data lives in volumes. Security.md 5 "Missing browser protections" gets its one headers test here.

**Files:**
- Create: `compose.prod.yaml`, `compose.edge-test.yaml`, `deploy/Caddyfile`, `deploy/tailscale-serve.json`, `tests/container/edge.test.ts`, `tests/container/helpers/edge.ts`, `docs/decisions/0004-deployment-images.md`
- Modify: `backend/entrypoint.sh` (`--publicDir=/pb/pb_public`), `.env.example` (new names, empty: `KWNTO_PRODUCTION`, `KWNTO_PUBLIC_URL`, `KWNTO_MAX_REQUEST_MB`, `KWNTO_BACKUP_DIR`, `TS_AUTHKEY`, `TS_HOSTNAME`), `.gitignore` (`backups/`), `docs/developer/backend.md` ("The production stack" section: services, network, which port goes where), `docs/developer/testing.md` (the edge test and its port)

**Interfaces:**
- Consumes: the `kwnto-pocketbase:dev` image and its `entrypoint.sh` (Plan 1 Task 2); `PNG_1PX` and `sampleBytes` shapes (copy the bytes; do not import from `tests/rules/` into `tests/container/`).
- Produces, `compose.prod.yaml`: services `web`, `pocketbase`, `caddy`, `tailscale`; volumes `kwnto-data` (at `/pb/pb_data`), `kwnto-web` (written by `web`, mounted read-only at `/pb/pb_public` in `pocketbase`), `kwnto-tailscale`; network `kwnto-edge` with an explicit `name: kwnto-edge` (so tests can join it), subnet `172.30.0.0/24`, `tailscale` at `172.30.0.2`. `pocketbase` and `caddy` keep `cap_drop: [ALL]`, `no-new-privileges`, run as non-root and publish no port; `tailscale` gets only `cap_add: [NET_ADMIN]` and `/dev/net/tun` (or `TS_USERSPACE=true` if the VM has no tun; the guide says which). `restart: unless-stopped` on the three long-running services.
- Produces, `compose.edge-test.yaml` (used with `-f compose.prod.yaml -f compose.edge-test.yaml`): `web` and `tailscale` behind a profile nobody enables; `pocketbase` with `tmpfs` data, the test admin `admin@example.test` / `test-admin-password-1`, `KWNTO_PRODUCTION` unset, and the host's `./dist` mounted at `/pb/pb_public:ro`; `caddy` published on `127.0.0.1:8094:8080` with `KWNTO_MAX_REQUEST_MB=2`; `pocketbase` also published on `127.0.0.1:8095:8090`, for the tests' admin set-up calls only (the stand-in for the tailnet port of D5). Tests never send an app request to 8095.
- Produces, `tests/container/helpers/edge.ts`:

```ts
export const EDGE_URL = 'http://127.0.0.1:8094'
export const EDGE_ADMIN_URL = 'http://127.0.0.1:8095'               // PocketBase direct: set-up only
export function edgeAdminToken(): Promise<string>                    // superuser token via EDGE_ADMIN_URL
export function verifiedUser(): Promise<{ id: string; email: string; token: string }> // signs up through EDGE_URL, verifies with the admin token
export function edgeUp(extraEnv?: Record<string, string>): void   // npm run build if dist/ is missing, then compose up -d --build --wait; throws with the compose logs on failure
export function edgeDown(): void                                     // compose down -v, never throws
export function raw(path: string, init?: RequestInit): Promise<Response> // fetch EDGE_URL + path with redirect: 'manual'
```

**If interrupted:** run `docker compose -f compose.prod.yaml -f compose.edge-test.yaml down -v`; nothing else is left outside the working tree.

## Checkpoint 1A: Images, compose and the decision record

- [x] **Step 1: Pin the three images** by digest: `docker pull <image>` then `docker inspect --format '{{index .RepoDigests 0}}' <image>`, for `node:22-alpine`, `caddy:2-alpine`, `tailscale/tailscale:stable`. Write `0004-deployment-images.md` (what each is for, licence: Node MIT, Caddy Apache-2.0, Tailscale BSD-3-Clause; how to bump: pull, read the release notes, replace the digest, run `npm run test:container`).
- [x] **Step 2: Write `compose.prod.yaml`, `compose.edge-test.yaml`, `deploy/tailscale-serve.json`** (D1, D5; the serve config uses `${TS_CERT_DOMAIN}` as Tailscale's container docs show) and change `entrypoint.sh`.
- [x] **Step 3: Run** `npm run test:container` (the existing four tests). Expected: PASS, unchanged. Then `docker compose -f compose.prod.yaml config` with an `.env` of dummy values: it must print no error. **Close checkpoint 1A** (commit `feat: production compose stack`).

## Checkpoint 1B: The proxy

- [x] **Step 4: Write the failing tests** C1 to C5 in `tests/container/edge.test.ts` with the helper; `beforeAll(edgeUp)`, `afterAll(edgeDown)`. Each test signs nothing in; C2's list is a `test.each` over the paths in Review Focus 3 and D2.
- [x] **Step 5: Run** `npx vitest run --project container tests/container/edge.test.ts`. Expected: FAIL (no Caddyfile).
- [x] **Step 6: Write `deploy/Caddyfile`** (D2, D3, D4, D6). Global options: `admin off`, `auto_https off` (Tailscale terminates TLS), the `servers` block of D6. One site `:8080`. Order: `request_body`, the blocked matchers with `respond "Not found" 404`, `header` (D3), `reverse_proxy pocketbase:8090 { header_up X-Forwarded-For {client_ip} }`. Caddy logs to stdout as JSON.
- [x] **Step 7: Run** the edge tests. Expected: PASS. Then open one block (remove `/api/settings*` from the matcher): C2 must fail on that row; restore it and say so in the report. **Close checkpoint 1B** (commit `feat: Caddy blocks admin paths and adds security headers`).

## Checkpoint 1C: The app behind the proxy

- [x] **Step 8: Write the failing test** C3's page half (the built `index.html` comes back for `/` and for `/#/team/x`'s base `/`, and holds no inline `<script>` without `src`), and C6.
- [x] **Step 9: Run, expect FAIL** until `--publicDir` and the mount are right; fix and run again. Expected: PASS.
- [x] **Step 10: Walk** the built app through `http://127.0.0.1:8094` in Firefox and Chromium with the developer tools console open: sign up, create a team, open a project, add a node, upload `PNG_1PX`. Record in `progress.md` that no Content-Security-Policy violation was logged (or the exact one and the D3 change that fixed it). Update `backend.md` and `testing.md`. **Close checkpoint 1C** (commit `feat: PocketBase serves the built app`).

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | the API answers through the proxy | container | `GET /api/health`; sign up and sign in a fresh user through `EDGE_URL` | 200; the sign-in returns a token | tests/container/edge.test.ts :: the app API works through the proxy |
| C2 | admin paths are blocked under every spelling | container | `GET` each of `/_/`, `/_`, `/_/images/logo.svg`, `/api/kwnto/admin/sign-out-all` (POST), `/api/collections/_superusers/auth-with-password` (POST with the test admin's real password), `/api/settings`, `/api/backups`, `/api/logs`, `/api/crons`, `/api/collections`, `/api/collections/users`, `/api/collections/users/truncate` (DELETE), `/api/collections/import` (PUT), `//_/`, `/%5F/`, `/API/settings` | 404 and body `Not found` for every row; the superuser sign-in returns no token | tests/container/edge.test.ts :: every admin path is not found on the public address |
| C3 | security headers on the page and the API | container | `GET /` and `GET /api/health` | each of the D3 headers with its exact value; no `Server` header; `index.html` has no inline script | tests/container/edge.test.ts :: the proxy adds the security headers |
| C4 | request size limit | container | `POST /api/collections/media/records` with a 3 MB body (limit 2 MB in the test override); then a 1 MB body | first 413 before PocketBase answers (no PocketBase JSON in the body); second not 413 | tests/container/edge.test.ts :: a body over the proxy limit is refused with 413 |
| C5 | media keeps its own stricter headers | container | a verified member uploads `PNG_1PX` and downloads it with a file token through `EDGE_URL` | `Content-Security-Policy` is Plan 5's (`default-src 'none'; ... sandbox`), not D3's; `X-Content-Type-Options: nosniff` once | tests/container/edge.test.ts :: stored files keep their own CSP behind the proxy |
| C6 | the web app is served | container | `GET /`, `GET /assets/<first asset named in index.html>` | 200 `text/html` with `<div id="root">`; the asset 200 with a JavaScript content type | tests/container/edge.test.ts :: PocketBase serves the built web app |
| C7 | the app works under the CSP | manual | Step 10 walk, both browsers | no CSP violation in the console; every step works | |
### Probes
**Probe folder:** none
### Breaks
none
### Flow
Step 10: the built app through the edge test stack in Firefox and Chromium with the console open (sign up, team, project, node, upload). Record the result in `progress.md`.
### Evidence
The full output of `npm run check:task`, the Step 7 opened-block run, the three pinned digests, and the Step 10 record.
