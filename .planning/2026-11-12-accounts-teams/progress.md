# Progress: Accounts and teams

| Date | Checkpoint | Verification | Next Action |
|------|------------|--------------|-------------|
| 2026-11-12 | plan written | plan and roadmap committed; no code yet | Task 1: settings tables and security log |
| 2026-11-12 | Task 1, checkpoint 1A: settings tables with defaults | test:rules 19/19 (3 new files), test:container 5/5 (restart keeps edit), unit, lint, typecheck green | Checkpoint 1B: security log and retention |
| 2026-11-12 | Task 1, checkpoint 1B: security log with retention | npm test exit 0 (unit 33, container 5, rules 26, e2e 2); check:docs clean; purge probed in a throwaway container | Review of Task 1, then Task 2: per-user records |
| 2026-11-12 | Task 2, checkpoint 2A: per-user preferences, limits and status | npm test exit 0 (unit 36, container 5, rules 47, e2e 2); rule mutation check fails 5 tests; migration backfill probed | Review of Task 2, then Tasks 3 and 4 |
| 2026-11-12 | Task 3, checkpoint 3A: password rules | test:unit 44/44 (8 new password-rules tests, 198-entry common list checked), lint, typecheck green | Checkpoint 3B: sign-up, verification and the password paths |
| 2026-11-12 | Task 3, checkpoint 3B: sign-up, verification flag and password policy | npm test exit 0 (unit 44, container 5, rules 55, e2e 2); hook mutation fails 4 tests, purge mutations fail the new purge test; verification and reset probed in a throwaway container. Password reset has no automated test (token arrives by mail): covered by the manual check in Task 5's runbook walk (Step 7) | Review of Task 3, then Task 4 |
| 2026-11-12 | Task 3 review fix: keep emailVisibility private | 2 new rule tests failed first (stored true), then rules 57/57 and npm test green; each new hook line removed fails its own test | Re-review of Task 3 |
| 2026-11-12 | Task 4, checkpoint 4A: lockout decision | test:unit 54/54 (10 new lockout tests; RED was "cannot find module"), two mutations each fail 2 tests, lint, typecheck green | Checkpoint 4B: sign-in hooks (lockout, block, lockdown) |
| 2026-11-12 | Task 4, checkpoint 4B: sign-in lockout, block and lockdown | npm test exit 0 (unit 56, container 5, rules 68, e2e 2); 11 new sign-in rule tests failed first; 10 hook mutations each fail at least one test; ensureUserRecords race test failed first | Review of Task 4, then Task 5 (incident controls) |
| 2026-11-12 | Task 4 review fix: parallel-attempt gap documented | probe: 20 parallel wrong attempts gave 18 evaluated guesses, 2 with the built-in limiter on; check:docs clean | Re-review of Task 4 |
| 2026-11-12 | Tasks 1-4 | Reviewer passed each task (Task 3 and Task 4 after one fix round); statuses set to done; Tasks 5-10 not started | Task 5: incident controls and the runbook |
