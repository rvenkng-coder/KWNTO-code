# Maintaining KWNTO by hand

For the day you are on your own, with no AI agent: how to get oriented, the commands you need, where to look when something breaks, and what you can safely ignore. The system map is in [architecture.md](architecture.md).

## Read in this order

1. [Design](../superpowers/specs/2026-11-11-kwnto-design.md) (what the product does) and the [ERD](../superpowers/specs/2026-11-11-kwnto-erd.md) (the data).
2. [architecture.md](architecture.md): the running system and the three code layers.
3. [Engineering principles](../engineering.md) and [security rules](../security.md): the rules every change follows.
4. A small, self-contained feature as a worked example: `frontend/src/features/player/` (a pure model in `story.ts` and `session.ts`, a screen, two entry points, tests beside them).
5. [backend.md](backend.md): collections, hooks, guarded writes, the door.
6. Last, and only when you must: the editor's save and offline machinery in [editor.md](editor.md#how-an-edit-travels) (`store/`, `sync/`). It is the hardest part. Keep [decision 0002](../decisions/0002-realtime-spike.md) open beside it; it says why every write carries a version.

## Commands you will use

| I want to | Run |
|---|---|
| Set up a fresh checkout | `npm install` (also sets the git hook that scans commits for secrets), copy `.env.example` to `.env` and fill the admin login ([getting-started](getting-started.md)) |
| Start the app for development | `npm run dev:backend` in one terminal, `npm run dev` in another; open `http://localhost:5173` |
| Run everything the CI runs | `npm test` (lint, typecheck, unit, container, rules, e2e; the last two start their own throwaway PocketBase in Docker) |
| Run only the fast checks | `npm run lint`, `npm run typecheck`, `npm run test:unit` |
| Run one unit test file | `npx vitest run frontend/src/features/player/session.test.ts` |
| Run one end-to-end spec | `npm run test:e2e -- e2e/player.spec.ts --project chromium` (drop `--project` for both browsers) |
| Run the access-rule tests | `npm run test:rules` |
| Read why an e2e test failed | `test-results/<test>/error-context.md` has the page as text at the moment of failure |

The tests use their own ports and containers (`kwnto-test`, ports 8091, 5174 and 5175), so they can run while your dev backend is up. If a run stops with "port 5174 is already used", a web server from an interrupted run is still there: stop it first.

## Making a change by hand

The full procedure, with a worked example of each kind of test, what each CI job needs and where the documentation goes, is in [workflow.md](workflow.md). In short:

