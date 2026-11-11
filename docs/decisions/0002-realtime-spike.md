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
