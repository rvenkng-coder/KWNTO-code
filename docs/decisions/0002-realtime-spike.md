# 0002: Real-time spike results

**Date:** 2026-11-11
**Environment:** PocketBase 0.40.6 (Docker, tmpfs data), `pocketbase` JS SDK 0.28.2, Playwright 1.65.0, Chromium 158.0.8127.18, Firefox 159.0. Local loopback, no proxy.

## Results

Raw numbers from `npm run spike:realtime` (one run; A varies between runs, see below).

| # | Measurement | Threshold | Chromium | Firefox |
|---|---|---|---|---|
| A | Rounds where both edits are kept (of 20) | 20 of 20 | **7** (7 title and 6 color edits lost) | **18** (2 title edits lost) |
| B | Events received / p50 / p95 / max latency | p95 < 500 ms | 1800 / 3 / 4 / 5 ms | 1800 / 5 / 7 / 12 ms |
| B | Lost events / failed writes | 0 / 0 | 0 / 0 | 0 / 0 |
| C | Initial load of 500 nodes and 5,000 lines | < 3 s | 70 ms | 222 ms |
| D | Events from project `other` reaching `big` subscribers | 0 | 0 (control edit arrived) | 0 (control edit arrived) |
| E | Of 5 edits made while offline, arrived after reconnect | record only | 0 | 0 |
| E | Time until new events flow again | record only | 263 ms | 275 ms |
| G | Pairs of back-to-back writes sharing one `updated` | record only | 0 of 50 | 0 of 50 |

Across four runs, A kept both edits in 4 to 7 of 20 rounds in Chromium and 16 to 18 of 20 in Firefox. It never reached 20.

## Funnel run (design 7b)

Run from the developer's laptop against a spike PocketBase on a VM, reached through Tailscale Funnel (`https://<host>.ts.net`). One run; steps in [spike/realtime/README.md](../../spike/realtime/README.md).

| # | Measurement | Threshold | Chromium | Firefox |
|---|---|---|---|---|
| A | Rounds where both edits are kept (of 20) | 20 of 20 | **18** (2 title edits lost) | **18** (2 title edits lost) |
| B | Events received / p50 / p95 / max latency | p95 < 500 ms | 1800 / 7 / 9 / 11 ms | 1800 / 9 / 34 / 173 ms |
| B | Lost events / failed writes | 0 / 0 | 0 / 0 | 0 / 0 |
| C | Initial load of 500 nodes and 5,000 lines | < 3 s | 167 ms | 301 ms |
| D | Events from project `other` reaching `big` subscribers | 0 | 0 (control edit arrived) | 0 (control edit arrived) |
| E | Reconnect | record only | not measured (needs an `http://` backend) | not measured |
| G | Pairs of back-to-back writes sharing one `updated` | record only | 0 of 50 | 0 of 50 |

The tunnel changes nothing about the verdict: real-time delivery through Funnel stayed fast (Firefox p95 34 ms, up from 7 ms on loopback), lost nothing and kept projects isolated. A fails here too. The reconnect behaviour (finding E) was measured locally only; the tunnel could behave differently, so Plan 4 should confirm it once against Funnel. The VM is a single hop on the same tailnet owner, so this is not a measurement from a distant network.

## What the numbers mean

- **A fails in both browsers.** When two clients PATCH different fields of the same record at the same moment, one edit is often lost (either field, so it is not a fixed bias). Chromium sends the two requests closer together than Firefox, hence the larger loss. This contradicts the ERD assumption that per-attribute editing merges. The likely cause is that an update loads the whole record and writes it back, so the later write carries the earlier value of the other field. That cause is **not verified**; the measurement shows only the effect.
- **B, C, D pass with wide margins.** Delivery is fast (p95 under 10 ms on loopback), nothing was lost, 500 nodes plus 5,000 lines load in under a quarter of a second, and the `project` filter isolated projects.
- **E** was measured with a real connection drop (a TCP proxy cut for 10 s). Playwright's `setOffline` does not close an open event stream, so it showed all 5 events arriving "while offline" and was discarded.

## Findings for Plan 4

