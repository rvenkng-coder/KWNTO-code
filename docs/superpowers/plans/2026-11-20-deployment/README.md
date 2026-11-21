# Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One `docker compose` command on the Proxmox VM starts KWNTO for real users: PocketBase serving the built web app and the API, Caddy in front of it blocking every admin path and adding security headers, and Tailscale Funnel publishing Caddy over HTTPS. The rate limiter and trusted proxy are on, mail links land in the app, backups run on a schedule and a restore is tested, and the admin gets a warning before the disk fills.

**Architecture:** A new `compose.prod.yaml` with four services: `web` (a one-shot Node container that builds `dist/` into a volume), `pocketbase` (the existing image, now also serving that volume with `--publicDir`), `caddy` (the only thing Tailscale reaches publicly) and `tailscale` (Funnel on 443 to Caddy; a tailnet-only port 8443 straight to PocketBase for the admin). Production-only PocketBase settings (rate limits, trusted proxy, app URL, backup schedule, mail link templates) are written once by a migration that runs only when `KWNTO_PRODUCTION=1`, so the dev and test backends keep behaving as today. Every decision with a branch in it is a pure function in `backend/pb_hooks/lib/`. A test-only override `compose.edge-test.yaml` runs the same Caddy and PocketBase on the developer's machine without Tailscale, so the container layer can test the proxy.

**Tech Stack:** Docker Compose, PocketBase 0.40.6 (migrations, settings API, cron, mail), Caddy 2, Tailscale (container, Serve and Funnel), Node 22 (build container), React 19 and TypeScript for two small screens, Vitest (unit, rules, container), Playwright.

**Spec:** [Design](../../specs/2026-11-11-kwnto-design.md) sections 7 (hosting, security), 7b (deployment, all of it), 7c (outgoing email, sign-up, the admin account, disk-usage warning), 8 (deployment instructions are a deliverable), 8b item 6 (security-headers check), 12 (before going public); [security.md](../../../security.md) sections 3 (rate limiter, trusted proxy, mail), 5 (missing browser protections), 6 (secrets and the server), 7 (backups, test the restore), 9 (runbook control 8); the [roadmap](../README.md) outline "6. Deployment" and its carried-over items from Plans 2, 4 and 5. Also binding: [engineering.md](../../../engineering.md), [testing-strategy.md](../../../testing-strategy.md), [backend.md](../../../developer/backend.md), [admin settings](../../../admin/settings.md). Executors read all of them.

**Standard:** test-plan-v1

## Global Constraints

Everything in the [Plan 1 router](../2026-11-11-foundation/README.md) "Global Constraints" still applies (zero cost, no new dependency, ask first, worktree, 300-line files, no `any`, deny by default, tests documented, prototype is reference only, secrets never in git, docs are part of done, Node 22). Values this plan depends on:

- **Worktree and branch:** `feat/deployment` in the sibling folder `../KWNTO-code-deploy`, created from `main` at 9416ede (Plans 1 to 5 `done`). Merge `main` again before a task if it has moved; never rebase this branch once pushed. Tracking in `.planning/2026-11-20-deployment/progress.md`.
- **Every task ends with** `npm run check:task -- --task docs/superpowers/plans/2026-11-20-deployment/task-<n>-<name>.md --base <sha at task start> --built-by <local|strong>`, full output pasted in the report.
- **Probes are written by the controller, not the implementer**, before a task is dispatched.
- **Ask first (engineering 5) applies hard here:** nothing in this plan touches the real VM, a real Tailscale account, a real Gmail account or a Docker volume other than the test ones it creates. Steps marked **(developer)** are done by the developer, or by an agent only while the developer watches and approves each command.
- **Ports:** existing dev `8090`, test `8091`, spike `8092`, container test `8093`; new: edge test Caddy `127.0.0.1:8094` and edge test PocketBase `127.0.0.1:8095` (admin set-up calls only). Inside `compose.prod.yaml`: PocketBase listens on `8090`, Caddy on `8080`; nothing is published on the VM's own interfaces (only Tailscale reaches them, over the compose network).
- **Docker images are dependencies.** `node:22-alpine`, `caddy:2-alpine` and `tailscale/tailscale:stable` are new; each is pinned by digest (as the Alpine base in `backend/Dockerfile` is), and Task 1 writes decision record `docs/decisions/0004-deployment-images.md` for all three. Approving this plan approves those three images and nothing else.
- **Production-only behaviour is gated by `KWNTO_PRODUCTION=1`.** The dev backend (`compose.dev.yaml`), the test backend (`compose.test.yaml`) and the rules and e2e suites must behave exactly as before this plan; `npm test` on this branch passes with no change to any existing test.
- **Secrets** (`KWNTO_ADMIN_PASSWORD`, `TS_AUTHKEY`, the SMTP app password) live only in `.env` on the VM or in the PocketBase database. `.env.example` lists names with empty values. The SMTP password is typed into the dashboard, never into a file in the repo.
- **Migrations:** new files from `1794390000_*` upward (Plan 7 uses `1794400000_*` and up, so the two branches never collide). No migration that has run on any machine is edited.
- **Exact copy** (tests compare it):
  - Verify screen, success: `Your email is verified. You can now create and join teams.`
  - Verify screen, failure: `This verification link is not valid or has expired. Sign in and ask for a new one.`
  - Reset screen, success: `Your password was changed. Sign in with the new password.`
  - Reset screen, failure: `This reset link is not valid or has expired. Ask for a new one from the sign-in screen.`
  - Mismatched passwords: `The two passwords are not the same.`
  - Storage warning mail subject: `KWNTO storage warning: <used> of <limit> used` (`formatBytes` from `lib/media-check.js`).

