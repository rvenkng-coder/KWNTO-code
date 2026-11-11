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

## Options

Options for the developer, none tried yet:

1. **Server-side field merge.** A PocketBase hook that re-reads the record inside the write transaction and applies only the fields the request sent. Keeps the ERD; needs a test that A reaches 20 of 20, plus finding G's counter.
2. **Version counter with rejection.** Every write carries the version it was based on; the server rejects stale ones and the client re-applies its own field. Fits design 6.7 and finding G; costs a retry path in the client.
3. **Coarser records.** One record per independently edited attribute (for example separate `title` and `color` records). Removes the problem but multiplies records and rules.
4. **A different backend** with field-level writes.

Option 1 or 2 is the cheapest to test next: re-run A against it.

## Decision

**NO-GO.** Measurement A failed in both browsers (Chromium 7 of 20, Firefox 18 of 20, needed 20 of 20). The other thresholds passed. Plans 2 and later do not start until the developer decides what changes.
