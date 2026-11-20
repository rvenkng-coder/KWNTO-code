# Deploying KWNTO

How to run KWNTO for real users on one Proxmox VM: PocketBase serves the app and the API, Caddy in front blocks every admin path and adds security headers, and Tailscale Funnel publishes it over HTTPS. The design is in [design section 7b](../superpowers/specs/2026-11-11-kwnto-design.md); the stack is described in [backend.md](../developer/backend.md#the-production-stack); what to do when something is wrong is the [incident runbook](../security.md#9-if-you-suspect-a-compromise-the-incident-runbook).

Examples use `kwnto.example.ts.net` for the public address and `admin@example.com` for the admin email. Replace them with yours. Nothing secret belongs in this file or in git.

## What you need

- A Proxmox VM running Linux with **Docker Engine and the Docker Compose plugin** (`docker compose version` prints a version) and **git**. The VM needs no Node or Go: the app is built inside a container.
- A **Tailscale account** with MagicDNS, HTTPS certificates and Funnel turned on (Tailscale admin console, DNS page for the first two; the access policy below for Funnel).
- A **Gmail account with 2-step verification** on, for outgoing mail (verification and password-reset mails). Without it the app works but those mails are not sent (see "Mail").
- Free disk space: the images, the built app and the uploaded media. The default storage warning is at 20 GB of uploads (see "When the disk fills").

## Getting the code onto the VM

The repository is private, so the VM needs a way to read it. It needs only the files, not the history: the build ignores `.git`. Pick one.

**A. Read-only deploy key (best for a VM you keep).** Run on the VM:

```sh
ssh-keygen -t ed25519 -f ~/.ssh/kwnto_deploy -N "" -C "kwnto-deploy@<vm name>"
printf 'Host github.com\n  IdentityFile ~/.ssh/kwnto_deploy\n  IdentitiesOnly yes\n' >> ~/.ssh/config
ssh-keyscan -t ed25519 github.com >> ~/.ssh/known_hosts
cat ~/.ssh/kwnto_deploy.pub
```

Copy the line `cat` prints. In GitHub open the repository, Settings, Deploy keys, Add deploy key (only a repository admin sees this page). Give it a title, paste the line and leave **Allow write access** off. Then check it and clone:

```sh
ssh -T git@github.com        # "Hi <owner>/<repo>! You've successfully authenticated, but GitHub does not provide shell access."
git clone git@github.com:<owner>/<repo>.git kwnto
```

`git pull` in that folder later updates it (see Updating). The private key never leaves the VM and never goes into the repository.

**B. Fine-grained access token.** In GitHub, Settings, Developer settings, Personal access tokens, Fine-grained tokens: choose this repository only and read-only **Contents**. Run `git clone https://github.com/<owner>/<repo>.git kwnto` and paste the token when it asks for the password. Do not put the token in the clone address, because it would stay in your shell history and in `.git/config`.

**C. Copy the files, no GitHub access from the VM.** On your own machine, in the repository, run `git archive --format=tar.gz -o kwnto.tar.gz <branch>`, then `scp kwnto.tar.gz <user>@<vm address>:`, and on the VM `mkdir kwnto && tar -xzf kwnto.tar.gz -C kwnto`. To update, send a new archive and unpack it over the folder (keep `.env`, `backups/` and the Docker volumes; they are not in the archive). There is no `git pull` with this option, so "Updating" below starts from the unpack step.

Whichever you pick, step 4 of First run continues from the folder `kwnto`.

## Set up Tailscale and Funnel

Funnel is what makes the app reachable from the internet. You do not install Tailscale on the VM itself: the `tailscale` container in `compose.prod.yaml` joins your tailnet as its own machine (named `TS_HOSTNAME`, default `kwnto`) and publishes Caddy through Funnel. What you set up here is the account side: the tailnet, the permission for Funnel, and an auth key. The VM only needs `/dev/net/tun` (`ls -l /dev/net/tun`); if it is missing, see the `TS_USERSPACE` fallback under First run.

Funnel has fixed rules that this setup relies on: it serves only ports 443, 8443 and 10000, and only over HTTPS with a `*.ts.net` name. KWNTO publishes port 443 through Funnel (the app) and keeps port 8443 (the admin dashboard) inside your tailnet.

1. **A tailnet.** Sign in at <https://login.tailscale.com> (a personal account is enough). Install Tailscale on the laptop or phone you will use to reach the admin dashboard, and sign in to the same tailnet, so that device can open `https://<host>:8443/_/` later.
2. **MagicDNS and HTTPS certificates.** In the admin console open the DNS page. Make sure **MagicDNS** is on, then under **HTTPS Certificates** press **Enable HTTPS**. Note the **tailnet name** shown there (for example `tail1234.ts.net`). Enabling HTTPS publishes your machine names in a public certificate log; use a machine name that does not reveal anything private (`kwnto` is fine).
3. **Tag and Funnel permission.** Open Access controls. Merge these two entries into your policy file (do not replace the file). The first lets you tag the machine, the second lets that tag use Funnel:

   ```json
   "tagOwners": {
     "tag:kwnto": ["autogroup:admin"]
   },
   "nodeAttrs": [
     {"target": ["tag:kwnto"], "attr": ["funnel"]}
   ]
   ```

   Save. A policy with an error is refused with a message; fix it there. If your policy already has a `nodeAttrs` list, add the one object to it instead of making a second list.
4. **Auth key.** Settings, Keys, Generate auth key: **Reusable off**, **Tags** `tag:kwnto`, a short expiry, and leave **Ephemeral** off (an ephemeral machine disappears when it goes offline). Copy the key (it starts with `tskey-auth-`); it is shown once. It is only used the first time the container joins; the container's login is then kept in the `kwnto-tailscale` volume, so the key can expire afterwards. Put it in `.env` as `TS_AUTHKEY` (First run, step 4) and nowhere else.
5. **Your public address.** It is `https://<TS_HOSTNAME>.<tailnet name>`. With `TS_HOSTNAME=kwnto` and the tailnet name `tail1234.ts.net` that is `https://kwnto.tail1234.ts.net`. **Check first that no machine called `kwnto` already exists** in the Machines page: if one does, the new container is named `kwnto-1` and the address you wrote in `KWNTO_PUBLIC_URL` is wrong. Remove the old machine (its menu, Delete) or pick another `TS_HOSTNAME`.

### Check it after the first start

Run these on the VM, in the folder `kwnto`, once `docker compose -f compose.prod.yaml up -d --build` has finished:

```sh
docker compose -f compose.prod.yaml exec tailscale tailscale status
docker compose -f compose.prod.yaml exec tailscale tailscale serve status
```

- `tailscale status` should list the machine as connected, and the admin console's Machines page should show it with the tag `tag:kwnto`.
- (The exact wording of these outputs differs between Tailscale versions, and this section has not yet been walked on the real VM.) `tailscale serve status` should show `https://<host>` (Funnel **on**) proxying to `http://caddy:8080` and `https://<host>:8443` (tailnet only) proxying to `http://pocketbase:8090`.
- From a device that is **not** on your tailnet (a phone on mobile data with Tailscale off), open `https://<host>`: the sign-in screen loads. The first time can take a minute or two while the HTTPS certificate is issued and the public DNS name spreads; wait before you assume it is broken.
- From a device that **is** on your tailnet, `https://<host>:8443/_/` shows the admin dashboard sign-in. From the phone off the tailnet, the same address must not answer.

If a step fails, see "Troubleshooting": the usual causes are an expired or reused auth key, Funnel not allowed for the tag (part 3), HTTPS certificates not enabled (part 2) and a hostname that became `kwnto-1` (part 5). After changing the policy or the key, `docker compose -f compose.prod.yaml logs tailscale` says what Tailscale thinks. If the key was wrong, make a new one, put it in `.env`, then `docker compose -f compose.prod.yaml down`, remove the volume `kwnto-tailscale` (and only that one: `docker volume ls`, the name ends in `kwnto-tailscale`) and `up -d` again.

## First run

1. **Tailscale access policy.** Done in [Set up Tailscale and Funnel](#set-up-tailscale-and-funnel), part 3 (the tag and the Funnel permission).
2. **Auth key.** Part 4 of the same section. You need the key (`tskey-auth-...`) for `TS_AUTHKEY` below.
3. **Your public address.** Part 5 of the same section. You need it for `KWNTO_PUBLIC_URL` below, because PocketBase writes it into its settings on its first start.
4. **Clone and fill `.env`:**

   ```sh
   # the code is already in the folder "kwnto" (see "Getting the code onto the VM")
   cd kwnto
   cp .env.example .env
   mkdir -p backups && sudo chown 10001:10001 backups
   ```

   The `backups` folder must exist and belong to user 10001 (the user PocketBase runs as) **before** the first start. Otherwise Docker creates it owned by root and the scheduled backups fail. Edit `.env`:

   | Value | What it is and where it comes from |
   |---|---|
   | `KWNTO_ADMIN_EMAIL` | The admin (dashboard) account, for example `admin@example.com`. You choose it. |
   | `KWNTO_ADMIN_PASSWORD` | The admin password, at least 10 characters. You choose it; keep it in a password manager. |
   | `KWNTO_PRODUCTION` | `1`. **Required on the VM**: it switches on the production settings (rate limits, trusted proxy, app address, backup schedule). Without it none of them is written. |
   | `KWNTO_PUBLIC_URL` | The address from step 3, starting with `https://`, for example `https://kwnto.example.ts.net`. A trailing slash is removed. The container refuses to start (exit 64) without it. |
   | `KWNTO_MAX_REQUEST_MB` | Largest upload body Caddy accepts, in MB. Leave empty for 1024. |
   | `KWNTO_BACKUP_DIR` | The host folder for backups. Leave empty for `./backups`; or a NAS mount, created and owned as above. |
   | `TS_AUTHKEY` | The key from step 2 (Set up Tailscale and Funnel, part 4). |
   | `TS_HOSTNAME` | The machine name in your tailnet, for example `kwnto`. Empty means `kwnto`. |

   `.env` is never committed. Protect it like a password (`chmod 600 .env`).

5. **Start it:**

   ```sh
   docker compose -f compose.prod.yaml up -d --build
   ```

   The first start builds the PocketBase image, downloads the Node, Caddy and Tailscale images and builds the web app with `npm ci`. Expect several minutes on a first run (not yet timed on the real VM); later starts take seconds. Watch it with `docker compose -f compose.prod.yaml ps`; the `web` service exits with `Exited (0)` when the build is done, which is normal.

   If the VM has no `/dev/net/tun`, `tailscale` fails to start. Then in `compose.prod.yaml` replace the `devices` lines of the `tailscale` service with `TS_USERSPACE: "true"` under `environment` (this fallback is not tested here).

**The production settings are written only once.** Migrations run once per data folder, so `KWNTO_PRODUCTION` and `KWNTO_PUBLIC_URL` count only on the **first start of an empty data volume**. If you started the app first without them, editing `.env` and restarting changes nothing. Two remedies:

- **Set them by hand in the dashboard** (always works; see "Admin access" to open it): Settings, Application: *Application URL* = your public address; *User IP proxy headers* = `X-Forwarded-For`, with the leftmost-IP option off; Settings, Application, *Rate limiting*: on, with the rules in "Rate limits"; Settings, Backups: the schedule and keep count in "Backups".
- **If the install holds nothing you need yet**, start over: `docker compose -f compose.prod.yaml down`, then remove the data volume (find its name with `docker volume ls`; it ends in `kwnto-data`, for example `docker volume rm kwnto_kwnto-data`), fix `.env`, and run step 5 again. This deletes every account and project in it. It is not run against a real volume by the tests; do it only on an empty install.

## Check it

From a phone **off the tailnet** (mobile data), or any machine that is not on your tailnet:

1. Open `https://kwnto.example.ts.net`. The sign-in screen loads.
2. The admin paths must be hidden. Each line must print `404`:

   ```sh
   URL=https://kwnto.example.ts.net
   curl -s -o /dev/null -w '%{http_code}\n' "$URL/_/"
   curl -s -o /dev/null -w '%{http_code}\n' "$URL/api/settings"
   curl -s -o /dev/null -w '%{http_code}\n' -X POST "$URL/api/kwnto/admin/sign-out-all"
   curl -s -o /dev/null -w '%{http_code}\n' -X POST "$URL/api/collections/_superusers/auth-with-password"
   curl -s -o /dev/null -w '%{http_code}\n' "$URL/api/backups"
   ```

   If any line prints something else, stop: the admin is exposed. Do not share the address; read "Troubleshooting".
3. From a device **on the tailnet** open `https://kwnto.example.ts.net:8443/_/` and sign in with `KWNTO_ADMIN_EMAIL` and `KWNTO_ADMIN_PASSWORD`. See "Admin access".
4. In the dashboard, Collections: `system_access`, `system_storage` and `system_behavior` each have one record (the defaults, [settings.md](settings.md)). Settings, Application shows your public address; Settings, Backups shows the cron `0 2 * * *` and keep `7`.

## Mail (Gmail app password)

PocketBase sends the verification and reset mails. The mail account is set in the dashboard, never in a file.

1. In the Google account, with 2-step verification on, open App passwords (myaccount.google.com, Security) and create one named `KWNTO`. Copy the 16 characters; they are shown once.
2. In the dashboard open Settings, Mail settings, turn on **Use SMTP mail server** and fill:

   | Field | Value |
   |---|---|
   | Sender name | `KWNTO` |
   | Sender address | the Gmail address (Gmail rewrites a different one) |
   | SMTP server host | `smtp.gmail.com` |
   | Port | `587` |
   | Username | the full Gmail address |
   | Password | the app password |
   | TLS encryption | off (PocketBase's label; port 587 then uses STARTTLS) |

   Save, then press **Send test email** and open the mail in your inbox.
3. Gmail limits a free account to about 500 mails a day; that is plenty for a class but a mass sign-up could hit it.
4. **If mail is down** (wrong password, Gmail refuses, limit reached), the app still answers as usual but no mail goes out. People cannot verify or reset by themselves; reset a password by hand ([runbook control 7](../security.md#7-reset-a-password-by-hand)) and add a verified account in the dashboard if needed. The dashboard's Logs show `Failed to send ...` lines.

## Admin access over the tailnet

The dashboard and admin API are **only** on `https://kwnto.example.ts.net:8443/_/`, reachable from devices on your tailnet. The public address (port 443) blocks them, and Funnel is switched on for 443 only (`deploy/tailscale-serve.json`). To work as admin, join the tailnet on your laptop, then open that address. The same address (without `/_/`) is the private API the scripts use; `deploy/backup-now.sh` runs on the VM against the container's own address instead (see "Backups").

## Rate limits and the trusted proxy

The first start of an empty volume with `KWNTO_PRODUCTION=1` writes these (admin edits afterwards are kept):

- **Rate limits** (PocketBase's built-in limiter): `*:auth` 2 requests per 3 seconds (stops parallel password guesses that would beat the lockout); `/api/kwnto/teams/` 10 per 60 seconds (join, invites, new join code); `/api/` 300 per 10 seconds. Change them in the dashboard: Settings, Application, Rate limiting, Manage rules.
- **Trusted proxy:** PocketBase takes the visitor's address from `X-Forwarded-For`. Caddy overwrites that header with the address it saw and believes a forwarded value only from the Tailscale container (`172.30.0.2` on the network `kwnto-edge`), so a visitor cannot invent an address. Where: Settings, Application, *User IP proxy headers*.
- **Known gap, to confirm on the VM:** whether Funnel passes the visitor's real address is not confirmed until the first walk (case C4 below). If it does not, every public visitor looks like one address and the per-address limits act on everybody together. The fallback is Cloudflare Tunnel ([security.md section 10](../security.md#10-accepted-risks-and-what-to-revisit-before-going-public)).

## Backups

- PocketBase makes a backup **every day at 02:00 UTC** and keeps the last **7**. Change the schedule and the keep count in the dashboard: Settings, Backups.
- A backup is a zip in the host folder `KWNTO_BACKUP_DIR` (default `./backups`). It holds the database, the uploaded media files and the admin account, so **protect it like a secret**. The folder must exist and be writable by user 10001 (`mkdir -p backups && sudo chown 10001:10001 backups`), or scheduled backups fail.
- **Copy the folder off the VM** (another machine, a NAS, a cloud drive), for example `rsync -a ./backups/ user@other-host:/safe/kwnto-backups/`. A backup on the same disk does not survive the disk.
- **Make one now:**

  ```sh
  PB_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' $(docker compose -f compose.prod.yaml ps -q pocketbase))
  PB=http://$PB_IP:8090 deploy/backup-now.sh
  ```

  `PB` is PocketBase's address on the compose network (nothing is published on the VM, so the first line looks it up; from the VM's own shell that address is reachable). When the script waits, type the admin email and press Enter, then the password and press Enter (two lines; the password is not echoed and never appears on a command line, so it stays out of your shell history). It prints `Backup written: manual_<yyyymmdd_hhmmss>.zip` (UTC time). Two backups within one second get the same name and the second fails: wait a second.

## Restore

The full procedure, with what it checks and what to do when it fails, is [runbook control 8](../security.md#8-restore-from-a-backup). In short, from the repository folder:

```sh
deploy/restore.sh ./backups/<file>.zip
```

- **The script finds the data volume itself** (Docker names it after the folder, for example `kwnto_kwnto-data`) and shows it on a line `Data volume to be replaced: <name>` before it asks you to type `RESTORE`; check that it is the volume you expect. If it cannot find it (the stack is not created, or the data is not a named volume) it stops with exit 1 and tells you to set `KWNTO_DATA_VOLUME` to the volume's name.
- A backup that is cut off or empty is refused before anything is touched: `Backup is damaged: <file>` (exit 2). If it prints `Could not check the backup (...)` (exit 1) the file may be fine: check that Docker runs and make the file readable (`chmod 644 <file>`), then run it again.
- A restore replaces **everything** with the state at the backup, including the admin password from that time.

## Updating

1. Make a backup first, as in [Backups](#backups) (`PB=http://$PB_IP:8090 deploy/backup-now.sh`).
2. Update (with option C of "Getting the code onto the VM", unpack the new archive instead of `git pull`):

```sh
git pull
docker compose -f compose.prod.yaml up -d --build --force-recreate
```

`--force-recreate` makes the `web` service build the new app again; accounts, projects, media and the settings you changed live in volumes and survive (a container test pins that data and settings survive an update). The image digests in `compose.prod.yaml` and `backend/Dockerfile` are pinned ([decision 0004](../decisions/0004-deployment-images.md)): once a month check for newer versions, change the digest and the comment next to it, rebuild and run `npm run test:container` on a development machine before deploying.

## When the disk fills

- The app warns you before the uploads fill the disk: when all uploaded files pass `system_storage.total_warning_bytes` (default 20 GB), an hourly job writes a `storage` entry to the security log and, if mail is set up, mails every admin account (at most one a day). Change the limit or turn it off with `0` in [settings.md](settings.md#system_storage).
- It counts uploaded files only. The VM's own free space is out of its reach: check it now and then with `df -h` (and `docker system df`) and in the Proxmox dashboard. If the disk is nearly full, grow the VM's disk in Proxmox and then its filesystem.
- **What may be cleared:** old backups in the host folder (after copying them off). Prune unused images with `docker image prune`. **Do not touch anything inside the data volume by hand**; to reduce uploads, delete the media in the app or the dashboard.

## Closing sign-up

If unwanted accounts appear, turn off `registration_open` ([runbook control 5](../security.md#5-close-sign-up)). People already registered still sign in.

## Troubleshooting

- **Logs:** `docker compose -f compose.prod.yaml logs <service>` with `web`, `pocketbase`, `caddy` or `tailscale`. Add `--tail 100 -f` to follow.
- **`pocketbase` exits at once:** the log says `KWNTO_ADMIN_EMAIL and KWNTO_ADMIN_PASSWORD must be set`, `... at least 10 characters` or `KWNTO_PUBLIC_URL must be set when KWNTO_PRODUCTION=1` (exit 64): fix `.env` and run the start command again.
- **Backups do not appear:** the host folder is owned by root. `sudo chown 10001:10001 backups`, then check Logs in the dashboard for the `backup` entries.
- **The public address does not load (Funnel not reachable):** `docker compose -f compose.prod.yaml logs tailscale` (look for an expired or rejected auth key: make a new one, put it in `.env`, and recreate with `docker compose -f compose.prod.yaml up -d --force-recreate tailscale`); check that the access policy of "First run" step 1 is saved, that HTTPS certificates and Funnel are on for the tailnet, and `docker compose -f compose.prod.yaml exec tailscale tailscale serve status` shows `Funnel on` for port 443.
- **The dashboard on 8443 does not load:** you must be on the tailnet; check the same `serve status` output.
- **A page loads blank:** the `web` build failed: `docker compose -f compose.prod.yaml logs web`.
- **Mail does not arrive:** the dashboard's Logs (filter for `mail` or `email`) show `Failed to send` with the reason; check the app password, the port and the "Send test email" result, look in the spam folder, and remember the 500-a-day limit.

## The first walk (for the developer)

Run these on the real VM, in order, after following this guide from an empty folder and writing down every place it was wrong or unclear (fix the guide for each). Record the result of each in `.planning/2026-11-20-deployment/progress.md`, with date, browser and device. A case is `done` only when its expected result was seen.

| Case | Do | Expect |
|---|---|---|
| C1 | The five `curl` lines from "Check it" from a phone off the tailnet; the dashboard from a tailnet laptop | Five `404`; the dashboard signs in on `:8443` |
| C2 | From a device off the tailnet, in Firefox and Chrome with the console open: sign up, verify, create a team, project and node, upload an image | Every step works; no Content-Security-Policy violation in the console |
| C3 | Upload a 150 MB MP4 from a device off the tailnet | It uploads and plays; note the time. Over 3 minutes or a failure means a follow-up (chunked or resumable upload; re-judge Cloudflare Tunnel) |
| C4 | One wrong sign-in from a phone on mobile data; read its `failure` entry in `security_events` | `ip` is the phone's public address, not `172.30.0.2` or a Tailscale address. If not: the known gap above |
| C5 | Sign up with a real address; ask for a reset typed with capitals (`Someone@Example.com`) | The verification mail arrives and its link says `Your email is verified. You can now create and join teams.`; the reset mail arrives and sets a password that then signs in (test-plan M10, M11) |
| C6 | Two laptops off the tailnet on one project; drop one laptop's network for 10 s while the other edits | The teammate's edit appears within a few seconds without a reload; edits made during the drop are saved (test-plan M12) |
| C7 | `deploy/backup-now.sh`; make a throwaway project; `deploy/restore.sh` with that backup | The throwaway project is gone, everything older is there, the dashboard signs in |