## Review Focus

The failure modes the spec implies that are most likely to bite a person, each pinned by a test in the task named:

1. **Mail links that point at the blocked dashboard.** PocketBase's default verification and reset mails link to `/_/#/auth/...`, which Caddy blocks on the public address, so every student's verification link would 404. The templates must link into the app, and the app must have screens that finish the job. (Task 3 C1, C3, C4)
2. **A spoofed `X-Forwarded-For` header must not move the lockout.** With the trusted proxy on, a client that sends its own `X-Forwarded-For` must still be counted by its real address; otherwise anyone can lock an account "from" any IP, or dodge the lockout by inventing one per guess. (Task 2 C5)
3. **Every admin path is 404 on the public address, under every spelling:** `/_/`, `/_`, `/api/kwnto/admin/...`, `/api/collections/_superusers/auth-with-password`, `/api/settings`, `/api/backups`, `/api/logs`, `/api/collections` (the schema API), `//_/`, `/%5F/`, `/API/settings`. (Task 1 C2)
4. **A restore brings back the data, the media files and the admin password from the backup**, into a fresh volume, and the app starts on it. A backup that cannot be restored is not a backup. (Task 4 C2)
5. **A 200 MB video still uploads through the proxy**, and a body over the proxy's limit gets 413 before PocketBase reads it. (Task 1 C4; Task 6 C3 measures it through Funnel)

Also covered, lower risk: the production migration does nothing on the dev and test backends (Task 2 C3); the app's own page loads under the Content-Security-Policy with no violation (Task 1 C3, Task 6 C2); the storage warning is sent at most once a day (Task 5 C1).

## Decisions made in this plan (please review)

The roadmap's "Decide first" items and calls where the spec is silent. Each is cheap to change before the task that builds it.

