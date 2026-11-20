# Task 6: Deployment guide, the walk on the VM and close-out

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid
**Depends on:** Tasks 1 to 5

Design 7b and 8: deployment instructions are a deliverable, and real-time must be tested through Funnel before relying on it. This task writes the guide, then the **developer** follows it on the real VM, and the walk is recorded. Every step marked **(developer)** touches the real server, a Tailscale account or a mailbox (engineering 5): an agent may only prepare the commands and record what the developer reports.

**Files:**
- Create: `docs/admin/deployment.md`
- Modify: `docs/README.md` (link it), `README.md` (one "Deploying" line linking it), `docs/security.md` (section 3: SMTP is set up per the guide; section 6: the dashboard check is in the guide; section 10: the unknown-email timing line of D14, and the D6 Funnel result), `docs/test-plan.md` (the new Deployment row; M10, M11, M12 status), `docs/superpowers/plans/README.md` (Plan 6 `done`; the Plan 2, 4 and 5 carry-overs ticked or moved; a "Carried over from Plan 6" table for anything left out, at least D13's result), `.planning/2026-11-20-deployment/progress.md`

**Interfaces:**
- Consumes: everything Tasks 1 to 5 produce; the runbook form of security.md section 9.
- Produces: `docs/admin/deployment.md` with these sections, in order: **What you need** (a Proxmox VM with Docker Engine and the Compose plugin, git, a Tailscale account with MagicDNS, HTTPS certificates and Funnel enabled, a Gmail account with 2-step verification); **First run** (clone; `cp .env.example .env`; fill each value, with what it is and where it comes from, `TS_AUTHKEY` a reusable-off, pre-approved auth key tagged `tag:kwnto`; the Tailscale access-policy lines that allow Funnel for `tag:kwnto`; `docker compose -f compose.prod.yaml up -d --build`; how long the first build takes); **Check it** (the public URL loads; the five `curl` lines that must print `404` for `/_/`, `/api/settings`, `/api/kwnto/admin/sign-out-all`, `/api/collections/_superusers/auth-with-password`, `/api/backups`; the dashboard on `https://<host>:8443/_/` from a tailnet device; the default settings rows exist); **Mail (Gmail app password)** (create the app password; the dashboard's Settings, Mail settings fields: host `smtp.gmail.com`, port `587`, TLS off with STARTTLS (as PocketBase labels it), username, the app password, sender name `KWNTO` and address; "Send test email"; Gmail's daily limit is about 500 mails; if mail is down the admin resets passwords by hand, runbook control 7); **Admin access over the tailnet**; **Rate limits and the trusted proxy** (what D7 and D6 set, where to change them in the dashboard); **Backups** (D10: schedule and keep count in the dashboard's Settings, Backups; the host folder; copy it off the VM; `deploy/backup-now.sh`); **Restore** (link to runbook control 8); **Updating** (`git pull`, `docker compose ... up -d --build`; data and settings survive, a container test pins it; image digests per decision 0004, monthly); **When the disk fills** (the storage warning of Task 5; `df -h`; the Proxmox disk; what can be cleared: old backups in the host folder, nothing inside the data volume by hand); **Closing sign-up** (runbook control 5); **Troubleshooting** (`docker compose logs <service>`; Funnel not reachable; mail not arriving: the dashboard Logs).

**If interrupted:** a half-done walk is recorded as far as it went in `progress.md`; resume at the first unrecorded step.

## Checkpoint 6A: The guide

- [ ] **Step 1: Write `docs/admin/deployment.md`** with the sections above. Every command is copy-pasteable and every value says where it comes from. No secret, real hostname or email appears in it (use `kwnto.example.ts.net`, `admin@example.com`).
- [ ] **Step 2: Run** `npm run check:docs`. Expected: PASS. **Close checkpoint 6A** (commit `docs: deployment guide`).

## Checkpoint 6B: The walk on the VM (developer)

- [ ] **Step 3 (developer):** follow the guide from an empty VM folder, word for word, and note every place it was wrong or unclear; fix the guide for each (commit `docs: deployment guide fixes from the first run`).
- [ ] **Step 4 (developer):** run the Flow below and record each case's result in `progress.md` with the date and browser.
- [ ] **Step 5:** update security.md, test-plan.md (M10, M11, M12 `done <date>` or `open` with what failed) from the record. If C4 found that Funnel does not pass the visitor's IP, write the known gap in security.md section 10 and a roadmap item. If C3 took over 3 minutes or failed, add D13's roadmap item. **Close checkpoint 6B** (commit `docs: deployment walked on the VM`).

## Checkpoint 6C: Close-out

- [ ] **Step 6: Update the roadmap** (Plan 6 `done`; the carried items from Plans 2, 4 and 5 marked done with the case that showed it, or moved with a reason). Add the test-plan row `Deployment (proxy, headers, rate limits, backups and restore, storage warning) | 7b, 7c | container, rules, unit, manual | covered | 6`.
- [ ] **Step 7: Run** `npm test` and `npm run check:docs`. Expected: PASS. **Close checkpoint 6C** (commit `docs: close the deployment plan`). The whole-branch review follows; it is not part of this task.

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | admin paths hidden in real life | manual | the guide's five `curl` lines from a phone off the tailnet; the dashboard from a tailnet laptop | five `404`; the dashboard signs in on `:8443` | |
| C2 | the app works through Funnel | manual | sign up from a device off the tailnet, in Firefox and Chrome, with the console open; verify, create a team, project and node, upload an image | every step works; no CSP violation | |
| C3 | a large upload through Funnel | manual | a 150 MB MP4 from a device off the tailnet | uploaded and playable; time noted; over 3 minutes or failed means D13's follow-up | |
| C4 | the visitor's IP reaches PocketBase | manual | one wrong sign-in from a phone on mobile data; read its `failure` entry in `security_events` | `ip` is the phone's public IP, not `172.30.0.2` or a Tailscale address (if not: the D6 known gap) | |
| C5 | real mail (M10, M11) | manual | sign up with a real address; ask for a reset typed with capitals (`Someone@Example.com`) | the verification mail arrives and its link shows the Task 3 success copy; the reset mail arrives and sets a password that then signs in | |
| C6 | reconnect behind public Funnel (M12) | manual | two laptops off the tailnet on one project; drop one laptop's network for 10 s while the other edits | the teammate's edit appears within a few seconds without a reload; edits made during the drop are saved | |
| C7 | restore on the VM | manual | `deploy/backup-now.sh`; make a throwaway project; `deploy/restore.sh` with that backup | the throwaway project is gone, everything older is there, the dashboard signs in | |
### Probes
**Probe folder:** none
### Breaks
none
### Flow
C1 to C7 in that order on the VM, by the developer, recorded in `progress.md` with date, browser and device for each.
### Evidence
The full output of `npm run check:task`, the `progress.md` record of the walk, and the list of guide fixes from Step 3.