- **Finding E (requirement):** events missed while a client is disconnected are **not replayed**: 0 of 5 arrived in both browsers. The SDK reconnects by itself and events flow again about 270 ms after the link returns. Plan 4 **must refetch the project (or everything changed since the last `updated` it saw) after every reconnect**, and must not assume the event stream is complete.
- **Finding G (requirement):** across 50 sequential pairs of writes, `updated` never repeated, so on loopback it separates writes made one after the other. That does not make it a safe version for conflict detection (design 6.7): the sequential test cannot show whether two concurrent writes can share a value, and A shows concurrent writes already lose edits silently. Plan 4 **must not use `updated` alone as the version**. It needs a counter field that the server increments and checks, so a stale write is rejected, or a field-level merge on the server.

## Options considered

Options put to the developer after the first result:

1. **Server-side field merge.** A PocketBase hook that re-reads the record inside the write transaction and applies only the fields the request sent. Keeps the ERD; needs a test that A reaches 20 of 20, plus finding G's counter.
2. **Version counter with rejection.** Every write carries the version it was based on; the server rejects stale ones and the client re-applies its own field. Fits design 6.7 and finding G; costs a retry path in the client.
3. **Coarser records.** One record per independently edited attribute (for example separate `title` and `color` records). Removes the problem but multiplies records and rules.
4. **A different backend** with field-level writes.

The developer chose **option 2** (version counter with rejection). Results are below.

## Follow-up: option 2, version counter with rejection

Date: 2026-11-12. Same environment as above. Code: `spike/realtime/pb_hooks/version.pb.js`, `pb_migrations/1794355400_spike_version.js`, `spike-version.spec.ts`.

**How it works.** `spike_nodes` gets a number field `version`. A client sends the `version` it last read together with the fields it changed. In one transaction the server runs `UPDATE ... SET version = version + 1 WHERE id = ? AND version = <sent>`; if no row matched, the save is refused with **409**. Otherwise it writes the changed fields onto the current record. The client's rule on 409: re-read the record, re-apply only its own field, send again.

| Check | Chromium | Firefox |
|---|---|---|
| A2: guarded concurrent edits of different fields keep both values (100 rounds) | 100 of 100 | 100 of 100 |
| A2: version rose by exactly 2 in every round | 100 of 100 | 100 of 100 |
| A2: conflict retries needed | 100 (one per round, the loser) | 100 |
| A (no version sent): accepted edits lost silently, 20 rounds | 0 | 0 |
| A (no version sent): losing writes refused with 409 | 19 | 18 |
| Write with an already used version is refused with 409 | yes | yes |
| B, C, D, E, G with the hook installed | same as the table above (B: 1800 events, 0 lost; p95 5 and 8 ms) | |

A2 and A were repeated 5 times in both browsers with values unique to each run: 30 of 30 passed.

**What it took to get here (the traps for Plans 3 and 4):**
1. A version check in the model hooks (`onRecordUpdate`, `onRecordUpdateExecute`) as a read followed by a write lost edits: 19 and 91 of 100 rounds kept both. Two saves read the same version before either wrote.
2. Making the check one SQL `UPDATE ... WHERE version = sent` inside those hooks still lost up to 3 of 20 accepted edits. Those hooks run **outside** the save transaction: a bump followed by a thrown error left the version bumped (probe: version 1, no data change). A second writer was then admitted on the new version before the first writer's data landed, and wrote a stale copy of the record.
3. What works is a hook on the update **request** that runs the bump and the write in one explicit transaction and writes the changed fields onto the freshly read record.

**Requirements for Plans 3 and 4:**
- Every collection whose records are edited concurrently (nodes, lines, connections, project settings) needs a `version` field and this guarded write. A plain PATCH without it must not be used for those collections.
- The client must handle 409 as normal flow, not as an error: re-read, re-apply the user's own field, retry. Bound the retries (the test used 20) and show a message if they run out.
- Writes queued while offline (Plan 4) carry the version they were based on; on replay a 409 means "someone changed it meanwhile" and follows the same retry rule, or the conflict dialog from design 6.7 if the same field was changed.
- The hook replaces the default save, so it must be checked in Task 5's rule tests: an unauthenticated or not-permitted update must still be refused, and responses must still respect field rules. The spike only tested signed-in users with the open spike rule.
- Not measured: the guard over Funnel (the Funnel run above was before the hook), and more than two simultaneous writers on one record.

