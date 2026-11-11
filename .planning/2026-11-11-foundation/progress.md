# Progress: Foundation and Real-Time Spike

| Date | Checkpoint | Verification | Next Action |
|------|------------|--------------|-------------|
| 2026-11-11 | 1A | `npm ls --depth=0` exits 0; no node_modules in git status | Close 1A |
| 2026-11-11 | 1B | `typecheck` clean, `test:unit` 1 passed, `build` produces dist/ | Close 1B |
| 2026-11-11 | 1C | .env.example and 0001-toolchain.md exist; ADR lists all deps | Task 2: PocketBase container |
| 2026-11-11 | 2A | `vitest --project container` 2 passed (refuses without creds, non-root) | 2B: admin bootstrap migration |
| 2026-11-11 | 2B | `vitest --project container` 3 passed (restart keeps first password) | 2C: compose files and scripts |
| 2026-11-11 | 2C | compose.test up --wait healthy, /api/health 200, test:container 3 passed | 2D: docs/developer/backend.md |
| 2026-11-11 | 2D | docs/developer/backend.md names bcrypt cost 10 with source | Task 2 review, then Task 3 |
| 2026-11-11 | Task 2 | Developer review passed | Task 3: real-time spike |
| 2026-11-11 | 3A | spike compose healthy; seed printed `seeded 510 nodes and 5000 lines`; 510 nodes/5000 lines confirmed | 3B: spike.spec.ts measurements A, C, D |
| 2026-11-11 | 3B | `npm run spike:realtime` ran A, C, D in both browsers; C and D pass, **A FAILS** (chromium 4/20, firefox 16/20 rounds keep both edits; either field lost, so whole-record last-writer-wins) | 3C: add B, E, G; then 0002 decision file |
| 2026-11-11 | 3C | all six measurements ran in both browsers; numbers copied to 0002 (A fails, B/C/D pass, E real drop via proxy, G 0 of 50 equal) | 3D: Funnel README, complete 0002 with GO/NO-GO |
| 2026-11-11 | 3D | 0002 ends with NO-GO and states findings E and G; Funnel run pending developer | Developer decision on measurement A; Task 4 may continue |
| 2026-11-12 | 3D | Funnel run recorded in 0002 (laptop to VM via Funnel): B/C/D pass, A fails 18 of 20 | Developer decision on measurement A |
| 2026-11-12 | 3D | Option 2 (version guard) built in the spike: A2 100/100 both browsers x5 repeats, A 0 silent losses, `npm run spike:realtime` 16 passed; 0002 now ends GO with conditions | Developer confirms GO; Plan 2 may start; Tasks 4-8 continue |
| 2026-11-12 | Task 3 | Developer accepted GO with option 2 (version guard) | Task 4: lint guardrails (Plan 2 may start after the Plan 1 review) |
| 2026-11-12 | 4A | `npx eslint .` clean, `test:unit` 5 passed (any-test mutation-checked); TypeScript pinned ~6.0.3, oxlint replaced by ESLint 10 | 4B: PERF comment check |
| 2026-11-12 | 4B | `npm run lint` clean; `test:unit` 9 passed; CLI mode checked on a bad file (exit 1, file:line printed) | Task 4 review, then Task 5 (rule-test harness) or Task 6 |
| 2026-11-11 | 5A | test:unit 5 passed (4 coverage tests + 1 smoke) | 5B: with-pocketbase script |
| 2026-11-11 | 5B | with-pocketbase.ts, container.test.ts, global-setup.ts implemented | 5C: rule test helpers and tests |
| 2026-11-11 | 5C | pb helpers, users & coverage rules tests, package scripts, migration 1794355400 | 5D: docs/developer/testing.md |
