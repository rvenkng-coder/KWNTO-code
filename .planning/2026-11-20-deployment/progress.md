# Deployment: progress

| Date | Task | Built by | What happened | Review | Escaped | Next |
|---|---|---|---|---|---|---|
| 2026-11-20 | Plan written | - | Router and 6 task files written on feat/deployment; check:plan ok; awaiting developer review of decisions D1 to D15 | - | - | developer reviews the plan |
| 2026-11-20 | Probes written | - | Controller probes for Tasks 2, 3, 5 (a7d2df2); subagent-driven run started | - | - | Task 1 |
| 2026-11-20 | Task 1, checkpoint 1A closed | strong | compose.prod.yaml, compose.edge-test.yaml, tailscale-serve.json, decision 0004 (three digests), entrypoint --publicDir (7aa473d); compose config ok; test:container 4 of 5 pass, with-pocketbase test blocked by another worktree's container holding 127.0.0.1:8091 | none | 0 | 1B |
| 2026-11-20 | Task 1, checkpoint 1B closed | strong | Caddyfile, edge helper, tests C1 to C5 (23 test cases); RED (no Caddyfile), GREEN, opened-block run failed 3 rows of C2 as required, restored | none | 0 | 1C |
| 2026-11-20 | Task 1, checkpoint 1C closed | strong | C6 added (24 test cases in edge.test.ts, all pass). Step 10 walk (C7), scripted with Playwright against http://127.0.0.1:8094, Chromium and Firefox, console and `securitypolicyviolation` listeners: sign up, team, project, node, upload PNG_1PX all completed; no Content-Security-Policy violation logged in either browser, no console error or warning (only React DevTools info and Firefox timeStamp noise); no D3 change needed | none | 0 | Task 2 |
