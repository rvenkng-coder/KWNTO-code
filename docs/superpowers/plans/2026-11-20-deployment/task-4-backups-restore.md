# Task 4: Backups and a tested restore

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong
**Depends on:** Task 2

Design 7b and 10: backups run on a schedule to a destination the admin chooses. Security.md 7: "Test the restore, not just the backup." After the 30-day trash, a restore is the only way back, so it must work when the app is broken (D11), and bring back the database, the media files and the admin account (Review Focus 4).

**Files:**
- Create: `deploy/backup-now.sh`, `deploy/restore.sh`, `compose.backup-test.yaml`, `tests/container/backup.test.ts`
- Modify: `compose.prod.yaml` (bind `${KWNTO_BACKUP_DIR:-./backups}` at `/pb/pb_data/backups`), `docs/security.md` (section 7: built; section 9 control 8 "Restore from a backup", written in the runbook's form: When, Steps, Confirm, Undo), `docs/developer/testing.md` (the backup test)

**Interfaces:**
- Consumes: `compose.prod.yaml` (Task 1); the backup schedule written by the production migration (Task 2: `backups.cron` `0 2 * * *`, `cronMaxKeep` 7); `verifiedUser`, `edgeAdminToken` patterns (Task 1 helper; the backup test may reuse `tests/container/helpers/edge.ts` with its own base URLs).
- Produces, `deploy/backup-now.sh`: `PB=<private address> deploy/backup-now.sh` reads the admin email and password from standard input (two lines, as the runbook's token lines do, never as arguments), `POST $PB/api/backups` with body `{"name":"manual_<UTC yyyymmdd_hhmmss>.zip"}`, prints `Backup written: <name>` and exits 0; any non-2xx prints the server's message and exits 1.
- Produces, `deploy/restore.sh`: `deploy/restore.sh [--yes] <backup.zip>`. Env: `KWNTO_COMPOSE_FILES` (default `-f compose.prod.yaml`), `KWNTO_DATA_VOLUME` (default `kwnto-data`). Exit 2 with `No such backup: <path>` or `Not a zip file: <path>` before touching anything. Without `--yes` it asks `This replaces ALL data with <file>. Type RESTORE to continue:` and stops (exit 1, nothing changed) on any other answer. Then: `docker compose $KWNTO_COMPOSE_FILES stop pocketbase`; a throwaway container of `kwnto-pocketbase:dev` with the volume and the zip mounted empties `/pb/pb_data` and unzips into it, running as uid 10001; `docker compose ... start pocketbase`; waits for `/api/health` (60 s); prints `Restored from <file>`.
- Produces, `compose.backup-test.yaml` (with `-f compose.prod.yaml`): like the edge override but data in the named volume `kwnto-backup-test-data`, backups bound to a temporary folder given as `KWNTO_BACKUP_DIR`, PocketBase on `127.0.0.1:8095`, Caddy on `127.0.0.1:8094`.

**If interrupted:** `docker compose -f compose.prod.yaml -f compose.backup-test.yaml down -v` and `docker volume rm -f kwnto-backup-test-data`.

## Checkpoint 4A: Backup now

- [ ] **Step 1: Write the failing test** C1 in `tests/container/backup.test.ts` (`beforeAll` starts the backup-test stack on a fresh volume and temp folder; `afterAll` removes both).
- [ ] **Step 2: Run** `npx vitest run --project container tests/container/backup.test.ts`. Expected: FAIL.
- [ ] **Step 3: Write `backup-now.sh`** (POSIX `sh`, `set -eu`; token as in security.md 9, through `printf` and `--config -`, never in the process list) and the compose bind mount.
- [ ] **Step 4: Run** it. Expected: PASS. **Close checkpoint 4A** (commit `feat: on-demand backup to the host folder`).

## Checkpoint 4B: Restore

- [ ] **Step 5: Write the failing tests** C2 to C4.
- [ ] **Step 6: Run, expect FAIL.**
- [ ] **Step 7: Write `restore.sh`.**
- [ ] **Step 8: Run** `npm run test:container`. Expected: PASS. Run C2 three times in a row and record 3 of 3. Write control 8 in security.md (the steps are `deploy/restore.sh`, then the C2 checks by hand: sign in to the dashboard over the tailnet, open a project in the app). **Close checkpoint 4B** (commit `feat: tested restore from a backup`).

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | backup now | container | the stack with one project; `backup-now.sh` with the test admin on stdin; then with a wrong password | a `manual_*.zip` appears in the host folder and the script prints `Backup written: ...`; the wrong password exits 1 and writes no file; `ps` during the run never shows the password (the script is checked to pass it only through stdin) | tests/container/backup.test.ts :: an on-demand backup lands in the host folder |
| C2 | restore brings everything back | container | a verified owner with a team, project, node and an uploaded `PNG_1PX`; back up; then delete the team (admin) and change the admin password; `restore.sh --yes <zip>` | the script prints `Restored from ...`; the project and node read back; the media file downloads with the same 67 bytes; the admin signs in with the **old** password and not the new one; the app's `/` still loads through Caddy | tests/container/backup.test.ts :: a restore brings back data, media files and the admin account |
| C3 | refuses a missing or bad file | container | `restore.sh --yes /nope.zip`; a text file named `x.zip`; a real backup cut in half; a good backup with mode 0600 (the container's user cannot read it) | exit 2 with `No such backup: /nope.zip`, `Not a zip file: ...` and `Backup is damaged: ...` (the cut one); exit 1 with `Could not check the backup (docker or file permission problem, see the error above): ...` (the unreadable one, not called damaged); the stack still running and the data unchanged | tests/container/backup.test.ts :: restore refuses a missing or broken backup before touching data |
| C4 | asks before replacing | container | `restore.sh <zip>` with `no` on stdin | exit 1; the prompt text; the data unchanged | tests/container/backup.test.ts :: restore asks before replacing all data |
### Probes
**Probe folder:** none
### Breaks
none
### Flow
none (the developer walks a restore on the VM in Task 6)
### Evidence
The full output of `npm run check:task` and the three runs of C2.