| # | Decision | Task |
|---|---|---|
| D1 | **Who serves the web app:** PocketBase, from `--publicDir=/pb/pb_public` (design 7b "the backend serves both"). The `web` service (pinned `node:22-alpine`) runs `npm ci && npm run build` into the named volume `kwnto-web`, mounted read-only into PocketBase. `pocketbase` waits for it with `depends_on: { web: { condition: service_completed_successfully } }`. So the VM needs only Docker and git (design 7b: "clone, set secrets, run"). `entrypoint.sh` passes `--publicDir` always; an empty folder is harmless for dev and test. | 1 |
| D2 | **Caddy blocks** (404, body `Not found`): `/_` and `/_/*`, `/api/kwnto/admin/*`, `/api/collections/_superusers/*`, `/api/settings*`, `/api/backups*`, `/api/logs*`, `/api/crons*`, `/api/collections/import`, and the schema API `path_regexp ^/api/collections/?$` and `^/api/collections/[^/]+/?$` and `^/api/collections/[^/]+/truncate$`. Matching is on Caddy's cleaned, case-folded path (Caddy's `path` matcher is case-insensitive and cleans `//` and `%5F` before matching; C2 proves it). Everything else is proxied to `pocketbase:8090`. | 1 |
| D3 | **Caddy headers** on every response: `Content-Security-Policy: default-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` (`'unsafe-inline'` styles because React Flow sets inline styles), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` (Plan 7's share tokens live in URLs), `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Strict-Transport-Security: max-age=31536000`, and `-Server`. The media download headers of Plan 5 D6 stay; Caddy adds its own on top and must not replace PocketBase's stricter `Content-Security-Policy` on `/api/files/` (use `header ?Content-Security-Policy` there, i.e. set only when absent). | 1 |
| D4 | **Request size:** `request_body { max_size {$KWNTO_MAX_REQUEST_MB}MB }`, `KWNTO_MAX_REQUEST_MB` default `1024` (the media field's hard ceiling, Plan 5 D3). The per-kind limits stay admin settings in PocketBase. | 1 |
| D5 | **Admin access:** only over the tailnet. The Tailscale serve config publishes `:443` with Funnel to `http://caddy:8080`, and `:8443` **without** Funnel to `http://pocketbase:8090` (the dashboard and admin routes, for tailnet devices only). Funnel is allowed only on 443, 8443 and 10000, and only 443 has `AllowFunnel`. | 1 |
| D6 | **Client IP chain:** Caddy trusts forwarding headers only from the Tailscale container, at the fixed address `172.30.0.2` on the compose network `kwnto-edge` (subnet `172.30.0.0/24`): `servers { trusted_proxies static 172.30.0.2/32; client_ip_headers X-Forwarded-For }`. Caddy then **overwrites** the header it sends upstream with one value, `header_up X-Forwarded-For {client_ip}`. PocketBase trusts `X-Forwarded-For` (`trustedProxy.headers`, `useLeftmostIP: false`). A client's own header is ignored unless it came through Tailscale. Whether Funnel actually sends the visitor's IP is confirmed by the developer in Task 6 C4; if it does not, every public visitor shares one IP and D7's per-IP limits become global (written in security.md as a known gap, with the Cloudflare Tunnel fallback). | 1, 2, 6 |
| D7 | **Rate limits** (PocketBase built-in, security.md 3): enabled with `*:auth` 2 requests per 3 s, `/api/kwnto/teams/` 10 per 60 s (join, invites, regenerate), `/api/` 300 per 10 s. Admins can change them in the dashboard afterwards. | 2 |
| D8 | **How production settings are written:** migration `1794390000_production_settings.js` applies `productionSettings(env)` from `lib/production-settings.js` **only when `KWNTO_PRODUCTION=1`**; otherwise it does nothing. It sets `meta.appURL` (from `KWNTO_PUBLIC_URL`), `meta.appName` `KWNTO`, `rateLimits` (D7), `trustedProxy` (D6), `backups.cron` and `backups.cronMaxKeep` (D10). It runs once per data folder, so the admin's later dashboard edits stay. `entrypoint.sh` refuses to start (exit 64, `KWNTO_PUBLIC_URL must be set when KWNTO_PRODUCTION=1`) when the flag is on without a URL starting `https://`. | 2 |
| D9 | **Mail links:** the `users` collection's verification and reset templates link to `{APP_URL}/#/verify/{TOKEN}` and `{APP_URL}/#/reset/{TOKEN}` (written by migration `1794390100_mail_links.js` on every backend, since dev mail would otherwise also point at the dashboard). Two new app screens finish the job through the door (`confirmVerification`, `confirmPasswordReset`). The email-change template is not used by the app and is left as is. SMTP itself is set by the admin in the dashboard (design 7c), never in a file. | 3 |
| D10 | **Backups:** PocketBase's built-in scheduled backups, default cron `0 2 * * *` (02:00 UTC daily), keep `7`. The destination is the host folder `KWNTO_BACKUP_DIR` (default `./backups`), bind-mounted at `/pb/pb_data/backups`, so a backup is a plain zip on the VM's disk that the admin can copy or point at a NAS mount. PocketBase leaves its `backups` folder out of each archive. `deploy/backup-now.sh` makes one now through the API on the private address. | 4 |
| D11 | **Restore** is the offline procedure `deploy/restore.sh <backup.zip>`: stop `pocketbase`, empty the `kwnto-data` volume with a throwaway container of the same image, unzip the backup into it, start `pocketbase`. Not the dashboard's restore button, because the offline steps are the ones the container test can prove and they also work when the app will not start. | 4 |
| D12 | **Disk-usage warning** (design 7c): new `system_storage.total_warning_bytes` (default `21474836480`, 20 GB). A cron `kwnto_storage_check` at `0 * * * *` sums every `media.size_bytes`; over the limit, and if no warning was sent in the last 24 hours, it writes a `security_events` entry of new type `storage` (`detail.usedBytes`, `detail.limitBytes`) and mails every superuser (when mail is set up). The VM's own free space is out of reach of a hook; the guide tells the admin to watch it with `df -h` and the Proxmox dashboard. | 5 |
| D13 | **Upload progress (Plan 5 D12):** not built here. Task 6 measures a 150 MB upload through Funnel; over 3 minutes, or if it fails, the roadmap gets a "chunked or resumable upload" item and the Cloudflare Tunnel fallback is re-judged. | 6 |
| D14 | **Unknown-email timing:** a line in security.md section 10 (accepted risk while internal, re-judge before going public). No code. | 6 |
| D15 | **Waiting offline edits after sign-out (Plan 4 carry-over):** stays an accepted risk (security.md 10), nothing to build until going public. | 6 |