## Decision

**GO, with option 2 as a required change.** Delivery, load and isolation passed in both browsers, locally and through Funnel. The original per-attribute merge failed (A), and the version-guarded write fixes it: no accepted edit is lost and no edit is rejected without a retry path (A2: 100 of 100, both browsers, repeated). Plans 2 and later may start on the condition that the version guard and the 409 retry rule above are part of Plans 3 and 4. The developer chose this option; if the guard cannot be kept on every concurrently edited collection, this decision goes back to **NO-GO**.

## Production check, Plan 3

Date: 2026-11-16. The real collections and hook of the editor core plan (`backend/pb_hooks/content-guard.pb.js`, PocketBase 0.40.6), local Docker, Chromium and Firefox. This closes the two points the spike left unmeasured inside the app (the guard over Funnel is still Plan 6's).

| Check | Result |
|---|---|
| More than two writers: four team members change `title`, `color`, `x` and `y` of one node at the same moment, each retrying on 409 as the client does, 10 rounds (`tests/rules/content-guard.rules.test.ts`, C1) | all four values kept in 10 of 10 rounds; version +4 every round |
| Break check: the guard turned into a plain whole-record update | C1 fails in round 1 |
| Break check: only the version check removed (fields still copied one by one onto a freshly read record) | C1 still passes, as Task 5 found: the version check is what protects a writer that copies whole records |
| Two browsers, one node: a title typed in one, a drag in the other, both sent on the same version; the drag's PATCH is held until the title has saved, so it always meets a 409 (`e2e/editor-live.spec.ts`, C2) | both kept on both pages and after a reload; 10 of 10 per browser |
| The 409 path seen by a person: every PATCH of a node answered 409 (C4) | 20 tries, then `Could not save: too many people are editing this at once. Try again.`; the title goes back; the teammate never sees the change; 10 of 10 per browser |

**Found on the way:** live **create** events of nodes never arrived. The start-node hook ran the node's insert inside a transaction of its own, and PocketBase then sends no realtime create event for that record. Fixed in `projects.pb.js` (insert first, start node in its own transaction after) and pinned by a rule test; the same pattern on teams and projects is carried to Plan 7 (roadmap, "Carried over from Plan 3"). Delivery of updates and deletes, measured by the spike, was not affected.

The decision stands: **GO with option 2**.

## Plan 4: reconnect and offline sync

Date: 2026-11-20. Offline queue, sync and conflicts of the offline sync plan (PocketBase JS SDK 0.28.2, PocketBase 0.40.6).

- **The reconnect signal (finding E, how it is met):** the SDK sends the topic `PB_CONNECT` to its subscribers every time the event stream connects, after it has resubmitted the subscriptions, including after an automatic reconnect (`dist/pocketbase.es.mjs`, the `PB_CONNECT` listener of `initConnect`). The door counts them (`onReconnect` of `backend.content.subscribe`; the first connect is not a reconnect, and a stream that was already open counts as connected), and the editor loads the project again and lays the waiting edits over it. When the browser reports offline the live subscriptions are closed, and when the engine is online again they are opened first and the project is loaded after, so a teammate's save cannot fall between the two.
- **The version is the counter (finding G):** an outbox entry keeps the `version` it was based on and the **values** of its fields before the edit. An edit made online that meets a 409 is retried silently as in Plan 3; only an edit made offline that meets a teammate's change to the same attribute asks the person (`Keep mine` or `Keep theirs`).
- **Found on the way (all fixed, each with a test):** a stopped backend behind a proxy answers 502, 503 or 504 (or a bare 500 from the dev proxy), which is "cannot be reached", not a refusal; a project loaded again can be older than a save of my own that landed meanwhile, so my saves made while a load is under way are laid over it; after coming back online the subscription is opened before the load; `Keep theirs` still sends the fields of the entry that did not conflict.
- **Funnel:** FUNNEL_RESULT