1. Work on a branch; never commit to `main`. The CI (`backend`, `checks`, `e2e`, `e2e-performance`, `secrets`) runs on every pull request and on pushes to `main`; `e2e` is split over four runners.
2. Write the failing test first (a unit test for logic, a rule test for access, an e2e spec for a screen), watch it fail for the right reason, then make it pass. Never edit a test just to make it pass.
3. Keep the rules: only the door imports PocketBase; 300 lines per file; no `any`; no new dependency without a decision record in `docs/decisions/`.
4. Update the docs for anything a person or the next maintainer would see: the user guides in `docs/user/`, the developer notes, the test plan row in `docs/test-plan.md` (which file for what: [workflow.md section 6](workflow.md#6-where-the-documentation-goes)).
5. Run `npm test`. Fix what it finds. Then open the pull request; the template in `.github/` has the checklist.
6. After it merges, deploy (below), then look at the site.

## Production, in short

Everything is in [docs/admin/deployment.md](../admin/deployment.md). The commands live in the repository folder on the VM.

| I want to | Do |
|---|---|
| Deploy what is on `main` | `deploy/update.sh`. It asks for the admin login, makes a backup, fast-forwards, rebuilds and waits until it is healthy. It prints the rollback commands if something fails |
| Back up now | `deploy/backup-now.sh` (see "Make a backup now" in the guide). The nightly backup also runs at 02:00 UTC and keeps 7. They sit on the VM's own disk, so copy them elsewhere regularly |
| Restore | `deploy/restore.sh <file>`. It replaces **everything** with that backup |
| See what is running | `docker compose -f compose.prod.yaml ps` (the `web` container exiting with code 0 is normal) |
| Read logs | `docker compose -f compose.prod.yaml logs <service> --tail 100` with `pocketbase`, `caddy`, `tailscale` or `web` |
| Open the admin dashboard | From a device on the tailnet: `https://<host>:8443/_/`. The security log is the `security_events` collection |
| Check the site is not exposing admin | The five `curl` lines in "Check it" in the guide; each must print `404` on the public address |

After a deploy, check three things: `docker compose ... ps` shows `pocketbase` and `caddy` healthy, the public address loads the sign-in page, and the admin paths still answer `404`.

## When something goes wrong, look here

| Symptom | Look at |
|---|---|
| Someone cannot sign in | `security_events` in the dashboard; [security.md](../security.md) section 3 (lockout) and section 9 (incident controls: sign one person out, block, lockdown) |
| Mail does not arrive, or links in mails go to the wrong address | The two matching entries in the deployment guide's Troubleshooting. Mail links come from Application URL in the dashboard, which must match the live hostname in `KWNTO_PUBLIC_URL` |
| The public address does not load | Deployment guide, Troubleshooting ("Funnel not reachable"); `docker compose ... logs tailscale` |
| Edits seem lost, "1 change could not be saved", or a "Someone else changed this" dialog | [editor.md](editor.md#how-an-edit-travels) (the outbox, the failed list, conflicts); the files in `frontend/src/features/editor/sync/` |
| An upload is refused | `backend/pb_hooks/media.pb.js`; the limits are settings in `system_storage` ([settings.md](../admin/settings.md)) |
| A share link says "not valid" | Revoked or wrong token: `share.pb.js`, `docs/developer/backend.md` (share links); the link list in the Share dialog |
| A deploy failed | `update.sh` printed the old commit and the rollback and restore commands; run them only if the data is damaged |
| The disk is filling | Deployment guide, "When the disk fills" |

## What you can ignore

Most of this repository's size is the scaffolding built for AI agents. You do not need it to work by hand:

- `docs/superpowers/plans/` and `.planning/`: the plans and progress logs of past work. Read one only to learn why something was built a certain way.
- `tests/probes/`, and the `check:task`, `check:breaks`, `check:probes`, `check:plan`, `prepare-local-run` and `report:*` scripts, plus `.pi/skills/`, `.claude/skills/` and the local-model docs. They exist for the agent workflow. (`npm run lint` still runs `check:plan` over the existing plan files; that is harmless.)
- `AGENTS.md` is a good one-page summary of the rules and layout even if you never use an agent.

Keep: `npm test`, `npm run lint`, the pre-commit secret scan, the CI, and the test suite itself, which is the best description of what must keep working.

## Known loose ends

- **Issue 26:** in busy full e2e runs Firefox sometimes holds a project on "Loading project…" for 5 seconds or more while the live connection is set up. The shared test steps wait 15 seconds to tolerate it; the cause is not found. If an e2e test fails once in Firefox at a setup step, run that spec again before assuming a real bug.
- **Keep dependencies current:** Dependabot (`.github/dependabot.yml`) opens a monthly pull request for npm and GitHub Actions updates; the CI tests each one, so review and merge them like your own. It deliberately skips the PocketBase JS client. Still manual, once a month: the Docker image digests pinned in `compose.prod.yaml` and `backend/Dockerfile` (bump them as the deployment guide describes, "Updating"), the PocketBase server version ([backend.md](backend.md), "Pinned version and how to bump it") and `npm audit`.
- **Backups off the VM:** the nightly backups share the VM's disk. Copy them to another machine on a schedule, and restore one on a quiet day to prove it works (see the next section).

## Set up once (things that live outside the repository)

None of these can be done from the code. Do them once, on a quiet day, and tick them off:

- [ ] **Keep an access list somewhere safe, not in the repository:** the VM login, the contents of the production `.env` (admin email and password, the mail app password, the Tailscale key), your GitHub access and your Tailscale admin login. Without them the system cannot be reached.
- [ ] **Get an alert when it is down.** Nothing tells you if the site or the disk fails: the storage warning only goes to the security log, and by email only if outgoing mail is set up. Point a free uptime monitor at `<your public address>/api/health` (it answers `200` when healthy) and have it email you.
- [ ] **Copy the backups off the VM on a schedule** (the deployment guide has an `rsync` example under "Copy backups off the VM"). A backup holds the admin password hash and every upload, so store the copies like a secret.
- [ ] **Restore one backup to prove it works,** on a test VM or on a day with no users ("Restore on the same VM" in the deployment guide). A backup you have never restored is a guess.
- [ ] **Rehearse the rollback once.** `deploy/update.sh` prints the commands that go back to the previous version (`git reset --keep <old commit>`, then a rebuild) and the `deploy/restore.sh` command for damaged data. Run them once on a quiet day so you know them before you need them.
- [ ] **Make the public address match.** `KWNTO_PUBLIC_URL` in `.env` and Application URL in the PocketBase dashboard must be the address the site is really on. Tailscale can rename a device when names clash (a `-1` or `-2` appears), and a stale address makes links in emails point to the wrong place (deployment guide, Troubleshooting).
- [ ] **Know which admin password is current.** `deploy/update.sh` asks for the admin email and password for its backup step. Give it the ones you use in the dashboard: `.env` holds the first-run values, and a password changed later is not written back. A wrong one fails the backup with `Failed to authenticate`, and the update stops before it changes anything. If you have lost the password, [backend.md](backend.md#how-the-admin-is-created) shows how to set a new one.