## File structure

| Path | Responsibility |
|---|---|
| `compose.prod.yaml` | The four production services, volumes `kwnto-data` and `kwnto-web`, network `kwnto-edge`, Tailscale state volume `kwnto-tailscale` |
| `compose.edge-test.yaml` | Test override: no `tailscale` or `web`; mounts the host's `dist/`; publishes Caddy on `127.0.0.1:8094`; in-memory data; test admin |
| `deploy/Caddyfile` | D2, D3, D4, D6 |
| `deploy/tailscale-serve.json` | D5 |
| `deploy/backup-now.sh`, `deploy/restore.sh` | D10, D11 |
| `backend/entrypoint.sh` | `--publicDir`, the D8 start check |
| `backend/pb_hooks/lib/production-settings.js` | Pure: `productionSettings(env)` |
| `backend/pb_hooks/lib/storage-warning.js` | Pure: `shouldWarn(...)`, `warningSubject(...)` |
| `backend/pb_hooks/storage-check.pb.js` | The D12 cron |
| `backend/pb_migrations/1794390000_production_settings.js`, `1794390100_mail_links.js`, `1794390200_storage_warning.js` | Settings, templates, the new field and log type |
| `frontend/src/features/auth/VerifyEmailScreen.tsx`, `ResetPasswordScreen.tsx` | D9 screens |
| `tests/container/edge.test.ts`, `tests/container/production.test.ts`, `tests/container/backup.test.ts`, `tests/container/helpers/edge.ts` | Container layer |
| `docs/admin/deployment.md` | First run, Tailscale, SMTP, updates, backups, restore, disk |
| `docs/decisions/0004-deployment-images.md` | The three images |

## Tasks

| # | Task | Tier | Depends on | Checkpoints | Status |
|---|---|---|---|---|---|
| 1 | [The production stack and the proxy](task-1-production-stack.md) | strong | Plans 1 to 5 | 1A 1B 1C | done |
| 2 | [Production settings: rate limits and trusted proxy](task-2-production-settings.md) | strong (2A local) | 1 | 2A 2B | done |
| 3 | [Mail links and the verify and reset screens](task-3-mail-links.md) | strong | 1 | 3A 3B 3C | done |
| 4 | [Backups and a tested restore](task-4-backups-restore.md) | strong | 2 | 4A 4B | done |
| 5 | [The disk-usage warning](task-5-storage-warning.md) | mid (5A local) | 2 | 5A 5B | done |
| 6 | [Deployment guide, the walk on the VM and close-out](task-6-guide-closeout.md) | mid | 1 to 5 | 6A 6B 6C | done |

**Status values:** `not started`, `in progress`, `awaiting review`, `done`. Run tasks one at a time (implementers never run in parallel). Tasks 3 and 4 do not depend on each other and may be taken in either order.

Names and signatures shared between tasks are in each task file's **Interfaces** block. If a task needs something its Interfaces block does not list, stop and report it; do not guess.

**Closing a checkpoint** follows the Plan 1 router, "Rules while working". Replace its `<date>-foundation` with `2026-11-20-deployment`.

## Done when

- `npm test` passes on a clean clone with Docker running, with no existing test changed, and `npm run check:task` passed for every task (output in the reports).
- Every row above says `done`, no step box is unticked, `git status` is clean.
- The developer has run Task 6's Flow on the VM: the public address serves the app, the admin paths are 404 there, a real verification and reset mail arrive (M10, M11), the reconnect check passes behind Funnel (M12), and a restore was walked once.
- [test-plan.md](../../../test-plan.md) has a `covered` row "Deployment (proxy, headers, rate limits, backups and restore, storage warning)"; security.md no longer marks the rate limiter, the trusted proxy, the headers check or backups **(planned)**; runbook control 8 is written.
- The roadmap marks Plan 6 `done`. A whole-branch review of `feat/deployment` is complete and the developer has reviewed the branch. Agents do not merge or push.
