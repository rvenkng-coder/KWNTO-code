# Task 3: Real-time spike and go/no-go decision

Part of the [Foundation and Real-Time Spike plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong  
**Depends on:** Task 2

Throwaway code. It answers one question: does PocketBase real-time hold up for per-attribute editing on a large project, as the ERD assumes? Nothing here is imported by the app.

**Files:**
- Create: `spike/realtime/compose.yaml`, `spike/realtime/pb_migrations/1794355300_spike_collections.js`, `spike/realtime/seed.ts`, `spike/realtime/playwright.config.ts`, `spike/realtime/spike.spec.ts`, `spike/realtime/README.md`, `docs/decisions/0002-realtime-spike.md`
- Modify: `package.json` (script `spike:realtime`)

**Interfaces:**
- Consumes: image `kwnto-pocketbase:dev` and the superuser migration from Task 2.
- Produces: `docs/decisions/0002-realtime-spike.md` with a results table and a **GO** or **NO-GO** line. Plans 2 and later do not start until it says GO or the developer has decided what changes.

**If interrupted** (see the router, "Surviving interruptions"):
- The script starts with `docker compose -f spike/realtime/compose.yaml down -v`, so a container left by a killed run never blocks the next one. The spike data is throwaway; running everything again is always safe.
- Measured numbers live only in the gitignored `spike/realtime/results/` until Step 5b. If that folder is empty or stale, run the spike again; do not write numbers from memory.
- The Funnel run (Step 6) waits on the developer and never blocks closing 3D: write "pending developer run".

## Checkpoint 3A: Spike backend and seed data

- [x] **Step 1: Spike backend.** `spike/realtime/compose.yaml` runs the image on `127.0.0.1:8092:8090` with tmpfs data and both the Task 2 migration and the spike migration mounted. The spike migration creates two base collections, every rule `@request.auth.id != ""`:
  - `spike_nodes`: `project` (text), `title` (text), `color` (text), `x` (number), `y` (number), `updated` (autodate, on create and update).
  - `spike_lines`: `project` (text), `node` (relation to `spike_nodes`), `text` (text), `sort_order` (number), `updated` (autodate).
- [x] **Step 2: `seed.ts`** signs in as the superuser and creates three verified users (`spike1@example.test` to `spike3@example.test`), project `big` with **500 nodes and 5,000 lines** (10 per node), and project `other` with 10 nodes. Prints `seeded 510 nodes and 5000 lines` when done. Exports `seed(url: string): Promise<{ users: { email: string; password: string }[] }>`.
- [x] **Close checkpoint 3A.** Verify: start the spike compose with `--wait`, run `node spike/realtime/seed.ts`, and it prints `seeded 510 nodes and 5000 lines`; then `docker compose -f spike/realtime/compose.yaml down -v`. Commit: `spike: collections and seed data`.

## Checkpoint 3B: Quick measurements A, C, D

- [ ] **Step 3: `spike.spec.ts`.** Write measurements A, C and D in this checkpoint, and B, E and G in checkpoint 3C. Chromium and Firefox. Three browser contexts, each opening `${SPIKE_URL}/api/health` (default `http://127.0.0.1:8092`), loading the SDK with `page.addScriptTag({ path: 'node_modules/pocketbase/dist/pocketbase.umd.js' })`, signing in as a different user and subscribing to both collections with filter `project = "big"`. One test per measurement; each writes its numbers to `spike/realtime/results/<browser>.json`.

| # | Measurement | Method | Pass threshold (my call) |
|---|---|---|---|
| A | Per-attribute merge | 20 rounds: client 1 PATCHes only `title` and client 2 PATCHes only `color` of the same node at the same moment | Both values kept in 20 of 20 rounds |
| B | Fan-out latency and loss | Each of 3 clients sends 5 single-field PATCHes per second for 60 s with the send time in the payload; the other two record arrival | p95 under 500 ms; 0 lost events; 0 failed writes |
| C | Initial load | One client fetches all of project `big` (both collections, `getFullList`) | Under 3 s |
| D | Filter isolation | A superuser client edits project `other` 50 times | 0 events reach the `big` subscribers |
| E | Reconnect | Client 2 goes offline (`context.setOffline(true)`) for 10 s while client 1 makes 5 edits, then returns | Record only: how many of the 5 arrive after reconnect, and how long until new events flow again |
| G | `updated` resolution | 50 pairs of back-to-back PATCHes to one record | Record only: how many pairs share the same `updated` value |

- [ ] **Step 4: Script** `spike:realtime`: run `docker compose -f spike/realtime/compose.yaml down -v` first, start the spike compose with `--wait`, run `seed.ts`, run Playwright with `spike/realtime/playwright.config.ts`, then `docker compose down -v`.
- [ ] **Close checkpoint 3B.** Verify: `npm run spike:realtime` runs A, C and D in both browsers and writes two result files. A failing threshold is a finding, not a reason to stop: record it and go on. Commit: `spike: merge, load and filter measurements`.

## Checkpoint 3C: Slow measurements B, E, G

- [ ] **Step 5: Add measurements B, E and G** to `spike.spec.ts` (table above), then run `npm run spike:realtime`. Expected: all six measurements run in both browsers and both result files hold numbers for each.
- [ ] **Step 5b: Copy the numbers now** into a new `docs/decisions/0002-realtime-spike.md` as a bare results table. The result files are gitignored, so this commit is what keeps the numbers if the session ends.
- [ ] **Close checkpoint 3C.** Verify: the decision file holds a number for every measurement and browser. Commit: `spike: latency, reconnect and timestamp measurements with raw results`.

## Checkpoint 3D: Decision record

- [ ] **Step 6: Funnel run (developer does this; it touches the server).** Add to `spike/realtime/README.md` the exact steps to run the same spec against a PocketBase reachable through Tailscale Funnel: `SPIKE_URL=https://<funnel-host> npx playwright test -c spike/realtime/playwright.config.ts`. Design 7b requires this before real-time is relied on. Report to the developer that this run is waiting on them, and continue with Task 4.
- [ ] **Step 7: Complete `docs/decisions/0002-realtime-spike.md`** (started in Step 5b)**:** date, PocketBase and browser versions, the table above with measured numbers per browser, the Funnel numbers or "pending developer run", and:
  - **Finding E** stated as a requirement for Plan 4: whether the client must refetch the project after a reconnect.
  - **Finding G** stated as a requirement for Plan 4: whether `updated` alone is a safe version for conflict detection (design 6.7), or a counter field is needed.
  - **GO** if A to D pass in both browsers, otherwise **NO-GO** with the failing numbers.
- [ ] **Step 8: If NO-GO, stop and report** to the developer with the numbers and the options (for example batching writes, coarser records, a different backend). Tasks 4 to 8 do not depend on the result and may continue; Plan 2 may not start.
- [ ] **Close checkpoint 3D.** Verify: the decision file ends with a **GO** or **NO-GO** line and states findings E and G as requirements for Plan 4. Commit: `spike: real-time decision record`.
