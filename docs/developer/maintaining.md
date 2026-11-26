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

1. Work on a branch; never commit to `main`. The CI (`backend`, `checks`, `e2e`, `secrets`) runs on every pull request and on pushes to `main`; the full e2e job takes about half an hour.
2. Write the failing test first (a unit test for logic, a rule test for access, an e2e spec for a screen), watch it fail for the right reason, then make it pass. Never edit a test just to make it pass.
3. Keep the rules: only the door imports PocketBase; 300 lines per file; no `any`; no new dependency without a decision record in `docs/decisions/`.
4. Update the docs for anything a person or the next maintainer would see: the user guides in `docs/user/`, the developer notes, the test plan row in `docs/test-plan.md`.
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
- **Keep dependencies current:** the Docker images are pinned by digest. Once a month check for newer ones, bump them as the deployment guide describes ("Updating"), and run `npm audit`. PocketBase's own bump procedure is in [backend.md](backend.md) ("Pinned version and how to bump it").
- **Backups off the VM:** the nightly backups share the VM's disk. Copy them to another machine on a schedule, and restore one on a quiet day to prove it works.
