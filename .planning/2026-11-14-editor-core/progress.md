# Progress: Editor core

Plan: docs/superpowers/plans/2026-11-14-editor-core/README.md. Branch `feat/editor-core`, worktree `KWNTO-code-editor`.

| Date | Task | Built by | What happened | Review | Escaped | Next |
|---|---|---|---|---|---|---|
| 2026-11-14 | Plan written | - | Router and task files for Plan 3 | - | - | Task 1 |
| 2026-11-14 | Task 1, checkpoint 1A: hash routes | local | `routes.ts` and `routes.test.ts` built in a sandbox (ff52dc3); probes for C1 to C7 written by a strong model (19, in `tests/probes/2026-11-14-editor-core/task-1/`) found that extra segments after a chapter id were accepted (`parts.length >= 4`); fix round 1 added 2 tests (failed first) and changed it to `=== 4` (54f7a8a); patch applied with `git am --3way`; `check:task` all PASS except coverage rows C8 to C11 (checkpoints 1B and 1C) | none | 1 | Checkpoint 1B: tokens, shell and restyled screens |
| 2026-11-14 | Task 1, checkpoint 1B: tokens, shell, restyled screens | strong | e2e C9, C10 written first (C10 failed: no route in the URL; C9 already passed on the unstyled page, so it guards against a regression only); `index.css` tokens, `AppShell`, `TopBar`, `theme.ts`, `useRoute`, hash-route `App`, auth and teams screens restyled (class names only); `styling.md`; lint, typecheck and `npm run test:e2e` (30 tests, both browsers) pass | none | 0 | Checkpoint 1C: theme saved to the account |
